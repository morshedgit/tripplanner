import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../db/client';
import { problemResponse } from '../../../../../../lib/http';
import { exportTripMarkdown } from '../../../../../../services/exportService';

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
    const markdown = await exportTripMarkdown(db, tripId);

    return new Response(markdown, {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${tripId}-itinerary.md"`,
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
      detail: err?.message || 'An error occurred while exporting trip markdown.',
      code: 'EXPORT_ERROR',
    });
  }
};
