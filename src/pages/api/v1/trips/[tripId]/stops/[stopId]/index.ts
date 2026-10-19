import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../../../lib/http';
import { updateTripStop, deleteTripStop } from '../../../../../../../services/stopService';

export const prerender = false;

export const PATCH: APIRoute = async ({ request, params, locals }) => {
  const { tripId, stopId } = params;

  if (!tripId || !stopId) {
    return problemResponse({
      status: 400,
      code: 'MISSING_PARAMETERS',
      title: 'Missing Required Parameters',
      detail: 'Both tripId and stopId are required in the URL.',
    });
  }

  try {
    const body = (await request.json()) as any;
    const db = await getDb(locals);

    const updated = await updateTripStop(db, tripId, stopId, body);
    return jsonResponse(updated, 200);
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    return problemResponse({
      status,
      code: 'UPDATE_STOP_FAILED',
      title: 'Failed to Update Stop',
      detail: error.message || 'An error occurred while updating the stop.',
    });
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const { tripId, stopId } = params;

  if (!tripId || !stopId) {
    return problemResponse({
      status: 400,
      code: 'MISSING_PARAMETERS',
      title: 'Missing Required Parameters',
      detail: 'Both tripId and stopId are required in the URL.',
    });
  }

  try {
    const db = await getDb(locals);
    const result = await deleteTripStop(db, tripId, stopId);
    return jsonResponse(result, 200);
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 500;
    return problemResponse({
      status,
      code: 'DELETE_STOP_FAILED',
      title: 'Failed to Delete Stop',
      detail: error.message || 'An error occurred while deleting the stop.',
    });
  }
};
