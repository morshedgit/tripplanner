import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../../../lib/http';
import { voteOnStop } from '../../../../../../../services/stopService';

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
    if (body.vote === undefined) {
      return problemResponse({
        status: 400,
        code: 'MISSING_VOTE',
        title: 'Missing Vote',
        detail: 'The field "vote" (1, -1, "up", or "down") is required.',
      });
    }

    const db = await getDb(locals);
    const result = await voteOnStop(db, tripId, stopId, {
      collaborator_id: body.collaborator_id,
      collaborator_name: body.collaborator_name,
      vote: body.vote,
      comment: body.comment,
    });

    return jsonResponse(result, 200);
  } catch (error: any) {
    const status = error.message?.includes('not found') ? 404 : 400;
    return problemResponse({
      status,
      code: 'VOTE_FAILED',
      title: 'Voting Failed',
      detail: error.message || 'An error occurred while voting on the stop.',
    });
  }
};
