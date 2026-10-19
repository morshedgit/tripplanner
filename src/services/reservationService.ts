import type { DatabaseAdapter } from '../db/client';
import type { Reservation, ReservationType, Day, Section } from '../types/domain';
import { generateId } from '../lib/http';

export type ReservationTypeInput =
  | 'flight'
  | 'lodging'
  | 'rental_car'
  | 'activity'
  | 'restaurant'
  | 'other'
  | 'FLIGHT'
  | 'LODGING'
  | 'CAR_RENTAL'
  | 'TRAIN'
  | 'RESTAURANT'
  | 'ACTIVITY'
  | string;

export interface CreateReservationInput {
  type: ReservationTypeInput;
  title: string;
  confirmation_code?: string | null;
  provider?: string | null;
  start_time?: string;
  start_datetime?: string;
  end_time?: string | null;
  end_datetime?: string | null;
  location?: string | null;
  cost?: number;
  currency?: string;
  notes?: string | null;
  auto_create_stops?: boolean;
}

export interface UpdateReservationInput {
  type?: ReservationTypeInput;
  title?: string;
  confirmation_code?: string | null;
  provider?: string | null;
  start_time?: string;
  start_datetime?: string;
  end_time?: string | null;
  end_datetime?: string | null;
  location?: string | null;
  cost?: number;
  currency?: string;
  notes?: string | null;
}

export interface ParsedReservation {
  title: string;
  type: ReservationType;
  confirmation_code: string | null;
  provider: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  cost: number;
  currency: string;
  notes: string | null;
}

/**
 * Normalizes input reservation type to domain schema CHECK constraint:
 * 'flight' | 'lodging' | 'rental_car' | 'activity' | 'restaurant' | 'other'
 */
export function normalizeReservationType(rawType: string): ReservationType {
  const lower = (rawType || '').trim().toLowerCase();
  if (lower === 'flight' || lower === 'plane' || lower === 'airline') return 'flight';
  if (lower === 'lodging' || lower === 'hotel' || lower === 'stay' || lower === 'airbnb' || lower === 'resort' || lower === 'hostel') return 'lodging';
  if (lower === 'rental_car' || lower === 'car_rental' || lower === 'car' || lower === 'car_hire') return 'rental_car';
  if (lower === 'restaurant' || lower === 'dining' || lower === 'food' || lower === 'dinner' || lower === 'lunch') return 'restaurant';
  if (lower === 'activity' || lower === 'tour' || lower === 'event' || lower === 'attraction' || lower === 'ticket') return 'activity';
  if (lower === 'train' || lower === 'rail' || lower === 'transit') return 'other';
  return 'other';
}

/**
 * Lists all reservations for a given trip, optionally filtered by reservation type.
 * Ordered by start_time ASC.
 */
export async function listReservations(
  db: DatabaseAdapter,
  tripId: string,
  type?: string
): Promise<Reservation[]> {
  if (type) {
    const normalized = normalizeReservationType(type);
    return await db.query<Reservation>(
      'SELECT * FROM reservations WHERE trip_id = ? AND type = ? ORDER BY start_time ASC',
      [tripId, normalized]
    );
  }

  return await db.query<Reservation>(
    'SELECT * FROM reservations WHERE trip_id = ? ORDER BY start_time ASC',
    [tripId]
  );
}

/**
 * Creates a new travel reservation (flight, lodging, rental car, restaurant, etc.).
 * When auto_create_stops !== false, automatically links or creates corresponding
 * arrival/check-in/departure stops in matching trip days based on start_time and end_time.
 */
export async function createReservation(
  db: DatabaseAdapter,
  tripId: string,
  input: CreateReservationInput
): Promise<Reservation> {
  const id = generateId('res');
  const normalizedType = normalizeReservationType(input.type);
  const startTime = input.start_time || input.start_datetime || new Date().toISOString();
  const endTime = input.end_time || input.end_datetime || null;
  const cost = typeof input.cost === 'number' ? input.cost : Number(input.cost ?? 0);
  const currency = (input.currency || 'USD').toUpperCase();
  const confirmationCode = input.confirmation_code ?? null;
  const provider = input.provider ?? null;
  const location = input.location ?? null;
  const notes = input.notes ?? null;

  await db.execute(
    `INSERT INTO reservations (
      id, trip_id, type, title, confirmation_code, provider,
      start_time, end_time, location, cost, currency, notes,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      id,
      tripId,
      normalizedType,
      input.title,
      confirmationCode,
      provider,
      startTime,
      endTime,
      location,
      cost,
      currency,
      notes,
    ]
  );

  // Automatically create stops if auto_create_stops is not explicitly disabled
  if (input.auto_create_stops !== false) {
    await autoCreateStopsForReservation(db, tripId, {
      id,
      type: normalizedType,
      title: input.title,
      confirmation_code: confirmationCode,
      start_time: startTime,
      end_time: endTime,
      location,
      cost,
    });
  }

  const created = await db.queryOne<Reservation>(
    'SELECT * FROM reservations WHERE id = ?',
    [id]
  );

  if (!created) {
    throw new Error(`Failed to retrieve newly created reservation ${id}`);
  }

  return created;
}

/**
 * Internal helper to automatically create check-in / arrival stops for reservations.
 */
async function autoCreateStopsForReservation(
  db: DatabaseAdapter,
  tripId: string,
  res: {
    id: string;
    type: ReservationType;
    title: string;
    confirmation_code: string | null;
    start_time: string;
    end_time: string | null;
    location: string | null;
    cost: number;
  }
): Promise<void> {
  const startDateStr = res.start_time.split('T')[0];

  // Look for matching calendar Day for the start date
  const startDay = await db.queryOne<Day>(
    'SELECT * FROM days WHERE trip_id = ? AND date = ?',
    [tripId, startDateStr]
  );

  if (startDay) {
    // Determine target section
    const timePart = res.start_time.includes('T') ? res.start_time.split('T')[1] : '';
    let preferredSection: 'morning' | 'afternoon' | 'evening' = 'morning';
    let arrivalTime = '09:00';

    if (timePart) {
      const hour = parseInt(timePart.slice(0, 2), 10);
      arrivalTime = timePart.slice(0, 5);
      if (hour >= 17) {
        preferredSection = 'evening';
      } else if (hour >= 12) {
        preferredSection = 'afternoon';
      }
    }

    let section = await db.queryOne<Section>(
      'SELECT * FROM sections WHERE trip_id = ? AND day_id = ? AND section_type = ? ORDER BY sort_order ASC',
      [tripId, startDay.id, preferredSection]
    );

    if (!section) {
      // Fall back to any section in that day
      section = await db.queryOne<Section>(
        'SELECT * FROM sections WHERE trip_id = ? AND day_id = ? ORDER BY sort_order ASC',
        [tripId, startDay.id]
      );
    }

    if (!section) {
      // Create a section for that day
      const sectionId = generateId('sec');
      const title = preferredSection.charAt(0).toUpperCase() + preferredSection.slice(1);
      await db.execute(
        `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`,
        [sectionId, tripId, startDay.id, title, preferredSection]
      );
      section = await db.queryOne<Section>('SELECT * FROM sections WHERE id = ?', [sectionId]);
    }

    if (section) {
      // Create or find Place
      const placeId = generateId('place');
      const placeName = res.title;
      const placeAddress = res.location || res.title;
      let placeCategory: 'attraction' | 'restaurant' | 'lodging' | 'transit' | 'shopping' | 'other' = 'transit';

      if (res.type === 'lodging') placeCategory = 'lodging';
      else if (res.type === 'restaurant') placeCategory = 'restaurant';
      else if (res.type === 'activity') placeCategory = 'attraction';

      await db.execute(
        `INSERT INTO places (id, name, formatted_address, lat, lng, category, rating, notes, created_at, updated_at)
         VALUES (?, ?, ?, 0.0, 0.0, ?, NULL, ?, datetime('now'), datetime('now'))`,
        [placeId, placeName, placeAddress, placeCategory, `Created for reservation ${res.id}`]
      );

      // Create Stop
      const stopId = generateId('stop');
      const maxSortRow = await db.queryOne<{ max_sort: number | null }>(
        'SELECT MAX(sort_order) as max_sort FROM stops WHERE section_id = ?',
        [section.id]
      );
      const sortOrder = (maxSortRow?.max_sort ?? -1) + 1;
      const notes = `${res.type === 'lodging' ? 'Check-in' : 'Reservation'}: ${res.title}${
        res.confirmation_code ? ` (Confirmation: ${res.confirmation_code})` : ''
      }`;

      await db.execute(
        `INSERT INTO stops (
          id, section_id, place_id, sort_order, arrival_time, departure_time,
          duration_minutes, user_notes, budget_amount, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, NULL, 60, ?, ?, datetime('now'), datetime('now'))`,
        [stopId, section.id, placeId, sortOrder, arrivalTime, notes, res.cost]
      );
    }
  }

  // If this is lodging with a different end date, auto-create a Check-out stop on the end day
  if (res.type === 'lodging' && res.end_time) {
    const endDateStr = res.end_time.split('T')[0];
    if (endDateStr !== startDateStr) {
      const endDay = await db.queryOne<Day>(
        'SELECT * FROM days WHERE trip_id = ? AND date = ?',
        [tripId, endDateStr]
      );

      if (endDay) {
        let checkoutSection = await db.queryOne<Section>(
          'SELECT * FROM sections WHERE trip_id = ? AND day_id = ? AND section_type = ? ORDER BY sort_order ASC',
          [tripId, endDay.id, 'morning']
        );

        if (!checkoutSection) {
          checkoutSection = await db.queryOne<Section>(
            'SELECT * FROM sections WHERE trip_id = ? AND day_id = ? ORDER BY sort_order ASC',
            [tripId, endDay.id]
          );
        }

        if (!checkoutSection) {
          const sectionId = generateId('sec');
          await db.execute(
            `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, 'Morning', 'morning', 0, datetime('now'), datetime('now'))`,
            [sectionId, tripId, endDay.id]
          );
          checkoutSection = await db.queryOne<Section>('SELECT * FROM sections WHERE id = ?', [sectionId]);
        }

        if (checkoutSection) {
          const placeId = generateId('place');
          await db.execute(
            `INSERT INTO places (id, name, formatted_address, lat, lng, category, rating, notes, created_at, updated_at)
             VALUES (?, ?, ?, 0.0, 0.0, 'lodging', NULL, ?, datetime('now'), datetime('now'))`,
            [placeId, res.title, res.location || res.title, `Check-out location for reservation ${res.id}`]
          );

          const maxSortRow = await db.queryOne<{ max_sort: number | null }>(
            'SELECT MAX(sort_order) as max_sort FROM stops WHERE section_id = ?',
            [checkoutSection.id]
          );
          const sortOrder = (maxSortRow?.max_sort ?? -1) + 1;
          const checkoutNotes = `Check-out: ${res.title}${
            res.confirmation_code ? ` (Confirmation: ${res.confirmation_code})` : ''
          }`;

          await db.execute(
            `INSERT INTO stops (
              id, section_id, place_id, sort_order, arrival_time, departure_time,
              duration_minutes, user_notes, budget_amount, created_at, updated_at
            ) VALUES (?, ?, ?, ?, '11:00', NULL, 30, ?, 0, datetime('now'), datetime('now'))`,
            [generateId('stop'), checkoutSection.id, placeId, sortOrder, checkoutNotes]
          );
        }
      }
    }
  }
}

/**
 * Updates an existing reservation. Returns updated reservation or null if not found.
 */
export async function updateReservation(
  db: DatabaseAdapter,
  tripId: string,
  reservationId: string,
  patch: UpdateReservationInput
): Promise<Reservation | null> {
  const existing = await db.queryOne<Reservation>(
    'SELECT * FROM reservations WHERE id = ? AND trip_id = ?',
    [reservationId, tripId]
  );

  if (!existing) {
    return null;
  }

  const newType = patch.type ? normalizeReservationType(patch.type) : existing.type;
  const newTitle = patch.title ?? existing.title;
  const newCode = patch.confirmation_code !== undefined ? patch.confirmation_code : existing.confirmation_code;
  const newProvider = patch.provider !== undefined ? patch.provider : existing.provider;
  const newStartTime = patch.start_time ?? patch.start_datetime ?? existing.start_time;
  const newEndTime = patch.end_time !== undefined ? patch.end_time : (patch.end_datetime !== undefined ? patch.end_datetime : existing.end_time);
  const newLocation = patch.location !== undefined ? patch.location : existing.location;
  const newCost = patch.cost !== undefined ? Number(patch.cost) : existing.cost;
  const newCurrency = patch.currency ? patch.currency.toUpperCase() : existing.currency;
  const newNotes = patch.notes !== undefined ? patch.notes : existing.notes;

  await db.execute(
    `UPDATE reservations SET
      type = ?,
      title = ?,
      confirmation_code = ?,
      provider = ?,
      start_time = ?,
      end_time = ?,
      location = ?,
      cost = ?,
      currency = ?,
      notes = ?,
      updated_at = datetime('now')
    WHERE id = ? AND trip_id = ?`,
    [
      newType,
      newTitle,
      newCode,
      newProvider,
      newStartTime,
      newEndTime,
      newLocation,
      newCost,
      newCurrency,
      newNotes,
      reservationId,
      tripId,
    ]
  );

  return await db.queryOne<Reservation>(
    'SELECT * FROM reservations WHERE id = ?',
    [reservationId]
  );
}

/**
 * Deletes a reservation by ID. Returns true if removed, false otherwise.
 */
export async function deleteReservation(
  db: DatabaseAdapter,
  tripId: string,
  reservationId: string
): Promise<boolean> {
  const res = await db.execute(
    'DELETE FROM reservations WHERE id = ? AND trip_id = ?',
    [reservationId, tripId]
  );
  return (res.changes ?? 0) > 0;
}

/**
 * Smart confirmation email parser (Wanderlog-style).
 * Extracts provider, confirmation code, reservation type, start/end dates, location, and cost from raw email text.
 */
export function parseReservationFromEmailText(rawText: string): ParsedReservation {
  const text = rawText || '';

  // 1. Detect Provider
  let provider: string | null = null;
  const knownProviders = [
    // Airlines
    'United Airlines', 'United', 'Delta Air Lines', 'Delta', 'American Airlines', 'Southwest Airlines',
    'Southwest', 'British Airways', 'Air France', 'Lufthansa', 'Japan Airlines', 'JAL', 'ANA',
    'All Nippon Airways', 'Emirates', 'Singapore Airlines', 'Qatar Airways', 'JetBlue', 'Alaska Airlines',
    'Ryanair', 'easyJet', 'KLM', 'Cathay Pacific', 'Virgin Atlantic',
    // Lodging
    'Marriott Hotels', 'Marriott', 'Courtyard by Marriott', 'Hilton Hotels', 'Hilton', 'Hyatt Regency',
    'Grand Hyatt', 'Park Hyatt', 'Hyatt', 'Sheraton', 'Westin', 'Airbnb', 'Booking.com', 'Hotels.com',
    'Expedia', 'Hostelworld', 'Agoda', 'Four Seasons', 'Ritz-Carlton', 'InterContinental', 'Holiday Inn',
    // Car Rental
    'Hertz', 'Avis', 'Enterprise Rent-A-Car', 'Enterprise', 'Budget Car Rental', 'Budget', 'Sixt',
    'National Car Rental', 'Alamo', 'Europcar',
    // Train & Rail
    'Amtrak', 'Eurostar', 'Japan Rail', 'JR Pass', 'SNCF', 'Deutsche Bahn', 'Renfe', 'Trenitalia',
    // Dining & Activities
    'OpenTable', 'Resy', 'SevenRooms', 'Viator', 'GetYourGuide', 'Klook'
  ];

  for (const p of knownProviders) {
    const pattern = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (pattern.test(text)) {
      provider = p;
      break;
    }
  }

  // 2. Detect Confirmation Code
  let confirmationCode: string | null = null;
  const codePatterns = [
    /(?:confirmation(?:\s*(?:code|number|num|#))?|booking\s*(?:ref|reference|code|#)|record\s*locator|pnr|reservation\s*(?:code|#|number))[:\s]*[:#]\s*([A-Z0-9-]{4,15})\b/i,
    /(?:confirmation\s+(?:code|number|#)|booking\s+(?:reference|ref|#)|record\s+locator|reservation\s+#)[:\s]+([A-Z0-9-]{4,15})\b/i,
    /\b(?:Code|PIN|Conf)[:\s#]+([A-Z0-9-]{5,12})\b/i,
    /(?:Confirmation|Reference):\s*([A-Z0-9-]{4,12})/i,
    /\b([A-Z0-9]{2}[0-9]{3,5}[A-Z0-9]?)\b/
  ];

  const ignoreWords = new Set(['CONFIRMATION', 'RESERVATION', 'BOOKING', 'NUMBER', 'HOTELS', 'AIRLINES']);

  for (const pat of codePatterns) {
    const match = text.match(pat);
    if (match && match[1]) {
      const code = match[1].trim().toUpperCase();
      if (!ignoreWords.has(code) && code.length >= 4) {
        confirmationCode = code;
        break;
      }
    }
  }

  // 3. Detect Reservation Type
  let type: ReservationType = 'other';
  const lower = text.toLowerCase();
  if (
    lower.includes('flight') ||
    lower.includes('airline') ||
    lower.includes('boarding pass') ||
    lower.includes('terminal') ||
    lower.includes('gate') ||
    lower.includes('e-ticket') ||
    lower.includes('departing flight')
  ) {
    type = 'flight';
  } else if (
    lower.includes('hotel') ||
    lower.includes('lodging') ||
    lower.includes('check-in') ||
    lower.includes('checkout') ||
    lower.includes('room reservation') ||
    lower.includes('night stay') ||
    lower.includes('airbnb') ||
    lower.includes('resort')
  ) {
    type = 'lodging';
  } else if (
    lower.includes('car rental') ||
    lower.includes('rental car') ||
    lower.includes('vehicle rental') ||
    lower.includes('pick-up') && lower.includes('drop-off') && (lower.includes('car') || lower.includes('hertz') || lower.includes('avis'))
  ) {
    type = 'rental_car';
  } else if (
    lower.includes('table reservation') ||
    lower.includes('restaurant') ||
    lower.includes('party of') ||
    lower.includes('dinner reservation') ||
    lower.includes('lunch reservation')
  ) {
    type = 'restaurant';
  } else if (
    lower.includes('tour') ||
    lower.includes('ticket') ||
    lower.includes('museum') ||
    lower.includes('guided activity') ||
    lower.includes('excursion')
  ) {
    type = 'activity';
  } else if (lower.includes('train') || lower.includes('rail') || lower.includes('amtrak') || lower.includes('eurostar')) {
    type = 'other';
  }

  // 4. Extract Cost and Currency
  let cost = 0;
  let currency = 'USD';

  if (text.includes('€') || /\bEUR\b/i.test(text)) currency = 'EUR';
  else if (text.includes('£') || /\bGBP\b/i.test(text)) currency = 'GBP';
  else if (text.includes('¥') || /\bJPY\b/i.test(text)) currency = 'JPY';
  else if (/\bCAD\b/i.test(text)) currency = 'CAD';
  else if (/\bAUD\b/i.test(text)) currency = 'AUD';
  else if (/\bCHF\b/i.test(text)) currency = 'CHF';

  const costPatterns = [
    /(?:total(?:\s*(?:paid|cost|price|amount|charge))?|amount\s*paid|grand\s*total|price|cost)[:\s]*([$€£¥A-Z]{0,4})\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /(?:[$€£¥]|USD\s*|EUR\s*|GBP\s*|JPY\s*)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2}))\s*(?:USD|EUR|GBP|JPY)/i
  ];

  for (const cp of costPatterns) {
    const match = text.match(cp);
    if (match) {
      const numStr = match[2] || match[1];
      if (numStr) {
        const parsedNum = parseFloat(numStr.replace(/,/g, ''));
        if (!isNaN(parsedNum) && parsedNum > 0) {
          cost = parsedNum;
          break;
        }
      }
    }
  }

  // 5. Extract Dates & Times (ISO or common formats)
  let startTime = '';
  let endTime: string | null = null;

  // Pattern for ISO timestamps: 2026-11-12T10:30:00 or 2026-11-12 10:30
  const isoMatches = text.match(/\b(20[2-9][0-9]-[0-1][0-9]-[0-3][0-9](?:[T\s][0-2][0-9]:[0-5][0-9](?::[0-5][0-9])?)?)\b/g);
  if (isoMatches && isoMatches.length > 0) {
    startTime = isoMatches[0].replace(' ', 'T');
    if (isoMatches.length > 1) {
      endTime = isoMatches[1].replace(' ', 'T');
    }
  }

  // Check labeled dates if ISO not fully found
  if (!startTime) {
    const departureMatch = text.match(/(?:departure|check-?in|start|pick-?up|date)[:\s]+([A-Za-z0-9,:\s-]{6,30})/i);
    if (departureMatch && departureMatch[1]) {
      const parsed = Date.parse(departureMatch[1].trim());
      if (!isNaN(parsed)) {
        startTime = new Date(parsed).toISOString();
      }
    }
  }

  if (!endTime) {
    const arrivalMatch = text.match(/(?:arrival|check-?out|end|drop-?off|return)[:\s]+([A-Za-z0-9,:\s-]{6,30})/i);
    if (arrivalMatch && arrivalMatch[1]) {
      const parsed = Date.parse(arrivalMatch[1].trim());
      if (!isNaN(parsed)) {
        endTime = new Date(parsed).toISOString();
      }
    }
  }

  if (!startTime) {
    startTime = new Date().toISOString();
  }

  // 6. Extract Location / Address
  let location: string | null = null;
  const locMatch = text.match(/(?:location|address|hotel\s*address|airport|destination)[:\s]+([^\n\r,]+(?:,\s*[^\n\r]+)?)/i);
  if (locMatch && locMatch[1]) {
    location = locMatch[1].trim();
  }

  // 7. Compose Title
  let title = '';
  if (provider) {
    const typeLabel =
      type === 'flight' ? 'Flight' :
      type === 'lodging' ? 'Hotel' :
      type === 'rental_car' ? 'Car Rental' :
      type === 'restaurant' ? 'Dining' :
      type === 'activity' ? 'Activity' : 'Reservation';
    title = `${provider} ${typeLabel}`;
  } else {
    // Try first informative non-empty line
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    title = lines[0] ? lines[0].slice(0, 60) : 'Travel Reservation';
  }

  return {
    title,
    type,
    confirmation_code: confirmationCode,
    provider,
    start_time: startTime,
    end_time: endTime,
    location,
    cost,
    currency,
    notes: text.trim().slice(0, 300) || null,
  };
}
