import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../../../lib/http';
import { optimizeDayRoute } from '../../../../../../../services/routingService';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals }) => {
  const { tripId, dayNumber } = params;

  if (!tripId || !dayNumber) {
    return problemResponse({
      status: 400,
      code: 'MISSING_PARAMETERS',
      title: 'Missing Required Parameters',
      detail: 'Both tripId and dayNumber are required in the URL.',
    });
  }

  const dayNum = parseInt(dayNumber, 10);
  if (isNaN(dayNum) || dayNum < 1) {
    return problemResponse({
      status: 400,
      code: 'INVALID_DAY_NUMBER',
      title: 'Invalid Day Number',
      detail: 'dayNumber must be a positive integer.',
    });
  }

  try {
    let options: any = {};
    if (request.headers.get('content-type')?.includes('application/json')) {
      try {
        options = await request.json();
      } catch {
        options = {};
      }
    }

    const db = await getDb(locals);
    const result = await optimizeDayRoute(db, tripId, dayNum, options);

    return jsonResponse(result, 200);
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    return problemResponse({
      status,
      code: 'OPTIMIZE_ROUTE_FAILED',
      title: 'Route Optimization Failed',
      detail: error.message || 'An error occurred while optimizing the day route.',
    });
  }
};
