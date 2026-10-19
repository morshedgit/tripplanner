import type { APIRoute } from 'astro';

/**
 * ChatGPT Plugin Manifest endpoint (GET /.well-known/ai-plugin.json)
 * Dynamically resolves the API and asset URLs using the request origin.
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const origin = url.origin;

  const manifest = {
    schema_version: 'v1',
    name_for_human: 'TripPlanner',
    name_for_model: 'tripplanner',
    description_for_human:
      'Collaborative Wanderlog-style trip planning, daily route optimization, reservations, group expense splitting, and calendar sync.',
    description_for_model:
      'TripPlanner enables users and LLM agents to plan multi-day itineraries, add and organize places and stops, calculate transit legs, optimize daily routes, manage flight and hotel reservations, track shared expenses and debt settlements, and export itineraries to Markdown, iCal (.ics), and CSV.',
    auth: {
      type: 'none',
    },
    api: {
      type: 'openapi',
      url: `${origin}/api/v1/openapi.json`,
    },
    logo_url: `${origin}/logo.png`,
    contact_email: 'support@tripplanner.dev',
    legal_info_url: `${origin}/legal`,
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
