import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, setTestDb, type DatabaseAdapter } from '../src/db/client';
import {
  ensureSessionTables,
  getSessionState,
  updateSessionState,
  recordSessionMutation,
  getSessionEventsSince,
  resolveStopDetails,
} from '../src/services/sessionService';

// Astro API route handlers
import {
  GET as getSessionRoute,
  POST as postSessionRoute,
  PATCH as patchSessionRoute,
  PUT as putSessionRoute,
} from '../src/pages/api/v1/session';
import {
  GET as getEventsRoute,
  POST as postEventsRoute,
} from '../src/pages/api/v1/events';

describe('Bi-directional Session State & Event Sync (Issue #15)', () => {
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = await createTestDb(true);
    setTestDb(db);
  });

  afterEach(() => {
    setTestDb(null);
  });

  // ==========================================================================
  // Session Service Unit Tests
  // ==========================================================================

  it('1. ensureSessionTables creates workspace_sessions and session_events idempotently', async () => {
    await ensureSessionTables(db);
    await ensureSessionTables(db); // Second call should not throw

    const sessionTableCheck = await db.queryOne<{ count: number }>(
      "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='workspace_sessions'"
    );
    const eventsTableCheck = await db.queryOne<{ count: number }>(
      "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='session_events'"
    );

    expect(sessionTableCheck?.count).toBe(1);
    expect(eventsTableCheck?.count).toBe(1);
  });

  it('2. getSessionState auto-initializes the default session row with trip-kyoto-2026', async () => {
    const state = await getSessionState(db, 'default');

    expect(state.session).toBeDefined();
    expect(state.session.session_id).toBe('default');
    expect(state.session.active_trip_id).toBe('trip-kyoto-2026');
    expect(state.session.active_tab).toBe('itinerary');
    expect(state.session.active_day_number).toBe(1);
    expect(state.session.state_version).toBe(1);
    expect(state.session.last_actor).toBe('system');
    expect(state.recent_events.length).toBe(1);
    expect(state.recent_events[0].action).toBe('session_init');
  });

  it('3. getSessionState loads full hierarchical trip data when includeTrip !== false', async () => {
    const state = await getSessionState(db, 'default', { includeTrip: true });

    expect(state.trip).not.toBeNull();
    expect(state.trip?.id).toBe('trip-kyoto-2026');
    expect(state.trip?.collaborators.length).toBeGreaterThanOrEqual(1);
    expect(state.trip?.days.length).toBe(5);
    expect(state.trip?.wishlist_sections.length).toBeGreaterThanOrEqual(1);
    expect(state.trip?.reservations.length).toBeGreaterThanOrEqual(1);
    expect(state.trip?.expenses.length).toBeGreaterThanOrEqual(1);
    // Verifies expenses with splits and budget settlement
    expect(state.trip?.expenses[0].splits).toBeDefined();
    expect(state.trip?.budget_settlement).toBeDefined();
    expect(state.trip?.budget_settlement?.total_expenses).toBeGreaterThan(0);
    expect(state.trip?.checklists.length).toBeGreaterThanOrEqual(1);
    expect(state.trip?.notes.length).toBeGreaterThanOrEqual(1);
  });

  it('4. getSessionState omits full trip hierarchy when includeTrip === false', async () => {
    const state = await getSessionState(db, 'default', { includeTrip: false });

    expect(state.session.session_id).toBe('default');
    expect(state.trip).toBeNull();
  });

  it('5. getSessionState resolves selected_stop with place and transit details', async () => {
    // Retrieve a stop from the seeded Kyoto trip
    const stop = await db.queryOne<{ id: string }>('SELECT id FROM stops LIMIT 1');
    expect(stop).not.toBeNull();

    // Update session to select this stop
    await updateSessionState(db, {
      selected_stop_id: stop!.id,
      actor: 'ui',
      event_summary: `Selected stop ${stop!.id}`,
    });

    const state = await getSessionState(db, 'default');
    expect(state.session.selected_stop_id).toBe(stop!.id);
    expect(state.session.selected_stop).not.toBeNull();
    expect(state.session.selected_stop?.id).toBe(stop!.id);
    expect(state.session.selected_stop?.place).toBeDefined();
    expect(state.session.selected_stop?.place.name).toBeTruthy();
    expect(state.selected_stop?.id).toBe(stop!.id);
  });

  it('6. updateSessionState increments state_version and persists UI state', async () => {
    const state1 = await getSessionState(db, 'default', { includeTrip: false });
    const initialVersion = state1.session.state_version;

    const state2 = await updateSessionState(db, {
      active_day_number: 3,
      active_tab: 'budget',
      actor: 'ui',
      action: 'switch_tab',
      event_summary: 'Switched to budget tab for Day 3',
    });

    expect(state2.session.state_version).toBe(initialVersion + 1);
    expect(state2.session.active_day_number).toBe(3);
    expect(state2.session.active_tab).toBe('budget');
    expect(state2.session.last_actor).toBe('ui');
    expect(state2.session.last_event_summary).toBe('Switched to budget tab for Day 3');

    // Recent events should contain the new event at the top
    expect(state2.recent_events[0].action).toBe('switch_tab');
    expect(state2.recent_events[0].state_version).toBe(initialVersion + 1);
    expect(state2.recent_events[0].actor).toBe('ui');
  });

  it('7. updateSessionState merges ui_context cleanly', async () => {
    await updateSessionState(db, {
      ui_context: { sidebar_open: true, map_zoom: 14 },
    });

    let state = await getSessionState(db, 'default', { includeTrip: false });
    expect(state.session.ui_context).toEqual({ sidebar_open: true, map_zoom: 14 });

    // Partial update merges with existing context
    await updateSessionState(db, {
      ui_context: { map_zoom: 16, filter_category: 'restaurant' },
    });

    state = await getSessionState(db, 'default', { includeTrip: false });
    expect(state.session.ui_context).toEqual({
      sidebar_open: true,
      map_zoom: 16,
      filter_category: 'restaurant',
    });
  });

  it('8. recordSessionMutation tracks mutations from agy CLI with payload', async () => {
    const result = await recordSessionMutation(db, {
      session_id: 'default',
      actor: 'agy',
      action: 'add_stop',
      summary: 'Added Fushimi Inari Taisha to Day 1 Morning',
      active_day_number: 1,
      active_tab: 'itinerary',
      payload: {
        place_name: 'Fushimi Inari Taisha',
        section: 'morning',
        stop_id: 'stop-custom-123',
      },
    });

    expect(result.event).toBeDefined();
    expect(result.event.actor).toBe('agy');
    expect(result.event.action).toBe('add_stop');
    expect(result.event.summary).toBe('Added Fushimi Inari Taisha to Day 1 Morning');
    expect(result.event.payload.place_name).toBe('Fushimi Inari Taisha');

    expect(result.session.last_actor).toBe('agy');
    expect(result.session.last_event_summary).toBe('Added Fushimi Inari Taisha to Day 1 Morning');
    expect(result.session.active_day_number).toBe(1);
    expect(result.session.state_version).toBe(result.event.state_version);
  });

  it('9. recordSessionMutation supports chat and system actors', async () => {
    const chatResult = await recordSessionMutation(db, {
      actor: 'chat',
      action: 'optimize_route',
      summary: 'Reordered Day 2 stops for optimal transit time',
      active_day_number: 2,
    });
    expect(chatResult.event.actor).toBe('chat');
    expect(chatResult.session.active_day_number).toBe(2);

    const systemResult = await recordSessionMutation(db, {
      actor: 'system',
      action: 'auto_sync',
      summary: 'Auto-synchronized currency rates',
    });
    expect(systemResult.event.actor).toBe('system');
    expect(systemResult.session.last_actor).toBe('system');
  });

  it('10. getSessionEventsSince returns has_changes: false when version is up-to-date', async () => {
    const current = await getSessionState(db, 'default', { includeTrip: false });
    const delta = await getSessionEventsSince(db, current.session.state_version, 'default');

    expect(delta.has_changes).toBe(false);
    expect(delta.current_version).toBe(current.session.state_version);
    expect(delta.events).toEqual([]);
  });

  it('11. getSessionEventsSince returns has_changes: true and delta events when client is behind', async () => {
    const v1 = (await getSessionState(db, 'default', { includeTrip: false })).session.state_version;

    // Perform two mutations
    await updateSessionState(db, { action: 'mutation_one', event_summary: 'Step 1' });
    await updateSessionState(db, { action: 'mutation_two', event_summary: 'Step 2' });

    const delta = await getSessionEventsSince(db, v1, 'default', { includeTrip: true });

    expect(delta.has_changes).toBe(true);
    expect(delta.current_version).toBe(v1 + 2);
    expect(delta.events.length).toBe(2);
    expect(delta.events[0].action).toBe('mutation_one');
    expect(delta.events[1].action).toBe('mutation_two');
    expect(delta.active_trip).not.toBeNull();
  });

  it('12. resolveStopDetails returns null for invalid stop ID', async () => {
    const resolved = await resolveStopDetails(db, 'non-existent-stop');
    expect(resolved).toBeNull();
  });

  // ==========================================================================
  // /api/v1/session Endpoint Tests
  // ==========================================================================

  it('13. GET /api/v1/session returns full session state with 200 OK', async () => {
    const req = new Request('http://localhost/api/v1/session?session_id=default');
    const res = await getSessionRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: {},
    } as any);

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.session).toBeDefined();
    expect(body.session.active_trip_id).toBe('trip-kyoto-2026');
    expect(body.trip).not.toBeNull();
    expect(body.recent_events.length).toBeGreaterThanOrEqual(1);
  });

  it('14. GET /api/v1/session?include_trip=false omits trip hierarchy', async () => {
    const req = new Request('http://localhost/api/v1/session?include_trip=false');
    const res = await getSessionRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: {},
    } as any);

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.session).toBeDefined();
    expect(body.trip).toBeNull();
  });

  it('15. POST /api/v1/session handles ui_action: select_trip', async () => {
    const req = new Request('http://localhost/api/v1/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ui_action: 'select_trip',
        trip_id: 'trip-kyoto-2026',
      }),
    });

    const res = await postSessionRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: {},
    } as any);

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.session.active_trip_id).toBe('trip-kyoto-2026');
    expect(body.session.selected_stop_id).toBeNull();
    expect(body.session.last_actor).toBe('ui');
    expect(body.session.last_event_summary).toContain('Switched active trip');
  });

  it('16. POST /api/v1/session handles ui_action: select_day', async () => {
    const req = new Request('http://localhost/api/v1/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ui_action: 'select_day',
        day_number: 4,
      }),
    });

    const res = await postSessionRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: {},
    } as any);

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.session.active_day_number).toBe(4);
    expect(body.session.active_tab).toBe('itinerary');
  });

  it('17. POST /api/v1/session handles ui_action: select_tab', async () => {
    const req = new Request('http://localhost/api/v1/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ui_action: 'select_tab',
        tab: 'expenses',
      }),
    });

    const res = await postSessionRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: {},
    } as any);

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.session.active_tab).toBe('expenses');
  });

  it('18. POST /api/v1/session handles ui_action: select_stop', async () => {
    const stop = await db.queryOne<{ id: string }>('SELECT id FROM stops LIMIT 1');
    expect(stop).not.toBeNull();

    const req = new Request('http://localhost/api/v1/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ui_action: 'select_stop',
        stop_id: stop!.id,
      }),
    });

    const res = await postSessionRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: {},
    } as any);

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.session.selected_stop_id).toBe(stop!.id);
    expect(body.selected_stop).not.toBeNull();
    expect(body.selected_stop.id).toBe(stop!.id);
  });

  it('19. PATCH and PUT /api/v1/session update arbitrary properties', async () => {
    const patchReq = new Request('http://localhost/api/v1/session', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        active_tab: 'packing',
        actor: 'agy',
        action: 'open_checklist',
        summary: 'Opened packing checklist',
      }),
    });

    const patchRes = await patchSessionRoute({
      request: patchReq,
      locals: {},
      url: new URL(patchReq.url),
      params: {},
    } as any);

    expect(patchRes.status).toBe(200);
    const patchBody: any = await patchRes.json();
    expect(patchBody.session.active_tab).toBe('packing');
    expect(patchBody.session.last_actor).toBe('agy');

    // PUT test
    const putReq = new Request('http://localhost/api/v1/session', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        active_tab: 'notes',
        actor: 'ui',
        summary: 'Navigated to notes',
      }),
    });

    const putRes = await putSessionRoute({
      request: putReq,
      locals: {},
      url: new URL(putReq.url),
      params: {},
    } as any);

    expect(putRes.status).toBe(200);
    const putBody: any = await putRes.json();
    expect(putBody.session.active_tab).toBe('notes');
  });

  it('20. /api/v1/session returns 400 problemResponse for invalid JSON', async () => {
    const req = new Request('http://localhost/api/v1/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid-json',
    });

    const res = await postSessionRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: {},
    } as any);

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.code).toBe('INVALID_JSON');
  });

  // ==========================================================================
  // /api/v1/events Endpoint Tests
  // ==========================================================================

  it('21. GET /api/v1/events in polling mode returns delta structure with active_trip', async () => {
    const req = new Request('http://localhost/api/v1/events?since_version=0');
    const res = await getEventsRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: {},
    } as any);

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.has_changes).toBe(true);
    expect(body.current_version).toBeGreaterThanOrEqual(1);
    expect(body.session).toBeDefined();
    expect(body.events.length).toBeGreaterThanOrEqual(1);
    expect(body.active_trip).not.toBeNull();
    expect(body.active_trip.id).toBe('trip-kyoto-2026');
  });

  it('22. GET /api/v1/events reports has_changes: false when version is current', async () => {
    const state = await getSessionState(db, 'default', { includeTrip: false });
    const currentVersion = state.session.state_version;

    const req = new Request(`http://localhost/api/v1/events?since_version=${currentVersion}`);
    const res = await getEventsRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: {},
    } as any);

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.has_changes).toBe(false);
    expect(body.events).toEqual([]);
    expect(body.active_trip).toBeNull();
  });

  it('23. GET /api/v1/events returns SSE stream when requested via Accept header or ?stream=true', async () => {
    const req = new Request('http://localhost/api/v1/events?stream=true', {
      headers: { Accept: 'text/event-stream' },
    });

    const res = await getEventsRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: {},
    } as any);

    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');

    const text = await res.text();
    expect(text).toContain('event: session_state');
    expect(text).toContain('event: version');
    expect(text).toContain('"trip-kyoto-2026"');
  });

  it('24. POST /api/v1/events records a mutation from AGY and returns 201 Created', async () => {
    const req = new Request('http://localhost/api/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        actor: 'agy',
        action: 'reorder_stops',
        summary: 'Reordered stops for Day 1',
        active_day_number: 1,
        payload: { stops_order: ['stop-1', 'stop-2'] },
      }),
    });

    const res = await postEventsRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: {},
    } as any);

    expect(res.status).toBe(201);
    const body: any = await res.json();
    expect(body.event).toBeDefined();
    expect(body.event.actor).toBe('agy');
    expect(body.event.action).toBe('reorder_stops');
    expect(body.session.last_actor).toBe('agy');
    expect(body.session.last_event_summary).toBe('Reordered stops for Day 1');
  });

  it('25. POST /api/v1/events returns 400 when missing action', async () => {
    const req = new Request('http://localhost/api/v1/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actor: 'agy' }),
    });

    const res = await postEventsRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: {},
    } as any);

    expect(res.status).toBe(400);
    const body: any = await res.json();
    expect(body.code).toBe('MISSING_ACTION');
  });
});
