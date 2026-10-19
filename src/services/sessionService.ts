import type { DatabaseAdapter } from '../db/client';
import { generateId } from '../lib/http';
import { getTrip, type FullTripHierarchy } from './tripService';
import {
  listExpenses,
  getBudgetSettlement,
  type ExpenseWithSplits,
  type BudgetSettlementResult,
} from './expenseService';
import type { StopDetail, Place, TransitLeg } from '../types/domain';

export type SessionActor = 'ui' | 'agy' | 'chat' | 'system';

export interface WorkspaceSessionRecord {
  session_id: string;
  active_trip_id: string;
  active_day_number: number | null;
  active_tab: string;
  selected_stop_id: string | null;
  last_actor: SessionActor;
  last_event_summary: string;
  state_version: number;
  ui_context_json: string;
  updated_at: string;
}

export interface SessionEventRecord {
  id: string;
  session_id: string;
  trip_id: string | null;
  actor: SessionActor;
  action: string;
  summary: string;
  state_version: number;
  payload_json: string;
  created_at: string;
}

export interface SessionEvent {
  id: string;
  session_id: string;
  trip_id: string | null;
  actor: SessionActor;
  action: string;
  summary: string;
  state_version: number;
  payload: Record<string, any>;
  created_at: string;
}

export interface WorkspaceSession {
  session_id: string;
  active_trip_id: string;
  active_day_number: number | null;
  active_tab: string;
  selected_stop_id: string | null;
  selected_stop?: StopDetail | null;
  last_actor: SessionActor;
  last_event_summary: string;
  state_version: number;
  ui_context: Record<string, any>;
  updated_at: string;
}

export interface CompleteTripData extends FullTripHierarchy {
  expenses: ExpenseWithSplits[];
  budget_settlement: BudgetSettlementResult | null;
}

export interface SessionStateResult {
  session: WorkspaceSession;
  recent_events: SessionEvent[];
  selected_stop: StopDetail | null;
  trip: CompleteTripData | null;
}

export interface UpdateSessionStatePatch {
  session_id?: string;
  active_trip_id?: string;
  active_day_number?: number | null;
  active_tab?: string;
  selected_stop_id?: string | null;
  actor?: SessionActor;
  event_summary?: string;
  action?: string;
  ui_context?: Record<string, any>;
}

export interface RecordSessionMutationInput {
  session_id?: string;
  trip_id?: string;
  actor: SessionActor;
  action: string;
  summary: string;
  active_day_number?: number | null;
  active_tab?: string;
  selected_stop_id?: string | null;
  payload?: Record<string, any>;
}

export interface RecordSessionMutationResult {
  event: SessionEvent;
  session: WorkspaceSession;
  state: SessionStateResult;
}

export interface SessionEventsSinceResult {
  has_changes: boolean;
  current_version: number;
  session: WorkspaceSession;
  events: SessionEvent[];
  trip_data?: CompleteTripData | null;
  active_trip?: CompleteTripData | null;
}

/**
 * Ensures session tables (workspace_sessions & session_events) exist in the database.
 */
export async function ensureSessionTables(db: DatabaseAdapter): Promise<void> {
  await db.execute(`CREATE TABLE IF NOT EXISTS workspace_sessions (
    session_id TEXT PRIMARY KEY,
    active_trip_id TEXT NOT NULL DEFAULT 'trip-kyoto-2026',
    active_day_number INTEGER,
    active_tab TEXT NOT NULL DEFAULT 'itinerary',
    selected_stop_id TEXT,
    last_actor TEXT NOT NULL DEFAULT 'system',
    last_event_summary TEXT NOT NULL DEFAULT 'Session initialized',
    state_version INTEGER NOT NULL DEFAULT 1,
    ui_context_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  await db.execute(`CREATE TABLE IF NOT EXISTS session_events (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL DEFAULT 'default',
    trip_id TEXT,
    actor TEXT NOT NULL DEFAULT 'system',
    action TEXT NOT NULL,
    summary TEXT NOT NULL,
    state_version INTEGER NOT NULL,
    payload_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
}

/**
 * Resolves full StopDetail for a selected stop ID, including place details,
 * transit leg to next stop, and voting counters.
 */
export async function resolveStopDetails(
  db: DatabaseAdapter,
  stopId: string
): Promise<StopDetail | null> {
  const row = await db.queryOne<any>(
    `SELECT
      s.id, s.section_id, s.place_id, s.sort_order, s.arrival_time, s.departure_time,
      s.duration_minutes, s.user_notes, s.budget_amount, s.created_at, s.updated_at,
      p.id as p_id, p.name as p_name, p.formatted_address as p_formatted_address,
      p.lat as p_lat, p.lng as p_lng, p.category as p_category, p.rating as p_rating,
      p.google_place_id as p_google_place_id, p.website as p_website,
      p.phone_number as p_phone_number, p.notes as p_notes,
      p.created_at as p_created_at, p.updated_at as p_updated_at
    FROM stops s
    JOIN places p ON s.place_id = p.id
    WHERE s.id = ?`,
    [stopId]
  );

  if (!row) return null;

  const place: Place = {
    id: row.p_id,
    name: row.p_name,
    formatted_address: row.p_formatted_address,
    lat: row.p_lat,
    lng: row.p_lng,
    category: row.p_category,
    rating: row.p_rating,
    google_place_id: row.p_google_place_id,
    website: row.p_website,
    phone_number: row.p_phone_number,
    notes: row.p_notes,
    created_at: row.p_created_at,
    updated_at: row.p_updated_at,
  };

  const transitLeg = await db.queryOne<TransitLeg>(
    'SELECT * FROM transit_legs WHERE from_stop_id = ? LIMIT 1',
    [stopId]
  );

  const votes = await db.query<{ vote_type: string; count: number }>(
    'SELECT vote_type, COUNT(*) as count FROM stop_votes WHERE stop_id = ? GROUP BY vote_type',
    [stopId]
  );
  let up = 0;
  let down = 0;
  for (const v of votes) {
    if (v.vote_type === 'up') up = Number(v.count);
    if (v.vote_type === 'down') down = Number(v.count);
  }

  return {
    id: row.id,
    section_id: row.section_id,
    place_id: row.place_id,
    sort_order: row.sort_order,
    arrival_time: row.arrival_time,
    departure_time: row.departure_time,
    duration_minutes: row.duration_minutes,
    user_notes: row.user_notes,
    budget_amount: row.budget_amount,
    created_at: row.created_at,
    updated_at: row.updated_at,
    place,
    transit_to_next: transitLeg ?? null,
    votes: { up, down },
  };
}

/**
 * Formats raw session record into typed WorkspaceSession object.
 */
function formatSession(
  row: WorkspaceSessionRecord,
  selectedStop?: StopDetail | null
): WorkspaceSession {
  let uiContext: Record<string, any> = {};
  try {
    uiContext = JSON.parse(row.ui_context_json || '{}');
  } catch {
    uiContext = {};
  }

  return {
    session_id: row.session_id,
    active_trip_id: row.active_trip_id,
    active_day_number: row.active_day_number !== null ? Number(row.active_day_number) : null,
    active_tab: row.active_tab,
    selected_stop_id: row.selected_stop_id,
    selected_stop: selectedStop ?? null,
    last_actor: row.last_actor,
    last_event_summary: row.last_event_summary,
    state_version: Number(row.state_version),
    ui_context: uiContext,
    updated_at: row.updated_at,
  };
}

/**
 * Formats raw event record into typed SessionEvent object.
 */
function formatEvent(row: SessionEventRecord): SessionEvent {
  let payload: Record<string, any> = {};
  try {
    payload = JSON.parse(row.payload_json || '{}');
  } catch {
    payload = {};
  }

  return {
    id: row.id,
    session_id: row.session_id,
    trip_id: row.trip_id,
    actor: row.actor,
    action: row.action,
    summary: row.summary,
    state_version: Number(row.state_version),
    payload,
    created_at: row.created_at,
  };
}

/**
 * Loads the complete synchronized hierarchical trip data for the active trip.
 */
async function loadCompleteTrip(
  db: DatabaseAdapter,
  tripId: string
): Promise<CompleteTripData | null> {
  const tripHierarchy = await getTrip(db, tripId, 'full');
  if (!tripHierarchy) return null;

  let expensesWithSplits: ExpenseWithSplits[] = [];
  try {
    expensesWithSplits = await listExpenses(db, tripId);
  } catch {
    expensesWithSplits = (tripHierarchy.expenses || []) as any;
  }

  let budgetSettlement: BudgetSettlementResult | null = null;
  try {
    budgetSettlement = await getBudgetSettlement(db, tripId);
  } catch {
    budgetSettlement = null;
  }

  return {
    ...tripHierarchy,
    expenses: expensesWithSplits,
    budget_settlement: budgetSettlement,
  };
}

/**
 * Retrieves the full synchronized session state.
 * Ensures the session row exists (pointing to 'trip-kyoto-2026' or first available trip).
 * Queries recent session_events (last 15 ordered by state_version DESC),
 * resolves selected_stop details when set, and loads complete trip hierarchy when includeTrip !== false.
 */
export async function getSessionState(
  db: DatabaseAdapter,
  sessionId: string = 'default',
  options?: { includeTrip?: boolean }
): Promise<SessionStateResult> {
  await ensureSessionTables(db);

  let sessionRow = await db.queryOne<WorkspaceSessionRecord>(
    'SELECT * FROM workspace_sessions WHERE session_id = ?',
    [sessionId]
  );

  if (!sessionRow) {
    let initialTripId = 'trip-kyoto-2026';
    const checkTrip = await db.queryOne<{ id: string }>(
      'SELECT id FROM trips WHERE id = ?',
      [initialTripId]
    );
    if (!checkTrip) {
      const firstTrip = await db.queryOne<{ id: string }>(
        'SELECT id FROM trips ORDER BY created_at ASC LIMIT 1'
      );
      if (firstTrip) {
        initialTripId = firstTrip.id;
      }
    }

    await db.execute(
      `INSERT INTO workspace_sessions (
        session_id, active_trip_id, active_day_number, active_tab, selected_stop_id,
        last_actor, last_event_summary, state_version, ui_context_json, updated_at
      ) VALUES (?, ?, 1, 'itinerary', NULL, 'system', 'Session initialized', 1, '{}', datetime('now'))`,
      [sessionId, initialTripId]
    );

    const initEventId = generateId('event');
    await db.execute(
      `INSERT INTO session_events (
        id, session_id, trip_id, actor, action, summary, state_version, payload_json, created_at
      ) VALUES (?, ?, ?, 'system', 'session_init', 'Session initialized', 1, '{}', datetime('now'))`,
      [initEventId, sessionId, initialTripId]
    );

    sessionRow = await db.queryOne<WorkspaceSessionRecord>(
      'SELECT * FROM workspace_sessions WHERE session_id = ?',
      [sessionId]
    );
    if (!sessionRow) {
      throw new Error(`Failed to initialize session '${sessionId}'`);
    }
  }

  // Fetch recent events (last 15 ordered by state_version DESC)
  const recentEventRows = await db.query<SessionEventRecord>(
    `SELECT * FROM session_events
     WHERE session_id = ?
     ORDER BY state_version DESC, created_at DESC
     LIMIT 15`,
    [sessionId]
  );
  const recentEvents = recentEventRows.map(formatEvent);

  // Resolve selected stop if set
  let selectedStop: StopDetail | null = null;
  if (sessionRow.selected_stop_id) {
    selectedStop = await resolveStopDetails(db, sessionRow.selected_stop_id);
  }

  const session = formatSession(sessionRow, selectedStop);

  // Load complete trip hierarchy if requested
  let tripData: CompleteTripData | null = null;
  if (options?.includeTrip !== false && session.active_trip_id) {
    tripData = await loadCompleteTrip(db, session.active_trip_id);
  }

  return {
    session,
    recent_events: recentEvents,
    selected_stop: selectedStop,
    trip: tripData,
  };
}

/**
 * Updates the session state, increments state_version = state_version + 1,
 * updates updated_at, records an entry into session_events, and returns
 * the updated complete session state.
 */
export async function updateSessionState(
  db: DatabaseAdapter,
  patch: UpdateSessionStatePatch
): Promise<SessionStateResult> {
  await ensureSessionTables(db);
  const sessionId = patch.session_id || 'default';

  // Ensure baseline session exists
  await getSessionState(db, sessionId, { includeTrip: false });

  const current = await db.queryOne<WorkspaceSessionRecord>(
    'SELECT * FROM workspace_sessions WHERE session_id = ?',
    [sessionId]
  );
  if (!current) {
    throw new Error(`Session '${sessionId}' not found.`);
  }

  const nextVersion = Number(current.state_version) + 1;
  const newTripId =
    patch.active_trip_id !== undefined ? patch.active_trip_id : current.active_trip_id;
  const newDayNumber =
    patch.active_day_number !== undefined
      ? patch.active_day_number
      : current.active_day_number;
  const newTab = patch.active_tab !== undefined ? patch.active_tab : current.active_tab;
  const newSelectedStopId =
    patch.selected_stop_id !== undefined
      ? patch.selected_stop_id
      : current.selected_stop_id;
  const newActor: SessionActor = patch.actor || 'system';
  const newSummary = patch.event_summary || patch.action || 'Session updated';
  const newAction = patch.action || 'update_session';

  let currentUiContext: Record<string, any> = {};
  try {
    currentUiContext = JSON.parse(current.ui_context_json || '{}');
  } catch {}

  const mergedUiContext =
    patch.ui_context !== undefined
      ? { ...currentUiContext, ...patch.ui_context }
      : currentUiContext;

  await db.execute(
    `UPDATE workspace_sessions SET
      active_trip_id = ?,
      active_day_number = ?,
      active_tab = ?,
      selected_stop_id = ?,
      last_actor = ?,
      last_event_summary = ?,
      state_version = ?,
      ui_context_json = ?,
      updated_at = datetime('now')
    WHERE session_id = ?`,
    [
      newTripId,
      newDayNumber,
      newTab,
      newSelectedStopId,
      newActor,
      newSummary,
      nextVersion,
      JSON.stringify(mergedUiContext),
      sessionId,
    ]
  );

  const eventId = generateId('event');
  const payloadJson = JSON.stringify({
    ...patch,
    previous_version: current.state_version,
    new_version: nextVersion,
  });

  await db.execute(
    `INSERT INTO session_events (
      id, session_id, trip_id, actor, action, summary, state_version, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      eventId,
      sessionId,
      newTripId,
      newActor,
      newAction,
      newSummary,
      nextVersion,
      payloadJson,
    ]
  );

  return await getSessionState(db, sessionId, { includeTrip: true });
}

/**
 * Records an explicit session mutation event (e.g. from agy CLI, chat assistant, or UI).
 * Increments state_version on workspace_sessions, updates session fields if provided,
 * and inserts a record into session_events.
 */
export async function recordSessionMutation(
  db: DatabaseAdapter,
  input: RecordSessionMutationInput
): Promise<RecordSessionMutationResult> {
  await ensureSessionTables(db);
  const sessionId = input.session_id || 'default';

  // Ensure baseline session exists
  await getSessionState(db, sessionId, { includeTrip: false });

  const current = await db.queryOne<WorkspaceSessionRecord>(
    'SELECT * FROM workspace_sessions WHERE session_id = ?',
    [sessionId]
  );
  if (!current) {
    throw new Error(`Session '${sessionId}' not found.`);
  }

  const nextVersion = Number(current.state_version) + 1;
  const newTripId = input.trip_id !== undefined ? input.trip_id : current.active_trip_id;
  const newDayNumber =
    input.active_day_number !== undefined
      ? input.active_day_number
      : current.active_day_number;
  const newTab = input.active_tab !== undefined ? input.active_tab : current.active_tab;
  const newSelectedStopId =
    input.selected_stop_id !== undefined
      ? input.selected_stop_id
      : current.selected_stop_id;

  await db.execute(
    `UPDATE workspace_sessions SET
      active_trip_id = ?,
      active_day_number = ?,
      active_tab = ?,
      selected_stop_id = ?,
      last_actor = ?,
      last_event_summary = ?,
      state_version = ?,
      updated_at = datetime('now')
    WHERE session_id = ?`,
    [
      newTripId,
      newDayNumber,
      newTab,
      newSelectedStopId,
      input.actor,
      input.summary,
      nextVersion,
      sessionId,
    ]
  );

  const eventId = generateId('event');
  const payloadJson = JSON.stringify(input.payload || {});

  await db.execute(
    `INSERT INTO session_events (
      id, session_id, trip_id, actor, action, summary, state_version, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      eventId,
      sessionId,
      newTripId,
      input.actor,
      input.action,
      input.summary,
      nextVersion,
      payloadJson,
    ]
  );

  const state = await getSessionState(db, sessionId, { includeTrip: true });
  const event: SessionEvent = {
    id: eventId,
    session_id: sessionId,
    trip_id: newTripId,
    actor: input.actor,
    action: input.action,
    summary: input.summary,
    state_version: nextVersion,
    payload: input.payload || {},
    created_at: new Date().toISOString(),
  };

  return {
    event,
    session: state.session,
    state,
  };
}

/**
 * Returns session events and state updates since a given state version.
 * Used by UI polling and incremental synchronization.
 */
export async function getSessionEventsSince(
  db: DatabaseAdapter,
  sinceVersion: number,
  sessionId: string = 'default',
  options?: { includeTrip?: boolean }
): Promise<SessionEventsSinceResult> {
  await ensureSessionTables(db);

  const sessionRow = await db.queryOne<WorkspaceSessionRecord>(
    'SELECT * FROM workspace_sessions WHERE session_id = ?',
    [sessionId]
  );

  if (!sessionRow) {
    const initialState = await getSessionState(db, sessionId, options);
    return {
      has_changes: true,
      current_version: initialState.session.state_version,
      session: initialState.session,
      events: initialState.recent_events,
      trip_data: initialState.trip,
      active_trip: initialState.trip,
    };
  }

  const currentVersion = Number(sessionRow.state_version);

  if (currentVersion <= sinceVersion) {
    let selectedStop: StopDetail | null = null;
    if (sessionRow.selected_stop_id) {
      selectedStop = await resolveStopDetails(db, sessionRow.selected_stop_id);
    }
    const session = formatSession(sessionRow, selectedStop);
    return {
      has_changes: false,
      current_version: currentVersion,
      session,
      events: [],
    };
  }

  // Version has incremented: load delta events
  const deltaRows = await db.query<SessionEventRecord>(
    `SELECT * FROM session_events
     WHERE session_id = ? AND state_version > ?
     ORDER BY state_version ASC, created_at ASC`,
    [sessionId, sinceVersion]
  );
  const deltaEvents = deltaRows.map(formatEvent);

  let selectedStop: StopDetail | null = null;
  if (sessionRow.selected_stop_id) {
    selectedStop = await resolveStopDetails(db, sessionRow.selected_stop_id);
  }
  const session = formatSession(sessionRow, selectedStop);

  let tripData: CompleteTripData | null = null;
  if (options?.includeTrip !== false && session.active_trip_id) {
    tripData = await loadCompleteTrip(db, session.active_trip_id);
  }

  return {
    has_changes: true,
    current_version: currentVersion,
    session,
    events: deltaEvents,
    trip_data: tripData,
    active_trip: tripData,
  };
}
