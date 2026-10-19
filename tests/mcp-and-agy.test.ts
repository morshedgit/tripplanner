import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTestDb, setTestDb, type DatabaseAdapter } from '../src/db/client';
import {
  handleMcpRequest,
  getOrCreateSession,
  bumpSessionState,
  MCP_TOOLS,
  type WorkspaceSessionRecord,
} from '../src/services/mcpService';

describe('Issue #16: Antigravity (agy) Plugin, MCP Server & Live Session Sync', () => {
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = await createTestDb(true);
    setTestDb(db);
  });

  afterEach(() => {
    setTestDb(null);
  });

  // --------------------------------------------------------------------------
  // 1. MCP Protocol Core: initialize, ping, notifications
  // --------------------------------------------------------------------------

  it('1. handles MCP initialize with protocolVersion "2025-03-26" and serverInfo', async () => {
    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        clientInfo: { name: 'antigravity-client', version: '2.0.0' },
      },
    });

    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe(1);
    expect(res.result).toBeDefined();
    expect(res.result.protocolVersion).toBe('2025-03-26');
    expect(res.result.serverInfo).toEqual({
      name: 'tripplanner-mcp',
      version: '1.0.0',
    });
    expect(res.result.capabilities).toHaveProperty('tools');
    expect(res.result.capabilities).toHaveProperty('resources');
  });

  it('2. handles notifications/initialized and ping', async () => {
    const initNotice: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: null,
      method: 'notifications/initialized',
    });
    expect(initNotice.jsonrpc).toBe('2.0');
    expect(initNotice.error).toBeUndefined();

    const pingRes: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 'ping-1',
      method: 'ping',
    });
    expect(pingRes.jsonrpc).toBe('2.0');
    expect(pingRes.id).toBe('ping-1');
    expect(pingRes.result).toEqual({});
  });

  // --------------------------------------------------------------------------
  // 2. MCP Resources: list and read
  // --------------------------------------------------------------------------

  it('3. handles resources/list returning session and trip URIs', async () => {
    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/list',
    });

    expect(res.result).toBeDefined();
    const uris = res.result.resources.map((r: any) => r.uri);
    expect(uris).toContain('tripplanner://session/current');
    expect(uris).toContain('tripplanner://trips/active');
  });

  it('4. handles resources/read for tripplanner://session/current', async () => {
    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 4,
      method: 'resources/read',
      params: { uri: 'tripplanner://session/current' },
    });

    expect(res.result).toBeDefined();
    expect(res.result.contents).toHaveLength(1);
    expect(res.result.contents[0].uri).toBe('tripplanner://session/current');
    expect(res.result.contents[0].mimeType).toBe('application/json');

    const parsed = JSON.parse(res.result.contents[0].text);
    expect(parsed.session).toBeDefined();
    expect(parsed.session.state_version).toBe(1);
    expect(parsed.session.active_tab).toBe('itinerary');
  });

  it('5. handles resources/read for tripplanner://trips/active', async () => {
    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 5,
      method: 'resources/read',
      params: { uri: 'tripplanner://trips/active' },
    });

    expect(res.result).toBeDefined();
    expect(res.result.contents).toHaveLength(1);
    const parsed = JSON.parse(res.result.contents[0].text);
    expect(parsed.id).toBeDefined();
    expect(parsed.days).toBeInstanceOf(Array);
    expect(parsed.days.length).toBeGreaterThanOrEqual(1);
  });

  // --------------------------------------------------------------------------
  // 3. MCP Tools: tools/list discovery
  // --------------------------------------------------------------------------

  it('6. handles tools/list exposing all 14 required tools with JSON schemas', async () => {
    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/list',
    });

    expect(res.result).toBeDefined();
    expect(res.result.tools.length).toBeGreaterThanOrEqual(14);

    const toolNames = res.result.tools.map((t: any) => t.name);
    const expected = [
      'get_session_context',
      'navigate_ui',
      'chat_with_tripplanner',
      'list_trips',
      'create_trip',
      'get_trip',
      'add_stop',
      'move_stop',
      'delete_stop',
      'optimize_day_route',
      'add_reservation',
      'log_expense',
      'get_budget_settlement',
      'manage_checklist',
    ];

    for (const name of expected) {
      expect(toolNames).toContain(name);
      const tool = res.result.tools.find((t: any) => t.name === name);
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema.type).toBe('object');
    }
  });

  // --------------------------------------------------------------------------
  // 4. Session Context & Navigation Tools
  // --------------------------------------------------------------------------

  it('7. tools/call get_session_context returns live session state', async () => {
    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'get_session_context',
        arguments: { session_id: 'default' },
      },
    });

    expect(res.result.isError).toBe(false);
    expect(res.result.session).toBeDefined();
    expect(res.result.session.session_id).toBe('default');
    expect(res.result.session.state_version).toBe(1);
    expect(res.result.session.last_actor).toBe('system');
    expect(res.result.trip).toBeDefined();
    expect(res.result.content[0].type).toBe('text');
  });

  it('8. tools/call navigate_ui switches tabs, updates day/stop, and increments state_version', async () => {
    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'navigate_ui',
        arguments: {
          active_tab: 'budget',
          active_day_number: 2,
          message: 'Switched to Budget tab for Day 2',
        },
      },
    });

    expect(res.result.isError).toBe(false);
    expect(res.result.state_version).toBe(2);
    expect(res.result.session.active_tab).toBe('budget');
    expect(res.result.session.active_day_number).toBe(2);
    expect(res.result.session.last_actor).toBe('agy');
    expect(res.result.session.last_event_summary).toBe('Switched to Budget tab for Day 2');

    // Verify session_events row was created
    const events = await db.query('SELECT * FROM session_events WHERE action = ?', ['navigate_ui']);
    expect(events).toHaveLength(1);
    expect(events[0].actor).toBe('agy');
    expect(events[0].state_version).toBe(2);
  });

  // --------------------------------------------------------------------------
  // 5. Trip Management Tools
  // --------------------------------------------------------------------------

  it('9. tools/call list_trips returns all trips', async () => {
    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: {
        name: 'list_trips',
        arguments: {},
      },
    });

    expect(res.result.isError).toBe(false);
    expect(res.result.trips).toBeInstanceOf(Array);
    expect(res.result.trips.length).toBeGreaterThanOrEqual(1);
  });

  it('10. tools/call create_trip creates a trip, sets as active, and increments state_version', async () => {
    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: {
        name: 'create_trip',
        arguments: {
          title: 'Tokyo Food Tour',
          destination: 'Tokyo, Japan',
          start_date: '2026-05-01',
          end_date: '2026-05-05',
          currency: 'JPY',
          set_as_active: true,
        },
      },
    });

    expect(res.result.isError).toBe(false);
    expect(res.result.trip.title).toBe('Tokyo Food Tour');
    expect(res.result.state_version).toBeGreaterThan(1);
    expect(res.result.session.active_trip_id).toBe(res.result.trip.id);
  });

  it('11. tools/call get_trip defaults to active_trip_id from UI session', async () => {
    const session = await getOrCreateSession(db);

    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: {
        name: 'get_trip',
        arguments: {},
      },
    });

    expect(res.result.isError).toBe(false);
    expect(res.result.trip.id).toBe(session.active_trip_id);
    expect(res.result.trip.days).toBeInstanceOf(Array);
  });

  // --------------------------------------------------------------------------
  // 6. Itinerary & Stops Tools with Session Defaults
  // --------------------------------------------------------------------------

  it('12. tools/call add_stop defaults to active_trip_id and active_day_number, updates selected_stop_id, and increments state_version', async () => {
    const beforeSession = await getOrCreateSession(db);
    const initialVersion = beforeSession.state_version;

    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: {
        name: 'add_stop',
        arguments: {
          place_name: 'Fushimi Inari Taisha',
          custom_title: 'Morning Shrine Walk',
        },
      },
    });

    expect(res.result.isError).toBe(false);
    expect(res.result.stop).toBeDefined();
    expect(res.result.stop.place.name).toBe('Fushimi Inari Taisha');
    expect(res.result.state_version).toBe(initialVersion + 1);

    // Verify UI session has the newly created stop selected
    const afterSession = await getOrCreateSession(db);
    expect(afterSession.selected_stop_id).toBe(res.result.stop.id);
    expect(afterSession.last_actor).toBe('agy');
  });

  it('13. tools/call move_stop uses selected_stop_id from session and increments state_version', async () => {
    // Select an existing stop in the session
    const stopRow: any = await db.queryOne('SELECT id FROM stops ORDER BY sort_order ASC LIMIT 1');
    expect(stopRow).toBeDefined();

    await bumpSessionState(db, {
      action: 'select_stop',
      summary: 'Selected stop in UI',
      patch: { selected_stop_id: stopRow.id, active_day_number: 1 },
    });

    const session = await getOrCreateSession(db);
    expect(session.selected_stop_id).toBe(stopRow.id);
    const initialVersion = session.state_version;

    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 13,
      method: 'tools/call',
      params: {
        name: 'move_stop',
        arguments: {
          target_day_number: 2,
          target_section_type: 'morning',
        },
      },
    });

    expect(res.result.isError).toBe(false);
    expect(res.result.state_version).toBe(initialVersion + 1);
    expect(res.result.session.last_actor).toBe('agy');
  });

  it('14. tools/call optimize_day_route defaults to active_day_number, optimizes route, and increments state_version', async () => {
    const beforeSession = await getOrCreateSession(db);
    const initialVersion = beforeSession.state_version;

    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 14,
      method: 'tools/call',
      params: {
        name: 'optimize_day_route',
        arguments: {
          transit_mode: 'walking',
        },
      },
    });

    expect(res.result.isError).toBe(false);
    expect(res.result.result).toBeDefined();
    expect(res.result.result.day_number).toBe(beforeSession.active_day_number || 1);
    expect(res.result.state_version).toBe(initialVersion + 1);
    expect(res.result.session.last_actor).toBe('agy');
  });

  // --------------------------------------------------------------------------
  // 7. Bookings, Budget & Checklists Tools
  // --------------------------------------------------------------------------

  it('15. tools/call add_reservation creates booking, switches to bookings tab, and increments state_version', async () => {
    const beforeSession = await getOrCreateSession(db);
    const initialVersion = beforeSession.state_version;

    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 15,
      method: 'tools/call',
      params: {
        name: 'add_reservation',
        arguments: {
          type: 'lodging',
          title: 'Hotel Granvia Kyoto',
          confirmation_code: 'GRANVIA-9988',
          cost: 350,
          currency: 'USD',
        },
      },
    });

    expect(res.result.isError).toBe(false);
    expect(res.result.reservation.title).toBe('Hotel Granvia Kyoto');
    expect(res.result.session.active_tab).toBe('bookings');
    expect(res.result.state_version).toBe(initialVersion + 1);
  });

  it('16. tools/call log_expense logs expense with splits, switches to budget tab, and increments state_version', async () => {
    const beforeSession = await getOrCreateSession(db);
    const initialVersion = beforeSession.state_version;

    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 16,
      method: 'tools/call',
      params: {
        name: 'log_expense',
        arguments: {
          title: 'Dinner at Pontocho',
          amount: 15000,
          currency: 'JPY',
          category: 'food',
          paid_by_collaborator_name: 'Alice',
          split_strategy: 'equal',
        },
      },
    });

    expect(res.result.isError).toBe(false);
    expect(res.result.expense.title).toBe('Dinner at Pontocho');
    expect(res.result.session.active_tab).toBe('budget');
    expect(res.result.state_version).toBe(initialVersion + 1);
  });

  it('17. tools/call get_budget_settlement calculates Splitwise debt settlements', async () => {
    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 17,
      method: 'tools/call',
      params: {
        name: 'get_budget_settlement',
        arguments: {},
      },
    });

    expect(res.result.isError).toBe(false);
    expect(res.result.settlement).toBeDefined();
    expect(res.result.settlement.settlement_transfers).toBeInstanceOf(Array);
  });

  it('18. tools/call manage_checklist adds and toggles items, switching to checklists tab and incrementing state_version', async () => {
    const beforeSession = await getOrCreateSession(db);
    const initialVersion = beforeSession.state_version;

    // Add item
    const addRes: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 18,
      method: 'tools/call',
      params: {
        name: 'manage_checklist',
        arguments: {
          action: 'add',
          title: 'Buy Japan Rail Pass',
          category: 'documents',
        },
      },
    });

    expect(addRes.result.isError).toBe(false);
    expect(addRes.result.item.title).toBe('Buy Japan Rail Pass');
    expect(addRes.result.session.active_tab).toBe('checklists');
    expect(addRes.result.state_version).toBe(initialVersion + 1);

    const itemId = addRes.result.item.id;

    // Toggle item
    const toggleRes: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 19,
      method: 'tools/call',
      params: {
        name: 'manage_checklist',
        arguments: {
          action: 'toggle',
          item_id: itemId,
          is_completed: true,
        },
      },
    });

    expect(toggleRes.result.isError).toBe(false);
    expect(toggleRes.result.item.is_completed).toBe(true);
    expect(toggleRes.result.state_version).toBe(initialVersion + 2);
  });

  // --------------------------------------------------------------------------
  // 8. Conversational Chat & Stop Deletion Tools
  // --------------------------------------------------------------------------

  it('20. tools/call chat_with_tripplanner processes natural language commands and updates session', async () => {
    const beforeSession = await getOrCreateSession(db);
    const initialVersion = beforeSession.state_version;

    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 20,
      method: 'tools/call',
      params: {
        name: 'chat_with_tripplanner',
        arguments: {
          message: 'Add Gion Corner to Day 1 evening',
        },
      },
    });

    expect(res.result.isError).toBe(false);
    expect(res.result.reply).toBeTruthy();
    expect(res.result.state_version).toBe(initialVersion + 1);
    expect(res.result.session.last_actor).toBe('agy');
  });

  it('21. tools/call delete_stop deletes stop using session defaults and clears selected_stop_id', async () => {
    // Select an existing stop in the session
    const stopRow: any = await db.queryOne('SELECT id FROM stops ORDER BY sort_order ASC LIMIT 1');
    expect(stopRow).toBeDefined();

    await bumpSessionState(db, {
      action: 'select_stop',
      summary: 'Selected stop in UI',
      patch: { selected_stop_id: stopRow.id },
    });

    const session = await getOrCreateSession(db);
    const stopIdToDelete = session.selected_stop_id;
    expect(stopIdToDelete).toBe(stopRow.id);
    const initialVersion = session.state_version;

    const res: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 21,
      method: 'tools/call',
      params: {
        name: 'delete_stop',
        arguments: {},
      },
    });

    expect(res.result.isError).toBe(false);
    expect(res.result.success).toBe(true);
    expect(res.result.state_version).toBe(initialVersion + 1);
    expect(res.result.session.selected_stop_id).toBeNull();
  });

  // --------------------------------------------------------------------------
  // 9. Batch Requests & Error Handling
  // --------------------------------------------------------------------------

  it('22. handles batch JSON-RPC requests correctly', async () => {
    const batchReq = [
      { jsonrpc: '2.0', id: 101, method: 'ping' },
      { jsonrpc: '2.0', id: 102, method: 'resources/list' },
    ];

    const responses: any = await handleMcpRequest(db, batchReq);
    expect(Array.isArray(responses)).toBe(true);
    expect(responses).toHaveLength(2);
    expect(responses[0].id).toBe(101);
    expect(responses[1].id).toBe(102);
  });

  it('23. returns standard JSON-RPC 2.0 error codes for invalid requests and unknown methods', async () => {
    const invalidRes: any = await handleMcpRequest(db, {
      jsonrpc: '1.0',
      method: 'ping',
    });
    expect(invalidRes.error.code).toBe(-32600);

    const unknownRes: any = await handleMcpRequest(db, {
      jsonrpc: '2.0',
      id: 999,
      method: 'non_existent_method',
    });
    expect(unknownRes.error.code).toBe(-32601);
  });

  // --------------------------------------------------------------------------
  // 10. Workspace Customizations Verification (Files Owned)
  // --------------------------------------------------------------------------

  it('24. verifies existence and valid schemas of Antigravity plugin, MCP config, skills and rules', () => {
    const root = process.cwd();

    // 1. Plugin manifest
    const pluginPath = resolve(root, '.agents/plugins/tripplanner/plugin.json');
    expect(existsSync(pluginPath)).toBe(true);
    const pluginJson = JSON.parse(readFileSync(pluginPath, 'utf8'));
    expect(pluginJson.name).toBe('tripplanner');
    expect(pluginJson.displayName).toContain('TripPlanner');
    expect(pluginJson.suggestedPrompts).toHaveLength(3);

    // 2. Plugin MCP config
    const mcpConfigPath = resolve(root, '.agents/plugins/tripplanner/mcp_config.json');
    expect(existsSync(mcpConfigPath)).toBe(true);
    const mcpConfig = JSON.parse(readFileSync(mcpConfigPath, 'utf8'));
    expect(mcpConfig.mcpServers['tripplanner-mcp']).toBeDefined();
    expect(mcpConfig.mcpServers['tripplanner-mcp'].url).toContain('/api/v1/mcp');

    // 3. Skills
    const pluginSkill = resolve(root, '.agents/plugins/tripplanner/skills/tripplanner/SKILL.md');
    const workspaceSkill = resolve(root, '.agents/skills/tripplanner/SKILL.md');
    expect(existsSync(pluginSkill)).toBe(true);
    expect(existsSync(workspaceSkill)).toBe(true);

    const skillContent = readFileSync(workspaceSkill, 'utf8');
    expect(skillContent).toContain('name: tripplanner');
    expect(skillContent).toContain('get_session_context');
    expect(skillContent).toContain('navigate_ui');

    // 4. Rules
    const pluginRules = resolve(root, '.agents/plugins/tripplanner/rules/AGENTS.md');
    const workspaceRules = resolve(root, '.agents/rules/tripplanner-session.md');
    expect(existsSync(pluginRules)).toBe(true);
    expect(existsSync(workspaceRules)).toBe(true);

    const rulesContent = readFileSync(workspaceRules, 'utf8');
    expect(rulesContent).toContain('get_session_context');
    expect(rulesContent).toContain('state_version');

    // 5. Stdio Bridge script
    const scriptPath = resolve(root, 'scripts/agy-mcp-server.mjs');
    expect(existsSync(scriptPath)).toBe(true);
    const scriptContent = readFileSync(scriptPath, 'utf8');
    expect(scriptContent).toContain('#!/usr/bin/env node');
    expect(scriptContent).toContain('process.stdin');
    expect(scriptContent).toContain('/api/v1/mcp');
  });
});
