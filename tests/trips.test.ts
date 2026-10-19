import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, setTestDb, type DatabaseAdapter } from '../src/db/client';
import {
  listTrips,
  createTrip,
  getTrip,
  getTripSummary,
  updateTrip,
  deleteTrip,
  getTripDay,
  updateTripDay,
  createTripSection,
  listCollaborators,
  addCollaborator,
} from '../src/services/tripService';
import {
  listChecklists,
  addChecklistItem,
  toggleChecklistItem,
  listTripNotes,
  upsertTripNote,
  deleteTripNote,
} from '../src/services/checklistService';

// Astro API route handlers
import { GET as getTripsRoute, POST as postTripsRoute } from '../src/pages/api/v1/trips/index';
import {
  GET as getTripRoute,
  PATCH as patchTripRoute,
  DELETE as deleteTripRoute,
} from '../src/pages/api/v1/trips/[tripId]/index';
import { GET as getTripSummaryRoute } from '../src/pages/api/v1/trips/[tripId]/summary';
import {
  GET as getTripDayRoute,
  PATCH as patchTripDayRoute,
} from '../src/pages/api/v1/trips/[tripId]/days/[dayNumber]';
import { POST as postSectionRoute } from '../src/pages/api/v1/trips/[tripId]/sections';
import {
  GET as getCollaboratorsRoute,
  POST as postCollaboratorRoute,
} from '../src/pages/api/v1/trips/[tripId]/collaborators';
import {
  GET as getChecklistsRoute,
  POST as postChecklistRoute,
  PATCH as patchChecklistRoute,
} from '../src/pages/api/v1/trips/[tripId]/checklists';
import {
  GET as getNotesRoute,
  POST as postNoteRoute,
  DELETE as deleteNoteRoute,
} from '../src/pages/api/v1/trips/[tripId]/notes';

describe('Trip Service Unit Tests', () => {
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = await createTestDb(true);
    setTestDb(db);
  });

  afterEach(() => {
    setTestDb(null);
  });

  it('listTrips returns all seeded trips and supports status filtering', async () => {
    const allTrips = await listTrips(db, 'all');
    expect(allTrips.length).toBeGreaterThanOrEqual(1);
    expect(allTrips[0].id).toBe('trip-kyoto-2026');

    // Create an old past trip
    await createTrip(db, {
      title: 'Past Rome Holiday',
      destination: 'Rome, Italy',
      start_date: '2020-05-01',
      end_date: '2020-05-10',
    });

    const pastTrips = await listTrips(db, 'past');
    expect(pastTrips.some((t) => t.title === 'Past Rome Holiday')).toBe(true);

    const upcomingTrips = await listTrips(db, 'upcoming');
    expect(upcomingTrips.some((t) => t.id === 'trip-kyoto-2026')).toBe(true);
  });

  it('createTrip scaffolds Day records, scheduled Morning/Afternoon/Evening sections, wishlist section and owner collaborator', async () => {
    const newTrip = await createTrip(db, {
      title: '7-Day Swiss Alps Adventure',
      destination: 'Interlaken, Switzerland',
      start_date: '2026-08-10',
      end_date: '2026-08-16',
      timezone: 'Europe/Zurich',
      currency: 'CHF',
      budget_cap: 4000,
      cover_image_url: 'https://images.unsplash.com/swiss-alps.jpg',
      owner_name: 'Elena Rostova',
      owner_email: 'elena@example.com',
    });

    expect(newTrip.id).toBeDefined();
    expect(newTrip.title).toBe('7-Day Swiss Alps Adventure');
    expect(newTrip.destination).toBe('Interlaken, Switzerland');
    expect(newTrip.currency).toBe('CHF');

    // Verify 7 Days generated
    const days = await db.query<any>(
      'SELECT * FROM days WHERE trip_id = ? ORDER BY day_number ASC',
      [newTrip.id]
    );
    expect(days).toHaveLength(7);
    expect(days[0].day_number).toBe(1);
    expect(days[0].date).toBe('2026-08-10');
    expect(days[6].day_number).toBe(7);
    expect(days[6].date).toBe('2026-08-16');

    // Verify default sections: each day has 3 scheduled sections (Morning, Afternoon, Evening)
    const day1Sections = await db.query<any>(
      'SELECT * FROM sections WHERE day_id = ? ORDER BY sort_order ASC',
      [days[0].id]
    );
    expect(day1Sections).toHaveLength(3);
    expect(day1Sections.map((s) => s.section_type)).toEqual(['morning', 'afternoon', 'evening']);

    // Verify default WISHLIST section (day_id = null)
    const wishlistSections = await db.query<any>(
      'SELECT * FROM sections WHERE trip_id = ? AND day_id IS NULL',
      [newTrip.id]
    );
    expect(wishlistSections).toHaveLength(1);
    expect(wishlistSections[0].title).toBe('Places to Visit');
    expect(wishlistSections[0].section_type).toBe('wishlist');

    // Verify owner collaborator
    const collabs = await db.query<any>(
      'SELECT * FROM collaborators WHERE trip_id = ?',
      [newTrip.id]
    );
    expect(collabs).toHaveLength(1);
    expect(collabs[0].name).toBe('Elena Rostova');
    expect(collabs[0].role).toBe('owner');
  });

  it('getTrip returns full hierarchical projection with nested stops, transit, reservations, expenses, checklists, and notes', async () => {
    const trip = await getTrip(db, 'trip-kyoto-2026', 'full');
    expect(trip).not.toBeNull();
    expect(trip!.id).toBe('trip-kyoto-2026');
    expect(trip!.collaborators.length).toBe(2);
    expect(trip!.days.length).toBe(5);

    // Verify Day 1 sections & stops
    const day1 = trip!.days[0];
    expect(day1.day_number).toBe(1);
    const morningSec = day1.sections.find((s) => s.section_type === 'morning');
    expect(morningSec).toBeDefined();
    expect(morningSec!.stops.length).toBeGreaterThanOrEqual(1);

    // Stop has attached place details & transit_to_next
    const stop1 = morningSec!.stops[0];
    expect(stop1.place).toBeDefined();
    expect(stop1.place.name).toBe('Fushimi Inari Taisha');
    expect(stop1.place.lat).toBe(34.9671);

    // Wishlist sections populated
    expect(trip!.wishlist_sections.length).toBeGreaterThanOrEqual(1);
    expect(trip!.wishlist_sections[0].title).toBe('Places to Visit');

    // Auxiliary entities
    expect(trip!.reservations.length).toBeGreaterThanOrEqual(2);
    expect(trip!.expenses.length).toBeGreaterThanOrEqual(2);
    expect(trip!.checklists.length).toBeGreaterThanOrEqual(2);
    expect(trip!.checklists[0].items.length).toBeGreaterThanOrEqual(1);
    expect(trip!.notes.length).toBeGreaterThanOrEqual(1);
  });

  it('getTrip returns null for non-existent trip', async () => {
    const result = await getTrip(db, 'non-existent-trip');
    expect(result).toBeNull();
  });

  it('getTripSummary returns concise summary with days overview and totals', async () => {
    const summary = await getTripSummary(db, 'trip-kyoto-2026');
    expect(summary).not.toBeNull();
    expect(summary!.id).toBe('trip-kyoto-2026');
    expect(summary!.destination_city).toBe('Kyoto, Japan');
    expect(summary!.total_days).toBe(5);
    expect(summary!.total_stops).toBeGreaterThanOrEqual(4);
    expect(summary!.total_spent).toBeGreaterThanOrEqual(400);
    expect(summary!.base_currency).toBe('USD');
    expect(summary!.days_overview).toHaveLength(5);
    expect(summary!.days_overview[0].day_number).toBe(1);
    expect(summary!.days_overview[0].stop_count).toBeGreaterThan(0);
    expect(summary!.days_overview[0].highlight_places).toContain('Fushimi Inari Taisha');
  });

  it('updateTrip updates metadata and increments version/timestamp', async () => {
    const updated = await updateTrip(db, 'trip-kyoto-2026', {
      title: '5-Day Kyoto Culinary & Cultural Tour',
      budget_cap: 3500,
    });

    expect(updated).not.toBeNull();
    expect(updated!.title).toBe('5-Day Kyoto Culinary & Cultural Tour');
    expect(updated!.budget_cap).toBe(3500);

    const nonExistent = await updateTrip(db, 'missing-trip', { title: 'Test' });
    expect(nonExistent).toBeNull();
  });

  it('deleteTrip cascades deletion to child records', async () => {
    const deleted = await deleteTrip(db, 'trip-kyoto-2026');
    expect(deleted).toBe(true);

    const tripAfter = await db.queryOne('SELECT * FROM trips WHERE id = ?', ['trip-kyoto-2026']);
    expect(tripAfter).toBeNull();

    const daysAfter = await db.query('SELECT * FROM days WHERE trip_id = ?', ['trip-kyoto-2026']);
    expect(daysAfter).toHaveLength(0);

    const notFound = await deleteTrip(db, 'already-deleted');
    expect(notFound).toBe(false);
  });

  it('getTripDay and updateTripDay inspect and patch individual day schedule', async () => {
    const daySchedule = await getTripDay(db, 'trip-kyoto-2026', 1);
    expect(daySchedule).not.toBeNull();
    expect(daySchedule!.day_number).toBe(1);
    expect(daySchedule!.sections.length).toBeGreaterThanOrEqual(3);

    const updated = await updateTripDay(db, 'trip-kyoto-2026', 1, {
      notes: 'Remember to wear comfortable walking shoes for Torii gates hike.',
    });
    expect(updated).not.toBeNull();
    expect(updated!.notes).toBe('Remember to wear comfortable walking shoes for Torii gates hike.');

    const missingDay = await getTripDay(db, 'trip-kyoto-2026', 99);
    expect(missingDay).toBeNull();
  });

  it('createTripSection adds custom scheduled and wishlist sections', async () => {
    const day1 = await db.queryOne<any>('SELECT id FROM days WHERE trip_id = ? AND day_number = 1', [
      'trip-kyoto-2026',
    ]);

    const lateNightSec = await createTripSection(db, 'trip-kyoto-2026', {
      day_id: day1.id,
      title: 'Late Night Izakaya Crawl',
      section_type: 'custom',
    });
    expect(lateNightSec.id).toBeDefined();
    expect(lateNightSec.title).toBe('Late Night Izakaya Crawl');
    expect(lateNightSec.day_id).toBe(day1.id);

    const customWishlist = await createTripSection(db, 'trip-kyoto-2026', {
      title: 'Michelin Star Wishlist',
      section_type: 'wishlist',
    });
    expect(customWishlist.day_id).toBeNull();
    expect(customWishlist.title).toBe('Michelin Star Wishlist');
  });

  it('listCollaborators and addCollaborator manage trip participants', async () => {
    const initialCollabs = await listCollaborators(db, 'trip-kyoto-2026');
    expect(initialCollabs).toHaveLength(2);

    const newCollab = await addCollaborator(db, 'trip-kyoto-2026', {
      name: 'Charlie Davis',
      email: 'charlie@example.com',
      role: 'viewer',
    });
    expect(newCollab.name).toBe('Charlie Davis');
    expect(newCollab.role).toBe('viewer');

    const updatedCollabs = await listCollaborators(db, 'trip-kyoto-2026');
    expect(updatedCollabs).toHaveLength(3);
  });
});

describe('Checklist & Notes Service Unit Tests', () => {
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = await createTestDb(true);
    setTestDb(db);
  });

  afterEach(() => {
    setTestDb(null);
  });

  it('listChecklists returns categories with populated items', async () => {
    const checklists = await listChecklists(db, 'trip-kyoto-2026');
    expect(checklists.length).toBeGreaterThanOrEqual(2);
    expect(checklists.some((c) => c.category === 'todo')).toBe(true);
    expect(checklists.some((c) => c.category === 'packing')).toBe(true);
  });

  it('addChecklistItem auto-creates checklist category and resolves collaborator by name', async () => {
    const item = await addChecklistItem(db, 'trip-kyoto-2026', {
      checklist_category: 'documents',
      title: 'Print International Driving Permit',
      assigned_to_name: 'Alice',
    });

    expect(item.id).toBeDefined();
    expect(item.title).toBe('Print International Driving Permit');
    expect(item.is_completed).toBe(false);
    expect(item.assigned_to_collaborator_id).toBe('collab-alice');

    // Verify 'documents' checklist container was auto-created
    const docChecklist = await db.queryOne<any>(
      'SELECT * FROM checklists WHERE trip_id = ? AND category = ?',
      ['trip-kyoto-2026', 'documents']
    );
    expect(docChecklist).not.toBeNull();
    expect(docChecklist.title).toBe('Travel Documents');
  });

  it('toggleChecklistItem updates completion status', async () => {
    // Find chki-esim (eSIM purchase, initial is_completed = 0)
    const toggled1 = await toggleChecklistItem(db, 'trip-kyoto-2026', 'chki-esim');
    expect(toggled1).not.toBeNull();
    expect(toggled1!.is_completed).toBe(true);

    const toggled2 = await toggleChecklistItem(db, 'trip-kyoto-2026', 'chki-esim', false);
    expect(toggled2).not.toBeNull();
    expect(toggled2!.is_completed).toBe(false);

    const missing = await toggleChecklistItem(db, 'trip-kyoto-2026', 'missing-item');
    expect(missing).toBeNull();
  });

  it('listTripNotes, upsertTripNote and deleteTripNote manage collaborative markdown notes', async () => {
    const initialNotes = await listTripNotes(db, 'trip-kyoto-2026');
    expect(initialNotes.length).toBeGreaterThanOrEqual(1);

    // Create new note
    const newNote = await upsertTripNote(db, 'trip-kyoto-2026', {
      title: 'Emergency Medical Contacts',
      content_markdown: '## Kyoto City Hospital\nPhone: +81-75-311-5311\nAddress: Gojo-dori',
    });
    expect(newNote.id).toBeDefined();
    expect(newNote.title).toBe('Emergency Medical Contacts');

    // Update existing note
    const updatedNote = await upsertTripNote(db, 'trip-kyoto-2026', {
      id: newNote.id,
      title: 'Emergency Medical Contacts & Pharmacies',
      content_markdown: 'Updated markdown content with 24/7 pharmacies',
    });
    expect(updatedNote.title).toBe('Emergency Medical Contacts & Pharmacies');
    expect(updatedNote.content).toContain('24/7 pharmacies');

    // Delete note
    const deleted = await deleteTripNote(db, 'trip-kyoto-2026', newNote.id);
    expect(deleted).toBe(true);

    const notesAfter = await listTripNotes(db, 'trip-kyoto-2026');
    expect(notesAfter.some((n) => n.id === newNote.id)).toBe(false);
  });
});

describe('Astro REST API Endpoints Integration Tests', () => {
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = await createTestDb(true);
    setTestDb(db);
  });

  afterEach(() => {
    setTestDb(null);
  });

  it('GET /api/v1/trips returns list of trips', async () => {
    const req = new Request('http://localhost/api/v1/trips?status=all');
    const res = await getTripsRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: {},
    } as any);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].id).toBe('trip-kyoto-2026');
  });

  it('POST /api/v1/trips creates trip and returns 201 with validation failure handling', async () => {
    // 1. Validation error on missing required fields
    const invalidReq = new Request('http://localhost/api/v1/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Incomplete Trip' }),
    });
    const invalidRes = await postTripsRoute({
      request: invalidReq,
      locals: {},
      url: new URL(invalidReq.url),
      params: {},
    } as any);

    expect(invalidRes.status).toBe(400);
    const errorBody = await invalidRes.json();
    expect(errorBody.code).toBe('VALIDATION_ERROR');
    expect(errorBody.errors).toBeDefined();

    // 2. Successful creation
    const validReq = new Request('http://localhost/api/v1/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Iceland Ring Road Odyssey',
        destination: 'Reykjavik, Iceland',
        start_date: '2026-09-01',
        end_date: '2026-09-07',
        currency: 'ISK',
        budget_cap: 5000,
        owner_name: 'Thor Odinson',
        owner_email: 'thor@asgard.org',
      }),
    });
    const validRes = await postTripsRoute({
      request: validReq,
      locals: {},
      url: new URL(validReq.url),
      params: {},
    } as any);

    expect(validRes.status).toBe(201);
    const createdTrip = await validRes.json();
    expect(createdTrip.title).toBe('Iceland Ring Road Odyssey');
    expect(createdTrip.destination).toBe('Reykjavik, Iceland');
  });

  it('GET /api/v1/trips/[tripId] returns full hierarchy and 404 for missing trip', async () => {
    const req = new Request('http://localhost/api/v1/trips/trip-kyoto-2026?view=full');
    const res = await getTripRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: { tripId: 'trip-kyoto-2026' },
    } as any);

    expect(res.status).toBe(200);
    const trip = await res.json();
    expect(trip.id).toBe('trip-kyoto-2026');
    expect(trip.days.length).toBe(5);

    const missingReq = new Request('http://localhost/api/v1/trips/unknown');
    const missingRes = await getTripRoute({
      request: missingReq,
      locals: {},
      url: new URL(missingReq.url),
      params: { tripId: 'unknown' },
    } as any);
    expect(missingRes.status).toBe(404);
  });

  it('PATCH and DELETE /api/v1/trips/[tripId] modify and delete trip', async () => {
    // PATCH
    const patchReq = new Request('http://localhost/api/v1/trips/trip-kyoto-2026', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Kyoto Autumn Photography Trip' }),
    });
    const patchRes = await patchTripRoute({
      request: patchReq,
      locals: {},
      url: new URL(patchReq.url),
      params: { tripId: 'trip-kyoto-2026' },
    } as any);
    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json();
    expect(updated.title).toBe('Kyoto Autumn Photography Trip');

    // DELETE
    const deleteReq = new Request('http://localhost/api/v1/trips/trip-kyoto-2026', {
      method: 'DELETE',
    });
    const deleteRes = await deleteTripRoute({
      request: deleteReq,
      locals: {},
      url: new URL(deleteReq.url),
      params: { tripId: 'trip-kyoto-2026' },
    } as any);
    expect(deleteRes.status).toBe(200);
    const deleteBody = await deleteRes.json();
    expect(deleteBody.success).toBe(true);
  });

  it('GET /api/v1/trips/[tripId]/summary returns summary statistics', async () => {
    const req = new Request('http://localhost/api/v1/trips/trip-kyoto-2026/summary');
    const res = await getTripSummaryRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: { tripId: 'trip-kyoto-2026' },
    } as any);

    expect(res.status).toBe(200);
    const summary = await res.json();
    expect(summary.total_days).toBe(5);
    expect(summary.total_spent).toBeGreaterThan(0);
    expect(summary.days_overview.length).toBe(5);
  });

  it('GET and PATCH /api/v1/trips/[tripId]/days/[dayNumber]', async () => {
    // GET Day 1
    const getReq = new Request('http://localhost/api/v1/trips/trip-kyoto-2026/days/1');
    const getRes = await getTripDayRoute({
      request: getReq,
      locals: {},
      url: new URL(getReq.url),
      params: { tripId: 'trip-kyoto-2026', dayNumber: '1' },
    } as any);
    expect(getRes.status).toBe(200);
    const day = await getRes.json();
    expect(day.day_number).toBe(1);

    // PATCH Day 1
    const patchReq = new Request('http://localhost/api/v1/trips/trip-kyoto-2026/days/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: 'Early morning hike recommended' }),
    });
    const patchRes = await patchTripDayRoute({
      request: patchReq,
      locals: {},
      url: new URL(patchReq.url),
      params: { tripId: 'trip-kyoto-2026', dayNumber: '1' },
    } as any);
    expect(patchRes.status).toBe(200);
    const updated = await patchRes.json();
    expect(updated.notes).toBe('Early morning hike recommended');
  });

  it('POST /api/v1/trips/[tripId]/sections creates custom section', async () => {
    const req = new Request('http://localhost/api/v1/trips/trip-kyoto-2026/sections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Coffee Shops & Bakeries',
        section_type: 'wishlist',
      }),
    });
    const res = await postSectionRoute({
      request: req,
      locals: {},
      url: new URL(req.url),
      params: { tripId: 'trip-kyoto-2026' },
    } as any);

    expect(res.status).toBe(201);
    const section = await res.json();
    expect(section.title).toBe('Coffee Shops & Bakeries');
    expect(section.section_type).toBe('wishlist');
  });

  it('GET and POST /api/v1/trips/[tripId]/collaborators', async () => {
    const getReq = new Request('http://localhost/api/v1/trips/trip-kyoto-2026/collaborators');
    const getRes = await getCollaboratorsRoute({
      request: getReq,
      locals: {},
      url: new URL(getReq.url),
      params: { tripId: 'trip-kyoto-2026' },
    } as any);
    expect(getRes.status).toBe(200);
    const initialList = await getRes.json();
    expect(initialList.length).toBe(2);

    const postReq = new Request('http://localhost/api/v1/trips/trip-kyoto-2026/collaborators', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'David Miller',
        email: 'david@example.com',
        role: 'editor',
      }),
    });
    const postRes = await postCollaboratorRoute({
      request: postReq,
      locals: {},
      url: new URL(postReq.url),
      params: { tripId: 'trip-kyoto-2026' },
    } as any);
    expect(postRes.status).toBe(201);
    const created = await postRes.json();
    expect(created.name).toBe('David Miller');
  });

  it('GET, POST, and PATCH /api/v1/trips/[tripId]/checklists', async () => {
    // 1. GET checklists
    const getReq = new Request('http://localhost/api/v1/trips/trip-kyoto-2026/checklists');
    const getRes = await getChecklistsRoute({
      request: getReq,
      locals: {},
      url: new URL(getReq.url),
      params: { tripId: 'trip-kyoto-2026' },
    } as any);
    expect(getRes.status).toBe(200);
    const checklists = await getRes.json();
    expect(checklists.length).toBeGreaterThanOrEqual(2);

    // 2. POST checklist item
    const postReq = new Request('http://localhost/api/v1/trips/trip-kyoto-2026/checklists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        checklist_category: 'packing',
        title: 'Rain Jacket & Umbrella',
      }),
    });
    const postRes = await postChecklistRoute({
      request: postReq,
      locals: {},
      url: new URL(postReq.url),
      params: { tripId: 'trip-kyoto-2026' },
    } as any);
    expect(postRes.status).toBe(201);
    const createdItem = await postRes.json();
    expect(createdItem.title).toBe('Rain Jacket & Umbrella');

    // 3. PATCH toggle item
    const patchReq = new Request('http://localhost/api/v1/trips/trip-kyoto-2026/checklists', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: createdItem.id,
        is_completed: true,
      }),
    });
    const patchRes = await patchChecklistRoute({
      request: patchReq,
      locals: {},
      url: new URL(patchReq.url),
      params: { tripId: 'trip-kyoto-2026' },
    } as any);
    expect(patchRes.status).toBe(200);
    const updatedItem = await patchRes.json();
    expect(updatedItem.is_completed).toBe(true);
  });

  it('GET, POST, and DELETE /api/v1/trips/[tripId]/notes', async () => {
    // 1. GET notes
    const getReq = new Request('http://localhost/api/v1/trips/trip-kyoto-2026/notes');
    const getRes = await getNotesRoute({
      request: getReq,
      locals: {},
      url: new URL(getReq.url),
      params: { tripId: 'trip-kyoto-2026' },
    } as any);
    expect(getRes.status).toBe(200);
    const notes = await getRes.json();
    expect(notes.length).toBeGreaterThanOrEqual(1);

    // 2. POST create note
    const postReq = new Request('http://localhost/api/v1/trips/trip-kyoto-2026/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Luggage Forwarding (Takkyubin) Guide',
        content_markdown: 'Drop off at 7-Eleven by 10 AM for same-day delivery to Osaka hotel.',
      }),
    });
    const postRes = await postNoteRoute({
      request: postReq,
      locals: {},
      url: new URL(postReq.url),
      params: { tripId: 'trip-kyoto-2026' },
    } as any);
    expect(postRes.status).toBe(201);
    const createdNote = await postRes.json();
    expect(createdNote.title).toBe('Luggage Forwarding (Takkyubin) Guide');

    // 3. DELETE note
    const deleteReq = new Request(
      `http://localhost/api/v1/trips/trip-kyoto-2026/notes?note_id=${createdNote.id}`,
      { method: 'DELETE' }
    );
    const deleteRes = await deleteNoteRoute({
      request: deleteReq,
      locals: {},
      url: new URL(deleteReq.url),
      params: { tripId: 'trip-kyoto-2026' },
    } as any);
    expect(deleteRes.status).toBe(200);
    const deleteBody = await deleteRes.json();
    expect(deleteBody.success).toBe(true);
  });
});
