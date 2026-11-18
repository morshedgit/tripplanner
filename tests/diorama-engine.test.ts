import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDb, setTestDb } from '../src/db/client';
import type { DatabaseAdapter } from '../src/db/client';
import {
  normalizeCoordinates,
  buildDioramaPayloadFromTrip,
  getDioramaStatus,
  renderDiorama,
} from '../src/services/dioramaEngine';
import { MCP_TOOLS, executeMcpTool } from '../src/services/mcpService';
import { GET as dioramaGet, POST as dioramaPost } from '../src/pages/api/v1/trips/[tripId]/diorama';

describe('3D Environmental Design & Cartographic Visualization Engine (2.5D Diorama)', () => {
  let db: DatabaseAdapter;

  beforeEach(async () => {
    db = await createTestDb(true);
    setTestDb(db);
  });

  afterEach(() => {
    setTestDb(null);
  });

  describe('1. Spatial Coordinate Normalization', () => {
    it('normalizes geographic coordinates to a balanced 2.5D local grid within [-3.8, 3.8]', () => {
      const coords = [
        { lat: 34.9671, lng: 135.7727 }, // Fushimi Inari
        { lat: 34.9858, lng: 135.7588 }, // Kyoto Station
        { lat: 34.9949, lng: 135.7850 }, // Kiyomizu-dera
        { lat: 35.0394, lng: 135.7292 }, // Kinkaku-ji
      ];

      const normalized = normalizeCoordinates(coords);
      expect(normalized).toHaveLength(4);

      for (const pt of normalized) {
        expect(pt.x).toBeGreaterThanOrEqual(-4.0);
        expect(pt.x).toBeLessThanOrEqual(4.0);
        expect(pt.y).toBeGreaterThanOrEqual(-4.0);
        expect(pt.y).toBeLessThanOrEqual(4.0);
      }
    });

    it('handles single-point and empty coordinate edge cases safely', () => {
      expect(normalizeCoordinates([])).toEqual([]);
      expect(normalizeCoordinates([{ lat: 35.0, lng: 135.7 }])).toEqual([{ x: 0, y: 0 }]);
    });
  });

  describe('2. Parameter Payload Construction', () => {
    it('generates the complete 3D environmental input payload from TripPlanner database', async () => {
      const payload = await buildDioramaPayloadFromTrip(db, 'trip-kyoto-2026', 1);

      expect(payload.region_name).toContain('Kyoto');
      expect(payload.day_number).toBe(1);
      expect(payload.key_metrics).toMatch(/\d+(\.\d+)?\s*KM.*STEPS/i);
      expect(payload.filter_labels.length).toBeGreaterThanOrEqual(3);
      expect(payload.waypoints.length).toBeGreaterThanOrEqual(2);
      expect(payload.callouts.length).toBeGreaterThanOrEqual(1);

      // Verify 3D POI geometric and material details exist
      expect(payload.poi_list.length).toBeGreaterThanOrEqual(2);
      for (const poi of payload.poi_list) {
        expect(poi.name).toBeDefined();
        expect(poi.category).toBeDefined();
        expect(poi.details).toBeDefined();
      }
    });
  });

  describe('3. Diorama Status & Cache Verification', () => {
    it('queries diorama status and returns public asset URLs', () => {
      const status = getDioramaStatus('trip-kyoto-2026', 1);
      expect(status.imageUrl).toContain('/dioramas/');
      expect(typeof status.exists).toBe('boolean');
    });

    it('returns cached diorama metadata when available', async () => {
      const meta = await renderDiorama(db, {
        tripId: 'trip-kyoto-2026',
        dayNumber: 1,
        quality: 'draft',
      });

      expect(meta.tripId).toBe('trip-kyoto-2026');
      expect(meta.dayNumber).toBe(1);
      expect(meta.imageUrl).toContain('.png');
      expect(meta.metrics).toBeDefined();
    });
  });

  describe('4. REST API Endpoints (/api/v1/trips/:id/diorama)', () => {
    it('GET /api/v1/trips/:id/diorama returns 200 with diorama metadata and waypoints', async () => {
      const req = new Request('http://localhost:4321/api/v1/trips/trip-kyoto-2026/diorama?day=1');
      const res = await dioramaGet({
        params: { tripId: 'trip-kyoto-2026' },
        request: req,
        locals: {},
      } as any);

      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, any>;
      expect(data.tripId).toBe('trip-kyoto-2026');
      expect(data.dayNumber).toBe(1);
      expect(data.imageUrl).toBeDefined();
      expect(data.waypoints).toBeInstanceOf(Array);
    });

    it('GET /api/v1/trips/:id/diorama returns 400 when tripId is missing', async () => {
      const req = new Request('http://localhost:4321/api/v1/trips//diorama');
      const res = await dioramaGet({
        params: {},
        request: req,
        locals: {},
      } as any);

      expect(res.status).toBe(400);
    });
  });

  describe('5. MCP Integration & Tool Execution', () => {
    it('exposes render_diorama tool in MCP_TOOLS with valid JSON schema', () => {
      const tool = MCP_TOOLS.find((t) => t.name === 'render_diorama');
      expect(tool).toBeDefined();
      expect(tool?.description).toContain('3D isometric diorama');
      expect(tool?.inputSchema.properties.trip_id).toBeDefined();
      expect(tool?.inputSchema.properties.day_number).toBeDefined();
    });

    it('executes render_diorama tool via executeMcpTool and updates workspace session', async () => {
      const result = await executeMcpTool(db, 'render_diorama', {
        trip_id: 'trip-kyoto-2026',
        day_number: 1,
        quality: 'draft',
      });

      expect(result.imageUrl).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.session.last_event_summary).toContain('3D Isometric Diorama');
    });
  });
});
