import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestDb,
  getDb,
  setTestDb,
  getKvCache,
  MemoryKvAdapter,
  type DatabaseAdapter,
} from '../src/db/client';
import {
  jsonResponse,
  problemResponse,
  parseViewMode,
  generateId,
} from '../src/lib/http';
import type {
  Trip,
  Collaborator,
  Day,
  Section,
  Place,
  Stop,
  TransitLeg,
  Reservation,
  Expense,
  ExpenseSplit,
  Checklist,
  ChecklistItem,
  TripNote,
  StopVote,
  ProblemDetails,
} from '../src/types/domain';

describe('Foundation: DatabaseAdapter & Schema Initialization', () => {
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = await createTestDb(true);
    setTestDb(db);
  });

  afterEach(() => {
    setTestDb(null);
  });

  it('initializes all 14 schema tables and enables foreign keys', async () => {
    const tables = await db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const tableNames = tables.map((t) => t.name);

    const expectedTables = [
      'checklist_items',
      'checklists',
      'collaborators',
      'days',
      'expense_splits',
      'expenses',
      'places',
      'reservations',
      'sections',
      'stop_votes',
      'stops',
      'transit_legs',
      'trip_notes',
      'trips',
    ];

    for (const expected of expectedTables) {
      expect(tableNames).toContain(expected);
    }
  });

  it('seeds the realistic 5-Day Kyoto Autumn Expedition trip', async () => {
    const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', ['trip-kyoto-2026']);
    expect(trip).not.toBeNull();
    expect(trip?.title).toBe('5-Day Kyoto Autumn Expedition');
    expect(trip?.destination).toBe('Kyoto, Japan');
    expect(trip?.start_date).toBe('2026-11-01');
    expect(trip?.end_date).toBe('2026-11-05');
    expect(trip?.timezone).toBe('Asia/Tokyo');
    expect(trip?.currency).toBe('USD');
    expect(trip?.budget_cap).toBe(2500);
  });

  it('seeds trip collaborators: Alice (owner) and Bob (editor)', async () => {
    const collaborators = await db.query<Collaborator>(
      'SELECT * FROM collaborators WHERE trip_id = ? ORDER BY role DESC',
      ['trip-kyoto-2026']
    );
    expect(collaborators).toHaveLength(2);

    const alice = collaborators.find((c) => c.id === 'collab-alice');
    const bob = collaborators.find((c) => c.id === 'collab-bob');

    expect(alice).toBeDefined();
    expect(alice?.role).toBe('owner');
    expect(alice?.email).toBe('alice@example.com');

    expect(bob).toBeDefined();
    expect(bob?.role).toBe('editor');
    expect(bob?.email).toBe('bob@example.com');
  });

  it('seeds 5 calendar days with correct dates', async () => {
    const days = await db.query<Day>(
      'SELECT * FROM days WHERE trip_id = ? ORDER BY day_number ASC',
      ['trip-kyoto-2026']
    );
    expect(days).toHaveLength(5);
    expect(days[0].date).toBe('2026-11-01');
    expect(days[4].date).toBe('2026-11-05');
  });

  it('seeds scheduled morning/afternoon/evening sections plus wishlist section', async () => {
    const sections = await db.query<Section>(
      'SELECT * FROM sections WHERE trip_id = ? ORDER BY sort_order ASC',
      ['trip-kyoto-2026']
    );
    // 5 days * 3 sections + 1 wishlist = 16 sections
    expect(sections).toHaveLength(16);

    const wishlist = sections.find((s) => s.section_type === 'wishlist');
    expect(wishlist).toBeDefined();
    expect(wishlist?.day_id).toBeNull();
    expect(wishlist?.title).toBe('Places to Visit');
  });

  it('seeds canonical Kyoto places with geographic coordinates', async () => {
    const places = await db.query<Place>('SELECT * FROM places ORDER BY name ASC');
    expect(places.length).toBeGreaterThanOrEqual(7);

    const fushimi = places.find((p) => p.id === 'place-fushimi');
    expect(fushimi).toBeDefined();
    expect(fushimi?.category).toBe('attraction');
    expect(fushimi?.lat).toBeCloseTo(34.9671, 3);
    expect(fushimi?.lng).toBeCloseTo(135.7727, 3);

    const kinkaku = places.find((p) => p.id === 'place-kinkaku');
    expect(kinkaku).toBeDefined();
    expect(kinkaku?.rating).toBe(4.7);
  });

  it('seeds itinerary stops with durations and notes', async () => {
    const stops = await db.query<Stop>('SELECT * FROM stops');
    expect(stops.length).toBeGreaterThanOrEqual(7);

    const fushimiStop = stops.find((s) => s.id === 'stop-fushimi');
    expect(fushimiStop).toBeDefined();
    expect(fushimiStop?.arrival_time).toBe('09:00');
    expect(fushimiStop?.duration_minutes).toBe(150);
  });

  it('seeds transit legs between consecutive stops', async () => {
    const legs = await db.query<TransitLeg>('SELECT * FROM transit_legs WHERE trip_id = ?', [
      'trip-kyoto-2026',
    ]);
    expect(legs.length).toBe(2);

    const leg1 = legs.find((l) => l.id === 'leg-d1-fushimi-ichiran');
    expect(leg1).toBeDefined();
    expect(leg1?.transit_mode).toBe('transit');
    expect(leg1?.duration_seconds).toBe(1200);
    expect(leg1?.distance_meters).toBe(4500);
  });

  it('seeds flight and hotel reservations', async () => {
    const reservations = await db.query<Reservation>(
      'SELECT * FROM reservations WHERE trip_id = ? ORDER BY cost DESC',
      ['trip-kyoto-2026']
    );
    expect(reservations).toHaveLength(2);

    const hotel = reservations.find((r) => r.type === 'lodging');
    expect(hotel?.cost).toBe(600);
    expect(hotel?.confirmation_code).toBe('PH-449102');

    const flight = reservations.find((r) => r.type === 'flight');
    expect(flight?.cost).toBe(350);
    expect(flight?.provider).toBe('All Nippon Airways');
  });

  it('seeds expenses and expense splits', async () => {
    const expenses = await db.query<Expense>('SELECT * FROM expenses WHERE trip_id = ?', [
      'trip-kyoto-2026',
    ]);
    expect(expenses).toHaveLength(2);

    const hotelExp = expenses.find((e) => e.id === 'exp-hotel');
    expect(hotelExp?.amount).toBe(600.0);
    expect(hotelExp?.paid_by_collaborator_id).toBe('collab-alice');

    const splits = await db.query<ExpenseSplit>(
      'SELECT * FROM expense_splits WHERE expense_id = ?',
      ['exp-hotel']
    );
    expect(splits).toHaveLength(2);
    expect(splits[0].amount_owed).toBe(300.0);
    expect(splits[1].amount_owed).toBe(300.0);
  });

  it('seeds checklists and checklist items', async () => {
    const checklists = await db.query<Checklist>('SELECT * FROM checklists WHERE trip_id = ?', [
      'trip-kyoto-2026',
    ]);
    expect(checklists).toHaveLength(2);

    const items = await db.query<ChecklistItem>(
      'SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY sort_order ASC',
      ['chk-pre-trip']
    );
    expect(items).toHaveLength(3);
    expect(items[0].is_completed).toBe(1);
    expect(items[1].is_completed).toBe(0);
    expect(items[1].assigned_to_collaborator_id).toBe('collab-bob');
  });

  it('seeds collaborative notes and stop votes', async () => {
    const notes = await db.query<TripNote>('SELECT * FROM trip_notes WHERE trip_id = ?', [
      'trip-kyoto-2026',
    ]);
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe('Kyoto Travel Tips & Etiquette');
    expect(notes[0].content).toContain('IC Cards: Use Suica');

    const votes = await db.query<StopVote>('SELECT * FROM stop_votes');
    expect(votes.length).toBeGreaterThanOrEqual(3);
  });
});

describe('DatabaseAdapter: query, execute, and batch operations', () => {
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = await createTestDb(false); // empty db without seeds
  });

  it('executes INSERT, UPDATE, queryOne, and DELETE cleanly', async () => {
    // 1. Insert a trip
    const insertResult = await db.execute(
      `INSERT INTO trips (id, title, destination, start_date, end_date)
       VALUES (?, ?, ?, ?, ?)`,
      ['trip-test-1', 'Tokyo Weekend', 'Tokyo, Japan', '2026-10-01', '2026-10-03']
    );
    expect(insertResult.changes).toBe(1);

    // 2. queryOne
    const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', ['trip-test-1']);
    expect(trip).not.toBeNull();
    expect(trip?.title).toBe('Tokyo Weekend');

    // 3. Update
    const updateResult = await db.execute(
      'UPDATE trips SET title = ? WHERE id = ?',
      ['Tokyo Long Weekend', 'trip-test-1']
    );
    expect(updateResult.changes).toBe(1);

    const updated = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', ['trip-test-1']);
    expect(updated?.title).toBe('Tokyo Long Weekend');

    // 4. Delete
    const deleteResult = await db.execute('DELETE FROM trips WHERE id = ?', ['trip-test-1']);
    expect(deleteResult.changes).toBe(1);

    const deleted = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', ['trip-test-1']);
    expect(deleted).toBeNull();
  });

  it('executes batch statements transactionally', async () => {
    await db.batch([
      {
        sql: 'INSERT INTO trips (id, title, destination, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
        params: ['trip-batch-1', 'Osaka Food Tour', 'Osaka', '2026-12-01', '2026-12-03'],
      },
      {
        sql: 'INSERT INTO trips (id, title, destination, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
        params: ['trip-batch-2', 'Nara Deer Park', 'Nara', '2026-12-04', '2026-12-05'],
      },
    ]);

    const trips = await db.query<Trip>('SELECT * FROM trips ORDER BY id ASC');
    expect(trips).toHaveLength(2);
    expect(trips[0].id).toBe('trip-batch-1');
    expect(trips[1].id).toBe('trip-batch-2');
  });

  it('enforces foreign key cascading deletes', async () => {
    await db.execute(
      'INSERT INTO trips (id, title, destination, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
      ['trip-cascade', 'Hokkaido Snow', 'Sapporo', '2027-01-10', '2027-01-15']
    );
    await db.execute(
      'INSERT INTO collaborators (id, trip_id, name, email, role) VALUES (?, ?, ?, ?, ?)',
      ['collab-casc', 'trip-cascade', 'Charlie', 'charlie@example.com', 'editor']
    );

    // Verify collaborator exists
    const collabBefore = await db.queryOne(
      'SELECT * FROM collaborators WHERE id = ?',
      ['collab-casc']
    );
    expect(collabBefore).not.toBeNull();

    // Delete trip
    await db.execute('DELETE FROM trips WHERE id = ?', ['trip-cascade']);

    // Collaborator should be cascaded
    const collabAfter = await db.queryOne(
      'SELECT * FROM collaborators WHERE id = ?',
      ['collab-casc']
    );
    expect(collabAfter).toBeNull();
  });
});

describe('getDb & setTestDb Integration', () => {
  it('returns the configured test database when setTestDb is used', async () => {
    const customTestDb = await createTestDb(false);
    setTestDb(customTestDb);

    const activeDb = await getDb();
    expect(activeDb).toBe(customTestDb);

    setTestDb(null);
  });

  it('auto-initializes Cloudflare D1 schema and seeds default trip when trips table does not exist', async () => {
    const { default: Database } = await import('better-sqlite3');
    const rawSqlite = new Database(':memory:');
    rawSqlite.pragma('foreign_keys = ON');

    const createStmtWrapper = (sql: string, boundParams: any[] = []) => ({
      bind: (...params: any[]) => createStmtWrapper(sql, params),
      all: async () => ({ results: rawSqlite.prepare(sql).all(...boundParams) }),
      first: async () => rawSqlite.prepare(sql).get(...boundParams) ?? null,
      run: async () => {
        const res = rawSqlite.prepare(sql).run(...boundParams);
        return { meta: { changes: res.changes, last_row_id: res.lastInsertRowid } };
      },
    });

    const mockD1 = {
      prepare: (sql: string) => createStmtWrapper(sql),
      batch: async (stmts: any[]) => {
        for (const s of stmts) {
          await s.run();
        }
      },
      exec: async () => {
        throw new Error('D1_EXEC_ERROR: workerd multi-line comment failure');
      },
    };

    const d1Adapter = await getDb({ DB: mockD1 });
    const seededTrip = await d1Adapter.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [
      'trip-kyoto-2026',
    ]);
    expect(seededTrip).not.toBeNull();
    expect(seededTrip?.title).toBe('5-Day Kyoto Autumn Expedition');

    const stops = await d1Adapter.query<Stop>('SELECT * FROM stops');
    expect(stops.length).toBeGreaterThanOrEqual(7);
  });
});

describe('KvCacheAdapter', () => {
  it('supports put, get, and delete with in-memory TTL caching', async () => {
    const kv = new MemoryKvAdapter();

    // 1. Put and get
    await kv.put('user:session:123', 'session-token-abc');
    let val = await kv.get('user:session:123');
    expect(val).toBe('session-token-abc');

    // 2. Delete
    await kv.delete('user:session:123');
    val = await kv.get('user:session:123');
    expect(val).toBeNull();

    // 3. Non-existent key
    val = await kv.get('random-key');
    expect(val).toBeNull();
  });

  it('expires entries past expirationTtl', async () => {
    const kv = new MemoryKvAdapter();

    // Put with 0 second TTL (immediate expiration)
    await kv.put('short-lived', 'temporary-val', { expirationTtl: -1 });
    const expiredVal = await kv.get('short-lived');
    expect(expiredVal).toBeNull();
  });

  it('getKvCache returns memory adapter fallback when no Cloudflare env is present', async () => {
    const kv = getKvCache();
    await kv.put('fallback-test', 'active');
    const res = await kv.get('fallback-test');
    expect(res).toBe('active');
    await kv.delete('fallback-test');
  });
});

describe('HTTP Utilities (src/lib/http.ts)', () => {
  it('jsonResponse produces correct Content-Type and JSON status', async () => {
    const payload = { success: true, count: 42 };
    const res = jsonResponse(payload, 201, { 'X-Custom-Header': 'Kyoto' });

    expect(res.status).toBe(201);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('X-Custom-Header')).toBe('Kyoto');

    const body = await res.json();
    expect(body).toEqual(payload);
  });

  it('problemResponse formats RFC 7807 self-healing error payloads', async () => {
    const res = problemResponse({
      status: 404,
      code: 'ERR_TRIP_NOT_FOUND',
      title: 'Trip Not Found',
      detail: 'The requested trip trip-unknown does not exist.',
      suggested_alternatives: [
        'Check /api/trips to list available trips',
        'Use default demo trip ID: trip-kyoto-2026',
      ],
      instance: '/api/trips/trip-unknown',
    });

    expect(res.status).toBe(404);
    expect(res.headers.get('Content-Type')).toContain('application/problem+json');

    const body: ProblemDetails = await res.json();
    expect(body.title).toBe('Trip Not Found');
    expect(body.status).toBe(404);
    expect(body.code).toBe('ERR_TRIP_NOT_FOUND');
    expect(body.type).toBe('https://tripplanner.dev/errors/err-trip-not-found');
    expect(body.detail).toBe('The requested trip trip-unknown does not exist.');
    expect(body.instance).toBe('/api/trips/trip-unknown');
    expect(body.suggested_alternatives).toHaveLength(2);
    expect(body.suggested_alternatives?.[1]).toContain('trip-kyoto-2026');
  });

  it('parseViewMode parses compact and full projections', () => {
    expect(parseViewMode('http://localhost/api/trips/123?view=compact')).toBe('compact');
    expect(parseViewMode('http://localhost/api/trips/123?view=COMPACT')).toBe('compact');
    expect(parseViewMode('http://localhost/api/trips/123?view=full')).toBe('full');
    expect(parseViewMode('http://localhost/api/trips/123')).toBe('full');
    expect(parseViewMode(new URL('https://tripplanner.dev/api/trips?view=compact'))).toBe('compact');
  });

  it('generateId produces uniquely prefixed identifiers', () => {
    const id1 = generateId('trip');
    const id2 = generateId('trip');
    const stopId = generateId('stop');

    expect(id1.startsWith('trip-')).toBe(true);
    expect(stopId.startsWith('stop-')).toBe(true);
    expect(id1).not.toBe(id2);
  });
});
