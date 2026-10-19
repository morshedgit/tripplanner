import type { APIRoute } from 'astro';
import { getDb } from '../../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../../lib/http';
import { listExpenses, createExpense, deleteExpense } from '../../../../../../services/expenseService';

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

  const expenses = await listExpenses(db, tripId);
  return jsonResponse(expenses);
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

  if (!body || !body.title || typeof body.amount !== 'number') {
    return problemResponse({
      status: 400,
      title: 'Validation Error',
      detail: 'Fields "title" and numeric "amount" are required',
      code: 'VALIDATION_ERROR',
      errors: {
        title: !body?.title ? ['Title is required'] : [],
        amount: typeof body?.amount !== 'number' ? ['Amount is required and must be a number'] : [],
      },
    });
  }

  try {
    const expense = await createExpense(db, tripId, body);
    return jsonResponse(expense, 201);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Internal Server Error',
      detail: error.message || 'Failed to create expense',
      code: 'EXPENSE_CREATE_ERROR',
    });
  }
};

export const DELETE: APIRoute = async ({ params, request, url, locals }) => {
  const tripId = params.tripId;
  if (!tripId) {
    return problemResponse({
      status: 400,
      title: 'Bad Request',
      detail: 'Missing required tripId parameter',
      code: 'MISSING_TRIP_ID',
    });
  }

  let expenseId = url.searchParams.get('expenseId') || url.searchParams.get('id');

  if (!expenseId) {
    try {
      const body = await request.json();
      expenseId = body?.expenseId || body?.id;
    } catch {
      // Optional body
    }
  }

  if (!expenseId) {
    return problemResponse({
      status: 400,
      title: 'Bad Request',
      detail: 'Expense ID must be provided via query param ?expenseId=... or request body { expenseId }',
      code: 'MISSING_EXPENSE_ID',
    });
  }

  const db = await getDb(locals);
  const deleted = await deleteExpense(db, tripId, expenseId);

  if (!deleted) {
    return problemResponse({
      status: 404,
      title: 'Not Found',
      detail: `Expense '${expenseId}' was not found on trip '${tripId}'`,
      code: 'EXPENSE_NOT_FOUND',
    });
  }

  return jsonResponse({
    success: true,
    deleted_expense_id: expenseId,
  });
};
