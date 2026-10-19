import type { APIRoute } from 'astro';
import { getDb } from '../../../db/client';
import { jsonResponse, problemResponse } from '../../../lib/http';
import {
  getSessionEventsSince,
  getSessionState,
  recordSessionMutation,
  type SessionActor,
} from '../../../services/sessionService';

export const prerender = false;

/**
 * GET /api/v1/events
 * Real-time event and state synchronization endpoint.
 *
 * Supported modes:
 * 1. SSE Stream: Triggered by `Accept: text/event-stream` or `?stream=true`.
 *    Streams initial session state and version snapshot using standard Server-Sent Events.
 * 2. JSON Polling (default): Accepts `?since_version=N&session_id=default&include_trip=true`.
 *    Returns `{ has_changes, current_version, session, events, active_trip }` allowing
 *    the browser UI and CLI to poll without hanging connections.
 */
export const GET: APIRoute = async ({ request, locals, url }) => {
  try {
    const parsedUrl = url || new URL(request.url);
    const sessionId = parsedUrl.searchParams.get('session_id') || 'default';
    const streamParam = parsedUrl.searchParams.get('stream');
    const acceptHeader = request.headers.get('accept') || '';
    const isSse = streamParam === 'true' || acceptHeader.includes('text/event-stream');

    const db = await getDb(locals);

    if (isSse) {
      const includeTrip = parsedUrl.searchParams.get('include_trip') !== 'false';
      const state = await getSessionState(db, sessionId, { includeTrip });

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(
            encoder.encode(`event: session_state\ndata: ${JSON.stringify(state)}\n\n`)
          );
          controller.enqueue(
            encoder.encode(
              `event: version\ndata: ${JSON.stringify({ version: state.session.state_version })}\n\n`
            )
          );
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        },
      });
    }

    // JSON Polling mode
    const sinceVersionStr = parsedUrl.searchParams.get('since_version');
    const sinceVersion = sinceVersionStr !== null ? parseInt(sinceVersionStr, 10) : 0;
    const includeTrip = parsedUrl.searchParams.get('include_trip') !== 'false';

    const delta = await getSessionEventsSince(
      db,
      isNaN(sinceVersion) ? 0 : sinceVersion,
      sessionId,
      { includeTrip }
    );

    return jsonResponse({
      has_changes: delta.has_changes,
      current_version: delta.current_version,
      session: delta.session,
      events: delta.events,
      active_trip: delta.trip_data ?? delta.active_trip ?? null,
    });
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Events Sync Error',
      detail: error.message || 'Failed to retrieve session events',
      code: 'EVENTS_SYNC_ERROR',
    });
  }
};

/**
 * POST /api/v1/events
 * Records a session mutation event directly (from agy CLI, chat assistant, or UI).
 */
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return problemResponse({
        status: 400,
        title: 'Bad Request',
        detail: 'Request body must be valid JSON',
        code: 'INVALID_JSON',
      });
    }

    if (!body || typeof body !== 'object' || !body.action) {
      return problemResponse({
        status: 400,
        title: 'Bad Request',
        detail: 'The "action" property is required in request body',
        code: 'MISSING_ACTION',
      });
    }

    const db = await getDb(locals);
    const sessionId = body.session_id || 'default';
    const actor: SessionActor = (body.actor as SessionActor) || 'agy';
    const action = String(body.action);
    const summary = body.summary || body.event_summary || action;

    const dayNumber =
      body.active_day_number !== undefined ? body.active_day_number : body.day_number;
    const tab = body.active_tab !== undefined ? body.active_tab : body.tab;
    const stopId =
      body.selected_stop_id !== undefined ? body.selected_stop_id : body.stop_id;

    const result = await recordSessionMutation(db, {
      session_id: sessionId,
      trip_id: body.trip_id,
      actor,
      action,
      summary,
      active_day_number: dayNumber !== undefined && dayNumber !== null ? Number(dayNumber) : undefined,
      active_tab: tab !== undefined ? String(tab) : undefined,
      selected_stop_id: stopId !== undefined ? stopId : undefined,
      payload: body.payload || {},
    });

    return jsonResponse(result, 201);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Record Mutation Error',
      detail: error.message || 'Failed to record session mutation',
      code: 'RECORD_MUTATION_ERROR',
    });
  }
};
