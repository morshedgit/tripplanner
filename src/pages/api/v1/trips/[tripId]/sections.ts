import type { APIRoute } from 'astro';
import { getDb } from '../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../lib/http';
import { createTripSection } from '../../../../../services/tripService';

export const prerender = false;

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
        detail: 'Section title is required',
        code: 'VALIDATION_ERROR',
      });
    }

    const db = await getDb(locals);

    // Verify trip exists
    const trip = await db.queryOne('SELECT id FROM trips WHERE id = ?', [tripId]);
    if (!trip) {
      return problemResponse({
        status: 404,
        title: 'Trip Not Found',
        detail: `Trip '${tripId}' was not found.`,
        code: 'TRIP_NOT_FOUND',
      });
    }

    // Verify day exists if day_id is provided
    if (body.day_id) {
      const day = await db.queryOne(
        'SELECT id FROM days WHERE id = ? AND trip_id = ?',
        [body.day_id, tripId]
      );
      if (!day) {
        return problemResponse({
          status: 404,
          title: 'Day Not Found',
          detail: `Day with id '${body.day_id}' does not belong to trip '${tripId}'.`,
          code: 'DAY_NOT_FOUND',
        });
      }
    }

    const section = await createTripSection(db, tripId, {
      day_id: body.day_id ?? null,
      title,
      section_type: body.section_type,
      sort_order: body.sort_order !== undefined ? Number(body.sort_order) : undefined,
    });

    return jsonResponse(section, 201);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to create section',
      code: 'CREATE_SECTION_ERROR',
    });
  }
};
