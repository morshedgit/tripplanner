import type { APIRoute } from 'astro';
import { getDb } from '../../../db/client';
import { jsonResponse, problemResponse } from '../../../lib/http';
import {
  getSessionState,
  updateSessionState,
  type SessionActor,
  type UpdateSessionStatePatch,
} from '../../../services/sessionService';

export const prerender = false;

/**
 * GET /api/v1/session
 * Retrieves the synchronized session state for a given session_id.
 * Query parameters:
 * - session_id (string, optional, default: 'default')
 * - include_trip (boolean, optional, default: true)
 */
export const GET: APIRoute = async ({ request, locals, url }) => {
  try {
    const parsedUrl = url || new URL(request.url);
    const sessionId = parsedUrl.searchParams.get('session_id') || 'default';
    const includeTripParam = parsedUrl.searchParams.get('include_trip');
    const includeTrip = includeTripParam !== 'false';

    const db = await getDb(locals);
    const state = await getSessionState(db, sessionId, { includeTrip });

    return jsonResponse(state);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Session Retrieve Error',
      detail: error.message || 'Failed to retrieve session state',
      code: 'SESSION_GET_ERROR',
    });
  }
};

/**
 * Common handler for mutating session state via POST, PUT, or PATCH.
 * Supports standard patch fields and UI quick-mutations (ui_action: select_trip | select_day | select_tab | select_stop).
 */
const handleSessionUpdate: APIRoute = async ({ request, locals }) => {
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

    if (!body || typeof body !== 'object') {
      return problemResponse({
        status: 400,
        title: 'Bad Request',
        detail: 'Request body must be an object',
        code: 'INVALID_BODY',
      });
    }

    const db = await getDb(locals);
    const sessionId = body.session_id || 'default';

    const patch: UpdateSessionStatePatch = {
      session_id: sessionId,
    };

    // 1. Process UI Quick Mutations
    if (body.ui_action) {
      patch.actor = (body.actor as SessionActor) || 'ui';
      patch.action = String(body.ui_action);

      switch (body.ui_action) {
        case 'select_trip': {
          const tripId = body.trip_id || body.active_trip_id;
          patch.active_trip_id = tripId;
          patch.selected_stop_id = null;
          patch.event_summary = body.summary || `Switched active trip to ${tripId}`;
          break;
        }
        case 'select_day': {
          const dayNumber =
            body.day_number !== undefined ? body.day_number : body.active_day_number;
          patch.active_day_number = dayNumber !== undefined && dayNumber !== null ? Number(dayNumber) : null;
          patch.active_tab = 'itinerary';
          patch.event_summary = body.summary || `Selected Day ${dayNumber}`;
          break;
        }
        case 'select_tab': {
          const tab = body.tab || body.active_tab;
          patch.active_tab = String(tab);
          patch.event_summary = body.summary || `Switched to tab: ${tab}`;
          break;
        }
        case 'select_stop': {
          const stopId =
            body.stop_id !== undefined ? body.stop_id : body.selected_stop_id;
          patch.selected_stop_id = stopId || null;
          patch.event_summary = body.summary || `Selected stop ${stopId}`;
          break;
        }
        default: {
          patch.event_summary =
            body.summary || body.event_summary || `Performed action: ${body.ui_action}`;
          break;
        }
      }
    }

    // 2. Merge explicit properties if present
    if (body.active_trip_id !== undefined) {
      patch.active_trip_id = body.active_trip_id;
    } else if (body.trip_id !== undefined && !patch.active_trip_id) {
      patch.active_trip_id = body.trip_id;
    }

    if (body.active_day_number !== undefined) {
      patch.active_day_number =
        body.active_day_number !== null ? Number(body.active_day_number) : null;
    } else if (body.day_number !== undefined && patch.active_day_number === undefined) {
      patch.active_day_number =
        body.day_number !== null ? Number(body.day_number) : null;
    }

    if (body.active_tab !== undefined) {
      patch.active_tab = String(body.active_tab);
    } else if (body.tab !== undefined && !patch.active_tab) {
      patch.active_tab = String(body.tab);
    }

    if (body.selected_stop_id !== undefined) {
      patch.selected_stop_id = body.selected_stop_id;
    } else if (body.stop_id !== undefined && patch.selected_stop_id === undefined) {
      patch.selected_stop_id = body.stop_id;
    }

    if (body.actor !== undefined) {
      patch.actor = body.actor as SessionActor;
    }

    if (body.event_summary !== undefined) {
      patch.event_summary = body.event_summary;
    } else if (body.summary !== undefined && !patch.event_summary) {
      patch.event_summary = body.summary;
    }

    if (body.action !== undefined) {
      patch.action = body.action;
    }

    if (body.ui_context !== undefined && typeof body.ui_context === 'object') {
      patch.ui_context = body.ui_context;
    }

    const updated = await updateSessionState(db, patch);
    return jsonResponse(updated);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Session Update Error',
      detail: error.message || 'Failed to update session state',
      code: 'SESSION_UPDATE_ERROR',
    });
  }
};

export const POST: APIRoute = handleSessionUpdate;
export const PUT: APIRoute = handleSessionUpdate;
export const PATCH: APIRoute = handleSessionUpdate;
