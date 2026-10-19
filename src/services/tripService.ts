import type { DatabaseAdapter } from '../db/client';
import { generateId } from '../lib/http';
import type {
  Trip,
  Collaborator,
  CollaboratorRole,
  Day,
  Section,
  SectionType,
  Stop,
  Place,
  TransitLeg,
  StopDetail,
  SectionSchedule,
  DaySchedule,
  Reservation,
  Expense,
  Checklist,
  ChecklistItem,
  TripNote,
} from '../types/domain';

export interface CreateTripInput {
  title: string;
  destination?: string;
  destination_city?: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  timezone?: string;
  currency?: string;
  budget_cap?: number | null;
  cover_image_url?: string | null;
  owner_name?: string;
  owner_email?: string;
  owner_avatar_url?: string | null;
}

export interface UpdateTripInput {
  title?: string;
  destination?: string;
  destination_city?: string;
  start_date?: string;
  end_date?: string;
  timezone?: string;
  currency?: string;
  base_currency?: string;
  budget_cap?: number | null;
  cover_image_url?: string | null;
  version?: number;
}

export interface DayOverview {
  day_number: number;
  date: string;
  title: string;
  stop_count: number;
  highlight_places: string[];
}

export interface TripSummaryResult {
  id: string;
  title: string;
  destination: string;
  destination_city: string;
  start_date: string;
  end_date: string;
  total_days: number;
  total_stops: number;
  total_spent: number;
  base_currency: string;
  currency: string;
  budget_cap: number | null;
  cover_image_url: string | null;
  days_overview: DayOverview[];
}

export interface FullTripHierarchy extends Trip {
  collaborators: Collaborator[];
  days: DaySchedule[];
  wishlist_sections: SectionSchedule[];
  reservations: Reservation[];
  expenses: Expense[];
  checklists: (Checklist & { items: ChecklistItem[] })[];
  notes: TripNote[];
}

/**
 * Lists trips, optionally filtered by status ('upcoming' | 'past' | 'all').
 */
export async function listTrips(
  db: DatabaseAdapter,
  status: 'upcoming' | 'past' | 'all' = 'all'
): Promise<Trip[]> {
  const today = new Date().toISOString().split('T')[0];

  if (status === 'upcoming') {
    return await db.query<Trip>(
      'SELECT * FROM trips WHERE end_date >= ? ORDER BY start_date ASC',
      [today]
    );
  }

  if (status === 'past') {
    return await db.query<Trip>(
      'SELECT * FROM trips WHERE end_date < ? ORDER BY start_date DESC',
      [today]
    );
  }

  return await db.query<Trip>('SELECT * FROM trips ORDER BY start_date ASC');
}

/**
 * Creates a new Trip, auto-generates Day records from start_date to end_date (1-indexed),
 * creates default SCHEDULED sections (Morning, Afternoon, Evening) for each day,
 * creates a default WISHLIST section ('Places to Visit'), and adds an owner collaborator if provided.
 */
export async function createTrip(
  db: DatabaseAdapter,
  input: CreateTripInput
): Promise<Trip> {
  const tripId = generateId('trip');
  const destination = input.destination || input.destination_city || '';
  const timezone = input.timezone || 'UTC';
  const currency = input.currency || 'USD';
  const budgetCap = input.budget_cap ?? null;
  const coverImageUrl = input.cover_image_url ?? null;

  // Insert trip record
  await db.execute(
    `INSERT INTO trips (
      id, title, destination, start_date, end_date, timezone, currency, budget_cap, cover_image_url, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      tripId,
      input.title,
      destination,
      input.start_date,
      input.end_date,
      timezone,
      currency,
      budgetCap,
      coverImageUrl,
    ]
  );

  // Auto-generate days and default scheduled sections
  const start = new Date(input.start_date + 'T00:00:00Z');
  const end = new Date(input.end_date + 'T00:00:00Z');
  const cur = new Date(start);

  let dayNumber = 1;
  const statements: { sql: string; params: any[] }[] = [];

  while (cur <= end) {
    const dateStr = cur.toISOString().split('T')[0];
    const dayId = generateId('day');

    statements.push({
      sql: `INSERT INTO days (id, trip_id, day_number, date, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, NULL, datetime('now'), datetime('now'))`,
      params: [dayId, tripId, dayNumber, dateStr],
    });

    // Default scheduled sections for the day
    statements.push(
      {
        sql: `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order, created_at, updated_at)
              VALUES (?, ?, ?, 'Morning', 'morning', 0, datetime('now'), datetime('now'))`,
        params: [generateId('sec'), tripId, dayId],
      },
      {
        sql: `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order, created_at, updated_at)
              VALUES (?, ?, ?, 'Afternoon', 'afternoon', 1, datetime('now'), datetime('now'))`,
        params: [generateId('sec'), tripId, dayId],
      },
      {
        sql: `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order, created_at, updated_at)
              VALUES (?, ?, ?, 'Evening', 'evening', 2, datetime('now'), datetime('now'))`,
        params: [generateId('sec'), tripId, dayId],
      }
    );

    cur.setUTCDate(cur.getUTCDate() + 1);
    dayNumber++;
  }

  // Default WISHLIST section (day_id = NULL)
  statements.push({
    sql: `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order, created_at, updated_at)
          VALUES (?, ?, NULL, 'Places to Visit', 'wishlist', 0, datetime('now'), datetime('now'))`,
    params: [generateId('sec'), tripId],
  });

  // Default owner collaborator if provided
  if (input.owner_name || input.owner_email) {
    const collabId = generateId('collab');
    statements.push({
      sql: `INSERT INTO collaborators (id, trip_id, name, email, avatar_url, role, joined_at)
            VALUES (?, ?, ?, ?, ?, 'owner', datetime('now'))`,
      params: [
        collabId,
        tripId,
        input.owner_name || 'Trip Owner',
        input.owner_email || 'owner@example.com',
        input.owner_avatar_url || null,
      ],
    });
  }

  if (statements.length > 0) {
    await db.batch(statements);
  }

  const created = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]);
  if (!created) {
    throw new Error(`Failed to retrieve newly created trip ${tripId}`);
  }
  return created;
}

/**
 * Retrieves full or compact trip hierarchy including collaborators,
 * days -> sections -> stops (with places & transit_to_next), wishlist sections,
 * reservations, expenses, checklists, and notes.
 */
export async function getTrip(
  db: DatabaseAdapter,
  tripId: string,
  view: 'compact' | 'full' = 'full'
): Promise<FullTripHierarchy | null> {
  const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]);
  if (!trip) return null;

  // 1. Collaborators
  const collaborators = await db.query<Collaborator>(
    'SELECT * FROM collaborators WHERE trip_id = ? ORDER BY joined_at ASC',
    [tripId]
  );

  // 2. Days
  const days = await db.query<Day>(
    'SELECT * FROM days WHERE trip_id = ? ORDER BY day_number ASC',
    [tripId]
  );

  // 3. Sections
  const sections = await db.query<Section>(
    'SELECT * FROM sections WHERE trip_id = ? ORDER BY sort_order ASC, created_at ASC',
    [tripId]
  );

  // 4. Stops with Places
  const rawStops = await db.query<any>(
    `SELECT
      s.id, s.section_id, s.place_id, s.sort_order, s.arrival_time, s.departure_time,
      s.duration_minutes, s.user_notes, s.budget_amount, s.created_at, s.updated_at,
      p.id as p_id, p.name as p_name, p.formatted_address as p_formatted_address,
      p.lat as p_lat, p.lng as p_lng, p.category as p_category, p.rating as p_rating,
      p.google_place_id as p_google_place_id, p.website as p_website,
      p.phone_number as p_phone_number, p.notes as p_notes,
      p.created_at as p_created_at, p.updated_at as p_updated_at
    FROM stops s
    JOIN sections sec ON s.section_id = sec.id
    JOIN places p ON s.place_id = p.id
    WHERE sec.trip_id = ?
    ORDER BY s.sort_order ASC, s.created_at ASC`,
    [tripId]
  );

  // 5. Transit Legs
  const transitLegs = await db.query<TransitLeg>(
    'SELECT * FROM transit_legs WHERE trip_id = ? ORDER BY created_at ASC',
    [tripId]
  );
  const transitByFromStop = new Map<string, TransitLeg>();
  for (const leg of transitLegs) {
    transitByFromStop.set(leg.from_stop_id, leg);
  }

  // 6. Stop Votes
  const stopVotes = await db.query<any>(
    `SELECT sv.* FROM stop_votes sv
     JOIN stops s ON sv.stop_id = s.id
     JOIN sections sec ON s.section_id = sec.id
     WHERE sec.trip_id = ?`,
    [tripId]
  );
  const votesByStop = new Map<string, { up: number; down: number }>();
  for (const v of stopVotes) {
    if (!votesByStop.has(v.stop_id)) {
      votesByStop.set(v.stop_id, { up: 0, down: 0 });
    }
    const t = votesByStop.get(v.stop_id)!;
    if (v.vote_type === 'up') t.up++;
    else if (v.vote_type === 'down') t.down++;
  }

  // Group stops by section_id
  const stopsBySection = new Map<string, StopDetail[]>();
  for (const r of rawStops) {
    const place: Place = {
      id: r.p_id,
      name: r.p_name,
      formatted_address: r.p_formatted_address,
      lat: r.p_lat,
      lng: r.p_lng,
      category: r.p_category,
      rating: r.p_rating,
      google_place_id: r.p_google_place_id,
      website: r.p_website,
      phone_number: r.p_phone_number,
      notes: r.p_notes,
      created_at: r.p_created_at,
      updated_at: r.p_updated_at,
    };

    const stopDetail: StopDetail = {
      id: r.id,
      section_id: r.section_id,
      place_id: r.place_id,
      sort_order: r.sort_order,
      arrival_time: r.arrival_time,
      departure_time: r.departure_time,
      duration_minutes: r.duration_minutes,
      user_notes: r.user_notes,
      budget_amount: r.budget_amount,
      created_at: r.created_at,
      updated_at: r.updated_at,
      place,
      transit_to_next: transitByFromStop.get(r.id) ?? null,
      votes: votesByStop.get(r.id) ?? { up: 0, down: 0 },
    };

    if (!stopsBySection.has(r.section_id)) {
      stopsBySection.set(r.section_id, []);
    }
    stopsBySection.get(r.section_id)!.push(stopDetail);
  }

  // Build section schedules
  const sectionsByDay = new Map<string, SectionSchedule[]>();
  const wishlistSections: SectionSchedule[] = [];

  for (const s of sections) {
    const schedule: SectionSchedule = {
      ...s,
      stops: stopsBySection.get(s.id) || [],
    };
    if (s.day_id) {
      if (!sectionsByDay.has(s.day_id)) {
        sectionsByDay.set(s.day_id, []);
      }
      sectionsByDay.get(s.day_id)!.push(schedule);
    } else {
      wishlistSections.push(schedule);
    }
  }

  const daySchedules: DaySchedule[] = days.map((d) => ({
    ...d,
    sections: sectionsByDay.get(d.id) || [],
  }));

  // Auxiliary entities: reservations, expenses, checklists, notes
  const reservations = await db.query<Reservation>(
    'SELECT * FROM reservations WHERE trip_id = ? ORDER BY start_time ASC',
    [tripId]
  );

  const expenses = await db.query<Expense>(
    'SELECT * FROM expenses WHERE trip_id = ? ORDER BY date ASC, created_at ASC',
    [tripId]
  );

  const rawChecklists = await db.query<Checklist>(
    'SELECT * FROM checklists WHERE trip_id = ? ORDER BY sort_order ASC, created_at ASC',
    [tripId]
  );

  const checklistItems = await db.query<any>(
    `SELECT ci.* FROM checklist_items ci
     JOIN checklists c ON ci.checklist_id = c.id
     WHERE c.trip_id = ?
     ORDER BY ci.sort_order ASC, ci.created_at ASC`,
    [tripId]
  );

  const itemsByChecklist = new Map<string, ChecklistItem[]>();
  for (const item of checklistItems) {
    if (!itemsByChecklist.has(item.checklist_id)) {
      itemsByChecklist.set(item.checklist_id, []);
    }
    itemsByChecklist.get(item.checklist_id)!.push({
      ...item,
      is_completed: Boolean(item.is_completed),
    });
  }

  const checklists = rawChecklists.map((c) => ({
    ...c,
    items: itemsByChecklist.get(c.id) || [],
  }));

  const notes = await db.query<TripNote>(
    'SELECT * FROM trip_notes WHERE trip_id = ? ORDER BY updated_at DESC',
    [tripId]
  );

  return {
    ...trip,
    collaborators,
    days: daySchedules,
    wishlist_sections: wishlistSections,
    reservations,
    expenses,
    checklists,
    notes,
  };
}

/**
 * Returns a concise, token-efficient trip summary with day overview and stop counts.
 */
export async function getTripSummary(
  db: DatabaseAdapter,
  tripId: string
): Promise<TripSummaryResult | null> {
  const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]);
  if (!trip) return null;

  const days = await db.query<Day>(
    'SELECT * FROM days WHERE trip_id = ? ORDER BY day_number ASC',
    [tripId]
  );

  const dayStops = await db.query<{ day_id: string; place_name: string }>(
    `SELECT sec.day_id, p.name as place_name
     FROM stops s
     JOIN sections sec ON s.section_id = sec.id
     JOIN places p ON s.place_id = p.id
     WHERE sec.trip_id = ? AND sec.day_id IS NOT NULL
     ORDER BY s.sort_order ASC`,
    [tripId]
  );

  const placesByDay = new Map<string, string[]>();
  for (const row of dayStops) {
    if (!placesByDay.has(row.day_id)) {
      placesByDay.set(row.day_id, []);
    }
    placesByDay.get(row.day_id)!.push(row.place_name);
  }

  const daysOverview: DayOverview[] = days.map((d) => {
    const places = placesByDay.get(d.id) || [];
    return {
      day_number: d.day_number,
      date: d.date,
      title: d.notes || `Day ${d.day_number}`,
      stop_count: places.length,
      highlight_places: places.slice(0, 5),
    };
  });

  const totalStopsRow = await db.queryOne<{ total: number }>(
    `SELECT COUNT(s.id) as total
     FROM stops s
     JOIN sections sec ON s.section_id = sec.id
     WHERE sec.trip_id = ?`,
    [tripId]
  );

  const totalSpentRow = await db.queryOne<{ total: number }>(
    'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE trip_id = ?',
    [tripId]
  );

  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    destination_city: trip.destination,
    start_date: trip.start_date,
    end_date: trip.end_date,
    total_days: days.length,
    total_stops: totalStopsRow?.total ?? 0,
    total_spent: totalSpentRow?.total ?? 0,
    base_currency: trip.currency,
    currency: trip.currency,
    budget_cap: trip.budget_cap,
    cover_image_url: trip.cover_image_url,
    days_overview: daysOverview,
  };
}

/**
 * Updates trip fields and updates updated_at timestamp.
 */
export async function updateTrip(
  db: DatabaseAdapter,
  tripId: string,
  patch: UpdateTripInput
): Promise<Trip | null> {
  const existing = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]);
  if (!existing) return null;

  const title = patch.title ?? existing.title;
  const destination = patch.destination ?? patch.destination_city ?? existing.destination;
  const startDate = patch.start_date ?? existing.start_date;
  const endDate = patch.end_date ?? existing.end_date;
  const timezone = patch.timezone ?? existing.timezone;
  const currency = patch.currency ?? patch.base_currency ?? existing.currency;
  const budgetCap = patch.budget_cap !== undefined ? patch.budget_cap : existing.budget_cap;
  const coverImageUrl =
    patch.cover_image_url !== undefined ? patch.cover_image_url : existing.cover_image_url;

  await db.execute(
    `UPDATE trips
     SET title = ?, destination = ?, start_date = ?, end_date = ?, timezone = ?,
         currency = ?, budget_cap = ?, cover_image_url = ?, updated_at = datetime('now')
     WHERE id = ?`,
    [title, destination, startDate, endDate, timezone, currency, budgetCap, coverImageUrl, tripId]
  );

  return await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]);
}

/**
 * Deletes a trip and cascades to all child days, sections, stops, etc.
 */
export async function deleteTrip(db: DatabaseAdapter, tripId: string): Promise<boolean> {
  const res = await db.execute('DELETE FROM trips WHERE id = ?', [tripId]);
  return res.changes > 0;
}

/**
 * Retrieves a single day's schedule for a trip with sections and stops.
 */
export async function getTripDay(
  db: DatabaseAdapter,
  tripId: string,
  dayNumber: number
): Promise<DaySchedule | null> {
  const day = await db.queryOne<Day>(
    'SELECT * FROM days WHERE trip_id = ? AND day_number = ?',
    [tripId, dayNumber]
  );
  if (!day) return null;

  const sections = await db.query<Section>(
    'SELECT * FROM sections WHERE trip_id = ? AND day_id = ? ORDER BY sort_order ASC, created_at ASC',
    [tripId, day.id]
  );

  const rawStops = await db.query<any>(
    `SELECT
      s.id, s.section_id, s.place_id, s.sort_order, s.arrival_time, s.departure_time,
      s.duration_minutes, s.user_notes, s.budget_amount, s.created_at, s.updated_at,
      p.id as p_id, p.name as p_name, p.formatted_address as p_formatted_address,
      p.lat as p_lat, p.lng as p_lng, p.category as p_category, p.rating as p_rating,
      p.google_place_id as p_google_place_id, p.website as p_website,
      p.phone_number as p_phone_number, p.notes as p_notes,
      p.created_at as p_created_at, p.updated_at as p_updated_at
    FROM stops s
    JOIN sections sec ON s.section_id = sec.id
    JOIN places p ON s.place_id = p.id
    WHERE sec.day_id = ?
    ORDER BY s.sort_order ASC, s.created_at ASC`,
    [day.id]
  );

  const transitLegs = await db.query<TransitLeg>(
    'SELECT * FROM transit_legs WHERE trip_id = ?',
    [tripId]
  );
  const transitByFromStop = new Map<string, TransitLeg>();
  for (const leg of transitLegs) {
    transitByFromStop.set(leg.from_stop_id, leg);
  }

  const stopVotes = await db.query<any>(
    `SELECT sv.* FROM stop_votes sv
     JOIN stops s ON sv.stop_id = s.id
     JOIN sections sec ON s.section_id = sec.id
     WHERE sec.day_id = ?`,
    [day.id]
  );
  const votesByStop = new Map<string, { up: number; down: number }>();
  for (const v of stopVotes) {
    if (!votesByStop.has(v.stop_id)) {
      votesByStop.set(v.stop_id, { up: 0, down: 0 });
    }
    const t = votesByStop.get(v.stop_id)!;
    if (v.vote_type === 'up') t.up++;
    else if (v.vote_type === 'down') t.down++;
  }

  const stopsBySection = new Map<string, StopDetail[]>();
  for (const r of rawStops) {
    const place: Place = {
      id: r.p_id,
      name: r.p_name,
      formatted_address: r.p_formatted_address,
      lat: r.p_lat,
      lng: r.p_lng,
      category: r.p_category,
      rating: r.p_rating,
      google_place_id: r.p_google_place_id,
      website: r.p_website,
      phone_number: r.p_phone_number,
      notes: r.p_notes,
      created_at: r.p_created_at,
      updated_at: r.p_updated_at,
    };

    const stopDetail: StopDetail = {
      id: r.id,
      section_id: r.section_id,
      place_id: r.place_id,
      sort_order: r.sort_order,
      arrival_time: r.arrival_time,
      departure_time: r.departure_time,
      duration_minutes: r.duration_minutes,
      user_notes: r.user_notes,
      budget_amount: r.budget_amount,
      created_at: r.created_at,
      updated_at: r.updated_at,
      place,
      transit_to_next: transitByFromStop.get(r.id) ?? null,
      votes: votesByStop.get(r.id) ?? { up: 0, down: 0 },
    };

    if (!stopsBySection.has(r.section_id)) {
      stopsBySection.set(r.section_id, []);
    }
    stopsBySection.get(r.section_id)!.push(stopDetail);
  }

  const sectionSchedules: SectionSchedule[] = sections.map((s) => ({
    ...s,
    stops: stopsBySection.get(s.id) || [],
  }));

  return {
    ...day,
    sections: sectionSchedules,
  };
}

/**
 * Updates a day's notes or metadata.
 */
export async function updateTripDay(
  db: DatabaseAdapter,
  tripId: string,
  dayNumber: number,
  patch: { notes?: string | null; title?: string | null }
): Promise<Day | null> {
  const day = await db.queryOne<Day>(
    'SELECT * FROM days WHERE trip_id = ? AND day_number = ?',
    [tripId, dayNumber]
  );
  if (!day) return null;

  const notes = patch.notes !== undefined ? patch.notes : patch.title !== undefined ? patch.title : day.notes;

  await db.execute(
    `UPDATE days SET notes = ?, updated_at = datetime('now') WHERE id = ?`,
    [notes, day.id]
  );

  return await db.queryOne<Day>('SELECT * FROM days WHERE id = ?', [day.id]);
}

/**
 * Creates a scheduled or wishlist section for a trip.
 */
export async function createTripSection(
  db: DatabaseAdapter,
  tripId: string,
  input: {
    day_id?: string | null;
    title: string;
    section_type?: SectionType;
    sort_order?: number;
  }
): Promise<Section> {
  const sectionId = generateId('sec');
  const dayId = input.day_id ?? null;
  const sectionType = input.section_type || (dayId ? 'custom' : 'wishlist');

  let sortOrder = input.sort_order;
  if (sortOrder === undefined) {
    const maxRow = await db.queryOne<{ max_sort: number | null }>(
      dayId
        ? 'SELECT MAX(sort_order) as max_sort FROM sections WHERE trip_id = ? AND day_id = ?'
        : 'SELECT MAX(sort_order) as max_sort FROM sections WHERE trip_id = ? AND day_id IS NULL',
      dayId ? [tripId, dayId] : [tripId]
    );
    sortOrder = (maxRow?.max_sort ?? -1) + 1;
  }

  await db.execute(
    `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [sectionId, tripId, dayId, input.title, sectionType, sortOrder]
  );

  const section = await db.queryOne<Section>('SELECT * FROM sections WHERE id = ?', [sectionId]);
  if (!section) {
    throw new Error(`Failed to create section ${sectionId}`);
  }
  return section;
}

/**
 * Lists collaborators for a trip.
 */
export async function listCollaborators(
  db: DatabaseAdapter,
  tripId: string
): Promise<Collaborator[]> {
  return await db.query<Collaborator>(
    'SELECT * FROM collaborators WHERE trip_id = ? ORDER BY joined_at ASC',
    [tripId]
  );
}

/**
 * Adds a collaborator to a trip.
 */
export async function addCollaborator(
  db: DatabaseAdapter,
  tripId: string,
  input: {
    name: string;
    email: string;
    avatar_url?: string | null;
    role?: CollaboratorRole;
  }
): Promise<Collaborator> {
  const collabId = generateId('collab');
  const role = input.role || 'editor';
  const avatarUrl = input.avatar_url ?? null;

  await db.execute(
    `INSERT INTO collaborators (id, trip_id, name, email, avatar_url, role, joined_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    [collabId, tripId, input.name, input.email, avatarUrl, role]
  );

  const collab = await db.queryOne<Collaborator>(
    'SELECT * FROM collaborators WHERE id = ?',
    [collabId]
  );
  if (!collab) {
    throw new Error(`Failed to retrieve newly added collaborator ${collabId}`);
  }
  return collab;
}
