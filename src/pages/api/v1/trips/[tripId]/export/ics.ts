import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../db/client';
import { problemResponse } from '../../../../../../lib/http';
import { exportTripIcs } from '../../../../../../services/exportService';

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
    const ics = await exportTripIcs(db, tripId);

    return new Response(ics, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${tripId}-calendar.ics"`,
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
      detail: err?.message || 'An error occurred while exporting trip iCalendar feed.',
      code: 'EXPORT_ERROR',
    });
  }
};
