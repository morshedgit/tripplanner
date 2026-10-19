import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../../lib/http';
import { addTripStop } from '../../../../../../services/stopService';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals }) => {
  const tripId = params.tripId;
  if (!tripId) {
    return problemResponse({
      status: 400,
      code: 'MISSING_TRIP_ID',
      title: 'Missing Trip ID',
      detail: 'Trip ID parameter is required in URL.',
    });
  }

  try {
    const body = (await request.json()) as any;
    const db = await getDb(locals);

    // Verify trip exists
    const trip = await db.queryOne('SELECT id FROM trips WHERE id = ?', [tripId]);
    if (!trip) {
      return problemResponse({
        status: 404,
        code: 'TRIP_NOT_FOUND',
        title: 'Trip Not Found',
        detail: `Trip with ID "${tripId}" does not exist.`,
      });
    }

    const result = await addTripStop(db, tripId, body);
    return jsonResponse(result, 201);
  } catch (error: any) {
    return problemResponse({
      status: 400,
      code: 'ADD_STOP_FAILED',
      title: 'Failed to Add Stop',
      detail: error.message || 'An error occurred while adding the stop to the itinerary.',
    });
  }
};
