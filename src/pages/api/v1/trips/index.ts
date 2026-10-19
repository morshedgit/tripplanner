import type { APIRoute } from 'astro';
import { getDb } from '../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../lib/http';
import { listTrips, createTrip } from '../../../../services/tripService';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals, url }) => {
  try {
    const db = await getDb(locals);
    const searchUrl = url || new URL(request.url);
    const statusParam = searchUrl.searchParams.get('status')?.toLowerCase();
    const status = statusParam === 'upcoming' || statusParam === 'past' || statusParam === 'all'
      ? statusParam
      : 'all';

    const trips = await listTrips(db, status);
    return jsonResponse(trips);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to list trips',
      code: 'LIST_TRIPS_ERROR',
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const db = await getDb(locals);
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

    const title = body?.title?.trim();
    const destination = (body?.destination || body?.destination_city)?.trim();
    const startDate = body?.start_date?.trim();
    const endDate = body?.end_date?.trim();

    const errors: Record<string, string[]> = {};
    if (!title) errors.title = ['Trip title is required'];
    if (!destination) errors.destination = ['Trip destination is required'];
    if (!startDate) errors.start_date = ['start_date (YYYY-MM-DD) is required'];
    if (!endDate) errors.end_date = ['end_date (YYYY-MM-DD) is required'];
    if (startDate && endDate && startDate > endDate) {
      errors.end_date = ['end_date cannot be earlier than start_date'];
    }

    if (Object.keys(errors).length > 0) {
      return problemResponse({
        status: 400,
        title: 'Validation Error',
        detail: 'Trip creation failed due to missing or invalid input fields.',
        code: 'VALIDATION_ERROR',
        errors,
        suggested_alternatives: [
          'Provide valid ISO dates in YYYY-MM-DD format with start_date <= end_date',
        ],
      });
    }

    const trip = await createTrip(db, {
      title,
      destination,
      start_date: startDate,
      end_date: endDate,
      timezone: body.timezone,
      currency: body.currency,
      budget_cap: body.budget_cap !== undefined ? Number(body.budget_cap) : null,
      cover_image_url: body.cover_image_url,
      owner_name: body.owner_name,
      owner_email: body.owner_email,
      owner_avatar_url: body.owner_avatar_url,
    });

    return jsonResponse(trip, 201);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to create trip',
      code: 'CREATE_TRIP_ERROR',
    });
  }
};
