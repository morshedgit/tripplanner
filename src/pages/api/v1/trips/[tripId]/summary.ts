import type { APIRoute } from 'astro';
import { getDb } from '../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../lib/http';
import { getTripSummary } from '../../../../../services/tripService';

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
    const summary = await getTripSummary(db, tripId);

    if (!summary) {
      return problemResponse({
        status: 404,
        title: 'Trip Not Found',
        detail: `Trip with ID '${tripId}' was not found.`,
        code: 'TRIP_NOT_FOUND',
        suggested_alternatives: ['List trips via GET /api/v1/trips to find existing trip IDs'],
      });
    }

    return jsonResponse(summary);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to retrieve trip summary',
      code: 'GET_TRIP_SUMMARY_ERROR',
    });
  }
};
