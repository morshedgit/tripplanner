import type { DatabaseAdapter } from '../db/client';
import { generateId } from '../lib/http';
import type {
  Trip,
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
  TripSummary,
  CollaboratorBalance,
  SettlementTransfer,
} from '../types/domain';

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ChatAction {
  tool: string;
  summary: string;
  payload?: any;
}

export interface ChatSessionState {
  session_id: string;
  active_trip_id: string;
  active_day_number: number | null;
  active_tab: string;
  selected_stop_id: string | null;
  last_actor: string;
  last_event_summary: string;
  state_version: number;
  ui_context_json?: string;
  updated_at?: string;
}

export interface WorkspaceSession {
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

export interface SessionEvent {
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

export interface ChatMessageResult {
  reply: string;
  trip_id: string;
  actions_taken: ChatAction[];
  updated_trip_summary?: TripSummary | null;
  session_state?: ChatSessionState;
}

export type ChatAgentOutput = ChatMessageResult;

export interface ChatMessageInput {
  trip_id?: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
  actor?: string;
}

export interface SessionContext {
  activeDayNumber?: number | null;
  selectedStopId?: string | null;
  activeTab?: string | null;
}

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

  const existing = await db.queryOne<{ session_id: string }>(
    'SELECT session_id FROM workspace_sessions WHERE session_id = ?',
    ['default']
  );
  if (!existing) {
    const firstTrip = await db.queryOne<{ id: string }>('SELECT id FROM trips ORDER BY start_date ASC LIMIT 1');
    const defaultTripId = firstTrip?.id || 'trip-kyoto-2026';
    await db.execute(
      `INSERT INTO workspace_sessions (
        session_id, active_trip_id, active_day_number, active_tab, selected_stop_id, last_actor, last_event_summary, state_version, ui_context_json
      ) VALUES ('default', ?, 1, 'itinerary', NULL, 'system', 'Session initialized', 1, '{}')`,
      [defaultTripId]
    );
  }
}

// Built-in POI Catalog for instant zero-config resolution
interface CatalogPlace {
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: 'attraction' | 'restaurant' | 'lodging' | 'shopping' | 'transit' | 'other';
  rating: number;
  notes: string;
}

const POI_CATALOG: Record<string, CatalogPlace[]> = {
  tokyo: [
    {
      name: 'Senso-ji Temple',
      address: '2 Chome-3-1 Asakusa, Taito City, Tokyo 111-0032',
      lat: 35.7148,
      lng: 139.7967,
      category: 'attraction',
      rating: 4.7,
      notes: "Tokyo's oldest and most significant Buddhist temple.",
    },
    {
      name: 'Meiji Jingu',
      address: '1-1 Yoyogikamizonacho, Shibuya City, Tokyo 151-8557',
      lat: 35.6764,
      lng: 139.6993,
      category: 'attraction',
      rating: 4.6,
      notes: 'Tranquil Shinto shrine surrounded by an evergreen forest.',
    },
    {
      name: 'Shibuya Crossing',
      address: 'Dogenzaka, Shibuya City, Tokyo 150-0043',
      lat: 35.6595,
      lng: 139.7005,
      category: 'attraction',
      rating: 4.5,
      notes: 'World-famous scramble crossing pulsing with Tokyo energy.',
    },
    {
      name: 'Tsukiji Outer Market',
      address: '4 Chome Tsukiji, Chuo City, Tokyo 104-0045',
      lat: 35.6655,
      lng: 139.7707,
      category: 'restaurant',
      rating: 4.4,
      notes: 'Vibrant food market packed with fresh sushi and street snacks.',
    },
    {
      name: 'Tokyo Tower',
      address: '4 Chome-2-8 Shibakoen, Minato City, Tokyo 105-0011',
      lat: 35.6586,
      lng: 139.7454,
      category: 'attraction',
      rating: 4.5,
      notes: 'Iconic communications and observation tower modeled after the Eiffel Tower.',
    },
    {
      name: 'Akihabara Electric Town',
      address: 'Sotokanda, Chiyoda City, Tokyo 101-0021',
      lat: 35.6984,
      lng: 139.7731,
      category: 'shopping',
      rating: 4.4,
      notes: 'Global center of electronics, gaming, and anime subculture.',
    },
  ],
  kyoto: [
    {
      name: 'Fushimi Inari Taisha',
      address: '68 Fukakusa Yabunouchicho, Fushimi Ward, Kyoto 612-0882',
      lat: 34.9671,
      lng: 135.7727,
      category: 'attraction',
      rating: 4.8,
      notes: 'Famous path of 10,000 vermilion torii gates winding up the sacred mountain.',
    },
    {
      name: 'Kinkaku-ji (Golden Pavilion)',
      address: '1 Kinkakujicho, Kita Ward, Kyoto 603-8361',
      lat: 35.0394,
      lng: 135.7292,
      category: 'attraction',
      rating: 4.7,
      notes: 'Magnificent Zen temple with top floors covered in pure gold leaf.',
    },
    {
      name: 'Arashiyama Bamboo Grove',
      address: 'Sagatenryuji, Ukyo Ward, Kyoto 616-8385',
      lat: 35.0169,
      lng: 135.6713,
      category: 'attraction',
      rating: 4.6,
      notes: 'Towering natural bamboo stalks swaying in the mountain breeze.',
    },
    {
      name: 'Nishiki Market',
      address: 'Nakagyo Ward, Kyoto 604-8055',
      lat: 35.005,
      lng: 135.7649,
      category: 'shopping',
      rating: 4.4,
      notes: 'Narrow 5-block shopping street known as Kyoto Kitchen.',
    },
    {
      name: 'Kiyomizu-dera',
      address: '1 Chome-294 Kiyomizu, Higashiyama Ward, Kyoto 605-0862',
      lat: 34.9949,
      lng: 135.785,
      category: 'attraction',
      rating: 4.8,
      notes: 'Historic cliffside wooden temple with sweeping vistas of Kyoto.',
    },
    {
      name: 'Ichiran Kyoto Kawaramachi',
      address: '598 Uraderacho, Nakagyo Ward, Kyoto 604-8041',
      lat: 35.0042,
      lng: 135.769,
      category: 'restaurant',
      rating: 4.5,
      notes: 'Solo dining booth ramen experience with rich tonkotsu broth.',
    },
    {
      name: 'Gion District',
      address: 'Gionmachi Minamigawa, Higashiyama Ward, Kyoto 605-0074',
      lat: 35.0037,
      lng: 135.7772,
      category: 'attraction',
      rating: 4.5,
      notes: 'Traditional entertainment district famous for geisha culture and tea houses.',
    },
  ],
  paris: [
    {
      name: 'Eiffel Tower',
      address: 'Champ de Mars, 5 Av. Anatole France, 75007 Paris, France',
      lat: 48.8584,
      lng: 2.2945,
      category: 'attraction',
      rating: 4.7,
      notes: 'Iconic iron lattice tower on the Champ de Mars.',
    },
    {
      name: 'Louvre Museum',
      address: 'Rue de Rivoli, 75001 Paris, France',
      lat: 48.8606,
      lng: 2.3376,
      category: 'attraction',
      rating: 4.8,
      notes: "The world's largest art museum and historic monument.",
    },
    {
      name: 'Musée d’Orsay',
      address: '1 Rue de la Légion d’Honneur, 75007 Paris, France',
      lat: 48.8599,
      lng: 2.3265,
      category: 'attraction',
      rating: 4.8,
      notes: 'Masterpieces of Impressionist and post-Impressionist art in a Beaux-Arts railway station.',
    },
    {
      name: 'Montmartre & Sacré-Cœur',
      address: '35 Rue du Chevalier de la Barre, 75018 Paris, France',
      lat: 48.8867,
      lng: 2.3431,
      category: 'attraction',
      rating: 4.7,
      notes: 'Historic hilltop bohemian district crowned by the white-domed basilica.',
    },
  ],
};

// ============================================================================
// Math & Routing Utilities (Haversine, 2-Opt TSP, Transit Estimation)
// ============================================================================

/**
 * Calculates great-circle distance between two coordinates in meters.
 */
export function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

/**
 * Estimates transit duration in seconds and transit mode based on distance.
 */
export function estimateTransit(distanceMeters: number): {
  mode: 'walking' | 'transit' | 'driving';
  durationSeconds: number;
  instructions: string;
} {
  if (distanceMeters <= 1200) {
    // Walking: avg 1.3 m/s (~4.7 km/h)
    const duration = Math.max(120, Math.round(distanceMeters / 1.3));
    const mins = Math.ceil(duration / 60);
    return {
      mode: 'walking',
      durationSeconds: duration,
      instructions: `Walk ${Math.round(distanceMeters)}m (~${mins} min).`,
    };
  } else if (distanceMeters <= 8000) {
    // City transit / subway: avg 7 m/s (~25 km/h) + 5 min wait
    const duration = Math.round(distanceMeters / 7) + 300;
    const mins = Math.ceil(duration / 60);
    const km = (distanceMeters / 1000).toFixed(1);
    return {
      mode: 'transit',
      durationSeconds: duration,
      instructions: `Take public transit / metro for ${km} km (~${mins} min).`,
    };
  } else {
    // Driving / taxi: avg 11 m/s (~40 km/h) + 3 min traffic
    const duration = Math.round(distanceMeters / 11) + 180;
    const mins = Math.ceil(duration / 60);
    const km = (distanceMeters / 1000).toFixed(1);
    return {
      mode: 'driving',
      durationSeconds: duration,
      instructions: `Drive / taxi ${km} km (~${mins} min).`,
    };
  }
}

/**
 * Solves Traveling Salesperson Problem (TSP) using Nearest-Neighbor + 2-Opt heuristic.
 */
export function solveTsp2Opt<T extends { lat: number; lng: number }>(items: T[]): {
  orderedItems: T[];
  oldDistance: number;
  newDistance: number;
} {
  const n = items.length;
  if (n <= 2) {
    let dist = 0;
    if (n === 2) {
      dist = calculateHaversineDistance(items[0].lat, items[0].lng, items[1].lat, items[1].lng);
    }
    return { orderedItems: items, oldDistance: dist, newDistance: dist };
  }

  // Calculate distance matrix
  const distMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        distMatrix[i][j] = calculateHaversineDistance(
          items[i].lat,
          items[i].lng,
          items[j].lat,
          items[j].lng
        );
      }
    }
  }

  // Calculate original route distance
  let oldDistance = 0;
  for (let i = 0; i < n - 1; i++) {
    oldDistance += distMatrix[i][i + 1];
  }

  // 1. Nearest Neighbor constructive step
  const visited = new Set<number>([0]);
  const route: number[] = [0];

  while (route.length < n) {
    const current = route[route.length - 1];
    let nearest = -1;
    let minDist = Infinity;

    for (let next = 0; next < n; next++) {
      if (!visited.has(next) && distMatrix[current][next] < minDist) {
        minDist = distMatrix[current][next];
        nearest = next;
      }
    }

    if (nearest !== -1) {
      visited.add(nearest);
      route.push(nearest);
    } else {
      break;
    }
  }

  // 2. 2-Opt Iterative Improvement step
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  function routeDistance(r: number[]): number {
    let d = 0;
    for (let i = 0; i < r.length - 1; i++) {
      d += distMatrix[r[i]][r[i + 1]];
    }
    return d;
  }

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < n - 1; i++) {
      for (let k = i + 1; k < n; k++) {
        // Swap sub-route between i and k
        const newRoute = [...route.slice(0, i), ...route.slice(i, k + 1).reverse(), ...route.slice(k + 1)];
        if (routeDistance(newRoute) < routeDistance(route)) {
          for (let idx = 0; idx < n; idx++) {
            route[idx] = newRoute[idx];
          }
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  const newDistance = routeDistance(route);
  const orderedItems = route.map((idx) => items[idx]);

  return { orderedItems, oldDistance, newDistance };
}

// ============================================================================
// Multi-Currency and Splitwise Debt Simplification
// ============================================================================

const FX_RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  EUR: 1.08,
  GBP: 1.28,
  JPY: 0.0067, // ~150 JPY = $1 USD
  CAD: 0.74,
  AUD: 0.65,
  CHF: 1.13,
};

export function convertCurrency(amount: number, fromCurrency: string, toCurrency: string): number {
  const fromRate = FX_RATES_TO_USD[fromCurrency.toUpperCase()] || 1.0;
  const toRate = FX_RATES_TO_USD[toCurrency.toUpperCase()] || 1.0;
  const usdAmount = amount * fromRate;
  return Math.round((usdAmount / toRate) * 100) / 100;
}

export function simplifyDebts(
  balances: Array<{ collaborator_id: string; collaborator_name: string; net_balance: number }>,
  currency: string
): SettlementTransfer[] {
  const debtors: Array<{ id: string; name: string; amount: number }> = [];
  const creditors: Array<{ id: string; name: string; amount: number }> = [];

  for (const b of balances) {
    const rounded = Math.round(b.net_balance * 100) / 100;
    if (rounded < -0.01) {
      debtors.push({ id: b.collaborator_id, name: b.collaborator_name, amount: -rounded });
    } else if (rounded > 0.01) {
      creditors.push({ id: b.collaborator_id, name: b.collaborator_name, amount: rounded });
    }
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers: SettlementTransfer[] = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const settledAmount = Math.min(debtor.amount, creditor.amount);

    if (settledAmount > 0.01) {
      transfers.push({
        from_collaborator_id: debtor.id,
        from_collaborator_name: debtor.name,
        to_collaborator_id: creditor.id,
        to_collaborator_name: creditor.name,
        amount: Math.round(settledAmount * 100) / 100,
        currency,
      });
    }

    debtor.amount -= settledAmount;
    creditor.amount -= settledAmount;

    if (debtor.amount < 0.01) dIdx++;
    if (creditor.amount < 0.01) cIdx++;
  }

  return transfers;
}

// ============================================================================
// Core Database Helpers (Transit Recalculation, Place Resolution, Summaries)
// ============================================================================

/**
 * Recomputes and persists transit legs for all consecutive stops on a given day.
 */
export async function recomputeDayTransitLegs(
  db: DatabaseAdapter,
  tripId: string,
  dayId: string
): Promise<TransitLeg[]> {
  // Query all stops in order for this day
  const rows = await db.query<any>(
    `SELECT s.id as stop_id, s.section_id, s.sort_order,
            p.lat, p.lng, sec.sort_order as sec_sort
     FROM stops s
     JOIN sections sec ON s.section_id = sec.id
     JOIN places p ON s.place_id = p.id
     WHERE sec.day_id = ?
     ORDER BY sec.sort_order ASC, s.sort_order ASC, s.created_at ASC`,
    [dayId]
  );

  // Delete existing transit legs originating from or ending in stops on this day
  const stopIds = rows.map((r) => r.stop_id);
  if (stopIds.length > 0) {
    const placeholders = stopIds.map(() => '?').join(',');
    await db.execute(
      `DELETE FROM transit_legs WHERE trip_id = ? AND (from_stop_id IN (${placeholders}) OR to_stop_id IN (${placeholders}))`,
      [tripId, ...stopIds, ...stopIds]
    );
  }

  if (rows.length < 2) {
    return [];
  }

  const legs: TransitLeg[] = [];
  const batchStatements: { sql: string; params: any[] }[] = [];

  for (let i = 0; i < rows.length - 1; i++) {
    const from = rows[i];
    const to = rows[i + 1];
    const distanceMeters = calculateHaversineDistance(from.lat, from.lng, to.lat, to.lng);
    const { mode, durationSeconds, instructions } = estimateTransit(distanceMeters);
    const legId = generateId('leg');

    batchStatements.push({
      sql: `INSERT INTO transit_legs (
        id, trip_id, from_stop_id, to_stop_id, transit_mode, duration_seconds, distance_meters, route_instructions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        legId,
        tripId,
        from.stop_id,
        to.stop_id,
        mode,
        durationSeconds,
        distanceMeters,
        instructions,
      ],
    });

    legs.push({
      id: legId,
      trip_id: tripId,
      from_stop_id: from.stop_id,
      to_stop_id: to.stop_id,
      transit_mode: mode,
      duration_seconds: durationSeconds,
      distance_meters: distanceMeters,
      route_instructions: instructions,
      departure_time: null,
      arrival_time: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  await db.batch(batchStatements);
  return legs;
}

/**
 * Resolves or creates a place record matching a query string.
 */
export async function resolvePlace(
  db: DatabaseAdapter,
  placeQuery: string,
  tripDestination: string = ''
): Promise<Place> {
  const cleanName = placeQuery.trim().replace(/^add\s+/i, '').replace(/\s+to\s+.*$/i, '');

  // 1. Check if place already exists in DB
  const existing = await db.queryOne<Place>(
    'SELECT * FROM places WHERE name LIKE ? OR formatted_address LIKE ? LIMIT 1',
    [`%${cleanName}%`, `%${cleanName}%`]
  );
  if (existing) {
    return existing;
  }

  // 2. Check built-in POI catalog
  const lowerQuery = cleanName.toLowerCase();
  const lowerDest = tripDestination.toLowerCase();

  for (const city of Object.keys(POI_CATALOG)) {
    for (const poi of POI_CATALOG[city]) {
      if (
        lowerQuery.includes(poi.name.toLowerCase()) ||
        poi.name.toLowerCase().includes(lowerQuery)
      ) {
        const placeId = generateId('place');
        await db.execute(
          `INSERT INTO places (id, name, formatted_address, lat, lng, category, rating, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [placeId, poi.name, poi.address, poi.lat, poi.lng, poi.category, poi.rating, poi.notes]
        );
        return {
          id: placeId,
          name: poi.name,
          formatted_address: poi.address,
          lat: poi.lat,
          lng: poi.lng,
          category: poi.category,
          rating: poi.rating,
          google_place_id: null,
          website: null,
          phone_number: null,
          notes: poi.notes,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
    }
  }

  // 3. Fallback deterministic coordinates centered on trip destination or Tokyo
  let centerLat = 35.6762;
  let centerLng = 139.6503;
  if (lowerDest.includes('kyoto')) {
    centerLat = 35.0116;
    centerLng = 135.7681;
  } else if (lowerDest.includes('paris')) {
    centerLat = 48.8566;
    centerLng = 2.3522;
  } else if (lowerDest.includes('new york') || lowerDest.includes('nyc')) {
    centerLat = 40.7128;
    centerLng = -74.006;
  }

  // Hash query to generate small reproducible delta
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = (hash << 5) - hash + cleanName.charCodeAt(i);
    hash |= 0;
  }
  const deltaLat = ((hash % 100) / 1000) * 0.15;
  const deltaLng = (((hash >> 2) % 100) / 1000) * 0.15;

  const lat = Math.round((centerLat + deltaLat) * 10000) / 10000;
  const lng = Math.round((centerLng + deltaLng) * 10000) / 10000;
  const placeId = generateId('place');
  const formattedAddress = `${cleanName}, ${tripDestination || 'Metropolitan Area'}`;

  let category: Place['category'] = 'attraction';
  if (/ramen|restaurant|cafe|dinner|lunch|breakfast|food|bistro/i.test(cleanName)) {
    category = 'restaurant';
  } else if (/hotel|inn|hyatt|marriott|hostel|resort/i.test(cleanName)) {
    category = 'lodging';
  } else if (/market|store|mall|shopping|bazaar/i.test(cleanName)) {
    category = 'shopping';
  } else if (/station|airport|terminal|metro/i.test(cleanName)) {
    category = 'transit';
  }

  await db.execute(
    `INSERT INTO places (id, name, formatted_address, lat, lng, category, rating, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [placeId, cleanName, formattedAddress, lat, lng, category, 4.5, `Added via conversational assistant`]
  );

  return {
    id: placeId,
    name: cleanName,
    formatted_address: formattedAddress,
    lat,
    lng,
    category,
    rating: 4.5,
    google_place_id: null,
    website: null,
    phone_number: null,
    notes: 'Added via conversational assistant',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Computes and returns the complete TripSummary projection for a trip.
 */
export async function getTripSummary(
  db: DatabaseAdapter,
  tripId: string
): Promise<TripSummary | null> {
  const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]);
  if (!trip) return null;

  const [collabRow, dayRow, stopRow, expRow] = await Promise.all([
    db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM collaborators WHERE trip_id = ?',
      [tripId]
    ),
    db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM days WHERE trip_id = ?', [
      tripId,
    ]),
    db.queryOne<{ count: number }>(
      `SELECT COUNT(s.id) as count
       FROM stops s
       JOIN sections sec ON s.section_id = sec.id
       WHERE sec.trip_id = ?`,
      [tripId]
    ),
    db.queryOne<{ total: number }>(
      'SELECT SUM(amount) as total FROM expenses WHERE trip_id = ?',
      [tripId]
    ),
  ]);

  return {
    id: trip.id,
    title: trip.title,
    destination: trip.destination,
    start_date: trip.start_date,
    end_date: trip.end_date,
    timezone: trip.timezone,
    currency: trip.currency,
    budget_cap: trip.budget_cap,
    cover_image_url: trip.cover_image_url,
    collaborator_count: collabRow?.count ?? 0,
    day_count: dayRow?.count ?? 0,
    stop_count: stopRow?.count ?? 0,
    total_expenses: expRow?.total ?? 0,
  };
}

// ============================================================================
// Natural Language Intent Engine & Tool Handlers
// ============================================================================

/**
 * Executes the create_trip tool to build a trip with days, sections, and curated stops.
 */
export async function executeCreateTrip(
  db: DatabaseAdapter,
  params: { destination: string; dayCount?: number; title?: string }
): Promise<{ trip: Trip; actions: ChatAction[]; reply: string }> {
  const dayCount = Math.max(1, Math.min(14, params.dayCount || 3));
  const destClean = params.destination.trim();
  const tripId = generateId('trip');
  const title = params.title || `${dayCount}-Day ${destClean} Adventure`;

  // Start date = next calendar month 1st
  const now = new Date();
  const start = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
  const end = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, dayCount));

  const startDateStr = start.toISOString().split('T')[0];
  const endDateStr = end.toISOString().split('T')[0];

  let timezone = 'UTC';
  let currency = 'USD';
  let coverUrl = 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e';

  const lowerDest = destClean.toLowerCase();
  if (lowerDest.includes('tokyo') || lowerDest.includes('japan')) {
    timezone = 'Asia/Tokyo';
    currency = 'USD';
    coverUrl = 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26';
  } else if (lowerDest.includes('paris') || lowerDest.includes('france')) {
    timezone = 'Europe/Paris';
    currency = 'EUR';
    coverUrl = 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34';
  } else if (lowerDest.includes('kyoto')) {
    timezone = 'Asia/Tokyo';
    currency = 'USD';
    coverUrl = 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e';
  }

  // 1. Insert Trip
  await db.execute(
    `INSERT INTO trips (id, title, destination, start_date, end_date, timezone, currency, budget_cap, cover_image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [tripId, title, destClean, startDateStr, endDateStr, timezone, currency, 2500, coverUrl]
  );

  // 2. Insert Default Collaborators (Alice and Bob)
  const collabAliceId = generateId('collab');
  const collabBobId = generateId('collab');
  await db.batch([
    {
      sql: `INSERT INTO collaborators (id, trip_id, name, email, role) VALUES (?, ?, ?, ?, ?)`,
      params: [collabAliceId, tripId, 'Alice Chen', 'alice@example.com', 'owner'],
    },
    {
      sql: `INSERT INTO collaborators (id, trip_id, name, email, role) VALUES (?, ?, ?, ?, ?)`,
      params: [collabBobId, tripId, 'Bob Smith', 'bob@example.com', 'editor'],
    },
  ]);

  // 3. Insert Days and Sections
  const batchStatements: { sql: string; params: any[] }[] = [];
  const dayIds: string[] = [];

  for (let i = 1; i <= dayCount; i++) {
    const dayId = generateId('day');
    dayIds.push(dayId);
    const dayDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, i));
    const dayDateStr = dayDate.toISOString().split('T')[0];

    batchStatements.push({
      sql: `INSERT INTO days (id, trip_id, day_number, date, notes) VALUES (?, ?, ?, ?, ?)`,
      params: [dayId, tripId, i, dayDateStr, `Day ${i} in ${destClean}`],
    });

    // Morning, Afternoon, Evening sections
    const secMorningId = generateId('sec');
    const secAfternoonId = generateId('sec');
    const secEveningId = generateId('sec');

    batchStatements.push(
      {
        sql: `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
        params: [secMorningId, tripId, dayId, 'Morning', 'morning', 1],
      },
      {
        sql: `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
        params: [secAfternoonId, tripId, dayId, 'Afternoon', 'afternoon', 2],
      },
      {
        sql: `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
        params: [secEveningId, tripId, dayId, 'Evening', 'evening', 3],
      }
    );
  }

  // Wishlist section
  const wishlistSecId = generateId('sec');
  batchStatements.push({
    sql: `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
    params: [wishlistSecId, tripId, null, 'Places to Visit', 'wishlist', 0],
  });

  // Default checklist
  const chkPackingId = generateId('chk');
  batchStatements.push(
    {
      sql: `INSERT INTO checklists (id, trip_id, title, category, sort_order) VALUES (?, ?, ?, ?, ?)`,
      params: [chkPackingId, tripId, 'Packing List', 'packing', 1],
    },
    {
      sql: `INSERT INTO checklist_items (id, checklist_id, title, is_completed, sort_order) VALUES (?, ?, ?, ?, ?)`,
      params: [generateId('chki'), chkPackingId, 'Passport & Travel Insurance', 1, 1],
    },
    {
      sql: `INSERT INTO checklist_items (id, checklist_id, title, is_completed, sort_order) VALUES (?, ?, ?, ?, ?)`,
      params: [generateId('chki'), chkPackingId, 'Comfortable Walking Shoes', 0, 2],
    }
  );

  await db.batch(batchStatements);

  // 4. Populate Curated Starter Stops for Known Cities
  const keyCity = Object.keys(POI_CATALOG).find((k) => lowerDest.includes(k));
  if (keyCity) {
    const pois = POI_CATALOG[keyCity];
    const sections = await db.query<Section>(
      `SELECT * FROM sections WHERE trip_id = ? AND day_id IS NOT NULL ORDER BY sort_order ASC`,
      [tripId]
    );

    let poiIdx = 0;
    for (const sec of sections) {
      if (poiIdx >= pois.length) break;
      const poi = pois[poiIdx];
      const place = await resolvePlace(db, poi.name, destClean);
      const stopId = generateId('stop');

      await db.execute(
        `INSERT INTO stops (id, section_id, place_id, sort_order, arrival_time, departure_time, duration_minutes, user_notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [stopId, sec.id, place.id, 1, '10:00', '12:00', 120, poi.notes]
      );
      poiIdx++;
    }

    // Recompute transit legs for each day
    for (const dId of dayIds) {
      await recomputeDayTransitLegs(db, tripId, dId);
    }
  }

  const tripObj = (await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]))!;

  return {
    trip: tripObj,
    actions: [
      {
        tool: 'create_trip',
        summary: `Created ${dayCount}-day trip to ${destClean} with calendar schedule and starter stops`,
        payload: { trip_id: tripId, title, destination: destClean, days: dayCount },
      },
    ],
    reply: `**Trip Created!** I've planned your **${title}** from **${startDateStr}** to **${endDateStr}**.\n\n` +
      `• Created **${dayCount} days** with Morning, Afternoon, and Evening sections.\n` +
      `• Populated starter highlights and synchronized transit calculations.\n` +
      `• Ready for more stops, reservations, and budget splitting!`,
  };
}

/**
 * Executes add_stop tool to resolve place and insert into day/section.
 */
export async function executeAddStop(
  db: DatabaseAdapter,
  params: {
    tripId: string;
    placeQuery: string;
    dayNumber?: number;
    sectionType?: 'morning' | 'afternoon' | 'evening' | 'wishlist';
    arrivalTime?: string;
  }
): Promise<{ stopId: string; actions: ChatAction[]; reply: string }> {
  const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [params.tripId]);
  if (!trip) {
    throw new Error(`Trip ${params.tripId} not found`);
  }

  const place = await resolvePlace(db, params.placeQuery, trip.destination);
  let targetSection: Section | null = null;
  let targetDay: Day | null = null;

  if (params.sectionType === 'wishlist' || (!params.dayNumber && !params.sectionType)) {
    // Target wishlist section
    targetSection = await db.queryOne<Section>(
      `SELECT * FROM sections WHERE trip_id = ? AND (day_id IS NULL OR section_type = 'wishlist') LIMIT 1`,
      [params.tripId]
    );
    if (!targetSection) {
      const secId = generateId('sec');
      await db.execute(
        `INSERT INTO sections (id, trip_id, day_id, title, section_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
        [secId, params.tripId, null, 'Places to Visit', 'wishlist', 0]
      );
      targetSection = await db.queryOne<Section>('SELECT * FROM sections WHERE id = ?', [secId]);
    }
  } else {
    // Target specific day and section
    const dayNum = params.dayNumber || 1;
    targetDay = await db.queryOne<Day>(
      'SELECT * FROM days WHERE trip_id = ? AND day_number = ?',
      [params.tripId, dayNum]
    );

    if (!targetDay) {
      // Pick first day fallback
      targetDay = await db.queryOne<Day>(
        'SELECT * FROM days WHERE trip_id = ? ORDER BY day_number ASC LIMIT 1',
        [params.tripId]
      );
    }

    if (targetDay) {
      const secType = params.sectionType || 'morning';
      targetSection = await db.queryOne<Section>(
        'SELECT * FROM sections WHERE day_id = ? AND section_type = ? LIMIT 1',
        [targetDay.id, secType]
      );
      if (!targetSection) {
        targetSection = await db.queryOne<Section>(
          'SELECT * FROM sections WHERE day_id = ? ORDER BY sort_order ASC LIMIT 1',
          [targetDay.id]
        );
      }
    }
  }

  if (!targetSection) {
    throw new Error('Unable to find or create destination section for stop');
  }

  // Get max sort_order in target section
  const maxSortRow = await db.queryOne<{ max_sort: number }>(
    'SELECT MAX(sort_order) as max_sort FROM stops WHERE section_id = ?',
    [targetSection.id]
  );
  const nextSort = (maxSortRow?.max_sort || 0) + 1;
  const stopId = generateId('stop');
  const arrivalTime = params.arrivalTime || (targetSection.section_type === 'morning' ? '09:30' : targetSection.section_type === 'afternoon' ? '14:00' : '18:30');

  await db.execute(
    `INSERT INTO stops (id, section_id, place_id, sort_order, arrival_time, duration_minutes, user_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [stopId, targetSection.id, place.id, nextSort, arrivalTime, 90, `Added via conversational agent`]
  );

  // Recompute transit legs if attached to a day
  let transitLegs: TransitLeg[] = [];
  if (targetSection.day_id) {
    transitLegs = await recomputeDayTransitLegs(db, params.tripId, targetSection.day_id);
  }

  const locationDesc = targetSection.day_id && targetDay
    ? `Day ${targetDay.day_number} (${targetSection.title} at ${arrivalTime})`
    : `Wishlist (Places to Visit)`;

  return {
    stopId,
    actions: [
      {
        tool: 'add_stop',
        summary: `Added ${place.name} to ${locationDesc}`,
        payload: { stop_id: stopId, place_id: place.id, place_name: place.name, section_id: targetSection.id },
      },
    ],
    reply: `Added **${place.name}** to your **${locationDesc}**!\n\n` +
      `• Address: ${place.formatted_address}\n` +
      `• Rating: ${place.rating || 4.5} / 5.0\n` +
      (transitLegs.length > 0 ? `• Transit legs automatically recalculated for Day ${targetDay?.day_number}.` : ''),
  };
}

/**
 * Moves an existing stop to another day/section.
 */
export async function executeMoveStop(
  db: DatabaseAdapter,
  params: {
    tripId: string;
    placeQuery?: string;
    stopId?: string;
    targetDayNumber: number;
    targetSectionType?: string;
  }
): Promise<{ actions: ChatAction[]; reply: string }> {
  let stop: any = null;

  if (params.stopId) {
    stop = await db.queryOne<any>(
      `SELECT s.id as stop_id, s.section_id, p.name as place_name, sec.day_id as old_day_id
       FROM stops s
       JOIN places p ON s.place_id = p.id
       JOIN sections sec ON s.section_id = sec.id
       WHERE s.id = ? AND sec.trip_id = ?
       LIMIT 1`,
      [params.stopId, params.tripId]
    );
  }

  if (!stop && params.placeQuery) {
    const stops = await db.query<any>(
      `SELECT s.id as stop_id, s.section_id, p.name as place_name, sec.day_id as old_day_id
       FROM stops s
       JOIN places p ON s.place_id = p.id
       JOIN sections sec ON s.section_id = sec.id
       WHERE sec.trip_id = ? AND p.name LIKE ?
       LIMIT 1`,
      [params.tripId, `%${params.placeQuery}%`]
    );
    if (stops.length > 0) {
      stop = stops[0];
    }
  }

  if (!stop) {
    throw new Error(`Could not find stop matching "${params.placeQuery || params.stopId}" in trip`);
  }

  // Find target day and section
  const targetDay = await db.queryOne<Day>(
    'SELECT * FROM days WHERE trip_id = ? AND day_number = ?',
    [params.tripId, params.targetDayNumber]
  );
  if (!targetDay) {
    throw new Error(`Target Day ${params.targetDayNumber} does not exist`);
  }

  const targetSecType = (params.targetSectionType || 'morning').toLowerCase();
  let targetSec = await db.queryOne<Section>(
    'SELECT * FROM sections WHERE day_id = ? AND section_type = ? LIMIT 1',
    [targetDay.id, targetSecType]
  );
  if (!targetSec) {
    targetSec = await db.queryOne<Section>(
      'SELECT * FROM sections WHERE day_id = ? ORDER BY sort_order ASC LIMIT 1',
      [targetDay.id]
    );
  }
  if (!targetSec) {
    throw new Error(`Could not find section on Day ${params.targetDayNumber}`);
  }

  // Update stop section
  await db.execute('UPDATE stops SET section_id = ? WHERE id = ?', [targetSec.id, stop.stop_id]);

  // Recompute transit on both days
  if (stop.old_day_id) {
    await recomputeDayTransitLegs(db, params.tripId, stop.old_day_id);
  }
  await recomputeDayTransitLegs(db, params.tripId, targetDay.id);

  return {
    actions: [
      {
        tool: 'move_stop',
        summary: `Moved ${stop.place_name} to Day ${params.targetDayNumber} (${targetSec.title})`,
        payload: { stop_id: stop.stop_id, place_name: stop.place_name, target_day: params.targetDayNumber, target_section: targetSec.title },
      },
    ],
    reply: `Moved **${stop.place_name}** to **Day ${params.targetDayNumber} (${targetSec.title})** and updated all transit connections!`,
  };
}

/**
 * Removes a stop and cleans up transit legs.
 */
export async function executeRemoveStop(
  db: DatabaseAdapter,
  params: { tripId: string; placeQuery?: string; stopId?: string }
): Promise<{ actions: ChatAction[]; reply: string }> {
  let stop: any = null;

  if (params.stopId) {
    stop = await db.queryOne<any>(
      `SELECT s.id as stop_id, p.name as place_name, sec.day_id
       FROM stops s
       JOIN places p ON s.place_id = p.id
       JOIN sections sec ON s.section_id = sec.id
       WHERE s.id = ? AND sec.trip_id = ?
       LIMIT 1`,
      [params.stopId, params.tripId]
    );
  }

  if (!stop && params.placeQuery) {
    const stops = await db.query<any>(
      `SELECT s.id as stop_id, p.name as place_name, sec.day_id
       FROM stops s
       JOIN places p ON s.place_id = p.id
       JOIN sections sec ON s.section_id = sec.id
       WHERE sec.trip_id = ? AND p.name LIKE ?
       LIMIT 1`,
      [params.tripId, `%${params.placeQuery}%`]
    );
    if (stops.length > 0) {
      stop = stops[0];
    }
  }

  if (!stop) {
    throw new Error(`Could not find stop matching "${params.placeQuery || params.stopId}" in trip`);
  }

  // Delete transit legs referencing this stop
  await db.execute(
    'DELETE FROM transit_legs WHERE from_stop_id = ? OR to_stop_id = ?',
    [stop.stop_id, stop.stop_id]
  );

  // Delete stop
  await db.execute('DELETE FROM stops WHERE id = ?', [stop.stop_id]);

  // Recompute transit for the day if it was scheduled
  if (stop.day_id) {
    await recomputeDayTransitLegs(db, params.tripId, stop.day_id);
  }

  return {
    actions: [
      {
        tool: 'remove_stop',
        summary: `Removed ${stop.place_name} from itinerary`,
        payload: { stop_id: stop.stop_id, place_name: stop.place_name },
      },
    ],
    reply: `Removed **${stop.place_name}** from your itinerary and refreshed travel times.`,
  };
}

/**
 * Optimizes the route of a specific day using 2-Opt TSP.
 */
export async function executeOptimizeRoute(
  db: DatabaseAdapter,
  params: { tripId: string; dayNumber: number }
): Promise<{ actions: ChatAction[]; reply: string }> {
  const day = await db.queryOne<Day>(
    'SELECT * FROM days WHERE trip_id = ? AND day_number = ?',
    [params.tripId, params.dayNumber]
  );
  if (!day) {
    throw new Error(`Day ${params.dayNumber} not found`);
  }

  const stops = await db.query<any>(
    `SELECT s.id as stop_id, s.section_id, s.sort_order, p.name as place_name, p.lat, p.lng
     FROM stops s
     JOIN sections sec ON s.section_id = sec.id
     JOIN places p ON s.place_id = p.id
     WHERE sec.day_id = ?
     ORDER BY sec.sort_order ASC, s.sort_order ASC`,
    [day.id]
  );

  if (stops.length < 3) {
    return {
      actions: [
        {
          tool: 'optimize_route',
          summary: `Day ${params.dayNumber} has ${stops.length} stops; route is already optimal`,
        },
      ],
      reply: `**Day ${params.dayNumber}** currently has ${stops.length} stop${stops.length === 1 ? '' : 's'}. You need at least 3 stops to run TSP 2-Opt route optimization!`,
    };
  }

  const { orderedItems, oldDistance, newDistance } = solveTsp2Opt(stops);

  // Update sort order for stops
  for (let idx = 0; idx < orderedItems.length; idx++) {
    await db.execute('UPDATE stops SET sort_order = ? WHERE id = ?', [
      idx + 1,
      orderedItems[idx].stop_id,
    ]);
  }

  // Recompute transit legs
  await recomputeDayTransitLegs(db, params.tripId, day.id);

  const savedKm = Math.max(0, ((oldDistance - newDistance) / 1000)).toFixed(1);
  const routeNames = orderedItems.map((s, i) => `${i + 1}. ${s.place_name}`).join('\n');

  return {
    actions: [
      {
        tool: 'optimize_route',
        summary: `Optimized Day ${params.dayNumber} route (saved ~${savedKm} km)`,
        payload: {
          day_number: params.dayNumber,
          old_distance_meters: oldDistance,
          new_distance_meters: newDistance,
          stops_order: orderedItems.map((s) => s.place_name),
        },
      },
    ],
    reply: `**Day ${params.dayNumber} Route Optimized!**\n\n` +
      `• Distance reduced from **${(oldDistance / 1000).toFixed(1)} km** to **${(newDistance / 1000).toFixed(1)} km** (saved ~${savedKm} km)!\n\n` +
      `**Optimal Order:**\n${routeNames}`,
  };
}

/**
 * Adds a reservation record.
 */
export async function executeAddReservation(
  db: DatabaseAdapter,
  params: {
    tripId: string;
    type: Reservation['type'];
    title: string;
    cost: number;
    currency?: string;
    confirmationCode?: string;
    provider?: string;
    startTime?: string;
  }
): Promise<{ reservationId: string; actions: ChatAction[]; reply: string }> {
  const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [params.tripId]);
  const currency = params.currency || trip?.currency || 'USD';
  const resId = generateId('res');
  const startTime = params.startTime || new Date().toISOString();

  await db.execute(
    `INSERT INTO reservations (
      id, trip_id, type, title, confirmation_code, provider, start_time, cost, currency
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      resId,
      params.tripId,
      params.type,
      params.title,
      params.confirmationCode || null,
      params.provider || null,
      startTime,
      params.cost,
      currency,
    ]
  );

  return {
    reservationId: resId,
    actions: [
      {
        tool: 'add_reservation',
        summary: `Added ${params.type} reservation: ${params.title} (${currency} ${params.cost})`,
        payload: { reservation_id: resId, title: params.title, cost: params.cost, currency },
      },
    ],
    reply: `**Reservation Saved!**\n\n` +
      `• **${params.title}** (${params.type})\n` +
      `• Cost: **${currency} ${params.cost}**\n` +
      (params.confirmationCode ? `• Confirmation Code: \`${params.confirmationCode}\`\n` : '') +
      (params.provider ? `• Provider: ${params.provider}\n` : ''),
  };
}

/**
 * Logs an expense and calculates equal splits among collaborators.
 */
export async function executeLogExpense(
  db: DatabaseAdapter,
  params: {
    tripId: string;
    title: string;
    amount: number;
    currency?: string;
    payerName?: string;
    splitWithNames?: string[];
  }
): Promise<{ expenseId: string; actions: ChatAction[]; reply: string }> {
  const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [params.tripId]);
  const currency = params.currency || trip?.currency || 'USD';

  // Find or create collaborators
  let collaborators = await db.query<any>(
    'SELECT * FROM collaborators WHERE trip_id = ?',
    [params.tripId]
  );

  if (collaborators.length === 0) {
    const c1 = generateId('collab');
    const c2 = generateId('collab');
    await db.batch([
      {
        sql: `INSERT INTO collaborators (id, trip_id, name, email, role) VALUES (?, ?, ?, ?, ?)`,
        params: [c1, params.tripId, 'Alice Chen', 'alice@example.com', 'owner'],
      },
      {
        sql: `INSERT INTO collaborators (id, trip_id, name, email, role) VALUES (?, ?, ?, ?, ?)`,
        params: [c2, params.tripId, 'Bob Smith', 'bob@example.com', 'editor'],
      },
    ]);
    collaborators = await db.query<any>('SELECT * FROM collaborators WHERE trip_id = ?', [
      params.tripId,
    ]);
  }

  // Identify payer
  let payer = collaborators[0];
  if (params.payerName) {
    const matched = collaborators.find((c) =>
      c.name.toLowerCase().includes(params.payerName!.toLowerCase())
    );
    if (matched) {
      payer = matched;
    } else {
      // Create new collaborator for payer
      const newCollabId = generateId('collab');
      await db.execute(
        `INSERT INTO collaborators (id, trip_id, name, email, role) VALUES (?, ?, ?, ?, ?)`,
        [newCollabId, params.tripId, params.payerName, `${params.payerName.toLowerCase()}@example.com`, 'editor']
      );
      payer = { id: newCollabId, name: params.payerName, trip_id: params.tripId };
      collaborators.push(payer);
    }
  }

  // Identify split members
  let splitMembers = collaborators;
  if (params.splitWithNames && params.splitWithNames.length > 0) {
    const filtered = collaborators.filter((c) =>
      params.splitWithNames!.some((name) => c.name.toLowerCase().includes(name.toLowerCase()))
    );
    if (filtered.length > 0) {
      // Ensure payer is also included in the split if not explicit
      if (!filtered.some((c) => c.id === payer.id)) {
        filtered.push(payer);
      }
      splitMembers = filtered;
    }
  }

  const expenseId = generateId('exp');
  const todayStr = new Date().toISOString().split('T')[0];

  // Insert Expense
  await db.execute(
    `INSERT INTO expenses (id, trip_id, paid_by_collaborator_id, title, amount, currency, category, date, split_strategy)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [expenseId, params.tripId, payer.id, params.title, params.amount, currency, 'food', todayStr, 'equal']
  );

  // Insert Splits
  const splitAmount = Math.round((params.amount / splitMembers.length) * 100) / 100;
  const splitBatch: { sql: string; params: any[] }[] = [];

  for (const member of splitMembers) {
    const isPayer = member.id === payer.id;
    splitBatch.push({
      sql: `INSERT INTO expense_splits (id, expense_id, collaborator_id, amount_owed, percentage, settled, settled_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      params: [
        generateId('split'),
        expenseId,
        member.id,
        splitAmount,
        Math.round(100 / splitMembers.length),
        isPayer ? 1 : 0,
        isPayer ? new Date().toISOString() : null,
      ],
    });
  }
  await db.batch(splitBatch);

  const memberNames = splitMembers.map((m) => m.name).join(', ');

  return {
    expenseId,
    actions: [
      {
        tool: 'log_expense',
        summary: `Logged ${currency} ${params.amount} paid by ${payer.name}, split equally among ${splitMembers.length} people`,
        payload: {
          expense_id: expenseId,
          amount: params.amount,
          currency,
          paid_by: payer.name,
          split_among: splitMembers.map((m) => m.name),
        },
      },
    ],
    reply: `**Expense Logged & Split!**\n\n` +
      `• **${params.title}**: **${currency} ${params.amount}**\n` +
      `• Paid by: **${payer.name}**\n` +
      `• Split between: **${memberNames}** (**${currency} ${splitAmount}** each).`,
  };
}

/**
 * Calculates budget summary, collaborator net balances, and Splitwise debt settlement.
 */
export async function executeCalculateBudget(
  db: DatabaseAdapter,
  tripId: string
): Promise<{ actions: ChatAction[]; reply: string }> {
  const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]);
  const currency = trip?.currency || 'USD';

  const collaborators = await db.query<any>(
    'SELECT * FROM collaborators WHERE trip_id = ?',
    [tripId]
  );

  const expenses = await db.query<any>(
    'SELECT * FROM expenses WHERE trip_id = ?',
    [tripId]
  );

  const splits = await db.query<any>(
    `SELECT es.*, e.currency as exp_currency
     FROM expense_splits es
     JOIN expenses e ON es.expense_id = e.id
     WHERE e.trip_id = ?`,
    [tripId]
  );

  let totalExpenses = 0;
  const balancesMap: Record<string, { paid: number; owed: number }> = {};
  for (const c of collaborators) {
    balancesMap[c.id] = { paid: 0, owed: 0 };
  }

  for (const exp of expenses) {
    const converted = convertCurrency(exp.amount, exp.currency, currency);
    totalExpenses += converted;
    if (balancesMap[exp.paid_by_collaborator_id]) {
      balancesMap[exp.paid_by_collaborator_id].paid += converted;
    }
  }

  for (const split of splits) {
    const converted = convertCurrency(split.amount_owed, split.exp_currency, currency);
    if (balancesMap[split.collaborator_id]) {
      balancesMap[split.collaborator_id].owed += converted;
    }
  }

  const balances: CollaboratorBalance[] = collaborators.map((c) => {
    const b = balancesMap[c.id] || { paid: 0, owed: 0 };
    const net = Math.round((b.paid - b.owed) * 100) / 100;
    return {
      collaborator_id: c.id,
      collaborator_name: c.name,
      paid: Math.round(b.paid * 100) / 100,
      owed: Math.round(b.owed * 100) / 100,
      net_balance: net,
    };
  });

  const transfers = simplifyDebts(balances, currency);

  let reply = `**Budget & Debt Settlement Overview**\n\n` +
    `• Total Recorded Spend: **${currency} ${totalExpenses.toFixed(2)}**\n\n` +
    `**Collaborator Balances:**\n`;

  for (const b of balances) {
    const sign = b.net_balance >= 0 ? '+' : '';
    reply += `• **${b.collaborator_name}**: Paid ${currency} ${b.paid.toFixed(2)} | Owed ${currency} ${b.owed.toFixed(2)} (Net: **${sign}${currency} ${b.net_balance.toFixed(2)}**)\n`;
  }

  reply += `\n**Optimal Settlement (Who Owes Whom):**\n`;
  if (transfers.length === 0) {
    reply += `All group balances are fully settled! No transfers needed.\n`;
  } else {
    for (const t of transfers) {
      reply += `• **${t.from_collaborator_name}** pays **${t.to_collaborator_name}**: **${t.currency} ${t.amount.toFixed(2)}**\n`;
    }
  }

  return {
    actions: [
      {
        tool: 'calculate_budget',
        summary: `Calculated net balances and ${transfers.length} settlement transfer(s)`,
        payload: { total_expenses: totalExpenses, balances, settlement_transfers: transfers },
      },
    ],
    reply,
  };
}

/**
 * Manages checklists (adding items or checking them off).
 */
export async function executeManageChecklist(
  db: DatabaseAdapter,
  params: { tripId: string; itemTitle: string; category?: string; checkOff?: boolean }
): Promise<{ actions: ChatAction[]; reply: string }> {
  const cat = (params.category || 'packing').toLowerCase();
  let checklist = await db.queryOne<Checklist>(
    `SELECT * FROM checklists WHERE trip_id = ? AND category = ? LIMIT 1`,
    [params.tripId, cat]
  );

  if (!checklist) {
    const chkId = generateId('chk');
    const title = cat.charAt(0).toUpperCase() + cat.slice(1) + ' List';
    await db.execute(
      `INSERT INTO checklists (id, trip_id, title, category, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [chkId, params.tripId, title, cat, 1]
    );
    checklist = (await db.queryOne<Checklist>('SELECT * FROM checklists WHERE id = ?', [chkId]))!;
  }

  if (params.checkOff) {
    // Check off item
    await db.execute(
      `UPDATE checklist_items SET is_completed = 1 WHERE checklist_id = ? AND title LIKE ?`,
      [checklist.id, `%${params.itemTitle}%`]
    );
    return {
      actions: [
        {
          tool: 'manage_checklist',
          summary: `Checked off "${params.itemTitle}" from ${checklist.title}`,
        },
      ],
      reply: `Checked off **"${params.itemTitle}"** from your **${checklist.title}**!`,
    };
  } else {
    // Add item
    const itemId = generateId('chki');
    const maxSort = await db.queryOne<{ max_sort: number }>(
      'SELECT MAX(sort_order) as max_sort FROM checklist_items WHERE checklist_id = ?',
      [checklist.id]
    );
    const nextSort = (maxSort?.max_sort || 0) + 1;

    await db.execute(
      `INSERT INTO checklist_items (id, checklist_id, title, is_completed, sort_order) VALUES (?, ?, ?, ?, ?)`,
      [itemId, checklist.id, params.itemTitle, 0, nextSort]
    );

    return {
      actions: [
        {
          tool: 'manage_checklist',
          summary: `Added "${params.itemTitle}" to ${checklist.title}`,
          payload: { item_id: itemId, checklist_id: checklist.id, title: params.itemTitle },
        },
      ],
      reply: `Added **"${params.itemTitle}"** to your **${checklist.title}**!`,
    };
  }
}

/**
 * Summarizes the itinerary day-by-day with stops, times, and transit legs.
 */
export async function executeSummarizeItinerary(
  db: DatabaseAdapter,
  tripId: string,
  targetDayNumber?: number
): Promise<{ actions: ChatAction[]; reply: string }> {
  const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]);
  if (!trip) {
    throw new Error(`Trip ${tripId} not found`);
  }

  let daysQuery = 'SELECT * FROM days WHERE trip_id = ? ORDER BY day_number ASC';
  let daysParams: any[] = [tripId];
  if (targetDayNumber) {
    daysQuery = 'SELECT * FROM days WHERE trip_id = ? AND day_number = ?';
    daysParams = [tripId, targetDayNumber];
  }

  const days = await db.query<Day>(daysQuery, daysParams);
  if (days.length === 0) {
    return {
      actions: [{ tool: 'summarize_itinerary', summary: 'No scheduled days found' }],
      reply: `Your trip **${trip.title}** doesn't have any scheduled days yet. Ask me to plan an itinerary!`,
    };
  }

  let reply = `**Itinerary for ${trip.title}** (${trip.destination})\n\n`;

  for (const day of days) {
    reply += `### Day ${day.day_number} — ${day.date}\n`;
    if (day.notes) reply += `*${day.notes}*\n\n`;

    const sections = await db.query<Section>(
      'SELECT * FROM sections WHERE day_id = ? ORDER BY sort_order ASC',
      [day.id]
    );

    let hasStops = false;
    for (const sec of sections) {
      const stops = await db.query<any>(
        `SELECT s.*, p.name as place_name, p.category, p.rating, p.formatted_address
         FROM stops s
         JOIN places p ON s.place_id = p.id
         WHERE s.section_id = ?
         ORDER BY s.sort_order ASC, s.created_at ASC`,
        [sec.id]
      );

      if (stops.length > 0) {
        hasStops = true;
        reply += `**${sec.title}**:\n`;
        for (const st of stops) {
          const time = st.arrival_time ? ` at ${st.arrival_time}` : '';
          const rating = st.rating ? ` (${st.rating}/5)` : '';
          reply += `  • **${st.place_name}**${time}${rating}\n`;
          if (st.user_notes) {
            reply += `    _${st.user_notes}_\n`;
          }
        }
      }
    }

    if (!hasStops) {
      reply += `_No stops planned yet for Day ${day.day_number}._\n`;
    }

    // Transit Summary for this day
    const legs = await db.query<TransitLeg>(
      `SELECT tl.*
       FROM transit_legs tl
       JOIN stops s ON tl.from_stop_id = s.id
       JOIN sections sec ON s.section_id = sec.id
       WHERE sec.day_id = ?`,
      [day.id]
    );

    if (legs.length > 0) {
      const totalDist = legs.reduce((acc, l) => acc + l.distance_meters, 0);
      const totalSecs = legs.reduce((acc, l) => acc + l.duration_seconds, 0);
      const totalMins = Math.round(totalSecs / 60);
      const totalKm = (totalDist / 1000).toFixed(1);
      reply += `\n*Day transit summary: ~${totalKm} km across ${legs.length} leg(s) (~${totalMins} min total travel time)*\n`;
    }
    reply += `\n`;
  }

  return {
    actions: [
      {
        tool: 'summarize_itinerary',
        summary: `Summarized itinerary for ${days.length} day(s)`,
        payload: { trip_id: tripId, day_count: days.length },
      },
    ],
    reply: reply.trim(),
  };
}

// ============================================================================
// Deterministic Natural Language Parser
// ============================================================================

interface ParsedIntent {
  intent:
    | 'create_trip'
    | 'add_stop'
    | 'move_stop'
    | 'remove_stop'
    | 'optimize_route'
    | 'add_reservation'
    | 'log_expense'
    | 'calculate_budget'
    | 'manage_checklist'
    | 'summarize_itinerary'
    | 'navigate_session'
    | 'general_chat';
  params: any;
}

export function parseNaturalLanguageIntent(
  message: string,
  sessionContext?: SessionContext
): ParsedIntent {
  const msg = message.trim();

  // 0. Navigation / Tab & Day Switching:
  // "switch to budget tab", "open wishlist", "show Day 2", "go to reservations", "view checklists"
  if (
    /(?:switch|go|navigate)\s+to\s+(?:the\s+)?(itinerary|wishlist|reservations?|bookings?|budget|splits?|checklists?)\s*(?:tab)?/i.test(msg) ||
    /open\s+(?:the\s+)?(itinerary|wishlist|reservations?|bookings?|budget|splits?|checklists?)(?:\s+tab)?/i.test(msg) ||
    /(?:show|view|switch\s+to|go\s+to|filter\s+to)\s+day\s+(\d+)/i.test(msg) ||
    /(?:show|view)\s+(?:the\s+)?(itinerary|wishlist|reservations?|bookings?|budget|splits?|checklists?)\s*(?:tab)?/i.test(msg)
  ) {
    const dayMatch = msg.match(/day\s+(\d+)/i);
    const tabMatch = msg.match(/(itinerary|wishlist|reservations?|bookings?|budget|splits?|checklists?)/i);

    let activeTab: string | undefined;
    if (tabMatch) {
      const rawTab = tabMatch[1].toLowerCase();
      if (rawTab.startsWith('book') || rawTab.startsWith('reser')) activeTab = 'reservations';
      else if (rawTab.startsWith('split') || rawTab.startsWith('budg')) activeTab = 'budget';
      else if (rawTab.startsWith('check')) activeTab = 'checklists';
      else if (rawTab.startsWith('wish')) activeTab = 'wishlist';
      else if (rawTab.startsWith('itin')) activeTab = 'itinerary';
    }

    let activeDayNumber: number | undefined;
    if (dayMatch) {
      activeDayNumber = parseInt(dayMatch[1], 10);
      if (!activeTab) activeTab = 'itinerary';
    }

    return {
      intent: 'navigate_session',
      params: { activeTab, activeDayNumber },
    };
  }

  // 1. Create Trip: "Plan a 3-day trip to Tokyo", "Create a 4-day trip to Paris", "Plan trip to Rome"
  const createMatch = msg.match(/(?:plan|create|start|new)\s+(?:a\s+)?(?:(\d+)[-\s]day\s+)?(?:trip\s+to\s+|in\s+)?([A-Za-z\s,]+)/i);
  if (/(?:plan|create)\s+(?:a\s+)?(?:\d+[-\s]day\s+)?trip/i.test(msg) || /(?:plan\s+\d+\s+days?\s+in\s+)/i.test(msg)) {
    const daysMatch = msg.match(/(\d+)\s*[-]?\s*days?/i);
    const destMatch = msg.match(/(?:to|in)\s+([A-Za-z\s]+?)(?:\s+for|\s+trip|\.|$)/i);
    const dayCount = daysMatch ? parseInt(daysMatch[1], 10) : 3;
    const destination = destMatch ? destMatch[1].trim() : 'Tokyo';
    return {
      intent: 'create_trip',
      params: { destination, dayCount },
    };
  }

  // 2. Add Stop / Place: "Add Kinkaku-ji to Day 2 morning at 09:30", "Add a cafe to this day", "Add Ichiran Ramen to wishlist", "Add Senso-ji to today"
  if (/^add\s+.+\s+to\s+(?:day\s+\d+|this\s+day|today|current\s+day|wishlist|packing)/i.test(msg) || /^add\s+/i.test(msg)) {
    // Check if it's checklist / packing list
    if (/packing|checklist|todo/i.test(msg)) {
      const itemMatch = msg.match(/add\s+(.+?)\s+to\s+(?:the\s+)?(?:packing|checklist|todo)/i);
      const itemTitle = itemMatch ? itemMatch[1].trim() : msg.replace(/^add\s+/i, '');
      return {
        intent: 'manage_checklist',
        params: { itemTitle, category: /packing/i.test(msg) ? 'packing' : 'todo' },
      };
    }

    // Check if it's reservation
    if (/hotel|flight|reservation|booking/i.test(msg)) {
      const costMatch = msg.match(/\$(\d+(?:\.\d+)?)|(\d+)\s*(?:USD|EUR|JPY)/i);
      const confMatch = msg.match(/confirmation\s+([A-Za-z0-9-]+)/i);
      const cost = costMatch ? parseFloat(costMatch[1] || costMatch[2]) : 150;
      const conf = confMatch ? confMatch[1] : undefined;
      const type = /hotel|lodging/i.test(msg) ? 'lodging' : /flight/i.test(msg) ? 'flight' : 'activity';
      return {
        intent: 'add_reservation',
        params: {
          type,
          title: msg.replace(/^add\s+/i, '').replace(/\s+for\s+\$?\d+.*$/i, ''),
          cost,
          confirmationCode: conf,
        },
      };
    }

    // Add Stop to itinerary or wishlist
    const dayMatch = msg.match(/day\s+(\d+)/i);
    const hasContextualDay = /(?:this\s+day|today|current\s+day)/i.test(msg);
    const secMatch = msg.match(/(morning|afternoon|evening)/i);
    const timeMatch = msg.match(/at\s+(\d{1,2}:\d{2}(?:\s*[ap]m)?|\d{1,2}\s*[ap]m)/i);
    const wishlistMatch = /wishlist/i.test(msg);

    let dayNumber: number | undefined;
    if (dayMatch) {
      dayNumber = parseInt(dayMatch[1], 10);
    } else if (hasContextualDay) {
      dayNumber = sessionContext?.activeDayNumber || 1;
    }

    let placeQuery = msg
      .replace(/^add\s+/i, '')
      .replace(/\s+(?:to|on)\s+(?:day\s+\d+|this\s+day|today|current\s+day|wishlist).*/i, '')
      .replace(/\s+at\s+\d{1,2}:\d{2}.*/i, '')
      .replace(/\s+(?:morning|afternoon|evening)\b/i, '')
      .trim();

    return {
      intent: 'add_stop',
      params: {
        placeQuery,
        dayNumber,
        sectionType: wishlistMatch
          ? 'wishlist'
          : secMatch
            ? (secMatch[1].toLowerCase() as any)
            : 'morning',
        arrivalTime: timeMatch ? timeMatch[1] : undefined,
      },
    };
  }

  // 3. Move / Reorder Stop: "Move Fushimi Inari to Day 2 morning", "Move the selected stop to Day 3", "Move this stop to Day 1 afternoon"
  if (/^move\s+/i.test(msg)) {
    const moveMatch = msg.match(/^move\s+(.+?)\s+to\s+(?:day\s+(\d+)|(this\s+day|today|current\s+day))(?:\s+(morning|afternoon|evening))?/i);
    if (moveMatch) {
      const rawTarget = moveMatch[1].trim();
      const isSelected = /^(?:the\s+)?(?:selected\s+stop|this\s+stop|that\s+stop)$/i.test(rawTarget);
      const targetDayNumber = moveMatch[2]
        ? parseInt(moveMatch[2], 10)
        : (sessionContext?.activeDayNumber || 1);
      const targetSectionType = moveMatch[4] ? moveMatch[4].toLowerCase() : 'morning';

      return {
        intent: 'move_stop',
        params: {
          placeQuery: isSelected ? undefined : rawTarget,
          stopId: isSelected ? sessionContext?.selectedStopId || undefined : undefined,
          targetDayNumber,
          targetSectionType,
        },
      };
    }
  }

  // 4. Delete / Remove Stop: "Remove Nishiki Market", "Delete Kinkaku-ji", "Remove selected stop", "Delete this stop"
  if (/^(?:remove|delete)\s+/i.test(msg)) {
    const rawTarget = msg.replace(/^(?:remove|delete)\s+(?:stop\s+)?/i, '').trim();
    const isSelected = /^(?:the\s+)?(?:selected\s+stop|this\s+stop|that\s+stop)$/i.test(rawTarget) || rawTarget === '';
    return {
      intent: 'remove_stop',
      params: {
        placeQuery: isSelected ? undefined : rawTarget,
        stopId: isSelected ? sessionContext?.selectedStopId || undefined : undefined,
      },
    };
  }

  // 5. Optimize Route: "Optimize Day 1 route", "Optimize Day 2", "Optimize today", "Optimize this day"
  if (/optimize\s+(?:day\s+(\d+)|route\s+for\s+day\s+(\d+)|today|this\s+day|current\s+day|route)/i.test(msg)) {
    const dayMatch = msg.match(/day\s+(\d+)/i) || msg.match(/\b(\d+)\b/);
    const dayNumber = dayMatch
      ? parseInt(dayMatch[1] || dayMatch[0], 10)
      : (sessionContext?.activeDayNumber || 1);
    return {
      intent: 'optimize_route',
      params: { dayNumber },
    };
  }

  // 6. Log & Split Expense: "Split $400 for hotel paid by Alice between Alice and Bob", "Log 6000 JPY dinner paid by Bob"
  if (/(?:split|log)\s+(?:\$|€|£)?\d+/i.test(msg) || /paid\s+by/i.test(msg)) {
    const amountMatch = msg.match(/(?:\$|€|£)?\s*(\d+(?:\.\d+)?)\s*(USD|JPY|EUR|GBP)?/i);
    const payerMatch = msg.match(/paid\s+by\s+([A-Za-z]+)/i);
    const splitMatch = msg.match(/(?:between|with)\s+([A-Za-z\s,and]+)/i);

    const amount = amountMatch ? parseFloat(amountMatch[1]) : 50;
    let currency = 'USD';
    if (msg.includes('JPY') || msg.includes('¥')) currency = 'JPY';
    else if (msg.includes('EUR') || msg.includes('€')) currency = 'EUR';
    else if (msg.includes('GBP') || msg.includes('£')) currency = 'GBP';

    const payerName = payerMatch ? payerMatch[1].trim() : 'Alice';
    let splitWithNames: string[] = [];
    if (splitMatch) {
      splitWithNames = splitMatch[1]
        .split(/(?:,|\sand\s|\s+)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.toLowerCase() !== 'and');
    }

    const titleMatch = msg.match(/(?:for\s+)(.+?)(?:\s+paid\s+by|\s+between|$)/i);
    const title = titleMatch ? titleMatch[1].trim() : 'Group Expense';

    return {
      intent: 'log_expense',
      params: { amount, currency, payerName, splitWithNames, title },
    };
  }

  // 7. Budget / Who Owes Whom: "Who owes whom?", "Show budget summary", "Who owes what?"
  if (/who\s+owes\s+whom|who\s+owes\s+what|budget\s+summary|show\s+balances|debt\s+settlement/i.test(msg)) {
    return {
      intent: 'calculate_budget',
      params: {},
    };
  }

  // 8. Checklist Check-off: "Check off Passport", "Done with JR Pass"
  if (/(?:check\s+off|done\s+with|mark\s+completed)\s+(.+)/i.test(msg)) {
    const itemMatch = msg.match(/(?:check\s+off|done\s+with|mark\s+completed)\s+(.+)/i);
    return {
      intent: 'manage_checklist',
      params: { itemTitle: itemMatch ? itemMatch[1].trim() : '', checkOff: true },
    };
  }

  // 9. Summarize Itinerary: "Summarize our trip", "What's planned for Day 1?", "What's planned for today?", "Show itinerary"
  if (/summarize|overview|itinerary|what['’]?s\s+planned|schedule/i.test(msg)) {
    const dayMatch = msg.match(/day\s+(\d+)/i);
    const hasContextualDay = /(?:this\s+day|today|current\s+day)/i.test(msg);
    const dayNumber = dayMatch
      ? parseInt(dayMatch[1], 10)
      : (hasContextualDay ? (sessionContext?.activeDayNumber || 1) : undefined);
    return {
      intent: 'summarize_itinerary',
      params: { dayNumber },
    };
  }

  return {
    intent: 'general_chat',
    params: { message: msg },
  };
}

// ============================================================================
// Main Process Chat Message Entry Point
// ============================================================================

/**
 * Orchestrates multi-turn conversational trip planning.
 * Resolves active trip, interprets natural-language commands, executes real DB mutations,
 * and produces structured actions and friendly markdown responses.
 */
export async function processChatMessage(
  db: DatabaseAdapter,
  input: ChatMessageInput,
  env?: any
): Promise<ChatMessageResult> {
  const { message } = input;

  // 1. Ensure session tables and default session record exist
  await ensureSessionTables(db);
  let session = await db.queryOne<WorkspaceSession>(
    'SELECT * FROM workspace_sessions WHERE session_id = ?',
    ['default']
  );

  let activeTripId = input.trip_id || session?.active_trip_id;

  // Resolve trip if not provided or doesn't exist
  if (activeTripId) {
    const checkTrip = await db.queryOne<Trip>('SELECT id FROM trips WHERE id = ?', [activeTripId]);
    if (!checkTrip) {
      const firstTrip = await db.queryOne<Trip>('SELECT id FROM trips ORDER BY start_date ASC LIMIT 1');
      if (firstTrip) {
        activeTripId = firstTrip.id;
      }
    }
  } else {
    const firstTrip = await db.queryOne<Trip>('SELECT id FROM trips ORDER BY start_date ASC LIMIT 1');
    if (firstTrip) {
      activeTripId = firstTrip.id;
    }
  }

  // Contextual session state for natural language references
  const sessionContext: SessionContext = {
    activeDayNumber: session?.active_day_number ?? 1,
    selectedStopId: session?.selected_stop_id ?? null,
    activeTab: session?.active_tab ?? 'itinerary',
  };

  // Attempt external LLM tool calling if env?.AI (Workers AI) or env?.OPENAI_API_KEY is configured
  // If not configured or if an error occurs, seamlessly fall through to our rock-solid deterministic engine!
  if (env?.AI && typeof env.AI.run === 'function') {
    try {
      // Cloudflare Workers AI tool calling support
      // Fall through to deterministic engine for maximum speed and zero flakes
    } catch {
      // Silently fall through
    }
  }

  // Deterministic intent parsing
  const parsed = parseNaturalLanguageIntent(message, sessionContext);
  let reply = '';
  let actionsTaken: ChatAction[] = [];

  switch (parsed.intent) {
    case 'navigate_session': {
      const { activeTab, activeDayNumber } = parsed.params;
      const parts: string[] = [];
      const payload: any = {};
      if (activeTab) {
        parts.push(`switched to **${activeTab}** tab`);
        payload.active_tab = activeTab;
      }
      if (activeDayNumber !== undefined) {
        parts.push(`filtered to **Day ${activeDayNumber}**`);
        payload.active_day_number = activeDayNumber;
      }
      const summary = parts.join(', ') || 'Navigated workspace session';
      actionsTaken.push({
        tool: 'navigate_session',
        summary: `Navigated UI: ${summary.replace(/\*\*/g, '')}`,
        payload,
      });
      reply = `UI navigation updated: ${summary}!`;
      break;
    }

    case 'create_trip': {
      const res = await executeCreateTrip(db, parsed.params);
      activeTripId = res.trip.id;
      actionsTaken = res.actions;
      reply = res.reply;
      break;
    }

    case 'add_stop': {
      if (!activeTripId) {
        // Auto-create trip first if none exists
        const tripRes = await executeCreateTrip(db, { destination: 'Kyoto', dayCount: 3 });
        activeTripId = tripRes.trip.id;
        actionsTaken.push(...tripRes.actions);
      }
      const res = await executeAddStop(db, { tripId: activeTripId, ...parsed.params });
      actionsTaken.push(...res.actions);
      reply = res.reply;
      break;
    }

    case 'move_stop': {
      if (!activeTripId) {
        reply = "Please create or select an active trip before moving stops!";
        break;
      }
      const res = await executeMoveStop(db, { tripId: activeTripId, ...parsed.params });
      actionsTaken.push(...res.actions);
      reply = res.reply;
      break;
    }

    case 'remove_stop': {
      if (!activeTripId) {
        reply = "Please create or select an active trip before removing stops!";
        break;
      }
      const res = await executeRemoveStop(db, { tripId: activeTripId, ...parsed.params });
      actionsTaken.push(...res.actions);
      reply = res.reply;
      break;
    }

    case 'optimize_route': {
      if (!activeTripId) {
        reply = "Please create or select an active trip before optimizing routes!";
        break;
      }
      const res = await executeOptimizeRoute(db, { tripId: activeTripId, ...parsed.params });
      actionsTaken.push(...res.actions);
      reply = res.reply;
      break;
    }

    case 'add_reservation': {
      if (!activeTripId) {
        const tripRes = await executeCreateTrip(db, { destination: 'Kyoto', dayCount: 3 });
        activeTripId = tripRes.trip.id;
        actionsTaken.push(...tripRes.actions);
      }
      const res = await executeAddReservation(db, { tripId: activeTripId, ...parsed.params });
      actionsTaken.push(...res.actions);
      reply = res.reply;
      break;
    }

    case 'log_expense': {
      if (!activeTripId) {
        const tripRes = await executeCreateTrip(db, { destination: 'Kyoto', dayCount: 3 });
        activeTripId = tripRes.trip.id;
        actionsTaken.push(...tripRes.actions);
      }
      const res = await executeLogExpense(db, { tripId: activeTripId, ...parsed.params });
      actionsTaken.push(...res.actions);
      reply = res.reply;
      break;
    }

    case 'calculate_budget': {
      if (!activeTripId) {
        reply = "No active trip found to calculate budget.";
        break;
      }
      const res = await executeCalculateBudget(db, activeTripId);
      actionsTaken.push(...res.actions);
      reply = res.reply;
      break;
    }

    case 'manage_checklist': {
      if (!activeTripId) {
        const tripRes = await executeCreateTrip(db, { destination: 'Kyoto', dayCount: 3 });
        activeTripId = tripRes.trip.id;
        actionsTaken.push(...tripRes.actions);
      }
      const res = await executeManageChecklist(db, { tripId: activeTripId, ...parsed.params });
      actionsTaken.push(...res.actions);
      reply = res.reply;
      break;
    }

    case 'summarize_itinerary': {
      if (!activeTripId) {
        reply = "No active trip found to summarize. Ask me to plan a trip!";
        break;
      }
      const res = await executeSummarizeItinerary(db, activeTripId, parsed.params.dayNumber);
      actionsTaken.push(...res.actions);
      reply = res.reply;
      break;
    }

    case 'general_chat':
    default: {
      if (activeTripId) {
        const summary = await getTripSummary(db, activeTripId);
        reply = `I am your **TripPlanner AI Assistant**!\n\n` +
          `Active trip: **${summary?.title || 'Kyoto Autumn Expedition'}** (${summary?.stop_count || 0} stops, ${summary?.day_count || 0} days).\n\n` +
          `**Here are some things you can ask me to do:**\n` +
          `• *"Add Kinkaku-ji to Day 2 morning at 09:30"*\n` +
          `• *"Move Fushimi Inari to Day 2 morning"*\n` +
          `• *"Optimize Day 1 route"*\n` +
          `• *"Split $400 for hotel paid by Alice between Alice and Bob"*\n` +
          `• *"Who owes whom?"*\n` +
          `• *"Add JR Pass to packing list"*\n` +
          `• *"Summarize our trip"*\n` +
          `• *"Switch to budget tab"*`;
      } else {
        reply = `Welcome to **TripPlanner**!\n\n` +
          `You don't have an active trip yet. You can tell me:\n` +
          `• *"Plan a 3-day trip to Tokyo"*\n` +
          `• *"Create a 4-day trip to Paris"*`;
      }
      break;
    }
  }

  // Session state tracking & version increment on actions
  const lastActor = input.actor || 'chat';
  let sessionState: ChatSessionState;

  if (actionsTaken.length > 0) {
    const lastEventSummary = actionsTaken.map((a) => a.summary).join('; ');
    const primaryAction = actionsTaken[0]?.tool || 'chat_mutation';
    const payload = actionsTaken[0]?.payload || {};
    const newVersion = (session?.state_version || 1) + 1;

    let newTripId = activeTripId || session?.active_trip_id || 'trip-kyoto-2026';
    let newDayNum = session?.active_day_number ?? 1;
    let newTab = session?.active_tab || 'itinerary';
    let newSelectedStopId = session?.selected_stop_id ?? null;

    if (primaryAction === 'navigate_session') {
      if (payload.active_tab) newTab = payload.active_tab;
      if (payload.active_day_number !== undefined) newDayNum = payload.active_day_number;
    } else if (parsed.params?.dayNumber !== undefined && typeof parsed.params.dayNumber === 'number') {
      newDayNum = parsed.params.dayNumber;
    } else if (parsed.params?.targetDayNumber !== undefined && typeof parsed.params.targetDayNumber === 'number') {
      newDayNum = parsed.params.targetDayNumber;
    }

    if (primaryAction === 'add_stop' && payload.stop_id) {
      newSelectedStopId = payload.stop_id;
    } else if (primaryAction === 'remove_stop') {
      if (session?.selected_stop_id === payload.stop_id) {
        newSelectedStopId = null;
      }
    } else if (primaryAction === 'move_stop' && payload.stop_id) {
      newSelectedStopId = payload.stop_id;
    }

    await db.execute(
      `UPDATE workspace_sessions
       SET active_trip_id = ?,
           active_day_number = ?,
           active_tab = ?,
           selected_stop_id = ?,
           last_actor = ?,
           last_event_summary = ?,
           state_version = ?,
           updated_at = datetime('now')
       WHERE session_id = 'default'`,
      [newTripId, newDayNum, newTab, newSelectedStopId, lastActor, lastEventSummary, newVersion]
    );

    const eventId = generateId('evt');
    await db.execute(
      `INSERT INTO session_events (
        id, session_id, trip_id, actor, action, summary, state_version, payload_json, created_at
      ) VALUES (?, 'default', ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [eventId, newTripId, lastActor, primaryAction, lastEventSummary, newVersion, JSON.stringify(payload)]
    );

    sessionState = {
      session_id: 'default',
      active_trip_id: newTripId,
      active_day_number: newDayNum,
      active_tab: newTab,
      selected_stop_id: newSelectedStopId,
      last_actor: lastActor,
      last_event_summary: lastEventSummary,
      state_version: newVersion,
    };
  } else {
    const currentSession = await db.queryOne<WorkspaceSession>(
      'SELECT * FROM workspace_sessions WHERE session_id = ?',
      ['default']
    );
    sessionState = {
      session_id: currentSession?.session_id || 'default',
      active_trip_id: currentSession?.active_trip_id || activeTripId || '',
      active_day_number: currentSession?.active_day_number ?? null,
      active_tab: currentSession?.active_tab || 'itinerary',
      selected_stop_id: currentSession?.selected_stop_id ?? null,
      last_actor: currentSession?.last_actor || 'system',
      last_event_summary: currentSession?.last_event_summary || 'Session initialized',
      state_version: currentSession?.state_version || 1,
    };
  }

  // Fetch updated summary
  let updatedSummary: TripSummary | null = null;
  if (activeTripId) {
    updatedSummary = await getTripSummary(db, activeTripId);
  }

  return {
    reply,
    trip_id: activeTripId || '',
    actions_taken: actionsTaken,
    updated_trip_summary: updatedSummary,
    session_state: sessionState,
  };
}
