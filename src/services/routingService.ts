import type { DatabaseAdapter } from '../db/client';
import type { TransitMode, TransitLeg, Stop, Place, Day, Section } from '../types/domain';
import { generateId } from '../lib/http';

export interface RouteCoordinates {
  lat: number;
  lng: number;
}

export interface TransitCalculationResult {
  duration_seconds: number;
  distance_meters: number;
  transit_mode: TransitMode;
  route_instructions: string;
  polyline: string;
}

export interface OptimizeRouteOptions {
  transit_mode?: TransitMode;
  fixed_start_stop_id?: string;
  fixed_end_stop_id?: string;
}

export interface OptimizeRouteResult {
  day_number: number;
  original_duration_seconds: number;
  optimized_duration_seconds: number;
  time_saved_minutes: number;
  reordered_stops: (Stop & { place: Place; is_locked?: number | boolean })[];
}

/**
 * Calculates Great-Circle Haversine distance between two points in meters.
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's mean radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Encodes a pair (or list) of lat/lng coordinates into a standard Google Polyline string.
 */
export function encodePolyline(points: RouteCoordinates[]): string {
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const point of points) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);

    const dLat = lat - prevLat;
    const dLng = lng - prevLng;

    prevLat = lat;
    prevLng = lng;

    encoded += encodeSignedNumber(dLat);
    encoded += encodeSignedNumber(dLng);
  }

  return encoded;
}

function encodeSignedNumber(num: number): string {
  let sgn_num = num < 0 ? ~(num << 1) : num << 1;
  let encodeString = '';
  while (sgn_num >= 0x20) {
    encodeString += String.fromCharCode((0x20 | (sgn_num & 0x1f)) + 63);
    sgn_num >>= 5;
  }
  encodeString += String.fromCharCode(sgn_num + 63);
  return encodeString;
}

/**
 * Normalizes input transit mode string to valid TransitMode.
 */
export function normalizeTransitMode(mode?: string): TransitMode {
  if (!mode) return 'walking';
  const m = mode.toLowerCase();
  if (m === 'walk' || m === 'walking') return 'walking';
  if (m === 'bike' || m === 'bicycle' || m === 'bicycling') return 'bicycling';
  if (m === 'transit' || m === 'bus' || m === 'subway' || m === 'train') return 'transit';
  if (m === 'drive' || m === 'driving' || m === 'car') return 'driving';
  if (m === 'flight' || m === 'fly' || m === 'plane') return 'flight';
  return 'walking';
}

/**
 * Computes realistic transit distance and duration between two coordinates using
 * Haversine, road tortuosity factors, and realistic travel mode speeds.
 */
export function calculateTransitBetweenPoints(
  origin: RouteCoordinates,
  dest: RouteCoordinates,
  mode: TransitMode | string = 'walking'
): TransitCalculationResult {
  const transitMode = normalizeTransitMode(mode);
  const straightLineDistance = calculateHaversineDistance(
    origin.lat,
    origin.lng,
    dest.lat,
    dest.lng
  );

  if (straightLineDistance === 0) {
    return {
      duration_seconds: 0,
      distance_meters: 0,
      transit_mode: transitMode,
      route_instructions: 'Origin and destination are the same location.',
      polyline: encodePolyline([origin, dest]),
    };
  }

  let tortuosity = 1.25;
  let speedMps = 1.25; // default walking ~4.5 km/h
  let fixedBufferSeconds = 0;
  let modeName = 'Walking';

  switch (transitMode) {
    case 'walking':
      tortuosity = 1.25;
      speedMps = 1.25; // 4.5 km/h
      fixedBufferSeconds = 0;
      modeName = 'Walking';
      break;

    case 'bicycling':
      tortuosity = 1.2;
      speedMps = 4.167; // 15 km/h
      fixedBufferSeconds = 60; // unlocking/parking
      modeName = 'Bicycling';
      break;

    case 'transit':
      tortuosity = 1.3;
      speedMps = 6.944; // 25 km/h
      fixedBufferSeconds = 480; // 8-minute average wait & transfer
      modeName = 'Public Transit';
      break;

    case 'driving':
      tortuosity = 1.35;
      // Urban speed: 35 km/h (~9.7 m/s); Highway speed: 70 km/h (~19.4 m/s) if > 15km
      speedMps = straightLineDistance > 15000 ? 19.44 : 9.722;
      fixedBufferSeconds = 120; // traffic lights & parking
      modeName = 'Driving';
      break;

    case 'flight':
      tortuosity = 1.05;
      speedMps = 194.44; // 700 km/h cruising speed
      fixedBufferSeconds = 5400; // 90 min airport check-in / security
      modeName = 'Flight';
      break;
  }

  const distanceMeters = Math.round(straightLineDistance * tortuosity);
  const travelDuration = Math.round(distanceMeters / speedMps);
  const durationSeconds = travelDuration + fixedBufferSeconds;

  const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10;
  const durationMins = Math.max(1, Math.round(durationSeconds / 60));

  const routeInstructions = `${modeName} route: ${distanceKm} km, approx ${durationMins} min${
    durationMins === 1 ? '' : 's'
  }.`;

  // Polyline: origin -> midpoint -> dest for realistic curve
  const midPoint: RouteCoordinates = {
    lat: (origin.lat + dest.lat) / 2 + (dest.lng - origin.lng) * 0.05,
    lng: (origin.lng + dest.lng) / 2 - (dest.lat - origin.lat) * 0.05,
  };
  const polyline = encodePolyline([origin, midPoint, dest]);

  return {
    duration_seconds: durationSeconds,
    distance_meters: distanceMeters,
    transit_mode: transitMode,
    route_instructions: routeInstructions,
    polyline,
  };
}

/**
 * Formats seconds addition to HH:MM time string.
 */
function addSecondsToTime(timeStr: string | null, seconds: number): string | null {
  if (!timeStr) return null;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const totalSeconds = hours * 3600 + mins * 60 + seconds;
  const newHours = Math.floor(totalSeconds / 3600) % 24;
  const newMins = Math.floor((totalSeconds % 3600) / 60);
  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}

/**
 * Recalculates all transit legs between consecutive scheduled stops for a given Day.
 * Deletes stale legs and inserts fresh legs with updated distances and travel times.
 */
export async function recalculateDayTransitLegs(
  db: DatabaseAdapter,
  tripId: string,
  dayId: string,
  defaultMode: TransitMode = 'walking'
): Promise<TransitLeg[]> {
  // 1. Query all stops scheduled in dayId across all sections in chronological sort order
  const stops = await db.query<
    Stop & { lat: number; lng: number; section_sort_order: number; place_name: string }
  >(
    `SELECT s.*, p.lat, p.lng, p.name AS place_name, sec.sort_order AS section_sort_order
     FROM stops s
     JOIN sections sec ON s.section_id = sec.id
     JOIN places p ON s.place_id = p.id
     WHERE sec.day_id = ? AND sec.trip_id = ?
     ORDER BY sec.sort_order ASC, s.sort_order ASC, s.created_at ASC`,
    [dayId, tripId]
  );

  const stopIds = stops.map((s) => s.id);

  // 2. Clean up old transit legs connecting these stops
  if (stopIds.length > 0) {
    const placeholders = stopIds.map(() => '?').join(',');
    await db.execute(
      `DELETE FROM transit_legs
       WHERE trip_id = ?
         AND (from_stop_id IN (${placeholders}) OR to_stop_id IN (${placeholders}))`,
      [tripId, ...stopIds, ...stopIds]
    );
  }

  if (stops.length < 2) {
    return [];
  }

  // 3. Insert fresh transit legs between sequential pairs
  const newLegs: TransitLeg[] = [];
  const statements: { sql: string; params: any[] }[] = [];

  for (let i = 0; i < stops.length - 1; i++) {
    const fromStop = stops[i];
    const toStop = stops[i + 1];

    const transit = calculateTransitBetweenPoints(
      { lat: fromStop.lat, lng: fromStop.lng },
      { lat: toStop.lat, lng: toStop.lng },
      defaultMode
    );

    const departureTime = fromStop.departure_time || fromStop.arrival_time || null;
    const arrivalTime = departureTime
      ? addSecondsToTime(departureTime, transit.duration_seconds)
      : null;

    const legId = generateId('leg');
    const leg: TransitLeg = {
      id: legId,
      trip_id: tripId,
      from_stop_id: fromStop.id,
      to_stop_id: toStop.id,
      transit_mode: transit.transit_mode,
      duration_seconds: transit.duration_seconds,
      distance_meters: transit.distance_meters,
      route_instructions: transit.route_instructions,
      departure_time: departureTime,
      arrival_time: arrivalTime,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    newLegs.push(leg);
    statements.push({
      sql: `INSERT INTO transit_legs (
        id, trip_id, from_stop_id, to_stop_id, transit_mode, duration_seconds, distance_meters,
        route_instructions, departure_time, arrival_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        leg.id,
        leg.trip_id,
        leg.from_stop_id,
        leg.to_stop_id,
        leg.transit_mode,
        leg.duration_seconds,
        leg.distance_meters,
        leg.route_instructions,
        leg.departure_time,
        leg.arrival_time,
      ],
    });
  }

  await db.batch(statements);
  return newLegs;
}

/**
 * Traveling Salesperson Problem (TSP) Daily Route Optimizer:
 * Uses Nearest-Neighbor construction followed by 2-Opt local search refinement.
 * Respects fixed_start_stop_id, fixed_end_stop_id, and is_locked stops.
 * Updates stop sort orders, recalculates transit legs, and returns time savings.
 */
export async function optimizeDayRoute(
  db: DatabaseAdapter,
  tripId: string,
  dayNumber: number,
  options?: OptimizeRouteOptions
): Promise<OptimizeRouteResult> {
  const mode = options?.transit_mode || 'walking';

  // 1. Resolve Day
  const day = await db.queryOne<Day>(
    'SELECT * FROM days WHERE trip_id = ? AND day_number = ?',
    [tripId, dayNumber]
  );
  if (!day) {
    throw new Error(`Day ${dayNumber} not found for trip ${tripId}`);
  }

  // 2. Fetch all scheduled stops with place coordinates
  // Support is_locked column if present, or detect from user_notes
  let stopsWithPlaces: (Stop & {
    lat: number;
    lng: number;
    name: string;
    formatted_address: string;
    category: any;
    rating: number | null;
    google_place_id: string | null;
    website: string | null;
    phone_number: string | null;
    notes: string | null;
    is_locked?: number | boolean;
  })[];

  try {
    stopsWithPlaces = await db.query(
      `SELECT s.*, p.name, p.formatted_address, p.lat, p.lng, p.category, p.rating,
              p.google_place_id, p.website, p.phone_number, p.notes,
              COALESCE(s.is_locked, 0) AS is_locked
       FROM stops s
       JOIN sections sec ON s.section_id = sec.id
       JOIN places p ON s.place_id = p.id
       WHERE sec.day_id = ? AND sec.trip_id = ?
       ORDER BY sec.sort_order ASC, s.sort_order ASC, s.created_at ASC`,
      [day.id, tripId]
    );
  } catch {
    // Fallback if is_locked column doesn't exist in schema yet
    stopsWithPlaces = await db.query(
      `SELECT s.*, p.name, p.formatted_address, p.lat, p.lng, p.category, p.rating,
              p.google_place_id, p.website, p.phone_number, p.notes,
              0 AS is_locked
       FROM stops s
       JOIN sections sec ON s.section_id = sec.id
       JOIN places p ON s.place_id = p.id
       WHERE sec.day_id = ? AND sec.trip_id = ?
       ORDER BY sec.sort_order ASC, s.sort_order ASC, s.created_at ASC`,
      [day.id, tripId]
    );
  }

  if (stopsWithPlaces.length <= 2) {
    const legs = await recalculateDayTransitLegs(db, tripId, day.id, mode);
    const totalDuration = legs.reduce((acc, l) => acc + l.duration_seconds, 0);
    const mapped = stopsWithPlaces.map((s) => ({
      ...s,
      place: {
        id: s.place_id,
        name: s.name,
        formatted_address: s.formatted_address,
        lat: s.lat,
        lng: s.lng,
        category: s.category,
        rating: s.rating,
        google_place_id: s.google_place_id,
        website: s.website,
        phone_number: s.phone_number,
        notes: s.notes,
        created_at: s.created_at,
        updated_at: s.updated_at,
      },
    }));

    return {
      day_number: dayNumber,
      original_duration_seconds: totalDuration,
      optimized_duration_seconds: totalDuration,
      time_saved_minutes: 0,
      reordered_stops: mapped,
    };
  }

  // 3. Compute pairwise duration matrix
  const N = stopsWithPlaces.length;
  const matrix: number[][] = Array.from({ length: N }, () => Array(N).fill(0));

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else {
        const transit = calculateTransitBetweenPoints(
          { lat: stopsWithPlaces[i].lat, lng: stopsWithPlaces[i].lng },
          { lat: stopsWithPlaces[j].lat, lng: stopsWithPlaces[j].lng },
          mode
        );
        matrix[i][j] = transit.duration_seconds;
      }
    }
  }

  // Calculate original duration
  let originalDuration = 0;
  for (let i = 0; i < N - 1; i++) {
    originalDuration += matrix[i][i + 1];
  }

  // 4. TSP Optimization Constraints & Setup
  const fixedStartStopId = options?.fixed_start_stop_id;
  const fixedEndStopId = options?.fixed_end_stop_id;

  let startIndex = 0;
  if (fixedStartStopId) {
    const idx = stopsWithPlaces.findIndex((s) => s.id === fixedStartStopId);
    if (idx !== -1) startIndex = idx;
  }

  let endIndex = -1;
  if (fixedEndStopId) {
    const idx = stopsWithPlaces.findIndex((s) => s.id === fixedEndStopId);
    if (idx !== -1) endIndex = idx;
  }

  // Phase A: Nearest-Neighbor construction
  const visited = new Set<number>();
  const tour: number[] = [startIndex];
  visited.add(startIndex);

  let current = startIndex;
  while (tour.length < (endIndex !== -1 && endIndex !== startIndex ? N - 1 : N)) {
    let nextBest = -1;
    let minCost = Infinity;

    for (let j = 0; j < N; j++) {
      if (visited.has(j) || j === endIndex) continue;

      const cost = matrix[current][j];
      if (cost < minCost) {
        minCost = cost;
        nextBest = j;
      }
    }

    if (nextBest === -1) {
      // Pick any unvisited non-end stop
      for (let j = 0; j < N; j++) {
        if (!visited.has(j) && j !== endIndex) {
          nextBest = j;
          break;
        }
      }
    }

    if (nextBest !== -1) {
      tour.push(nextBest);
      visited.add(nextBest);
      current = nextBest;
    } else {
      break;
    }
  }

  if (endIndex !== -1 && !visited.has(endIndex)) {
    tour.push(endIndex);
    visited.add(endIndex);
  }

  // Ensure all stops are in the tour
  for (let i = 0; i < N; i++) {
    if (!visited.has(i)) {
      tour.push(i);
      visited.add(i);
    }
  }

  // Helper to calculate total tour duration
  const tourCost = (t: number[]): number => {
    let sum = 0;
    for (let i = 0; i < t.length - 1; i++) {
      sum += matrix[t[i]][t[i + 1]];
    }
    return sum;
  };

  // Phase B: 2-Opt local search refinement
  let bestTour = [...tour];
  let bestCost = tourCost(bestTour);
  let improved = true;
  let iterations = 0;
  const maxIterations = 50;

  // Determine movable range: index 0 is locked if fixedStart; index N-1 is locked if fixedEnd
  const minK = fixedStartStopId ? 1 : 0;
  const maxK = fixedEndStopId ? N - 2 : N - 1;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = minK; i < maxK; i++) {
      for (let j = i + 1; j <= maxK; j++) {
        // Check if any stop between i and j has is_locked flag
        const hasLockedStop = bestTour
          .slice(i, j + 1)
          .some((idx) => Boolean(stopsWithPlaces[idx].is_locked));
        if (hasLockedStop) continue;

        // Perform 2-opt swap (reversing subarray bestTour[i...j])
        const newTour = [
          ...bestTour.slice(0, i),
          ...bestTour.slice(i, j + 1).reverse(),
          ...bestTour.slice(j + 1),
        ];

        const newCost = tourCost(newTour);
        if (newCost < bestCost) {
          bestTour = newTour;
          bestCost = newCost;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  // Guarantee optimized duration <= original duration
  let finalTour = bestTour;
  let optimizedDuration = bestCost;
  if (optimizedDuration > originalDuration) {
    finalTour = Array.from({ length: N }, (_, i) => i);
    optimizedDuration = originalDuration;
  }

  // 5. Apply new order to database
  const batchStatements: { sql: string; params: any[] }[] = [];
  const reorderedStops: (Stop & { place: Place; is_locked?: number | boolean })[] = [];

  for (let newIndex = 0; newIndex < N; newIndex++) {
    const originalIdx = finalTour[newIndex];
    const stop = stopsWithPlaces[originalIdx];
    const sortOrder = newIndex + 1;

    batchStatements.push({
      sql: "UPDATE stops SET sort_order = ?, updated_at = datetime('now') WHERE id = ?",
      params: [sortOrder, stop.id],
    });

    reorderedStops.push({
      ...stop,
      sort_order: sortOrder,
      place: {
        id: stop.place_id,
        name: stop.name,
        formatted_address: stop.formatted_address,
        lat: stop.lat,
        lng: stop.lng,
        category: stop.category,
        rating: stop.rating,
        google_place_id: stop.google_place_id,
        website: stop.website,
        phone_number: stop.phone_number,
        notes: stop.notes,
        created_at: stop.created_at,
        updated_at: stop.updated_at,
      },
    });
  }

  await db.batch(batchStatements);

  // 6. Recalculate transit legs with new stop order
  await recalculateDayTransitLegs(db, tripId, day.id, mode);

  // 7. Update trip updated_at and increment version if column exists
  try {
    await db.execute("UPDATE trips SET version = version + 1, updated_at = datetime('now') WHERE id = ?", [tripId]);
  } catch {
    await db.execute("UPDATE trips SET updated_at = datetime('now') WHERE id = ?", [tripId]);
  }

  const timeSavedMinutes = Math.max(0, Math.round((originalDuration - optimizedDuration) / 60));

  return {
    day_number: dayNumber,
    original_duration_seconds: originalDuration,
    optimized_duration_seconds: optimizedDuration,
    time_saved_minutes: timeSavedMinutes,
    reordered_stops: reorderedStops,
  };
}
