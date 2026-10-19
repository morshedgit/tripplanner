import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../../lib/http';
import { getBudgetSettlement } from '../../../../../../services/expenseService';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const tripId = params.tripId;
  if (!tripId) {
    return problemResponse({
      status: 400,
      title: 'Bad Request',
      detail: 'Missing required tripId parameter',
      code: 'MISSING_TRIP_ID',
    });
  }

  const db = await getDb(locals);
  const trip = await db.queryOne('SELECT id FROM trips WHERE id = ?', [tripId]);
  if (!trip) {
    return problemResponse({
      status: 404,
      title: 'Not Found',
      detail: `Trip with ID '${tripId}' was not found`,
      code: 'TRIP_NOT_FOUND',
    });
  }

  try {
    const settlement = await getBudgetSettlement(db, tripId);
    return jsonResponse(settlement);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to calculate budget settlement',
      code: 'SETTLEMENT_ERROR',
    });
  }
};
