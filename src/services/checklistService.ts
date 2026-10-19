import type { DatabaseAdapter } from '../db/client';
import { generateId } from '../lib/http';
import type {
  Checklist,
  ChecklistItem,
  ChecklistCategory,
  TripNote,
} from '../types/domain';

export interface ChecklistWithItems extends Checklist {
  items: ChecklistItem[];
}

export interface AddChecklistItemInput {
  checklist_category?: ChecklistCategory;
  checklist_id?: string;
  title: string;
  assigned_to_name?: string;
  assigned_to_collaborator_id?: string | null;
  due_date?: string | null;
  sort_order?: number;
}

export interface UpsertTripNoteInput {
  id?: string;
  title?: string;
  content_markdown?: string;
  content?: string;
  updated_by_collaborator_id?: string | null;
}

/**
 * Lists all checklists for a trip, populated with their items.
 */
export async function listChecklists(
  db: DatabaseAdapter,
  tripId: string
): Promise<ChecklistWithItems[]> {
  const checklists = await db.query<Checklist>(
    'SELECT * FROM checklists WHERE trip_id = ? ORDER BY sort_order ASC, created_at ASC',
    [tripId]
  );

  if (checklists.length === 0) {
    return [];
  }

  const rawItems = await db.query<any>(
    `SELECT ci.* FROM checklist_items ci
     JOIN checklists c ON ci.checklist_id = c.id
     WHERE c.trip_id = ?
     ORDER BY ci.sort_order ASC, ci.created_at ASC`,
    [tripId]
  );

  const itemsByChecklist = new Map<string, ChecklistItem[]>();
  for (const item of rawItems) {
    if (!itemsByChecklist.has(item.checklist_id)) {
      itemsByChecklist.set(item.checklist_id, []);
    }
    itemsByChecklist.get(item.checklist_id)!.push({
      ...item,
      is_completed: Boolean(item.is_completed),
    });
  }

  return checklists.map((c) => ({
    ...c,
    items: itemsByChecklist.get(c.id) || [],
  }));
}

/**
 * Adds an item to a checklist. If the checklist doesn't exist for the category,
 * it is automatically created. If assigned_to_name is supplied, resolves collaborator ID.
 */
export async function addChecklistItem(
  db: DatabaseAdapter,
  tripId: string,
  input: AddChecklistItemInput
): Promise<ChecklistItem> {
  let checklistId = input.checklist_id;

  if (!checklistId) {
    const category: ChecklistCategory = input.checklist_category || 'todo';
    const existing = await db.queryOne<Checklist>(
      'SELECT * FROM checklists WHERE trip_id = ? AND category = ? LIMIT 1',
      [tripId, category]
    );

    if (existing) {
      checklistId = existing.id;
    } else {
      checklistId = generateId('chk');
      const categoryTitles: Record<ChecklistCategory, string> = {
        packing: 'Packing List',
        todo: 'To-Do List',
        documents: 'Travel Documents',
        custom: 'Trip Checklist',
      };
      const title = categoryTitles[category] || 'Trip Checklist';

      const maxSortRow = await db.queryOne<{ max_sort: number | null }>(
        'SELECT MAX(sort_order) as max_sort FROM checklists WHERE trip_id = ?',
        [tripId]
      );
      const sortOrder = (maxSortRow?.max_sort ?? -1) + 1;

      await db.execute(
        `INSERT INTO checklists (id, trip_id, title, category, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [checklistId, tripId, title, category, sortOrder]
      );
    }
  }

  // Resolve collaborator assignment by name if not provided directly
  let assignedCollaboratorId = input.assigned_to_collaborator_id ?? null;
  if (!assignedCollaboratorId && input.assigned_to_name) {
    const collab = await db.queryOne<{ id: string }>(
      'SELECT id FROM collaborators WHERE trip_id = ? AND name LIKE ? LIMIT 1',
      [tripId, `%${input.assigned_to_name}%`]
    );
    if (collab) {
      assignedCollaboratorId = collab.id;
    }
  }

  let sortOrder = input.sort_order;
  if (sortOrder === undefined) {
    const maxItemSort = await db.queryOne<{ max_sort: number | null }>(
      'SELECT MAX(sort_order) as max_sort FROM checklist_items WHERE checklist_id = ?',
      [checklistId]
    );
    sortOrder = (maxItemSort?.max_sort ?? -1) + 1;
  }

  const itemId = generateId('item');
  await db.execute(
    `INSERT INTO checklist_items (
      id, checklist_id, title, is_completed, assigned_to_collaborator_id, due_date, sort_order, created_at, updated_at
    ) VALUES (?, ?, ?, 0, ?, ?, ?, datetime('now'), datetime('now'))`,
    [itemId, checklistId, input.title, assignedCollaboratorId, input.due_date ?? null, sortOrder]
  );

  const item = await db.queryOne<any>('SELECT * FROM checklist_items WHERE id = ?', [itemId]);
  if (!item) {
    throw new Error(`Failed to create checklist item ${itemId}`);
  }

  return {
    ...item,
    is_completed: Boolean(item.is_completed),
  };
}

/**
 * Toggles or updates the completion status of a checklist item.
 */
export async function toggleChecklistItem(
  db: DatabaseAdapter,
  tripId: string,
  itemId: string,
  isCompleted?: boolean
): Promise<ChecklistItem | null> {
  const existing = await db.queryOne<any>(
    `SELECT ci.*, c.trip_id FROM checklist_items ci
     JOIN checklists c ON ci.checklist_id = c.id
     WHERE ci.id = ? AND c.trip_id = ?`,
    [itemId, tripId]
  );

  if (!existing) return null;

  const nextCompleted = isCompleted !== undefined ? (isCompleted ? 1 : 0) : existing.is_completed ? 0 : 1;

  await db.execute(
    `UPDATE checklist_items SET is_completed = ?, updated_at = datetime('now') WHERE id = ?`,
    [nextCompleted, itemId]
  );

  const updated = await db.queryOne<any>('SELECT * FROM checklist_items WHERE id = ?', [itemId]);
  if (!updated) return null;

  return {
    ...updated,
    is_completed: Boolean(updated.is_completed),
  };
}

/**
 * Lists collaborative notes for a trip.
 */
export async function listTripNotes(
  db: DatabaseAdapter,
  tripId: string
): Promise<TripNote[]> {
  return await db.query<TripNote>(
    'SELECT * FROM trip_notes WHERE trip_id = ? ORDER BY updated_at DESC',
    [tripId]
  );
}

/**
 * Creates or updates a trip note.
 */
export async function upsertTripNote(
  db: DatabaseAdapter,
  tripId: string,
  input: UpsertTripNoteInput
): Promise<TripNote> {
  const title = input.title ?? 'Untitled Note';
  const content = input.content_markdown ?? input.content ?? '';
  const collaboratorId = input.updated_by_collaborator_id ?? null;

  if (input.id) {
    const existing = await db.queryOne<TripNote>(
      'SELECT * FROM trip_notes WHERE id = ? AND trip_id = ?',
      [input.id, tripId]
    );

    if (existing) {
      await db.execute(
        `UPDATE trip_notes
         SET title = ?, content = ?, updated_by_collaborator_id = ?, updated_at = datetime('now')
         WHERE id = ?`,
        [title, content, collaboratorId, input.id]
      );

      const updated = await db.queryOne<TripNote>(
        'SELECT * FROM trip_notes WHERE id = ?',
        [input.id]
      );
      return updated!;
    }
  }

  const noteId = input.id ?? generateId('note');
  await db.execute(
    `INSERT INTO trip_notes (
      id, trip_id, title, content, updated_by_collaborator_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [noteId, tripId, title, content, collaboratorId]
  );

  const created = await db.queryOne<TripNote>('SELECT * FROM trip_notes WHERE id = ?', [noteId]);
  if (!created) {
    throw new Error(`Failed to create note ${noteId}`);
  }
  return created;
}

/**
 * Deletes a note belonging to a trip.
 */
export async function deleteTripNote(
  db: DatabaseAdapter,
  tripId: string,
  noteId: string
): Promise<boolean> {
  const res = await db.execute(
    'DELETE FROM trip_notes WHERE id = ? AND trip_id = ?',
    [noteId, tripId]
  );
  return res.changes > 0;
}
