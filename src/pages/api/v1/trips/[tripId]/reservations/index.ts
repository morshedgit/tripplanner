import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../../lib/http';
import { listReservations, createReservation } from '../../../../../../services/reservationService';

export const prerender = false;

export const GET: APIRoute = async ({ params, url, locals }) => {
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

  const typeParam = url.searchParams.get('type') || undefined;
  const reservations = await listReservations(db, tripId, typeParam);
  return jsonResponse(reservations);
};

export const POST: APIRoute = async ({ params, request, locals }) => {
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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return problemResponse({
      status: 400,
      title: 'Bad Request',
      detail: 'Invalid JSON request payload',
      code: 'INVALID_JSON',
    });
  }

  if (!body || !body.title || !body.type) {
    return problemResponse({
      status: 400,
      title: 'Validation Error',
      detail: 'Fields "title" and "type" are required',
      code: 'VALIDATION_ERROR',
      errors: {
        title: !body?.title ? ['Title is required'] : [],
        type: !body?.type ? ['Type is required'] : [],
      },
    });
  }

  try {
    const reservation = await createReservation(db, tripId, body);
    return jsonResponse(reservation, 201);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to create reservation',
      code: 'RESERVATION_CREATE_ERROR',
    });
  }
};
