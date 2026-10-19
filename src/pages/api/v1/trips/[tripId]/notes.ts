import type { APIRoute } from 'astro';
import { getDb } from '../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../lib/http';
import {
  listTripNotes,
  upsertTripNote,
  deleteTripNote,
} from '../../../../../services/checklistService';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { tripId } = params;
    if (!tripId) {
      return problemResponse({
        status: 400,
        title: 'Bad Request',
        detail: 'tripId URL parameter is required',
        code: 'MISSING_TRIP_ID',
      });
    }

    const db = await getDb(locals);
    const trip = await db.queryOne('SELECT id FROM trips WHERE id = ?', [tripId]);
    if (!trip) {
      return problemResponse({
        status: 404,
        title: 'Trip Not Found',
        detail: `Trip '${tripId}' was not found.`,
        code: 'TRIP_NOT_FOUND',
      });
    }

    const notes = await listTripNotes(db, tripId);
    return jsonResponse(notes);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to list trip notes',
      code: 'LIST_NOTES_ERROR',
    });
  }
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const { tripId } = params;
    if (!tripId) {
      return problemResponse({
        status: 400,
        title: 'Bad Request',
        detail: 'tripId URL parameter is required',
        code: 'MISSING_TRIP_ID',
      });
    }

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

    const db = await getDb(locals);
    const trip = await db.queryOne('SELECT id FROM trips WHERE id = ?', [tripId]);
    if (!trip) {
      return problemResponse({
        status: 404,
        title: 'Trip Not Found',
        detail: `Trip '${tripId}' was not found.`,
        code: 'TRIP_NOT_FOUND',
      });
    }

    const isNew = !body.id;
    const note = await upsertTripNote(db, tripId, {
      id: body.id,
      title: body.title,
      content_markdown: body.content_markdown,
      content: body.content,
      updated_by_collaborator_id: body.updated_by_collaborator_id,
    });

    return jsonResponse(note, isNew ? 201 : 200);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to upsert trip note',
      code: 'UPSERT_NOTE_ERROR',
    });
  }
};

export const DELETE: APIRoute = async ({ params, request, locals, url }) => {
  try {
    const { tripId } = params;
    if (!tripId) {
      return problemResponse({
        status: 400,
        title: 'Bad Request',
        detail: 'tripId URL parameter is required',
        code: 'MISSING_TRIP_ID',
      });
    }

    const searchUrl = url || new URL(request.url);
    let noteId = searchUrl.searchParams.get('note_id') || searchUrl.searchParams.get('id');

    if (!noteId) {
      try {
        const body: any = await request.json();
        noteId = body?.note_id || body?.id;
      } catch {
        // Body was optional if query param was present
      }
    }

    if (!noteId) {
      return problemResponse({
        status: 400,
        title: 'Bad Request',
        detail: 'note_id parameter is required either as query parameter or in request body',
        code: 'MISSING_NOTE_ID',
      });
    }

    const db = await getDb(locals);
    const deleted = await deleteTripNote(db, tripId, noteId);

    if (!deleted) {
      return problemResponse({
        status: 404,
        title: 'Note Not Found',
        detail: `Note '${noteId}' was not found in trip '${tripId}'.`,
        code: 'NOTE_NOT_FOUND',
      });
    }

    return jsonResponse({
      success: true,
      message: `Note '${noteId}' was successfully deleted.`,
    });
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to delete note',
      code: 'DELETE_NOTE_ERROR',
    });
  }
};
