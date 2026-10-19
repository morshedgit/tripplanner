import type { DatabaseAdapter } from '../db/client';
import { generateId } from '../lib/http';
import type { Trip, Day, Section, Stop, Place } from '../types/domain';
import { listTrips, createTrip, getTrip, getTripSummary, type CreateTripInput } from './tripService';
import { addTripStop, moveTripStop, deleteTripStop, type AddTripStopInput } from './stopService';
import { optimizeDayRoute, type TransitCalculationResult } from './routingService';
import { createReservation, type CreateReservationInput } from './reservationService';
import { createExpense, getBudgetSettlement, type CreateExpenseInput } from './expenseService';
import { addChecklistItem, toggleChecklistItem, type AddChecklistItemInput } from './checklistService';
import { processChatMessage } from './chatAgentService';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface WorkspaceSessionRecord {
  session_id: string;
  active_trip_id: string;
  active_day_number: number | null;
  active_tab: string;
  selected_stop_id: string | null;
  last_actor: string;
  last_event_summary: string;
  state_version: number;
  ui_context_json: string;
  updated_at: string;
}

export interface SessionEventRecord {
  id: string;
  session_id: string;
  trip_id: string | null;
  actor: string;
  action: string;
  summary: string;
  state_version: number;
  payload_json: string;
  created_at: string;
}

export interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, any>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// ============================================================================
// Database Session Helpers
// ============================================================================

/**
 * Ensures workspace_sessions and session_events tables exist in the database.
 */
export async function ensureSessionTables(db: DatabaseAdapter): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS workspace_sessions (
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
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS session_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL DEFAULT 'default',
      trip_id TEXT,
      actor TEXT NOT NULL DEFAULT 'system',
      action TEXT NOT NULL,
      summary TEXT NOT NULL,
      state_version INTEGER NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Retrieves the current workspace session or initializes a default one if absent.
 */
export async function getOrCreateSession(
  db: DatabaseAdapter,
  sessionId: string = 'default'
): Promise<WorkspaceSessionRecord> {
  await ensureSessionTables(db);

  let session = await db.queryOne<WorkspaceSessionRecord>(
    'SELECT * FROM workspace_sessions WHERE session_id = ?',
    [sessionId]
  );

  if (!session) {
    const trip = await db.queryOne<{ id: string }>('SELECT id FROM trips ORDER BY start_date ASC LIMIT 1');
    const defaultTripId = trip?.id || 'trip-kyoto-2026';

    await db.execute(
      `INSERT INTO workspace_sessions (
        session_id, active_trip_id, active_day_number, active_tab, selected_stop_id,
        last_actor, last_event_summary, state_version, ui_context_json, updated_at
      ) VALUES (?, ?, 1, 'itinerary', NULL, 'system', 'Session initialized', 1, '{}', datetime('now'))`,
      [sessionId, defaultTripId]
    );

    await db.execute(
      `INSERT INTO session_events (
        id, session_id, trip_id, actor, action, summary, state_version, payload_json, created_at
      ) VALUES (?, ?, ?, 'system', 'init', 'Session initialized', 1, '{}', datetime('now'))`,
      [generateId('evt'), sessionId, defaultTripId]
    );

    session = await db.queryOne<WorkspaceSessionRecord>(
      'SELECT * FROM workspace_sessions WHERE session_id = ?',
      [sessionId]
    );
  }

  return session!;
}

/**
 * Atomically updates session fields, increments state_version, sets last_actor,
 * and records a mutation event in session_events.
 */
export async function bumpSessionState(
  db: DatabaseAdapter,
  options: {
    sessionId?: string;
    tripId?: string;
    actor?: string;
    action: string;
    summary: string;
    patch?: Partial<{
      active_trip_id: string;
      active_day_number: number | null;
      active_tab: string;
      selected_stop_id: string | null;
      ui_context_json: string;
    }>;
    payload?: Record<string, any>;
  }
): Promise<WorkspaceSessionRecord> {
  const sessionId = options.sessionId || 'default';
  const session = await getOrCreateSession(db, sessionId);

  const newVersion = (session.state_version || 1) + 1;
  const actor = options.actor || 'agy';
  const summary = options.summary;

  const activeTripId = options.patch?.active_trip_id ?? options.tripId ?? session.active_trip_id;
  const activeDayNumber =
    options.patch?.active_day_number !== undefined
      ? options.patch.active_day_number
      : session.active_day_number;
  const activeTab = options.patch?.active_tab ?? session.active_tab;
  const selectedStopId =
    options.patch?.selected_stop_id !== undefined
      ? options.patch.selected_stop_id
      : session.selected_stop_id;
  const uiContextJson = options.patch?.ui_context_json ?? session.ui_context_json;

  await db.execute(
    `UPDATE workspace_sessions
     SET active_trip_id = ?,
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
      activeTripId,
      activeDayNumber,
      activeTab,
      selectedStopId,
      actor,
      summary,
      newVersion,
      uiContextJson,
      sessionId,
    ]
  );

  const eventId = generateId('evt');
  await db.execute(
    `INSERT INTO session_events (
      id, session_id, trip_id, actor, action, summary, state_version, payload_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [
      eventId,
      sessionId,
      activeTripId,
      actor,
      options.action,
      summary,
      newVersion,
      JSON.stringify(options.payload || {}),
    ]
  );

  return (await db.queryOne<WorkspaceSessionRecord>(
    'SELECT * FROM workspace_sessions WHERE session_id = ?',
    [sessionId]
  ))!;
}

// ============================================================================
// MCP Server Tools Specification
// ============================================================================

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'get_session_context',
    description:
      'Returns the live session state (active_trip_id, active_day_number, active_tab, selected_stop_id, last_actor, last_event_summary, state_version), what the user last interacted with in the UI, and a summary of the active trip & selected day/stop.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: "Session ID (defaults to 'default')" },
      },
    },
  },
  {
    name: 'navigate_ui',
    description:
      'Allows the agy session to control the open Web UI (active_trip_id, active_day_number, active_tab, selected_stop_id, message), incrementing state_version so the browser immediately switches views, tabs, days, or highlights a stop on the map.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: "Session ID (defaults to 'default')" },
        active_trip_id: { type: 'string', description: 'Switch the active trip displayed in the UI' },
        active_day_number: { type: 'integer', description: 'Switch to a specific day itinerary' },
        active_tab: {
          type: 'string',
          enum: ['itinerary', 'wishlist', 'bookings', 'budget', 'checklists'],
          description: 'Switch the active navigation tab',
        },
        selected_stop_id: {
          type: 'string',
          description: 'Focus/highlight a specific stop on the itinerary list and map pin',
        },
        message: { type: 'string', description: 'Summary message displayed as a toast notification in the UI' },
      },
    },
  },
  {
    name: 'chat_with_tripplanner',
    description:
      'Executes a natural-language command against the active trip (using itinerary, routing, reservation, expense, or checklist services) and updates workspace_sessions so the UI stays synchronized.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Natural-language user command or query' },
        session_id: { type: 'string', description: "Session ID (defaults to 'default')" },
        trip_id: { type: 'string', description: 'Trip ID (defaults to active_trip_id from session)' },
      },
      required: ['message'],
    },
  },
  {
    name: 'list_trips',
    description: 'Lists all trips available in the TripPlanner workspace.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'create_trip',
    description:
      'Creates a new trip with auto-generated days and scheduled sections, optionally setting it as the active trip in the UI session.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Title of the trip (e.g. Kyoto Cherry Blossoms 2026)' },
        destination: { type: 'string', description: 'Destination city/country' },
        destination_city: { type: 'string', description: 'Destination city alias' },
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        timezone: { type: 'string', description: 'Timezone (e.g. Asia/Tokyo)' },
        currency: { type: 'string', description: 'Trip currency code (e.g. JPY, USD, EUR)' },
        budget_cap: { type: 'number', description: 'Total budget cap' },
        cover_image_url: { type: 'string', description: 'Optional cover image URL' },
        owner_name: { type: 'string', description: 'Name of the organizer' },
        owner_email: { type: 'string', description: 'Email of the organizer' },
        set_as_active: { type: 'boolean', description: 'Whether to set as active trip in UI session (default: true)' },
        session_id: { type: 'string', description: "Session ID (defaults to 'default')" },
      },
      required: ['title', 'start_date', 'end_date'],
    },
  },
  {
    name: 'get_trip',
    description:
      'Gets full or compact trip details (defaults to the session active_trip_id if trip_id is omitted).',
    inputSchema: {
      type: 'object',
      properties: {
        trip_id: { type: 'string', description: 'Trip ID (defaults to active_trip_id)' },
        view: { type: 'string', enum: ['full', 'compact'], description: 'Hierarchy level (default: full)' },
        session_id: { type: 'string', description: "Session ID (defaults to 'default')" },
      },
    },
  },
  {
    name: 'add_stop',
    description:
      'Adds a stop to a scheduled day section or wishlist (defaults to session active_trip_id and active_day_number) and increments state_version.',
    inputSchema: {
      type: 'object',
      properties: {
        trip_id: { type: 'string', description: 'Trip ID (defaults to active_trip_id)' },
        day_number: { type: 'integer', description: 'Target day number (defaults to active_day_number)' },
        section_id: { type: 'string', description: 'Target section ID' },
        section_type: {
          type: 'string',
          enum: ['morning', 'afternoon', 'evening', 'custom', 'wishlist'],
          description: 'Section type',
        },
        section_title: { type: 'string', description: 'Section title' },
        place_name: { type: 'string', description: 'Name of the place or attraction' },
        place: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            formatted_address: { type: 'string' },
            lat: { type: 'number' },
            lng: { type: 'number' },
            category: { type: 'string' },
          },
        },
        place_id: { type: 'string', description: 'Existing place ID' },
        arrival_time: { type: 'string', description: 'Scheduled arrival time (HH:MM)' },
        departure_time: { type: 'string', description: 'Scheduled departure time (HH:MM)' },
        duration_minutes: { type: 'integer', description: 'Planned duration in minutes' },
        user_notes: { type: 'string', description: 'User notes or instructions' },
        budget_amount: { type: 'number', description: 'Budget allocation for this stop' },
        custom_title: { type: 'string', description: 'Custom display title' },
        pin_color: { type: 'string', description: 'Custom map pin color hex or name' },
        session_id: { type: 'string', description: "Session ID (defaults to 'default')" },
      },
    },
  },
  {
    name: 'move_stop',
    description:
      'Moves or reorders a stop (defaults stop_id to session selected_stop_id if omitted) and updates workspace_sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        trip_id: { type: 'string', description: 'Trip ID (defaults to active_trip_id)' },
        stop_id: { type: 'string', description: 'Stop ID to move (defaults to selected_stop_id)' },
        target_section_id: { type: 'string', description: 'Destination section ID' },
        target_day_number: { type: 'integer', description: 'Target day number (used if target_section_id is omitted)' },
        target_section_type: {
          type: 'string',
          enum: ['morning', 'afternoon', 'evening', 'custom', 'wishlist'],
          description: 'Target section type',
        },
        target_index: { type: 'integer', description: '0-based insertion index' },
        session_id: { type: 'string', description: "Session ID (defaults to 'default')" },
      },
    },
  },
  {
    name: 'delete_stop',
    description: 'Deletes a stop from the trip itinerary and updates workspace_sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        trip_id: { type: 'string', description: 'Trip ID (defaults to active_trip_id)' },
        stop_id: { type: 'string', description: 'Stop ID to delete (defaults to selected_stop_id)' },
        session_id: { type: 'string', description: "Session ID (defaults to 'default')" },
      },
    },
  },
  {
    name: 'optimize_day_route',
    description:
      'Optimizes a day route via TSP 2-Opt (defaults day_number to active_day_number or 1) and updates workspace_sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        trip_id: { type: 'string', description: 'Trip ID (defaults to active_trip_id)' },
        day_number: { type: 'integer', description: 'Day number to optimize (defaults to active_day_number)' },
        transit_mode: {
          type: 'string',
          enum: ['walking', 'driving', 'transit', 'bicycling'],
          description: 'Transit mode for calculation',
        },
        session_id: { type: 'string', description: "Session ID (defaults to 'default')" },
      },
    },
  },
  {
    name: 'add_reservation',
    description: 'Logs a flight, lodging, activity, or transport reservation and updates workspace_sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        trip_id: { type: 'string', description: 'Trip ID (defaults to active_trip_id)' },
        type: { type: 'string', description: 'Type: flight, lodging, rental_car, activity, restaurant, etc.' },
        title: { type: 'string', description: 'Reservation title / headline' },
        confirmation_code: { type: 'string', description: 'Confirmation or PNR code' },
        provider: { type: 'string', description: 'Provider / Airline / Hotel name' },
        start_time: { type: 'string', description: 'Start datetime ISO' },
        end_time: { type: 'string', description: 'End datetime ISO' },
        location: { type: 'string', description: 'Physical location / address' },
        cost: { type: 'number', description: 'Cost amount' },
        currency: { type: 'string', description: 'Currency code (default: USD)' },
        notes: { type: 'string', description: 'Additional notes' },
        session_id: { type: 'string', description: "Session ID (defaults to 'default')" },
      },
      required: ['type', 'title'],
    },
  },
  {
    name: 'log_expense',
    description: 'Logs and splits a multi-currency expense and updates workspace_sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        trip_id: { type: 'string', description: 'Trip ID (defaults to active_trip_id)' },
        title: { type: 'string', description: 'Expense description' },
        amount: { type: 'number', description: 'Amount paid' },
        currency: { type: 'string', description: 'Currency code (e.g. JPY, USD, EUR)' },
        category: { type: 'string', description: 'Category: food, lodging, transport, activities, shopping, other' },
        date: { type: 'string', description: 'Date (YYYY-MM-DD)' },
        paid_by_collaborator_id: { type: 'string', description: 'Collaborator ID who paid' },
        paid_by_collaborator_name: { type: 'string', description: 'Name of the person who paid' },
        split_strategy: {
          type: 'string',
          enum: ['equal', 'exact', 'percentage', 'shares'],
          description: 'Splitting strategy',
        },
        splits: { type: 'array', description: 'Explicit splits list', items: { type: 'object' } },
        receipt_url: { type: 'string', description: 'Receipt image URL' },
        notes: { type: 'string', description: 'Expense notes' },
        session_id: { type: 'string', description: "Session ID (defaults to 'default')" },
      },
      required: ['title', 'amount'],
    },
  },
  {
    name: 'get_budget_settlement',
    description: 'Computes Splitwise debt settlements and balances for the active trip.',
    inputSchema: {
      type: 'object',
      properties: {
        trip_id: { type: 'string', description: 'Trip ID (defaults to active_trip_id)' },
        session_id: { type: 'string', description: "Session ID (defaults to 'default')" },
      },
    },
  },
  {
    name: 'manage_checklist',
    description: 'Adds or toggles a checklist item and updates workspace_sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        trip_id: { type: 'string', description: 'Trip ID (defaults to active_trip_id)' },
        action: { type: 'string', enum: ['add', 'toggle'], description: 'Action to perform' },
        item_id: { type: 'string', description: 'Item ID (required for toggle)' },
        title: { type: 'string', description: 'Item title (required for add)' },
        category: {
          type: 'string',
          enum: ['packing', 'todo', 'documents', 'custom'],
          description: 'Checklist category',
        },
        is_completed: { type: 'boolean', description: 'Target completion status for toggle' },
        assigned_to_name: { type: 'string', description: 'Name of assignee' },
        session_id: { type: 'string', description: "Session ID (defaults to 'default')" },
      },
      required: ['action'],
    },
  },
];

// ============================================================================
// MCP Tool Call Dispatcher
// ============================================================================

export async function executeMcpTool(
  db: DatabaseAdapter,
  toolName: string,
  args: Record<string, any> = {},
  env?: any
): Promise<any> {
  const sessionId = args.session_id || 'default';

  switch (toolName) {
    case 'get_session_context': {
      const session = await getOrCreateSession(db, sessionId);
      let tripSummary: any = null;
      let activeDay: any = null;
      let selectedStop: any = null;

      if (session.active_trip_id) {
        try {
          tripSummary = await getTripSummary(db, session.active_trip_id);
        } catch {}
      }

      if (session.active_trip_id && session.active_day_number) {
        try {
          activeDay = await db.queryOne(
            'SELECT * FROM days WHERE trip_id = ? AND day_number = ?',
            [session.active_trip_id, session.active_day_number]
          );
        } catch {}
      }

      if (session.selected_stop_id) {
        try {
          selectedStop = await db.queryOne(
            `SELECT s.*, p.name AS place_name, p.formatted_address, p.lat, p.lng, p.category AS place_category
             FROM stops s
             LEFT JOIN places p ON s.place_id = p.id
             WHERE s.id = ?`,
            [session.selected_stop_id]
          );
        } catch {}
      }

      const recentEvents = await db.query(
        'SELECT * FROM session_events WHERE session_id = ? ORDER BY created_at DESC LIMIT 5',
        [sessionId]
      );

      return {
        session,
        trip: tripSummary,
        active_day: activeDay,
        selected_stop: selectedStop,
        recent_events: recentEvents,
        state_version: session.state_version,
      };
    }

    case 'navigate_ui': {
      const session = await getOrCreateSession(db, sessionId);
      const summary =
        args.message ||
        `Navigated UI: tab=${args.active_tab || session.active_tab}, day=${args.active_day_number ?? session.active_day_number}`;

      const updated = await bumpSessionState(db, {
        sessionId,
        action: 'navigate_ui',
        summary,
        patch: {
          active_trip_id: args.active_trip_id,
          active_day_number: args.active_day_number,
          active_tab: args.active_tab,
          selected_stop_id: args.selected_stop_id,
        },
        payload: args,
      });

      return {
        success: true,
        session: updated,
        state_version: updated.state_version,
      };
    }

    case 'chat_with_tripplanner': {
      if (!args.message || typeof args.message !== 'string') {
        throw new Error('message is required and must be a string');
      }
      const session = await getOrCreateSession(db, sessionId);
      const tripId = args.trip_id || session.active_trip_id;

      const chatResult = await processChatMessage(
        db,
        {
          trip_id: tripId,
          message: args.message,
        },
        env
      );

      const resolvedTripId = chatResult.trip_id || tripId;
      const updated = await bumpSessionState(db, {
        sessionId,
        tripId: resolvedTripId,
        action: 'chat_command',
        summary: chatResult.reply.slice(0, 100),
        payload: {
          message: args.message,
          actions: chatResult.actions_taken,
        },
      });

      return {
        reply: chatResult.reply,
        actions: chatResult.actions_taken,
        actions_taken: chatResult.actions_taken,
        active_trip_id: resolvedTripId,
        session: updated,
        state_version: updated.state_version,
      };
    }

    case 'list_trips': {
      const trips = await listTrips(db);
      return { trips, count: trips.length };
    }

    case 'create_trip': {
      const trip = await createTrip(db, args as CreateTripInput);
      let stateVersion = 1;
      let sessionRecord: WorkspaceSessionRecord | null = null;

      if (args.set_as_active !== false) {
        sessionRecord = await bumpSessionState(db, {
          sessionId,
          tripId: trip.id,
          action: 'create_trip',
          summary: `Created trip "${trip.title}" (${trip.destination})`,
          patch: {
            active_trip_id: trip.id,
            active_day_number: 1,
            active_tab: 'itinerary',
            selected_stop_id: null,
          },
          payload: { trip_id: trip.id, title: trip.title },
        });
        stateVersion = sessionRecord.state_version;
      }

      return {
        trip,
        session: sessionRecord,
        state_version: stateVersion,
      };
    }

    case 'get_trip': {
      const session = await getOrCreateSession(db, sessionId);
      const tripId = args.trip_id || session.active_trip_id;
      const trip = await getTrip(db, tripId, args.view || 'full');
      if (!trip) {
        throw new Error(`Trip ${tripId} not found`);
      }
      return { trip, state_version: session.state_version };
    }

    case 'add_stop': {
      const session = await getOrCreateSession(db, sessionId);
      const tripId = args.trip_id || session.active_trip_id;

      const dayNumber =
        args.day_number !== undefined
          ? args.day_number
          : args.section_type === 'wishlist' || args.section_id
            ? undefined
            : session.active_day_number || 1;

      const placeInput = args.place || (args.place_name ? { name: args.place_name } : undefined);

      const stop = await addTripStop(db, tripId, {
        day_number: dayNumber,
        section_id: args.section_id,
        section_type: args.section_type,
        section_title: args.section_title,
        place_id: args.place_id,
        place: placeInput,
        arrival_time: args.arrival_time,
        departure_time: args.departure_time,
        duration_minutes: args.duration_minutes,
        user_notes: args.user_notes,
        budget_amount: args.budget_amount,
        custom_title: args.custom_title,
        pin_color: args.pin_color,
      });

      const stopTitle = stop.place?.name || args.place_name || stop.custom_title || 'Stop';
      const updated = await bumpSessionState(db, {
        sessionId,
        tripId,
        action: 'add_stop',
        summary: `Added stop "${stopTitle}" to Day ${dayNumber ?? 'Wishlist'}`,
        patch: {
          selected_stop_id: stop.id,
          ...(dayNumber !== undefined ? { active_day_number: dayNumber } : {}),
        },
        payload: { stop_id: stop.id, place_name: stopTitle, trip_id: tripId },
      });

      return {
        stop,
        session: updated,
        state_version: updated.state_version,
      };
    }

    case 'move_stop': {
      const session = await getOrCreateSession(db, sessionId);
      const tripId = args.trip_id || session.active_trip_id;
      const stopId = args.stop_id || session.selected_stop_id;

      if (!stopId) {
        throw new Error('stop_id is required or a stop must be selected in the current session');
      }

      let targetSectionId = args.target_section_id;

      if (!targetSectionId) {
        if (args.target_section_type === 'wishlist') {
          let wishlistSec = await db.queryOne<Section>(
            "SELECT * FROM sections WHERE trip_id = ? AND section_type = 'wishlist'",
            [tripId]
          );
          if (!wishlistSec) {
            const id = generateId('sec');
            await db.execute(
              `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order)
               VALUES (?, ?, NULL, 'Places to Visit', 'wishlist', 99)`,
              [id, tripId]
            );
            wishlistSec = await db.queryOne<Section>('SELECT * FROM sections WHERE id = ?', [id]);
          }
          targetSectionId = wishlistSec?.id;
        } else {
          const targetDayNum = args.target_day_number ?? session.active_day_number ?? 1;
          const day = await db.queryOne<Day>(
            'SELECT * FROM days WHERE trip_id = ? AND day_number = ?',
            [tripId, targetDayNum]
          );
          if (day) {
            const secType = args.target_section_type || 'morning';
            let sec = await db.queryOne<Section>(
              'SELECT * FROM sections WHERE day_id = ? AND section_type = ?',
              [day.id, secType]
            );
            if (!sec) {
              sec = await db.queryOne<Section>(
                'SELECT * FROM sections WHERE day_id = ? ORDER BY sort_order ASC LIMIT 1',
                [day.id]
              );
            }
            targetSectionId = sec?.id;
          }
        }
      }

      if (!targetSectionId) {
        throw new Error(`Unable to resolve target section for move in trip ${tripId}`);
      }

      const moved = await moveTripStop(db, tripId, stopId, {
        target_section_id: targetSectionId,
        target_index: args.target_index,
      });

      const updated = await bumpSessionState(db, {
        sessionId,
        tripId,
        action: 'move_stop',
        summary: `Moved stop ${stopId} to section ${targetSectionId}`,
        patch: {
          selected_stop_id: stopId,
          ...(args.target_day_number ? { active_day_number: args.target_day_number } : {}),
        },
        payload: { stop_id: stopId, target_section_id: targetSectionId },
      });

      return {
        stop: moved,
        session: updated,
        state_version: updated.state_version,
      };
    }

    case 'delete_stop': {
      const session = await getOrCreateSession(db, sessionId);
      const tripId = args.trip_id || session.active_trip_id;
      const stopId = args.stop_id || session.selected_stop_id;

      if (!stopId) {
        throw new Error('stop_id is required or a stop must be selected in the current session');
      }

      const res = await deleteTripStop(db, tripId, stopId);

      const updated = await bumpSessionState(db, {
        sessionId,
        tripId,
        action: 'delete_stop',
        summary: `Deleted stop ${stopId}`,
        patch: {
          selected_stop_id: session.selected_stop_id === stopId ? null : session.selected_stop_id,
        },
        payload: { stop_id: stopId, trip_id: tripId },
      });

      return {
        success: res.success,
        deleted_stop_id: stopId,
        session: updated,
        state_version: updated.state_version,
      };
    }

    case 'optimize_day_route': {
      const session = await getOrCreateSession(db, sessionId);
      const tripId = args.trip_id || session.active_trip_id;
      const dayNumber = args.day_number ?? session.active_day_number ?? 1;

      const result = await optimizeDayRoute(db, tripId, dayNumber, {
        transit_mode: args.transit_mode,
      });

      const updated = await bumpSessionState(db, {
        sessionId,
        tripId,
        action: 'optimize_day_route',
        summary: `Optimized Day ${dayNumber} route: saved ${result.time_saved_minutes} min`,
        patch: {
          active_day_number: dayNumber,
        },
        payload: {
          day_number: dayNumber,
          time_saved_minutes: result.time_saved_minutes,
          total_stops: result.reordered_stops.length,
        },
      });

      return {
        result,
        session: updated,
        state_version: updated.state_version,
      };
    }

    case 'add_reservation': {
      const session = await getOrCreateSession(db, sessionId);
      const tripId = args.trip_id || session.active_trip_id;

      const reservation = await createReservation(db, tripId, args as CreateReservationInput);

      const updated = await bumpSessionState(db, {
        sessionId,
        tripId,
        action: 'add_reservation',
        summary: `Added reservation: ${reservation.title} (${reservation.type})`,
        patch: {
          active_tab: 'bookings',
        },
        payload: { reservation_id: reservation.id, title: reservation.title },
      });

      return {
        reservation,
        session: updated,
        state_version: updated.state_version,
      };
    }

    case 'log_expense': {
      const session = await getOrCreateSession(db, sessionId);
      const tripId = args.trip_id || session.active_trip_id;

      const expense = await createExpense(db, tripId, args as CreateExpenseInput);

      const updated = await bumpSessionState(db, {
        sessionId,
        tripId,
        action: 'log_expense',
        summary: `Logged expense: ${expense.title} (${expense.amount} ${expense.currency})`,
        patch: {
          active_tab: 'budget',
        },
        payload: { expense_id: expense.id, title: expense.title, amount: expense.amount },
      });

      return {
        expense,
        session: updated,
        state_version: updated.state_version,
      };
    }

    case 'get_budget_settlement': {
      const session = await getOrCreateSession(db, sessionId);
      const tripId = args.trip_id || session.active_trip_id;
      const settlement = await getBudgetSettlement(db, tripId);
      return { settlement, state_version: session.state_version };
    }

    case 'manage_checklist': {
      const session = await getOrCreateSession(db, sessionId);
      const tripId = args.trip_id || session.active_trip_id;

      let item: any;
      let summary = '';

      if (args.action === 'add') {
        if (!args.title) {
          throw new Error('title is required when action is "add"');
        }
        item = await addChecklistItem(db, tripId, {
          title: args.title,
          checklist_category: args.category || 'todo',
          assigned_to_name: args.assigned_to_name,
        });
        summary = `Added checklist item: ${item.title}`;
      } else if (args.action === 'toggle') {
        if (!args.item_id) {
          throw new Error('item_id is required when action is "toggle"');
        }
        item = await toggleChecklistItem(db, tripId, args.item_id, args.is_completed);
        summary = `Toggled checklist item: ${item?.title || args.item_id}`;
      } else {
        throw new Error(`Unsupported checklist action: ${args.action}`);
      }

      const updated = await bumpSessionState(db, {
        sessionId,
        tripId,
        action: 'manage_checklist',
        summary,
        patch: {
          active_tab: 'checklists',
        },
        payload: { item_id: item?.id, action: args.action },
      });

      return {
        item,
        session: updated,
        state_version: updated.state_version,
      };
    }

    default:
      throw new Error(`Unknown MCP tool: ${toolName}`);
  }
}

// ============================================================================
// Main MCP Request Handler (JSON-RPC 2.0)
// ============================================================================

export async function handleSingleMcpRequest(
  db: DatabaseAdapter,
  request: any,
  env?: any
): Promise<JsonRpcResponse> {
  if (!request || typeof request !== 'object' || request.jsonrpc !== '2.0' || typeof request.method !== 'string') {
    return {
      jsonrpc: '2.0',
      id: request?.id ?? null,
      error: {
        code: -32600,
        message: 'Invalid Request: jsonrpc must be "2.0" and method must be a string',
      },
    };
  }

  const { id = null, method, params = {} } = request;

  try {
    switch (method) {
      case 'initialize': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: {
              tools: {},
              resources: {},
            },
            serverInfo: {
              name: 'tripplanner-mcp',
              version: '1.0.0',
            },
          },
        };
      }

      case 'notifications/initialized': {
        return {
          jsonrpc: '2.0',
          id,
          result: {},
        };
      }

      case 'ping': {
        return {
          jsonrpc: '2.0',
          id,
          result: {},
        };
      }

      case 'resources/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            resources: [
              {
                uri: 'tripplanner://session/current',
                name: 'Current Workspace Session',
                mimeType: 'application/json',
                description:
                  'Live session state tracking active trip, day, tab, selected stop, and last UI interaction',
              },
              {
                uri: 'tripplanner://trips/active',
                name: 'Active Trip Details',
                mimeType: 'application/json',
                description:
                  'Full itinerary, schedule, reservations, budget, and checklists for the active trip',
              },
            ],
          },
        };
      }

      case 'resources/read': {
        const uri = params?.uri;
        if (!uri) {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: 'Invalid params: uri is required for resources/read',
            },
          };
        }

        if (uri === 'tripplanner://session/current') {
          const session = await getOrCreateSession(db, params.session_id || 'default');
          let tripSummary: any = null;
          if (session.active_trip_id) {
            try {
              tripSummary = await getTripSummary(db, session.active_trip_id);
            } catch {}
          }
          const payload = { session, trip: tripSummary };
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(payload, null, 2),
                },
              ],
            },
          };
        }

        if (uri === 'tripplanner://trips/active') {
          const session = await getOrCreateSession(db, params.session_id || 'default');
          const trip = await getTrip(db, session.active_trip_id, 'full');
          return {
            jsonrpc: '2.0',
            id,
            result: {
              contents: [
                {
                  uri,
                  mimeType: 'application/json',
                  text: JSON.stringify(trip, null, 2),
                },
              ],
            },
          };
        }

        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: `Resource not found: ${uri}`,
          },
        };
      }

      case 'tools/list': {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            tools: MCP_TOOLS,
          },
        };
      }

      case 'tools/call': {
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        if (!toolName || typeof toolName !== 'string') {
          return {
            jsonrpc: '2.0',
            id,
            error: {
              code: -32602,
              message: 'Invalid params: name is required for tools/call',
            },
          };
        }

        try {
          const output = await executeMcpTool(db, toolName, toolArgs, env);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: typeof output === 'string' ? output : JSON.stringify(output, null, 2),
                },
              ],
              isError: false,
              structuredContent: output,
              ...output,
            },
          };
        } catch (toolError: any) {
          return {
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: `Error executing ${toolName}: ${toolError?.message || String(toolError)}`,
                },
              ],
              isError: true,
            },
          };
        }
      }

      default: {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        };
      }
    }
  } catch (err: any) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: err?.message || 'Internal error in MCP handler',
      },
    };
  }
}

/**
 * Handles single or batch JSON-RPC 2.0 MCP requests.
 */
export async function handleMcpRequest(
  db: DatabaseAdapter,
  request: any,
  env?: any
): Promise<JsonRpcResponse | JsonRpcResponse[]> {
  if (Array.isArray(request)) {
    const responses: JsonRpcResponse[] = [];
    for (const singleReq of request) {
      responses.push(await handleSingleMcpRequest(db, singleReq, env));
    }
    return responses;
  }
  return handleSingleMcpRequest(db, request, env);
}
