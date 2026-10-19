import type { APIRoute } from 'astro';
import { getDb } from '../../../../../db/client';
import { jsonResponse, problemResponse, parseViewMode } from '../../../../../lib/http';
import { getTrip, updateTrip, deleteTrip } from '../../../../../services/tripService';

export const prerender = false;

export const GET: APIRoute = async ({ params, request, locals, url }) => {
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
    const view = parseViewMode(url || new URL(request.url));
    const trip = await getTrip(db, tripId, view);

    if (!trip) {
      return problemResponse({
        status: 404,
        title: 'Trip Not Found',
        detail: `Trip with ID '${tripId}' was not found.`,
        code: 'TRIP_NOT_FOUND',
        suggested_alternatives: ['List trips via GET /api/v1/trips to find valid IDs'],
      });
    }

    return jsonResponse(trip);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to retrieve trip',
      code: 'GET_TRIP_ERROR',
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

    const db = await getDb(locals);
    const updated = await updateTrip(db, tripId, body);

    if (!updated) {
      return problemResponse({
        status: 404,
        title: 'Trip Not Found',
        detail: `Cannot update non-existent trip '${tripId}'.`,
        code: 'TRIP_NOT_FOUND',
        suggested_alternatives: ['List trips via GET /api/v1/trips to verify existing trip IDs'],
      });
    }

    return jsonResponse(updated);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to update trip',
      code: 'UPDATE_TRIP_ERROR',
    });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
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
    const deleted = await deleteTrip(db, tripId);

    if (!deleted) {
      return problemResponse({
        status: 404,
        title: 'Trip Not Found',
        detail: `Cannot delete non-existent trip '${tripId}'.`,
        code: 'TRIP_NOT_FOUND',
      });
    }

    return jsonResponse({
      success: true,
      message: `Trip '${tripId}' and all associated itinerary items were successfully deleted.`,
    });
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to delete trip',
      code: 'DELETE_TRIP_ERROR',
    });
  }
};
