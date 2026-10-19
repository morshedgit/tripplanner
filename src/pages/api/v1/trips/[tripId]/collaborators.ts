import type { APIRoute } from 'astro';
import { getDb } from '../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../lib/http';
import { listCollaborators, addCollaborator } from '../../../../../services/tripService';

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

    const collaborators = await listCollaborators(db, tripId);
    return jsonResponse(collaborators);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to list collaborators',
      code: 'LIST_COLLABORATORS_ERROR',
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

    const name = body?.name?.trim();
    const email = body?.email?.trim();

    if (!name || !email) {
      return problemResponse({
        status: 400,
        title: 'Validation Error',
        detail: 'Collaborator name and email are required',
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

    const role = body?.role || 'editor';
    if (!['owner', 'editor', 'viewer'].includes(role)) {
      return problemResponse({
        status: 400,
        title: 'Validation Error',
        detail: "Role must be 'owner', 'editor', or 'viewer'",
        code: 'INVALID_ROLE',
      });
    }

    const collaborator = await addCollaborator(db, tripId, {
      name,
      email,
      avatar_url: body.avatar_url ?? null,
      role,
    });

    return jsonResponse(collaborator, 201);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to add collaborator',
      code: 'ADD_COLLABORATOR_ERROR',
    });
  }
};
