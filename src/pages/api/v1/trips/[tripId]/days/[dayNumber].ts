import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../../lib/http';
import { getTripDay, updateTripDay } from '../../../../../../services/tripService';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const { tripId, dayNumber } = params;
    if (!tripId || !dayNumber) {
      return problemResponse({
        status: 400,
        title: 'Bad Request',
        detail: 'tripId and dayNumber URL parameters are required',
        code: 'MISSING_PARAMETERS',
      });
    }

    const dayNum = parseInt(dayNumber, 10);
    if (isNaN(dayNum) || dayNum <= 0) {
      return problemResponse({
        status: 400,
        title: 'Bad Request',
        detail: 'dayNumber must be a positive 1-indexed integer',
        code: 'INVALID_DAY_NUMBER',
      });
    }

    const db = await getDb(locals);
    const daySchedule = await getTripDay(db, tripId, dayNum);

    if (!daySchedule) {
      return problemResponse({
        status: 404,
        title: 'Day Not Found',
        detail: `Day ${dayNum} for trip '${tripId}' was not found.`,
        code: 'DAY_NOT_FOUND',
        suggested_alternatives: [`Inspect full itinerary via GET /api/v1/trips/${tripId}`],
      });
    }

    return jsonResponse(daySchedule);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to retrieve day schedule',
      code: 'GET_DAY_ERROR',
    });
  }
};

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  try {
    const { tripId, dayNumber } = params;
    if (!tripId || !dayNumber) {
      return problemResponse({
        status: 400,
        title: 'Bad Request',
        detail: 'tripId and dayNumber URL parameters are required',
        code: 'MISSING_PARAMETERS',
      });
    }

    const dayNum = parseInt(dayNumber, 10);
    if (isNaN(dayNum) || dayNum <= 0) {
      return problemResponse({
        status: 400,
        title: 'Bad Request',
        detail: 'dayNumber must be a positive 1-indexed integer',
        code: 'INVALID_DAY_NUMBER',
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
    const updated = await updateTripDay(db, tripId, dayNum, body);

    if (!updated) {
      return problemResponse({
        status: 404,
        title: 'Day Not Found',
        detail: `Cannot update non-existent Day ${dayNum} for trip '${tripId}'.`,
        code: 'DAY_NOT_FOUND',
      });
    }

    return jsonResponse(updated);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to update day',
      code: 'UPDATE_DAY_ERROR',
    });
  }
};
