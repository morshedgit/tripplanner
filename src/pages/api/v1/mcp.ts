import type { APIRoute } from 'astro';
import { getDb } from '../../../db/client';
import { jsonResponse } from '../../../lib/http';
import { handleMcpRequest, MCP_TOOLS } from '../../../services/mcpService';

export const prerender = false;

/**
 * GET /api/v1/mcp
 * Returns MCP server discovery metadata, supported protocols, available tools,
 * resources, and instructions for connecting Antigravity (agy).
 */
export const GET: APIRoute = async () => {
  return jsonResponse({
    name: 'tripplanner-mcp',
    version: '1.0.0',
    protocolVersion: '2025-03-26',
    transports: ['Streamable HTTP', 'stdio'],
    endpoint: '/api/v1/mcp',
    stdio_bridge: 'scripts/agy-mcp-server.mjs',
    capabilities: {
      tools: {},
      resources: {},
    },
    tools: MCP_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
    resources: [
      {
        uri: 'tripplanner://session/current',
        name: 'Current Workspace Session',
        mimeType: 'application/json',
        description: 'Live session state tracking active trip, day, tab, selected stop, and last UI interaction',
      },
      {
        uri: 'tripplanner://trips/active',
        name: 'Active Trip Details',
        mimeType: 'application/json',
        description: 'Full itinerary, schedule, reservations, budget, and checklists for the active trip',
      },
    ],
    agy_instructions: {
      streamable_http: {
        description: 'Direct Streamable HTTP connection over localhost',
        config_snippet: {
          mcpServers: {
            'tripplanner-mcp': {
              url: 'http://localhost:4321/api/v1/mcp',
            },
          },
        },
      },
      stdio_bridge: {
        description: 'Stdio bridge running via scripts/agy-mcp-server.mjs',
        config_snippet: {
          mcpServers: {
            'tripplanner-mcp': {
              command: 'node',
              args: ['scripts/agy-mcp-server.mjs'],
            },
          },
        },
      },
    },
  });
};

/**
 * POST /api/v1/mcp
 * Streamable HTTP MCP JSON-RPC 2.0 endpoint accepting single or batch requests.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  let body: any;

  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error: invalid JSON received by MCP endpoint',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  try {
    const db = await getDb(locals);
    const env = (locals as any)?.runtime?.env;

    const rpcResponse = await handleMcpRequest(db, body, env);

    return new Response(JSON.stringify(rpcResponse), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: (Array.isArray(body) ? null : body?.id) ?? null,
        error: {
          code: -32603,
          message: err?.message || 'Internal MCP server error',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
