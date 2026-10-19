#!/usr/bin/env node

/**
 * TripPlanner Model Context Protocol (MCP) Stdio Bridge
 *
 * Reads JSON-RPC 2.0 messages line-by-line from standard input and proxies
 * them via HTTP POST to the TripPlanner MCP endpoint (default: http://localhost:4321/api/v1/mcp).
 * Emits the JSON-RPC response back over stdout followed by a newline.
 */

import readline from 'node:readline';

const endpoint = process.env.TRIPPLANNER_URL || 'http://localhost:4321/api/v1/mcp';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    const errRes = {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error: invalid JSON input' },
    };
    process.stdout.write(JSON.stringify(errRes) + '\n');
    return;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(parsed),
    });

    if (!res.ok) {
      const errText = await res.text();
      const errRes = {
        jsonrpc: '2.0',
        id: (Array.isArray(parsed) ? null : parsed?.id) ?? null,
        error: {
          code: -32603,
          message: `TripPlanner MCP HTTP error ${res.status}: ${res.statusText}`,
          data: errText,
        },
      };
      process.stdout.write(JSON.stringify(errRes) + '\n');
      return;
    }

    const json = await res.json();
    process.stdout.write(JSON.stringify(json) + '\n');
  } catch (err) {
    const errRes = {
      jsonrpc: '2.0',
      id: (Array.isArray(parsed) ? null : parsed?.id) ?? null,
      error: {
        code: -32000,
        message: `Failed to connect to TripPlanner server at ${endpoint}: ${err.message}`,
      },
    };
    process.stdout.write(JSON.stringify(errRes) + '\n');
  }
});
