import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../db/client';
import { problemResponse } from '../../../../../../lib/http';
import { exportExpensesCsv } from '../../../../../../services/exportService';

export const GET: APIRoute = async ({ params, locals }) => {
  const { tripId } = params;

  if (!tripId) {
    return problemResponse({
      status: 400,
      title: 'Bad Request',
      detail: 'Trip ID parameter is required.',
      code: 'INVALID_PARAMETERS',
    });
  }

  try {
    const db = await getDb(locals);
    const csv = await exportExpensesCsv(db, tripId);

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${tripId}-expenses.csv"`,
      },
    });
  } catch (err: any) {
    if (err?.message?.includes('Trip not found')) {
      return problemResponse({
        status: 404,
        title: 'Trip Not Found',
        detail: err.message,
        code: 'TRIP_NOT_FOUND',
        suggested_alternatives: [
          'Verify the tripId matches an existing trip.',
          'Call GET /api/v1/trips to list available trips.',
        ],
      });
    }

    return problemResponse({
      status: 500,
      title: 'Export Failed',
      detail: err?.message || 'An error occurred while exporting trip expenses CSV.',
      code: 'EXPORT_ERROR',
    });
  }
};
