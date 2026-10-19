import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../../../lib/http';
import { moveTripStop } from '../../../../../../../services/stopService';

export const prerender = false;

export const POST: APIRoute = async ({ request, params, locals }) => {
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
    if (!body || !body.target_section_id) {
      return problemResponse({
        status: 400,
        code: 'MISSING_TARGET_SECTION',
        title: 'Missing Target Section ID',
        detail: 'The field "target_section_id" is required in request body.',
      });
    }

    const db = await getDb(locals);
    const result = await moveTripStop(db, tripId, stopId, {
      target_section_id: body.target_section_id,
      target_index: body.target_index,
    });

    return jsonResponse(result, 200);
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    return problemResponse({
      status,
      code: 'MOVE_STOP_FAILED',
      title: 'Failed to Move Stop',
      detail: error.message || 'An error occurred while moving the stop.',
    });
  }
};
