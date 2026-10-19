import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../../lib/http';
import { updateReservation, deleteReservation } from '../../../../../../services/reservationService';

export const prerender = false;

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const { tripId, reservationId } = params;
  if (!tripId || !reservationId) {
    return problemResponse({
      status: 400,
      title: 'Bad Request',
      detail: 'Both tripId and reservationId parameters are required',
      code: 'MISSING_PARAMETERS',
    });
  }

  const db = await getDb(locals);

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

  const updated = await updateReservation(db, tripId, reservationId, body);
  if (!updated) {
    return problemResponse({
      status: 404,
      title: 'Not Found',
      detail: `Reservation '${reservationId}' was not found on trip '${tripId}'`,
      code: 'RESERVATION_NOT_FOUND',
    });
  }

  return jsonResponse(updated);
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const { tripId, reservationId } = params;
  if (!tripId || !reservationId) {
    return problemResponse({
      status: 400,
      title: 'Bad Request',
      detail: 'Both tripId and reservationId parameters are required',
      code: 'MISSING_PARAMETERS',
    });
  }

  const db = await getDb(locals);
  const deleted = await deleteReservation(db, tripId, reservationId);

  if (!deleted) {
    return problemResponse({
      status: 404,
      title: 'Not Found',
      detail: `Reservation '${reservationId}' was not found on trip '${tripId}'`,
      code: 'RESERVATION_NOT_FOUND',
    });
  }

  return jsonResponse({
    success: true,
    deleted_reservation_id: reservationId,
  });
};
