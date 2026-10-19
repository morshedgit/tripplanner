import type { APIRoute } from 'astro';
import { getDb, getKvCache } from '../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../lib/http';
import { searchPlaces } from '../../../../services/placeService';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get('q') || url.searchParams.get('query');
    const city = url.searchParams.get('city') || undefined;

    if (!query || query.trim().length === 0) {
      return problemResponse({
        status: 400,
        code: 'MISSING_QUERY',
        title: 'Missing Search Query',
        detail: 'The query parameter "q" or "query" is required.',
      });
    }

    const db = await getDb(locals);
    const kv = getKvCache(locals);

    const places = await searchPlaces(db, query.trim(), city?.trim(), kv);

    return jsonResponse(places, 200);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      code: 'SEARCH_ERROR',
      title: 'Place Search Failed',
      detail: error.message || 'An unexpected error occurred while searching for places.',
    });
  }
};
