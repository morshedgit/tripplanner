import type { APIRoute } from 'astro';
import { getDb } from '../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../lib/http';
import {
  listChecklists,
  addChecklistItem,
  toggleChecklistItem,
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

    const checklists = await listChecklists(db, tripId);
    return jsonResponse(checklists);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to list checklists',
      code: 'LIST_CHECKLISTS_ERROR',
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

    const title = body?.title?.trim();
    if (!title) {
      return problemResponse({
        status: 400,
        title: 'Validation Error',
        detail: 'Checklist item title is required',
        code: 'VALIDATION_ERROR',
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

    const item = await addChecklistItem(db, tripId, {
      checklist_category: body.checklist_category,
      checklist_id: body.checklist_id,
      title,
      assigned_to_name: body.assigned_to_name,
      assigned_to_collaborator_id: body.assigned_to_collaborator_id,
      due_date: body.due_date,
      sort_order: body.sort_order !== undefined ? Number(body.sort_order) : undefined,
    });

    return jsonResponse(item, 201);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to add checklist item',
      code: 'ADD_CHECKLIST_ITEM_ERROR',
    });
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
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

    const itemId = (body?.item_id || body?.id)?.trim();
    if (!itemId) {
      return problemResponse({
        status: 400,
        title: 'Validation Error',
        detail: 'item_id is required to update checklist item',
        code: 'VALIDATION_ERROR',
      });
    }

    const db = await getDb(locals);
    const isCompleted = body.is_completed !== undefined ? Boolean(body.is_completed) : undefined;
    const updated = await toggleChecklistItem(db, tripId, itemId, isCompleted);

    if (!updated) {
      return problemResponse({
        status: 404,
        title: 'Checklist Item Not Found',
        detail: `Checklist item '${itemId}' was not found in trip '${tripId}'.`,
        code: 'CHECKLIST_ITEM_NOT_FOUND',
      });
    }

    return jsonResponse(updated);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to toggle checklist item',
      code: 'TOGGLE_CHECKLIST_ITEM_ERROR',
    });
  }
};
