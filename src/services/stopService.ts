import type { DatabaseAdapter } from '../db/client';
import type { Stop, Place, Section, Day, StopVote, VoteType } from '../types/domain';
import { generateId } from '../lib/http';
import {
  resolveOrCreatePlace,
  validatePlaceOpeningHours,
  type ResolvePlaceInput,
  type OpeningHoursValidationResult,
} from './placeService';
import { recalculateDayTransitLegs } from './routingService';

export interface AddTripStopInput {
  section_id?: string;
  day_number?: number;
  section_type?: 'morning' | 'afternoon' | 'evening' | 'custom' | 'wishlist';
  section_title?: string;
  place_id?: string;
  place?: ResolvePlaceInput;
  arrival_time?: string | null;
  departure_time?: string | null;
  duration_minutes?: number | null;
  user_notes?: string | null;
  budget_amount?: number | null;
  custom_title?: string | null;
  pin_color?: string | null;
  is_locked?: boolean | number;
  sort_order?: number;
}

export interface UpdateTripStopInput {
  arrival_time?: string | null;
  departure_time?: string | null;
  duration_minutes?: number | null;
  user_notes?: string | null;
  budget_amount?: number | null;
  custom_title?: string | null;
  pin_color?: string | null;
  is_locked?: boolean | number;
  sort_order?: number;
}

export interface MoveTripStopOptions {
  target_section_id: string;
  target_index?: number; // 0-based or 1-based index
}

export interface VoteOnStopInput {
  collaborator_id?: string;
  collaborator_name?: string;
  vote: 1 | -1 | 'up' | 'down';
  comment?: string;
}

export interface VoteResult {
  stop_id: string;
  up: number;
  down: number;
  user_vote: VoteType;
}

export interface StopWithDetails extends Stop {
  place: Place;
  is_locked?: number | boolean;
  custom_title?: string | null;
  pin_color?: string | null;
  warning?: OpeningHoursValidationResult;
  votes?: {
    up: number;
    down: number;
    user_vote?: VoteType;
  };
}

/**
 * Ensures extra stop columns exist in database if not present in base schema.
 */
async function ensureExtraStopColumns(db: DatabaseAdapter): Promise<void> {
  try {
    await db.execute('ALTER TABLE stops ADD COLUMN is_locked INTEGER DEFAULT 0');
  } catch {}
  try {
    await db.execute('ALTER TABLE stops ADD COLUMN custom_title TEXT DEFAULT NULL');
  } catch {}
  try {
    await db.execute('ALTER TABLE stops ADD COLUMN pin_color TEXT DEFAULT NULL');
  } catch {}
}

/**
 * Resolves or creates a Section for the stop:
 * Checks section_id, or day_number + section_type, or wishlist.
 */
async function resolveSection(
  db: DatabaseAdapter,
  tripId: string,
  input: AddTripStopInput
): Promise<Section> {
  // 1. Direct section_id
  if (input.section_id) {
    const sec = await db.queryOne<Section>(
      'SELECT * FROM sections WHERE id = ? AND trip_id = ?',
      [input.section_id, tripId]
    );
    if (sec) return sec;
  }

  // 2. Wishlist section requested
  if (input.section_type === 'wishlist' || input.section_title?.toLowerCase().includes('wishlist')) {
    let wishlistSec = await db.queryOne<Section>(
      "SELECT * FROM sections WHERE trip_id = ? AND section_type = 'wishlist'",
      [tripId]
    );
    if (!wishlistSec) {
      const id = generateId('sec');
      await db.execute(
        `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order)
         VALUES (?, ?, NULL, ?, 'wishlist', 99)`,
        [id, tripId, input.section_title || 'Places to Visit']
      );
      wishlistSec = await db.queryOne<Section>('SELECT * FROM sections WHERE id = ?', [id]);
    }
    if (wishlistSec) return wishlistSec;
  }

  // 3. By day_number
  if (input.day_number !== undefined) {
    const day = await db.queryOne<Day>(
      'SELECT * FROM days WHERE trip_id = ? AND day_number = ?',
      [tripId, input.day_number]
    );
    if (day) {
      const targetType = input.section_type || 'morning';
      let sec = await db.queryOne<Section>(
        'SELECT * FROM sections WHERE trip_id = ? AND day_id = ? AND section_type = ?',
        [tripId, day.id, targetType]
      );
      if (!sec) {
        // Fallback to any section in that day
        sec = await db.queryOne<Section>(
          'SELECT * FROM sections WHERE trip_id = ? AND day_id = ? ORDER BY sort_order ASC LIMIT 1',
          [tripId, day.id]
        );
      }
      if (!sec) {
        // Create section for this day
        const id = generateId('sec');
        await db.execute(
          `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order)
           VALUES (?, ?, ?, ?, ?, 1)`,
          [id, tripId, day.id, input.section_title || `${targetType.charAt(0).toUpperCase() + targetType.slice(1)}`, targetType]
        );
        sec = await db.queryOne<Section>('SELECT * FROM sections WHERE id = ?', [id]);
      }
      if (sec) return sec;
    }
  }

  // 4. Fallback to first available section of trip
  let fallbackSec = await db.queryOne<Section>(
    'SELECT * FROM sections WHERE trip_id = ? ORDER BY sort_order ASC LIMIT 1',
    [tripId]
  );
  if (!fallbackSec) {
    const id = generateId('sec');
    await db.execute(
      `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order)
       VALUES (?, ?, NULL, 'Places to Visit', 'wishlist', 1)`,
      [id, tripId]
    );
    fallbackSec = await db.queryOne<Section>('SELECT * FROM sections WHERE id = ?', [id]);
  }

  if (!fallbackSec) {
    throw new Error(`Unable to resolve or create a section for trip ${tripId}`);
  }
  return fallbackSec;
}

/**
 * Adds an itinerary stop to a trip, resolving place and section, validating opening hours,
 * calculating sort order, and recalculating transit legs for scheduled days.
 */
export async function addTripStop(
  db: DatabaseAdapter,
  tripId: string,
  input: AddTripStopInput
): Promise<StopWithDetails> {
  await ensureExtraStopColumns(db);

  // 1. Resolve section
  const section = await resolveSection(db, tripId, input);

  // 2. Resolve place
  const placeInput: ResolvePlaceInput = {
    place_id: input.place_id || input.place?.place_id,
    ...input.place,
  };
  const place = await resolveOrCreatePlace(db, placeInput);

  // 3. Validate opening hours if section is attached to a day
  let warning: OpeningHoursValidationResult | undefined;
  if (section.day_id) {
    const day = await db.queryOne<Day>('SELECT * FROM days WHERE id = ?', [section.day_id]);
    if (day) {
      const validation = validatePlaceOpeningHours(place, day.date, input.arrival_time);
      if (!validation.isValid) {
        warning = validation;
      }
    }
  }

  // 4. Compute sort_order
  let sortOrder = input.sort_order;
  if (sortOrder === undefined) {
    const maxRow = await db.queryOne<{ max_order: number | null }>(
      'SELECT MAX(sort_order) AS max_order FROM stops WHERE section_id = ?',
      [section.id]
    );
    sortOrder = (maxRow?.max_order ?? 0) + 1;
  }

  // 5. Insert Stop
  const stopId = generateId('stop');
  const isLocked = input.is_locked ? 1 : 0;
  const customTitle = input.custom_title ?? null;
  const pinColor = input.pin_color ?? null;

  try {
    await db.execute(
      `INSERT INTO stops (
        id, section_id, place_id, sort_order, arrival_time, departure_time,
        duration_minutes, user_notes, budget_amount, is_locked, custom_title, pin_color
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stopId,
        section.id,
        place.id,
        sortOrder,
        input.arrival_time ?? null,
        input.departure_time ?? null,
        input.duration_minutes ?? null,
        input.user_notes ?? null,
        input.budget_amount ?? null,
        isLocked,
        customTitle,
        pinColor,
      ]
    );
  } catch {
    // Schema fallback without extra columns
    await db.execute(
      `INSERT INTO stops (
        id, section_id, place_id, sort_order, arrival_time, departure_time,
        duration_minutes, user_notes, budget_amount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        stopId,
        section.id,
        place.id,
        sortOrder,
        input.arrival_time ?? null,
        input.departure_time ?? null,
        input.duration_minutes ?? null,
        input.user_notes ?? null,
        input.budget_amount ?? null,
      ]
    );
  }

  // 6. Recalculate transit legs if scheduled
  if (section.day_id) {
    await recalculateDayTransitLegs(db, tripId, section.day_id);
  }

  // 7. Update trip updated_at
  await db.execute("UPDATE trips SET updated_at = datetime('now') WHERE id = ?", [tripId]);

  const createdStop = await db.queryOne<Stop>('SELECT * FROM stops WHERE id = ?', [stopId]);
  if (!createdStop) {
    throw new Error(`Failed to retrieve newly created stop ${stopId}`);
  }

  return {
    ...createdStop,
    place,
    is_locked: isLocked,
    custom_title: customTitle,
    pin_color: pinColor,
    ...(warning ? { warning } : {}),
  };
}

/**
 * Updates a stop's timings, notes, budget, custom title, pin color, or lock status.
 */
export async function updateTripStop(
  db: DatabaseAdapter,
  tripId: string,
  stopId: string,
  patch: UpdateTripStopInput
): Promise<StopWithDetails> {
  await ensureExtraStopColumns(db);

  // 1. Fetch current stop and section
  const current = await db.queryOne<Stop & { day_id: string | null }>(
    `SELECT s.*, sec.day_id
     FROM stops s
     JOIN sections sec ON s.section_id = sec.id
     WHERE s.id = ? AND sec.trip_id = ?`,
    [stopId, tripId]
  );
  if (!current) {
    throw new Error(`Stop ${stopId} not found in trip ${tripId}`);
  }

  // 2. Fetch associated place
  const place = await db.queryOne<Place>('SELECT * FROM places WHERE id = ?', [current.place_id]);
  if (!place) {
    throw new Error(`Place ${current.place_id} for stop ${stopId} not found`);
  }

  // 3. Build UPDATE fields
  const fields: string[] = ["updated_at = datetime('now')"];
  const params: any[] = [];

  if (patch.arrival_time !== undefined) {
    fields.push('arrival_time = ?');
    params.push(patch.arrival_time);
  }
  if (patch.departure_time !== undefined) {
    fields.push('departure_time = ?');
    params.push(patch.departure_time);
  }
  if (patch.duration_minutes !== undefined) {
    fields.push('duration_minutes = ?');
    params.push(patch.duration_minutes);
  }
  if (patch.user_notes !== undefined) {
    fields.push('user_notes = ?');
    params.push(patch.user_notes);
  }
  if (patch.budget_amount !== undefined) {
    fields.push('budget_amount = ?');
    params.push(patch.budget_amount);
  }
  if (patch.sort_order !== undefined) {
    fields.push('sort_order = ?');
    params.push(patch.sort_order);
  }

  // Check extra columns
  if (patch.is_locked !== undefined) {
    try {
      fields.push('is_locked = ?');
      params.push(patch.is_locked ? 1 : 0);
    } catch {}
  }
  if (patch.custom_title !== undefined) {
    try {
      fields.push('custom_title = ?');
      params.push(patch.custom_title);
    } catch {}
  }
  if (patch.pin_color !== undefined) {
    try {
      fields.push('pin_color = ?');
      params.push(patch.pin_color);
    } catch {}
  }

  params.push(stopId);
  await db.execute(`UPDATE stops SET ${fields.join(', ')} WHERE id = ?`, params);

  // 4. Validate opening hours if timing changed
  let warning: OpeningHoursValidationResult | undefined;
  if (current.day_id && patch.arrival_time !== undefined) {
    const day = await db.queryOne<Day>('SELECT * FROM days WHERE id = ?', [current.day_id]);
    if (day) {
      const validation = validatePlaceOpeningHours(place, day.date, patch.arrival_time);
      if (!validation.isValid) {
        warning = validation;
      }
    }
  }

  // 5. Recalculate transit legs if timing changed on a scheduled day
  if (current.day_id && (patch.departure_time !== undefined || patch.arrival_time !== undefined)) {
    await recalculateDayTransitLegs(db, tripId, current.day_id);
  }

  // 6. Update trip updated_at
  await db.execute("UPDATE trips SET updated_at = datetime('now') WHERE id = ?", [tripId]);

  const updatedStop = await db.queryOne<Stop & { is_locked?: number; custom_title?: string; pin_color?: string }>(
    'SELECT * FROM stops WHERE id = ?',
    [stopId]
  );
  if (!updatedStop) {
    throw new Error(`Failed to load updated stop ${stopId}`);
  }

  return {
    ...updatedStop,
    place,
    ...(warning ? { warning } : {}),
  };
}

/**
 * Moves a stop across sections or reorders within the same section.
 * Re-normalizes sort orders and recalculates transit legs for both source and target days.
 */
export async function moveTripStop(
  db: DatabaseAdapter,
  tripId: string,
  stopId: string,
  options: MoveTripStopOptions
): Promise<StopWithDetails> {
  // 1. Fetch current stop and section
  const current = await db.queryOne<Stop & { day_id: string | null; section_id: string }>(
    `SELECT s.*, sec.day_id, sec.id AS section_id
     FROM stops s
     JOIN sections sec ON s.section_id = sec.id
     WHERE s.id = ? AND sec.trip_id = ?`,
    [stopId, tripId]
  );
  if (!current) {
    throw new Error(`Stop ${stopId} not found in trip ${tripId}`);
  }

  const targetSection = await db.queryOne<Section>(
    'SELECT * FROM sections WHERE id = ? AND trip_id = ?',
    [options.target_section_id, tripId]
  );
  if (!targetSection) {
    throw new Error(`Target section ${options.target_section_id} not found in trip ${tripId}`);
  }

  const sourceSectionId = current.section_id;
  const sourceDayId = current.day_id;
  const targetDayId = targetSection.day_id;

  // 2. Query existing stops in target section excluding current stop
  const targetStops = await db.query<Stop>(
    'SELECT * FROM stops WHERE section_id = ? AND id != ? ORDER BY sort_order ASC, created_at ASC',
    [targetSection.id, stopId]
  );

  // Compute insertion position
  let insertIndex = options.target_index ?? targetStops.length;
  // Convert 1-based index if given as 1..N+1
  if (insertIndex > 0 && insertIndex > targetStops.length) {
    insertIndex = targetStops.length;
  }
  if (insertIndex < 0) {
    insertIndex = 0;
  }

  // Insert current stop into target array
  targetStops.splice(insertIndex, 0, current);

  // 3. Batch update sort orders in target section
  const batchStatements: { sql: string; params: any[] }[] = [];

  for (let i = 0; i < targetStops.length; i++) {
    const s = targetStops[i];
    const newOrder = i + 1;
    if (s.id === stopId) {
      batchStatements.push({
        sql: `UPDATE stops SET section_id = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?`,
        params: [targetSection.id, newOrder, stopId],
      });
    } else if (s.sort_order !== newOrder) {
      batchStatements.push({
        sql: `UPDATE stops SET sort_order = ?, updated_at = datetime('now') WHERE id = ?`,
        params: [newOrder, s.id],
      });
    }
  }

  // 4. If moved to a different section, re-normalize source section
  if (sourceSectionId !== targetSection.id) {
    const sourceStops = await db.query<Stop>(
      'SELECT * FROM stops WHERE section_id = ? AND id != ? ORDER BY sort_order ASC, created_at ASC',
      [sourceSectionId, stopId]
    );
    for (let i = 0; i < sourceStops.length; i++) {
      const s = sourceStops[i];
      const newOrder = i + 1;
      if (s.sort_order !== newOrder) {
        batchStatements.push({
          sql: `UPDATE stops SET sort_order = ?, updated_at = datetime('now') WHERE id = ?`,
          params: [newOrder, s.id],
        });
      }
    }
  }

  await db.batch(batchStatements);

  // 5. Recalculate transit legs for source day
  if (sourceDayId) {
    await recalculateDayTransitLegs(db, tripId, sourceDayId);
  }

  // 6. Recalculate transit legs for target day
  if (targetDayId && targetDayId !== sourceDayId) {
    await recalculateDayTransitLegs(db, tripId, targetDayId);
  }

  // 7. Update trip updated_at
  await db.execute("UPDATE trips SET updated_at = datetime('now') WHERE id = ?", [tripId]);

  const movedStop = await db.queryOne<Stop>('SELECT * FROM stops WHERE id = ?', [stopId]);
  const place = await db.queryOne<Place>('SELECT * FROM places WHERE id = ?', [current.place_id]);

  return {
    ...movedStop!,
    place: place!,
  };
}

/**
 * Deletes a stop, cleans up transit legs and votes, and recalculates day transit legs.
 */
export async function deleteTripStop(
  db: DatabaseAdapter,
  tripId: string,
  stopId: string
): Promise<{ success: boolean; deleted_stop_id: string }> {
  // 1. Fetch stop and section/day
  const current = await db.queryOne<Stop & { day_id: string | null; section_id: string }>(
    `SELECT s.*, sec.day_id, sec.id AS section_id
     FROM stops s
     JOIN sections sec ON s.section_id = sec.id
     WHERE s.id = ? AND sec.trip_id = ?`,
    [stopId, tripId]
  );
  if (!current) {
    throw new Error(`Stop ${stopId} not found in trip ${tripId}`);
  }

  // 2. Delete stop votes
  await db.execute('DELETE FROM stop_votes WHERE stop_id = ?', [stopId]);

  // 3. Delete transit legs
  await db.execute(
    'DELETE FROM transit_legs WHERE trip_id = ? AND (from_stop_id = ? OR to_stop_id = ?)',
    [tripId, stopId, stopId]
  );

  // 4. Delete stop
  await db.execute('DELETE FROM stops WHERE id = ?', [stopId]);

  // 5. Re-normalize sort_order in section
  const remaining = await db.query<Stop>(
    'SELECT * FROM stops WHERE section_id = ? ORDER BY sort_order ASC, created_at ASC',
    [current.section_id]
  );
  if (remaining.length > 0) {
    const stmts: { sql: string; params: any[] }[] = [];
    for (let i = 0; i < remaining.length; i++) {
      const s = remaining[i];
      const newOrder = i + 1;
      if (s.sort_order !== newOrder) {
        stmts.push({
          sql: 'UPDATE stops SET sort_order = ? WHERE id = ?',
          params: [newOrder, s.id],
        });
      }
    }
    if (stmts.length > 0) {
      await db.batch(stmts);
    }
  }

  // 6. Recalculate transit legs for the day
  if (current.day_id) {
    await recalculateDayTransitLegs(db, tripId, current.day_id);
  }

  // 7. Update trip updated_at
  await db.execute("UPDATE trips SET updated_at = datetime('now') WHERE id = ?", [tripId]);

  return {
    success: true,
    deleted_stop_id: stopId,
  };
}

/**
 * Casts or updates a collaborator's vote (up/down) on an itinerary stop.
 */
export async function voteOnStop(
  db: DatabaseAdapter,
  tripId: string,
  stopId: string,
  input: VoteOnStopInput
): Promise<VoteResult> {
  // 1. Verify stop exists in trip
  const stop = await db.queryOne<Stop>(
    `SELECT s.*
     FROM stops s
     JOIN sections sec ON s.section_id = sec.id
     WHERE s.id = ? AND sec.trip_id = ?`,
    [stopId, tripId]
  );
  if (!stop) {
    throw new Error(`Stop ${stopId} not found in trip ${tripId}`);
  }

  // 2. Resolve collaborator
  let collaboratorId = input.collaborator_id;
  if (!collaboratorId && input.collaborator_name) {
    const collab = await db.queryOne<{ id: string }>(
      'SELECT id FROM collaborators WHERE trip_id = ? AND (LOWER(name) = LOWER(?) OR LOWER(email) = LOWER(?))',
      [tripId, input.collaborator_name.trim(), input.collaborator_name.trim()]
    );
    if (collab) {
      collaboratorId = collab.id;
    }
  }

  if (!collaboratorId) {
    // Pick first collaborator on trip or create a guest collaborator
    const firstCollab = await db.queryOne<{ id: string }>(
      'SELECT id FROM collaborators WHERE trip_id = ? LIMIT 1',
      [tripId]
    );
    if (firstCollab) {
      collaboratorId = firstCollab.id;
    } else {
      const newId = generateId('collab');
      await db.execute(
        `INSERT INTO collaborators (id, trip_id, name, email, role)
         VALUES (?, ?, ?, ?, 'editor')`,
        [newId, tripId, input.collaborator_name || 'Guest Explorer', `${newId}@example.com`]
      );
      collaboratorId = newId;
    }
  }

  // 3. Normalize vote type
  let voteType: VoteType = 'up';
  if (input.vote === -1 || input.vote === 'down') {
    voteType = 'down';
  } else if (input.vote === 1 || input.vote === 'up') {
    voteType = 'up';
  }

  // 4. Upsert vote
  const voteId = generateId('vote');
  await db.execute(
    `INSERT INTO stop_votes (id, stop_id, collaborator_id, vote_type)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(stop_id, collaborator_id) DO UPDATE SET vote_type = excluded.vote_type`,
    [voteId, stopId, collaboratorId, voteType]
  );

  // 5. Query tally
  const counts = await db.queryOne<{ up: number; down: number }>(
    `SELECT
       SUM(CASE WHEN vote_type = 'up' THEN 1 ELSE 0 END) AS up,
       SUM(CASE WHEN vote_type = 'down' THEN 1 ELSE 0 END) AS down
     FROM stop_votes
     WHERE stop_id = ?`,
    [stopId]
  );

  return {
    stop_id: stopId,
    up: counts?.up ?? 0,
    down: counts?.down ?? 0,
    user_vote: voteType,
  };
}
