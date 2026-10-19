import type { APIRoute } from 'astro';
import { getDb } from '../../../db/client';
import { jsonResponse, problemResponse } from '../../../lib/http';
import { processChatMessage } from '../../../services/chatAgentService';

export const prerender = false;

/**
 * GET /api/v1/chat
 * Returns status, capabilities, and suggested conversational prompts.
 */
export const GET: APIRoute = async () => {
  return jsonResponse({
    status: 'online',
    service: 'TripPlanner Conversational Itinerary Assistant',
    description: 'Natural-language trip planning, scheduling, route optimization, and budget settlement.',
    sample_prompts: [
      'Plan a 3-day trip to Tokyo',
      'Add Kinkaku-ji to Day 2 morning at 09:30',
      'Move Fushimi Inari to Day 2 morning',
      'Remove Nishiki Market',
      'Optimize Day 1 route',
      'Add hotel reservation at Hyatt Kyoto for $450 confirmation HYT123',
      'Split $400 for hotel paid by Alice between Alice and Bob',
      'Who owes whom?',
      'Add JR Pass to packing list',
      'Summarize our trip',
    ],
  });
};

/**
 * POST /api/v1/chat
 * Accepts natural-language messages, invokes the conversational orchestrator,
 * performs atomic database mutations, and returns structured actions and replies.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return problemResponse({
      status: 400,
      code: 'INVALID_JSON',
      title: 'Invalid JSON Body',
      detail: 'The request body must be a valid JSON object.',
      suggested_alternatives: [
        'Ensure the Content-Type header is application/json',
        'Verify JSON formatting: {"message": "Plan a 3-day trip to Tokyo"}',
      ],
    });
  }

  if (!body || typeof body.message !== 'string' || body.message.trim().length === 0) {
    return problemResponse({
      status: 400,
      code: 'MISSING_MESSAGE',
      title: 'Missing Required Field',
      detail: 'The "message" field is required and must not be empty.',
      suggested_alternatives: [
        'Provide a message such as: "Add Kinkaku-ji to Day 2 morning"',
        'Ask: "Who owes whom?" to check budget settlement',
      ],
      errors: {
        message: ['Field is required and must be a non-empty string.'],
      },
    });
  }

  try {
    const db = await getDb(locals);
    const env = (locals as any)?.runtime?.env;

    const result = await processChatMessage(
      db,
      {
        trip_id: body.trip_id,
        message: body.message.trim(),
        history: Array.isArray(body.history) ? body.history : undefined,
      },
      env
    );

    return jsonResponse(result);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      code: 'CHAT_AGENT_ERROR',
      title: 'Chat Assistant Execution Error',
      detail: error?.message || 'An unexpected error occurred while processing the chat message.',
      suggested_alternatives: [
        'Verify that the referenced trip_id or stop exists in the database',
        'Try simplifying your request or rephrasing with specific dates/names',
      ],
    });
  }
};
