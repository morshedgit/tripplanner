import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTestDb,
  setTestDb,
  MemoryKvAdapter,
  type DatabaseAdapter,
} from '../src/db/client';
import {
  searchPlaces,
  resolveOrCreatePlace,
  validatePlaceOpeningHours,
  CURATED_POI_CATALOG,
} from '../src/services/placeService';
import {
  calculateTransitBetweenPoints,
  calculateHaversineDistance,
  encodePolyline,
  recalculateDayTransitLegs,
  optimizeDayRoute,
} from '../src/services/routingService';
import {
  addTripStop,
  updateTripStop,
  moveTripStop,
  deleteTripStop,
  voteOnStop,
} from '../src/services/stopService';
import type { TransitLeg, Stop, Day, Section } from '../src/types/domain';

// Import API routes
import { GET as searchPlacesApi } from '../src/pages/api/v1/places/search';
import { POST as addStopApi } from '../src/pages/api/v1/trips/[tripId]/stops/index';
import {
  PATCH as updateStopApi,
  DELETE as deleteStopApi,
} from '../src/pages/api/v1/trips/[tripId]/stops/[stopId]/index';
import { POST as moveStopApi } from '../src/pages/api/v1/trips/[tripId]/stops/[stopId]/move';
import { POST as voteStopApi } from '../src/pages/api/v1/trips/[tripId]/stops/[stopId]/vote';
import { POST as optimizeRouteApi } from '../src/pages/api/v1/trips/[tripId]/days/[dayNumber]/optimize-route';

describe('Geospatial, Routing & Stop Management Services', () => {
  let db: DatabaseAdapter;
  const tripId = 'trip-kyoto-2026';

  beforeEach(async () => {
    db = await createTestDb(true);
    setTestDb(db);
  });

  afterEach(() => {
    setTestDb(null);
  });

  // ==========================================================================
  // 1. Curated POI Catalog & Place Search
  // ==========================================================================
  describe('Place Service & POI Catalog', () => {
    it('contains rich curated POIs across Kyoto, Tokyo, Paris, New York, London, Rome', () => {
      const cities = new Set(CURATED_POI_CATALOG.map((p) => p.city));
      expect(cities.has('Kyoto')).toBe(true);
      expect(cities.has('Tokyo')).toBe(true);
      expect(cities.has('Paris')).toBe(true);
      expect(cities.has('New York')).toBe(true);
      expect(cities.has('London')).toBe(true);
      expect(cities.has('Rome')).toBe(true);

      for (const poi of CURATED_POI_CATALOG) {
        expect(poi.lat).toBeTypeOf('number');
        expect(poi.lng).toBeTypeOf('number');
        expect(poi.opening_hours).toBeDefined();
        expect(Array.isArray(poi.opening_hours.open_days)).toBe(true);
        expect(poi.opening_hours.open_time).toMatch(/^\d{2}:\d{2}$/);
        expect(poi.opening_hours.close_time).toMatch(/^\d{2}:\d{2}$/);
      }
    });

    it('searches places from database and curated catalog', async () => {
      const results = await searchPlaces(db, 'Kinkaku');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toContain('Kinkaku');
    });

    it('filters places by city parameter', async () => {
      const kyotoResults = await searchPlaces(db, 'Market', 'Kyoto');
      expect(kyotoResults.some((p) => p.name.includes('Nishiki'))).toBe(true);
      expect(kyotoResults.some((p) => p.name.includes('Tsukiji'))).toBe(false);

      const tokyoResults = await searchPlaces(db, 'Market', 'Tokyo');
      expect(tokyoResults.some((p) => p.name.includes('Tsukiji'))).toBe(true);
      expect(tokyoResults.some((p) => p.name.includes('Nishiki'))).toBe(false);
    });

    it('uses KV cache for geocoder queries', async () => {
      const kv = new MemoryKvAdapter();
      await kv.put(
        'nominatim:sagano:kyoto',
        JSON.stringify([
          {
            id: 'place-sagano-mock',
            name: 'Sagano Scenic Railway',
            formatted_address: 'Sagatenryuji, Ukyo Ward, Kyoto',
            city: 'Kyoto',
            country: 'Japan',
            lat: 35.018,
            lng: 135.678,
            category: 'attraction',
            rating: 4.6,
            opening_hours: {
              open_days: [0, 1, 2, 3, 4, 5, 6],
              open_time: '09:00',
              close_time: '17:00',
            },
          },
        ])
      );

      const places = await searchPlaces(db, 'sagano', 'kyoto', kv);
      expect(places.some((p) => p.name === 'Sagano Scenic Railway')).toBe(true);
    });

    it('resolves existing places and creates new places when not present', async () => {
      // Resolve existing seeded place by ID
      const existing = await resolveOrCreatePlace(db, { place_id: 'place-fushimi' });
      expect(existing.name).toBe('Fushimi Inari Taisha');

      // Resolve from catalog by name
      const catalogPlace = await resolveOrCreatePlace(db, { name: 'Louvre Museum', city: 'Paris' });
      expect(catalogPlace.name).toBe('Louvre Museum');
      expect(catalogPlace.lat).toBeCloseTo(48.8606, 2);

      // Create custom place with coordinates
      const custom = await resolveOrCreatePlace(db, {
        name: 'Gion Corner Tea House',
        address: 'Higashiyama Ward, Kyoto',
        lat: 35.003,
        lng: 135.776,
        category: 'restaurant',
      });
      expect(custom.id).toBeDefined();
      expect(custom.name).toBe('Gion Corner Tea House');
      expect(custom.category).toBe('restaurant');
    });
  });

  // ==========================================================================
  // 2. Opening Hours Validation
  // ==========================================================================
  describe('Opening Hours Validation', () => {
    it('validates open places as valid', () => {
      // 2026-11-01 is a Sunday. Kinkaku-ji is open daily 09:00 - 17:00.
      const res = validatePlaceOpeningHours(
        { name: 'Kinkaku-ji (Golden Pavilion)' },
        '2026-11-01',
        '10:30'
      );
      expect(res.isValid).toBe(true);
      expect(res.open).toBe(true);
    });

    it('flags places closed on specific weekdays and suggests open alternatives', () => {
      // 2026-11-02 is a Monday. Nishiki Market is closed on Mondays!
      const res = validatePlaceOpeningHours({ name: 'Nishiki Market' }, '2026-11-02', '11:00');
      expect(res.isValid).toBe(false);
      expect(res.open).toBe(false);
      expect(res.warning).toContain('closed on Mondays');
      expect(res.suggested_alternatives).toBeDefined();
      expect(res.suggested_alternatives!.length).toBeGreaterThan(0);

      // 2026-11-03 is a Tuesday. Louvre Museum is closed on Tuesdays!
      const louvreRes = validatePlaceOpeningHours({ name: 'Louvre Museum' }, '2026-11-03');
      expect(louvreRes.isValid).toBe(false);
      expect(louvreRes.warning).toContain('closed on Tuesdays');

      // 2026-11-01 is a Sunday. Vatican Museums is closed on Sundays!
      const vaticanRes = validatePlaceOpeningHours({ name: 'Vatican Museums' }, '2026-11-01');
      expect(vaticanRes.isValid).toBe(false);
      expect(vaticanRes.warning).toContain('closed on Sundays');
    });

    it('flags visits scheduled outside operating hours', () => {
      // Kinkaku-ji hours: 09:00 - 17:00. Scheduled at 19:30 (closed)
      const res = validatePlaceOpeningHours(
        { name: 'Kinkaku-ji (Golden Pavilion)' },
        '2026-11-01',
        '19:30'
      );
      expect(res.isValid).toBe(false);
      expect(res.warning).toContain('closed at 19:30');
      expect(res.open_hours_summary).toBe('09:00 - 17:00');
    });
  });

  // ==========================================================================
  // 3. Multi-Modal Transit Calculations & Polyline Encoding
  // ==========================================================================
  describe('Routing Service & Transit Calculations', () => {
    const kyotoStation = { lat: 34.9858, lng: 135.7588 };
    const fushimiInari = { lat: 34.9671, lng: 135.7727 };
    const tokyoStation = { lat: 35.6812, lng: 139.7671 };

    it('computes accurate Haversine distance', () => {
      const distance = calculateHaversineDistance(
        kyotoStation.lat,
        kyotoStation.lng,
        fushimiInari.lat,
        fushimiInari.lng
      );
      // Roughly 2.4 - 2.8 km straight line
      expect(distance).toBeGreaterThan(2000);
      expect(distance).toBeLessThan(3200);
    });

    it('encodes coordinate polyline strings', () => {
      const polyline = encodePolyline([kyotoStation, fushimiInari]);
      expect(polyline).toBeTypeOf('string');
      expect(polyline.length).toBeGreaterThan(5);
    });

    it('calculates realistic travel times across transit modes', () => {
      const walk = calculateTransitBetweenPoints(kyotoStation, fushimiInari, 'walking');
      const bike = calculateTransitBetweenPoints(kyotoStation, fushimiInari, 'bicycling');
      const transit = calculateTransitBetweenPoints(kyotoStation, fushimiInari, 'transit');
      const drive = calculateTransitBetweenPoints(kyotoStation, fushimiInari, 'driving');

      // Bike should be faster than walking
      expect(bike.duration_seconds).toBeLessThan(walk.duration_seconds);
      // Driving duration should be reasonable
      expect(drive.duration_seconds).toBeLessThan(walk.duration_seconds);
      // Distance accounts for road tortuosity (> straight line)
      expect(walk.distance_meters).toBeGreaterThan(2200);

      // Flight calculation for long distance (Kyoto to Tokyo ~370 km)
      const flight = calculateTransitBetweenPoints(kyotoStation, tokyoStation, 'flight');
      expect(flight.duration_seconds).toBeGreaterThan(5400); // Airport buffer + flight
      expect(flight.distance_meters).toBeGreaterThan(350000);
    });

    it('recalculates day transit legs between sequential stops', async () => {
      const legs = await recalculateDayTransitLegs(db, tripId, 'day-1', 'walking');
      // Day 1 has 2 seeded stops (Fushimi Inari and Ichiran)
      expect(legs.length).toBe(1);
      expect(legs[0].from_stop_id).toBe('stop-fushimi');
      expect(legs[0].to_stop_id).toBe('stop-ichiran-d1');
      expect(legs[0].duration_seconds).toBeGreaterThan(0);
      expect(legs[0].distance_meters).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // 4. Itinerary Stop CRUD, Moving, Reordering & Voting
  // ==========================================================================
  describe('Stop Management Service', () => {
    it('adds a new stop with opening hours validation and auto-updates transit legs', async () => {
      const result = await addTripStop(db, tripId, {
        day_number: 1,
        section_type: 'afternoon',
        place: {
          name: 'Nishiki Market',
          formatted_address: 'Nakagyo Ward, Kyoto',
          lat: 35.005,
          lng: 135.7649,
          category: 'shopping',
        },
        arrival_time: '14:30',
        duration_minutes: 90,
      });

      expect(result.id).toBeDefined();
      expect(result.place.name).toBe('Nishiki Market');
      expect(result.sort_order).toBe(2);

      // Check transit legs auto-updated on Day 1 (now 3 stops: Fushimi -> Ichiran -> Nishiki = 2 legs)
      const legs = await db.query<TransitLeg>('SELECT * FROM transit_legs WHERE trip_id = ?', [
        tripId,
      ]);
      const day1Legs = legs.filter(
        (l) => l.from_stop_id === 'stop-ichiran-d1' && l.to_stop_id === result.id
      );
      expect(day1Legs.length).toBe(1);
    });

    it('returns a self-healing warning when adding a stop on a day the venue is closed', async () => {
      // Day 2 date is 2026-11-02 (Monday). Nishiki Market is closed on Mondays!
      const result = await addTripStop(db, tripId, {
        day_number: 2,
        section_type: 'morning',
        place: {
          name: 'Nishiki Market',
        },
      });

      expect(result.warning).toBeDefined();
      expect(result.warning?.isValid).toBe(false);
      expect(result.warning?.warning).toContain('closed on Mondays');
      expect(result.warning?.suggested_alternatives?.length).toBeGreaterThan(0);
    });

    it('updates stop details, timings, and locks', async () => {
      const updated = await updateTripStop(db, tripId, 'stop-fushimi', {
        arrival_time: '08:00',
        departure_time: '10:30',
        duration_minutes: 150,
        user_notes: 'Wear comfortable hiking shoes!',
        is_locked: true,
        custom_title: 'Mount Inari Sunrise Hike',
        pin_color: '#FF4500',
      });

      expect(updated.arrival_time).toBe('08:00');
      expect(updated.departure_time).toBe('10:30');
      expect(updated.user_notes).toBe('Wear comfortable hiking shoes!');
      expect(updated.is_locked).toBe(1);
      expect(updated.custom_title).toBe('Mount Inari Sunrise Hike');
    });

    it('moves a stop across sections and recalculates transit legs', async () => {
      // Move stop-ichiran-d1 from day 1 afternoon to day 2 afternoon
      const targetSec = await db.queryOne<Section>(
        'SELECT id FROM sections WHERE day_id = ? AND section_type = ?',
        ['day-2', 'afternoon']
      );
      expect(targetSec).toBeDefined();

      const moved = await moveTripStop(db, tripId, 'stop-ichiran-d1', {
        target_section_id: targetSec!.id,
        target_index: 0,
      });

      expect(moved.section_id).toBe(targetSec!.id);
      expect(moved.sort_order).toBe(1);

      // Verify source day (day-1) transit legs were updated (now only 1 stop on day-1, 0 legs)
      const day1Legs = await db.query<TransitLeg>(
        'SELECT * FROM transit_legs WHERE from_stop_id = ? OR to_stop_id = ?',
        ['stop-fushimi', 'stop-fushimi']
      );
      expect(day1Legs.length).toBe(0);
    });

    it('deletes a stop, cleans up legs and votes, and updates transit legs', async () => {
      const del = await deleteTripStop(db, tripId, 'stop-fushimi');
      expect(del.success).toBe(true);

      const check = await db.queryOne('SELECT * FROM stops WHERE id = ?', ['stop-fushimi']);
      expect(check).toBeNull();

      // Votes should be deleted
      const votes = await db.query('SELECT * FROM stop_votes WHERE stop_id = ?', ['stop-fushimi']);
      expect(votes.length).toBe(0);
    });

    it('records collaborator up/down votes on stops and tallies counts', async () => {
      const vote1 = await voteOnStop(db, tripId, 'stop-arashiyama', {
        collaborator_name: 'Alice Chen',
        vote: 'up',
      });
      expect(vote1.up).toBeGreaterThanOrEqual(1);

      const vote2 = await voteOnStop(db, tripId, 'stop-arashiyama', {
        collaborator_name: 'Bob Smith',
        vote: 'down',
      });
      expect(vote2.down).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // 5. TSP Daily Route Optimizer
  // ==========================================================================
  describe('TSP Daily Route Optimizer (Nearest-Neighbor + 2-Opt)', () => {
    beforeEach(async () => {
      // Add 3 more stops to Day 2 in scattered geographical order
      // Day 2 already has: stop-arashiyama (Arashiyama, west) and stop-tenryu (Tenryu-ji, west)
      // Add Kinkaku-ji (north), Fushimi (south), Kiyomizu (east) in deliberately scrambled order
      await addTripStop(db, tripId, {
        day_number: 2,
        section_type: 'morning',
        place_id: 'place-kinkaku',
      });
      await addTripStop(db, tripId, {
        day_number: 2,
        section_type: 'afternoon',
        place_id: 'place-fushimi',
      });
      await addTripStop(db, tripId, {
        day_number: 2,
        section_type: 'evening',
        place_id: 'place-kiyomizu',
      });
    });

    it('optimizes daily stops tour guaranteeing duration <= original duration', async () => {
      const res = await optimizeDayRoute(db, tripId, 2, {
        transit_mode: 'driving',
      });

      expect(res.day_number).toBe(2);
      expect(res.reordered_stops.length).toBe(5);
      expect(res.optimized_duration_seconds).toBeLessThanOrEqual(res.original_duration_seconds);
      expect(res.time_saved_minutes).toBeGreaterThanOrEqual(0);

      // Verify transit legs were recalculated
      const legs = await db.query<TransitLeg>(
        'SELECT * FROM transit_legs WHERE trip_id = ? ORDER BY departure_time ASC',
        [tripId]
      );
      expect(legs.length).toBeGreaterThanOrEqual(4);
    });

    it('respects fixed_start_stop_id constraint', async () => {
      const res = await optimizeDayRoute(db, tripId, 2, {
        fixed_start_stop_id: 'stop-arashiyama',
        transit_mode: 'driving',
      });

      expect(res.reordered_stops[0].id).toBe('stop-arashiyama');
    });

    it('respects fixed_end_stop_id constraint', async () => {
      const res = await optimizeDayRoute(db, tripId, 2, {
        fixed_end_stop_id: 'stop-tenryu',
        transit_mode: 'driving',
      });

      const lastStop = res.reordered_stops[res.reordered_stops.length - 1];
      expect(lastStop.id).toBe('stop-tenryu');
    });

    it('preserves locked stops in route optimization', async () => {
      // Lock stop-tenryu
      await updateTripStop(db, tripId, 'stop-tenryu', { is_locked: true });

      const res = await optimizeDayRoute(db, tripId, 2, {
        transit_mode: 'driving',
      });

      expect(res.optimized_duration_seconds).toBeLessThanOrEqual(res.original_duration_seconds);
    });
  });

  // ==========================================================================
  // 6. Astro REST API Routes Integration
  // ==========================================================================
  describe('Astro REST API Endpoints', () => {
    it('GET /api/v1/places/search returns candidate places and rejects missing queries', async () => {
      // Missing query -> 400
      const badReq = new Request('http://localhost/api/v1/places/search');
      const badRes = await (searchPlacesApi as any)({ request: badReq, locals: {} });
      expect(badRes.status).toBe(400);

      // Valid search -> 200
      const goodReq = new Request('http://localhost/api/v1/places/search?q=inari&city=Kyoto');
      const goodRes = await (searchPlacesApi as any)({ request: goodReq, locals: {} });
      expect(goodRes.status).toBe(200);
      const data = await goodRes.json();
      expect(data.length).toBeGreaterThan(0);
      expect(data[0].name).toContain('Inari');
    });

    it('POST /api/v1/trips/:tripId/stops creates a stop with 201', async () => {
      const req = new Request(`http://localhost/api/v1/trips/${tripId}/stops`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_number: 1,
          section_type: 'evening',
          place: {
            name: 'Gion District',
            formatted_address: 'Higashiyama Ward, Kyoto',
            lat: 35.0037,
            lng: 135.7772,
          },
        }),
      });

      const res = await (addStopApi as any)({
        request: req,
        params: { tripId },
        locals: {},
      });

      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.id).toBeDefined();
      expect(data.place.name).toBe('Gion District');
    });

    it('PATCH & DELETE /api/v1/trips/:tripId/stops/:stopId', async () => {
      // PATCH update
      const patchReq = new Request(
        `http://localhost/api/v1/trips/${tripId}/stops/stop-fushimi`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration_minutes: 180 }),
        }
      );
      const patchRes = await (updateStopApi as any)({
        request: patchReq,
        params: { tripId, stopId: 'stop-fushimi' },
        locals: {},
      });
      expect(patchRes.status).toBe(200);
      const patched = await patchRes.json();
      expect(patched.duration_minutes).toBe(180);

      // DELETE
      const delRes = await (deleteStopApi as any)({
        params: { tripId, stopId: 'stop-fushimi' },
        locals: {},
      });
      expect(delRes.status).toBe(200);
    });

    it('POST /api/v1/trips/:tripId/stops/:stopId/move reorders stops', async () => {
      const sec = await db.queryOne<Section>(
        'SELECT id FROM sections WHERE day_id = ? AND section_type = ?',
        ['day-2', 'morning']
      );

      const req = new Request(
        `http://localhost/api/v1/trips/${tripId}/stops/stop-arashiyama/move`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            target_section_id: sec!.id,
            target_index: 0,
          }),
        }
      );

      const res = await (moveStopApi as any)({
        request: req,
        params: { tripId, stopId: 'stop-arashiyama' },
        locals: {},
      });
      expect(res.status).toBe(200);
    });

    it('POST /api/v1/trips/:tripId/stops/:stopId/vote votes on a stop', async () => {
      const req = new Request(
        `http://localhost/api/v1/trips/${tripId}/stops/stop-arashiyama/vote`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collaborator_name: 'Alice Chen',
            vote: 1,
          }),
        }
      );

      const res = await (voteStopApi as any)({
        request: req,
        params: { tripId, stopId: 'stop-arashiyama' },
        locals: {},
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.up).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/v1/trips/:tripId/days/:dayNumber/optimize-route triggers TSP route optimization', async () => {
      const req = new Request(
        `http://localhost/api/v1/trips/${tripId}/days/1/optimize-route`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transit_mode: 'walking',
          }),
        }
      );

      const res = await (optimizeRouteApi as any)({
        request: req,
        params: { tripId, dayNumber: '1' },
        locals: {},
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.day_number).toBe(1);
      expect(data.optimized_duration_seconds).toBeLessThanOrEqual(data.original_duration_seconds);
    });
  });
});
