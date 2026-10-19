import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, setTestDb, type DatabaseAdapter } from '../src/db/client';
import {
  processChatMessage,
  calculateHaversineDistance,
  estimateTransit,
  solveTsp2Opt,
  simplifyDebts,
  convertCurrency,
  ensureSessionTables,
} from '../src/services/chatAgentService';
import { POST as chatPost, GET as chatGet } from '../src/pages/api/v1/chat';

describe('Chat Agent Service & Conversational Engine (Issue #6)', () => {
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = await createTestDb(true);
    setTestDb(db);
  });

  afterEach(() => {
    setTestDb(null);
  });

  describe('Mathematical & Routing Algorithms', () => {
    it('calculates Haversine distance accurately between known landmarks', () => {
      // Fushimi Inari (34.9671, 135.7727) to Kinkaku-ji (35.0394, 135.7292) ~ 8900m
      const distance = calculateHaversineDistance(34.9671, 135.7727, 35.0394, 135.7292);
      expect(distance).toBeGreaterThan(8000);
      expect(distance).toBeLessThan(10000);
    });

    it('estimates transit modes and durations based on distance', () => {
      const walking = estimateTransit(400);
      expect(walking.mode).toBe('walking');
      expect(walking.durationSeconds).toBeGreaterThan(0);
      expect(walking.instructions).toContain('Walk');

      const transit = estimateTransit(4500);
      expect(transit.mode).toBe('transit');
      expect(transit.instructions).toContain('public transit');

      const driving = estimateTransit(15000);
      expect(driving.mode).toBe('driving');
      expect(driving.instructions).toContain('Drive');
    });

    it('optimizes multi-stop route using Nearest-Neighbor + 2-Opt TSP heuristic', () => {
      const stops = [
        { name: 'Stop A', lat: 35.0, lng: 135.7 },
        { name: 'Stop B', lat: 35.05, lng: 135.75 },
        { name: 'Stop C', lat: 35.01, lng: 135.71 },
        { name: 'Stop D', lat: 35.04, lng: 135.74 },
      ];

      const result = solveTsp2Opt(stops);
      expect(result.orderedItems.length).toBe(4);
      expect(result.newDistance).toBeLessThanOrEqual(result.oldDistance);
    });

    it('converts currencies and simplifies Splitwise group debts', () => {
      const usdFromJpy = convertCurrency(15000, 'JPY', 'USD');
      expect(usdFromJpy).toBeCloseTo(100.5, 0);

      const balances = [
        { collaborator_id: 'c1', collaborator_name: 'Alice', net_balance: 100 },
        { collaborator_id: 'c2', collaborator_name: 'Bob', net_balance: -60 },
        { collaborator_id: 'c3', collaborator_name: 'Charlie', net_balance: -40 },
      ];

      const transfers = simplifyDebts(balances, 'USD');
      expect(transfers.length).toBe(2);
      expect(transfers[0].to_collaborator_name).toBe('Alice');
      expect(transfers[0].amount + transfers[1].amount).toBeCloseTo(100, 2);
    });
  });

  describe('Multi-Turn Conversational Actions', () => {
    it('Action 1: creates a new multi-day trip with schedule and starter highlights', async () => {
      const res = await processChatMessage(db, {
        message: 'Plan a 3-day trip to Tokyo',
      });

      expect(res.actions_taken.length).toBeGreaterThan(0);
      expect(res.actions_taken[0].tool).toBe('create_trip');
      expect(res.reply).toContain('Tokyo');
      expect(res.trip_id).toBeTruthy();

      const trip = await db.queryOne('SELECT * FROM trips WHERE id = ?', [res.trip_id]);
      expect(trip).toBeTruthy();
      expect(trip.destination).toBe('Tokyo');

      const days = await db.query('SELECT * FROM days WHERE trip_id = ?', [res.trip_id]);
      expect(days.length).toBe(3);
    });

    it('Action 2: adds a new stop with auto-geocoding, section placement, and transit sync', async () => {
      const tripId = 'trip-kyoto-2026';
      const res = await processChatMessage(db, {
        trip_id: tripId,
        message: 'Add Kinkaku-ji to Day 2 morning at 09:30',
      });

      expect(res.actions_taken.length).toBeGreaterThan(0);
      expect(res.actions_taken[0].tool).toBe('add_stop');
      expect(res.reply).toContain('Kinkaku-ji');

      // Check database stop
      const stop = await db.queryOne(
        `SELECT s.*, p.name FROM stops s
         JOIN places p ON s.place_id = p.id
         WHERE s.id = ?`,
        [res.actions_taken[0].payload.stop_id]
      );
      expect(stop).toBeTruthy();
      expect(stop.name).toContain('Kinkaku-ji');
      expect(stop.arrival_time).toBe('09:30');
    });

    it('Action 2b: adds a place to the wishlist', async () => {
      const tripId = 'trip-kyoto-2026';
      const res = await processChatMessage(db, {
        trip_id: tripId,
        message: 'Add Gion District to wishlist',
      });

      expect(res.actions_taken[0].tool).toBe('add_stop');
      expect(res.reply).toContain('Wishlist');

      const wishlistSec = await db.queryOne(
        "SELECT * FROM sections WHERE trip_id = ? AND section_type = 'wishlist'",
        [tripId]
      );
      const stop = await db.queryOne('SELECT * FROM stops WHERE section_id = ?', [wishlistSec.id]);
      expect(stop).toBeTruthy();
    });

    it('Action 3: moves a stop to another day/section and refreshes transit legs', async () => {
      const tripId = 'trip-kyoto-2026';
      const res = await processChatMessage(db, {
        trip_id: tripId,
        message: 'Move Fushimi Inari to Day 2 morning',
      });

      expect(res.actions_taken[0].tool).toBe('move_stop');
      expect(res.reply).toContain('Day 2');

      const day2Morning = await db.queryOne(
        `SELECT sec.id FROM sections sec
         JOIN days d ON sec.day_id = d.id
         WHERE d.trip_id = ? AND d.day_number = 2 AND sec.section_type = 'morning'`,
        [tripId]
      );

      const stop = await db.queryOne(
        `SELECT s.* FROM stops s
         JOIN places p ON s.place_id = p.id
         WHERE s.section_id = ? AND p.name LIKE '%Fushimi%'`,
        [day2Morning.id]
      );
      expect(stop).toBeTruthy();
    });

    it('Action 4: removes a stop and cleans up transit connections', async () => {
      const tripId = 'trip-kyoto-2026';
      const res = await processChatMessage(db, {
        trip_id: tripId,
        message: 'Remove Nishiki Market',
      });

      expect(res.actions_taken[0].tool).toBe('remove_stop');
      expect(res.reply).toContain('Removed');

      const stop = await db.queryOne(
        `SELECT s.* FROM stops s
         JOIN places p ON s.place_id = p.id
         JOIN sections sec ON s.section_id = sec.id
         WHERE sec.trip_id = ? AND p.name LIKE '%Nishiki%'`,
        [tripId]
      );
      expect(stop).toBeNull();
    });

    it('Action 5: optimizes a day route with 2-Opt TSP', async () => {
      const tripId = 'trip-kyoto-2026';

      // First add stops to Day 1 so it has 3 stops
      await processChatMessage(db, {
        trip_id: tripId,
        message: 'Add Kiyomizu-dera to Day 1 afternoon',
      });
      await processChatMessage(db, {
        trip_id: tripId,
        message: 'Add Kinkaku-ji to Day 1 evening',
      });

      const res = await processChatMessage(db, {
        trip_id: tripId,
        message: 'Optimize Day 1 route',
      });

      expect(res.actions_taken[0].tool).toBe('optimize_route');
      expect(res.reply).toContain('Optimized');
    });

    it('Action 6: adds a flight or hotel reservation', async () => {
      const tripId = 'trip-kyoto-2026';
      const res = await processChatMessage(db, {
        trip_id: tripId,
        message: 'Add hotel reservation at Hyatt Kyoto for $450 confirmation HYT123',
      });

      expect(res.actions_taken[0].tool).toBe('add_reservation');
      expect(res.reply).toContain('Hyatt Kyoto');
      expect(res.reply).toContain('450');

      const reservation = await db.queryOne(
        'SELECT * FROM reservations WHERE trip_id = ? AND confirmation_code = ?',
        [tripId, 'HYT123']
      );
      expect(reservation).toBeTruthy();
      expect(reservation.cost).toBe(450);
    });

    it('Action 7: logs and splits an expense between collaborators', async () => {
      const tripId = 'trip-kyoto-2026';
      const res = await processChatMessage(db, {
        trip_id: tripId,
        message: 'Split $400 for hotel paid by Alice between Alice and Bob',
      });

      expect(res.actions_taken[0].tool).toBe('log_expense');
      expect(res.reply).toContain('Alice');
      expect(res.reply).toContain('Bob');

      const splits = await db.query(
        `SELECT * FROM expense_splits WHERE expense_id = ?`,
        [res.actions_taken[0].payload.expense_id]
      );
      expect(splits.length).toBe(2);
      expect(splits[0].amount_owed).toBe(200);
      expect(splits[1].amount_owed).toBe(200);
    });

    it('Action 8: queries Who Owes Whom settlement transfers', async () => {
      const tripId = 'trip-kyoto-2026';
      const res = await processChatMessage(db, {
        trip_id: tripId,
        message: 'Who owes whom?',
      });

      expect(res.actions_taken[0].tool).toBe('calculate_budget');
      expect(res.reply).toContain('Budget & Debt Settlement Overview');
      expect(res.reply).toContain('Alice');
      expect(res.reply).toContain('Bob');
    });

    it('Action 9: adds items to the packing checklist and checks them off', async () => {
      const tripId = 'trip-kyoto-2026';

      // Add item
      const addRes = await processChatMessage(db, {
        trip_id: tripId,
        message: 'Add JR Pass to packing list',
      });
      expect(addRes.actions_taken[0].tool).toBe('manage_checklist');
      expect(addRes.reply).toContain('JR Pass');

      // Check off item
      const checkRes = await processChatMessage(db, {
        trip_id: tripId,
        message: 'Check off JR Pass',
      });
      expect(checkRes.reply).toContain('Checked off');
    });

    it('Action 10: summarizes the full itinerary with travel times', async () => {
      const tripId = 'trip-kyoto-2026';
      const res = await processChatMessage(db, {
        trip_id: tripId,
        message: 'Summarize our trip',
      });

      expect(res.actions_taken[0].tool).toBe('summarize_itinerary');
      expect(res.reply).toContain('Day 1');
      expect(res.reply).toContain('Fushimi Inari');
      expect(res.reply).toContain('Day transit summary');
    });

    it('General chat: returns welcoming prompt suggestions', async () => {
      const tripId = 'trip-kyoto-2026';
      const res = await processChatMessage(db, {
        trip_id: tripId,
        message: 'Hello!',
      });

      expect(res.reply).toContain('TripPlanner AI Assistant');
      expect(res.reply).toContain('Add Kinkaku-ji');
    });
  });

  describe('API Endpoint Integration (/api/v1/chat)', () => {
    it('GET /api/v1/chat returns 200 with service information and sample prompts', async () => {
      const response = await chatGet({} as any);
      expect(response.status).toBe(200);

      const json = (await response.json()) as any;
      expect(json.status).toBe('online');
      expect(Array.isArray(json.sample_prompts)).toBe(true);
      expect(json.sample_prompts.length).toBeGreaterThan(5);
    });

    it('POST /api/v1/chat returns 200 with chat response for valid message', async () => {
      const req = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: 'trip-kyoto-2026',
          message: 'Who owes whom?',
        }),
      });

      const response = await chatPost({ request: req, locals: {} } as any);
      expect(response.status).toBe(200);

      const json = (await response.json()) as any;
      expect(json.trip_id).toBe('trip-kyoto-2026');
      expect(json.reply).toContain('Budget & Debt Settlement');
      expect(Array.isArray(json.actions_taken)).toBe(true);
      expect(json.updated_trip_summary).toBeTruthy();
    });

    it('POST /api/v1/chat returns RFC 7807 problem details on missing message', async () => {
      const req = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: '   ' }),
      });

      const response = await chatPost({ request: req, locals: {} } as any);
      expect(response.status).toBe(400);

      const json = (await response.json()) as any;
      expect(json.code).toBe('MISSING_MESSAGE');
      expect(json.title).toBe('Missing Required Field');
      expect(Array.isArray(json.suggested_alternatives)).toBe(true);
    });

    it('POST /api/v1/chat returns RFC 7807 problem details on invalid JSON body', async () => {
      const req = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-non-json',
      });

      const response = await chatPost({ request: req, locals: {} } as any);
      expect(response.status).toBe(400);

      const json = (await response.json()) as any;
      expect(json.code).toBe('INVALID_JSON');
    });
  });

  describe('Issue #17: Reactive AGY Session State Synchronization & Contextual Commands', () => {
    it('initializes session tables and defaults active_trip_id to session.active_trip_id when omitted', async () => {
      await ensureSessionTables(db);
      await db.execute(
        "UPDATE workspace_sessions SET active_trip_id = 'trip-kyoto-2026', state_version = 1 WHERE session_id = 'default'"
      );

      // Call processChatMessage without trip_id
      const res = await processChatMessage(db, {
        message: 'Who owes whom?',
      });

      expect(res.trip_id).toBe('trip-kyoto-2026');
      expect(res.session_state).toBeDefined();
      expect(res.session_state?.active_trip_id).toBe('trip-kyoto-2026');
      expect(res.session_state?.state_version).toBe(2);
    });

    it('resolves contextual day references ("today", "this day") using session.active_day_number', async () => {
      await ensureSessionTables(db);
      await db.execute(
        "UPDATE workspace_sessions SET active_trip_id = 'trip-kyoto-2026', active_day_number = 2 WHERE session_id = 'default'"
      );

      const res = await processChatMessage(db, {
        trip_id: 'trip-kyoto-2026',
        message: 'Add Kinkaku-ji to today afternoon',
      });

      expect(res.actions_taken[0].tool).toBe('add_stop');
      expect(res.actions_taken[0].summary).toContain('Day 2');

      // Verify stop is in Day 2
      const stop = await db.queryOne<any>(
        `SELECT s.*, sec.day_id, d.day_number
         FROM stops s
         JOIN sections sec ON s.section_id = sec.id
         JOIN days d ON sec.day_id = d.id
         WHERE s.id = ?`,
        [res.actions_taken[0].payload.stop_id]
      );
      expect(stop).toBeDefined();
      expect(stop.day_number).toBe(2);
    });

    it('resolves contextual stop references ("selected stop", "this stop") using session.selected_stop_id', async () => {
      await ensureSessionTables(db);

      // Pick an existing stop from Day 1
      const stop = await db.queryOne<any>(
        `SELECT s.id, p.name FROM stops s
         JOIN places p ON s.place_id = p.id
         JOIN sections sec ON s.section_id = sec.id
         WHERE sec.trip_id = 'trip-kyoto-2026' LIMIT 1`
      );
      expect(stop).toBeDefined();

      // Set selected_stop_id in session
      await db.execute(
        "UPDATE workspace_sessions SET selected_stop_id = ?, active_trip_id = 'trip-kyoto-2026' WHERE session_id = 'default'",
        [stop.id]
      );

      // Move selected stop
      const moveRes = await processChatMessage(db, {
        trip_id: 'trip-kyoto-2026',
        message: 'Move the selected stop to Day 2 afternoon',
      });

      expect(moveRes.actions_taken[0].tool).toBe('move_stop');
      expect(moveRes.actions_taken[0].payload.stop_id).toBe(stop.id);

      // Delete this stop
      const delRes = await processChatMessage(db, {
        trip_id: 'trip-kyoto-2026',
        message: 'Delete this stop',
      });

      expect(delRes.actions_taken[0].tool).toBe('remove_stop');
      expect(delRes.actions_taken[0].payload.stop_id).toBe(stop.id);

      // Check selected_stop_id was cleared in session
      const sess = await db.queryOne<any>(
        "SELECT selected_stop_id FROM workspace_sessions WHERE session_id = 'default'"
      );
      expect(sess.selected_stop_id).toBeNull();
    });

    it('handles natural-language UI navigation ("switch to budget tab", "show Day 2")', async () => {
      await ensureSessionTables(db);

      const navRes = await processChatMessage(db, {
        trip_id: 'trip-kyoto-2026',
        message: 'switch to budget tab',
      });

      expect(navRes.actions_taken[0].tool).toBe('navigate_session');
      expect(navRes.session_state?.active_tab).toBe('budget');

      const sess = await db.queryOne<any>(
        "SELECT active_tab FROM workspace_sessions WHERE session_id = 'default'"
      );
      expect(sess.active_tab).toBe('budget');

      const dayRes = await processChatMessage(db, {
        trip_id: 'trip-kyoto-2026',
        message: 'show Day 2',
      });
      expect(dayRes.session_state?.active_day_number).toBe(2);
    });

    it('increments state_version and inserts a session_events record on mutations', async () => {
      await ensureSessionTables(db);
      await db.execute("UPDATE workspace_sessions SET state_version = 10 WHERE session_id = 'default'");

      const res = await processChatMessage(db, {
        trip_id: 'trip-kyoto-2026',
        message: 'Add JR Pass to packing list',
        actor: 'agy',
      });

      expect(res.session_state?.state_version).toBe(11);
      expect(res.session_state?.last_actor).toBe('agy');

      const sess = await db.queryOne<any>(
        "SELECT state_version, last_actor, last_event_summary FROM workspace_sessions WHERE session_id = 'default'"
      );
      expect(sess.state_version).toBe(11);
      expect(sess.last_actor).toBe('agy');
      expect(sess.last_event_summary).toContain('JR Pass');

      const event = await db.queryOne<any>(
        "SELECT * FROM session_events WHERE state_version = 11 AND session_id = 'default'"
      );
      expect(event).toBeDefined();
      expect(event.actor).toBe('agy');
      expect(event.action).toBe('manage_checklist');
      expect(event.summary).toContain('JR Pass');
    });

    it('POST /api/v1/chat endpoint returns session_state in HTTP response', async () => {
      const req = new Request('http://localhost/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trip_id: 'trip-kyoto-2026',
          message: 'Who owes whom?',
          actor: 'ui',
        }),
      });

      const response = await chatPost({ request: req, locals: {} } as any);
      expect(response.status).toBe(200);

      const json = (await response.json()) as any;
      expect(json.session_state).toBeDefined();
      expect(json.session_state.active_trip_id).toBe('trip-kyoto-2026');
      expect(json.session_state.state_version).toBeGreaterThanOrEqual(1);
      expect(json.session_state.last_event_summary).toBeTruthy();
    });
  });
});
