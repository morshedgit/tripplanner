import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, setTestDb, type DatabaseAdapter } from '../src/db/client';
import {
  exportTripMarkdown,
  exportTripIcs,
  exportExpensesCsv,
} from '../src/services/exportService';
import { GET as getPluginManifest } from '../src/pages/.well-known/ai-plugin.json';
import { GET as getOpenApiSpec } from '../src/pages/api/v1/openapi.json';
import { GET as getMarkdownExport } from '../src/pages/api/v1/trips/[tripId]/export/markdown';
import { GET as getIcsExport } from '../src/pages/api/v1/trips/[tripId]/export/ics';
import { GET as getExpensesCsvExport } from '../src/pages/api/v1/trips/[tripId]/export/expenses.csv';

describe('Issue #5: ChatGPT Plugin Manifest, OpenAPI 3.1 Spec & Multi-Format Export', () => {
  let db: DatabaseAdapter;

  beforeAll(async () => {
    // Initialize in-memory test database seeded with Kyoto Autumn Expedition trip
    db = await createTestDb(true);
    setTestDb(db);
  });

  afterAll(() => {
    setTestDb(null);
  });

  // ==========================================================================
  // 1. ChatGPT Plugin Manifest (GET /.well-known/ai-plugin.json)
  // ==========================================================================
  describe('ChatGPT Plugin Manifest (/.well-known/ai-plugin.json)', () => {
    it('returns a valid JSON manifest adhering to OpenAI ChatGPT plugin schema v1', async () => {
      const mockRequest = new Request('https://tripplanner.example.com/.well-known/ai-plugin.json');
      const response = await getPluginManifest({ request: mockRequest } as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');

      const manifest = await response.json();
      expect(manifest.schema_version).toBe('v1');
      expect(manifest.name_for_human).toBe('TripPlanner');
      expect(manifest.name_for_model).toBe('tripplanner');
      expect(manifest.description_for_human).toBeTruthy();
      expect(manifest.description_for_model).toBeTruthy();
      expect(manifest.auth.type).toBe('none');

      // Verifies origin was dynamically resolved
      expect(manifest.api.type).toBe('openapi');
      expect(manifest.api.url).toBe('https://tripplanner.example.com/api/v1/openapi.json');
      expect(manifest.logo_url).toBe('https://tripplanner.example.com/logo.png');
      expect(manifest.contact_email).toBe('support@tripplanner.dev');
      expect(manifest.legal_info_url).toBe('https://tripplanner.example.com/legal');
    });
  });

  // ==========================================================================
  // 2. OpenAPI 3.1.0 Specification (GET /api/v1/openapi.json)
  // ==========================================================================
  describe('OpenAPI 3.1.0 Specification (/api/v1/openapi.json)', () => {
    it('returns valid OpenAPI 3.1.0 specification with all required operationIds', async () => {
      const mockRequest = new Request('https://tripplanner.example.com/api/v1/openapi.json');
      const response = await getOpenApiSpec({ request: mockRequest } as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('application/json');

      const spec = await response.json();
      expect(spec.openapi).toBe('3.1.0');
      expect(spec.info.title).toBe('TripPlanner API');
      expect(spec.info.version).toBe('1.0.0');

      // Verify server origin resolution
      expect(spec.servers).toHaveLength(1);
      expect(spec.servers[0].url).toBe('https://tripplanner.example.com');

      // Extract all operationIds defined across paths
      const operationIds: string[] = [];
      for (const pathKey of Object.keys(spec.paths)) {
        const pathItem = spec.paths[pathKey];
        for (const method of ['get', 'post', 'patch', 'delete', 'put']) {
          if (pathItem[method]?.operationId) {
            operationIds.push(pathItem[method].operationId);
          }
        }
      }

      // Check required operationIds
      const requiredOperationIds = [
        'listTrips',
        'createTrip',
        'getTrip',
        'getTripSummary',
        'getTripDay',
        'createTripSection',
        'searchPlaces',
        'addTripStop',
        'updateTripStop',
        'moveTripStop',
        'deleteTripStop',
        'optimizeDayRoute',
        'listReservations',
        'createReservation',
        'listExpenses',
        'createExpense',
        'getBudgetSettlement',
        'addChecklistItem',
        'exportItineraryMarkdown',
        'exportItineraryIcs',
        'exportExpensesCsv',
        'sendChatMessage',
      ];

      for (const opId of requiredOperationIds) {
        expect(operationIds, `Missing required operationId: ${opId}`).toContain(opId);
      }

      // Check core schemas in components
      expect(spec.components.schemas).toBeDefined();
      expect(spec.components.schemas.Trip).toBeDefined();
      expect(spec.components.schemas.TripSummary).toBeDefined();
      expect(spec.components.schemas.DaySchedule).toBeDefined();
      expect(spec.components.schemas.Section).toBeDefined();
      expect(spec.components.schemas.Place).toBeDefined();
      expect(spec.components.schemas.StopDetail).toBeDefined();
      expect(spec.components.schemas.Reservation).toBeDefined();
      expect(spec.components.schemas.Expense).toBeDefined();
      expect(spec.components.schemas.BudgetSettlement).toBeDefined();
      expect(spec.components.schemas.ProblemDetails).toBeDefined();
    });
  });

  // ==========================================================================
  // 3. Markdown Export (exportTripMarkdown)
  // ==========================================================================
  describe('Markdown Export (exportTripMarkdown)', () => {
    it('generates a rich Wanderlog-style Markdown trip guide with all entities', async () => {
      const markdown = await exportTripMarkdown(db, 'trip-kyoto-2026');

      expect(typeof markdown).toBe('string');

      // Header and metadata
      expect(markdown).toContain('# 5-Day Kyoto Autumn Expedition');
      expect(markdown).toContain('**Destination:** Kyoto, Japan');
      expect(markdown).toContain('**Dates:** 2026-11-01 to 2026-11-05');
      expect(markdown).toContain('**Timezone:** Asia/Tokyo');
      expect(markdown).toContain('**Currency:** USD');
      expect(markdown).toContain('**Budget Cap:** $2500.00 USD');

      // Collaborators
      expect(markdown).toContain('## Collaborators');
      expect(markdown).toContain('**Alice Chen** (owner)');
      expect(markdown).toContain('**Bob Smith** (editor)');

      // Travel Notes
      expect(markdown).toContain('## Travel Notes & Tips');
      expect(markdown).toContain('### Kyoto Travel Tips & Etiquette');
      expect(markdown).toContain('IC Cards: Use Suica / Pasmo / ICOCA');

      // Itinerary Days and Sections
      expect(markdown).toContain('## Itinerary');
      expect(markdown).toContain('### Day 1: 2026-11-01');
      expect(markdown).toContain('### Day 2: 2026-11-02');
      expect(markdown).toContain('### Day 3: 2026-11-03');
      expect(markdown).toContain('### Day 4: 2026-11-04');
      expect(markdown).toContain('### Day 5: 2026-11-05');

      // Stops and Places
      expect(markdown).toContain('Fushimi Inari Taisha');
      expect(markdown).toContain('Arashiyama Bamboo Grove');
      expect(markdown).toContain('Tenryu-ji');
      expect(markdown).toContain('Nishiki Market');
      expect(markdown).toContain('Kiyomizu-dera');
      expect(markdown).toContain('Kinkaku-ji');

      // Stop timings and details
      expect(markdown).toContain('09:00 – 11:30');
      expect(markdown).toContain('⭐ 4.8 / 5.0');
      expect(markdown).toContain('Start early to beat the tour buses');

      // Transit legs
      expect(markdown).toContain('🚗 **Transit to next:** Transit · ~20 min (4.5 km)');
      expect(markdown).toContain('Take Keihan Main Line from Fushimi-Inari Station');

      // Reservations
      expect(markdown).toContain('## Reservations');
      expect(markdown).toContain('ANA Flight NH 123');
      expect(markdown).toContain('The Pocket Hotel Kyoto Karasuma');
      expect(markdown).toContain('`NH-78291`');

      // Checklists
      expect(markdown).toContain('## Checklists');
      expect(markdown).toContain('### Pre-trip Checklist (todo)');
      expect(markdown).toContain('- [x] Book JR Rail Pass or Kansai Thru Pass');
      expect(markdown).toContain('- [ ] Get Pocket Wi-Fi or Japan eSIM *(Assigned to: Bob Smith)*');
      expect(markdown).toContain('### Packing Essentials (packing)');

      // Expenses
      expect(markdown).toContain('## Expenses & Budget');
      expect(markdown).toContain('The Pocket Hotel 4 Nights');
      expect(markdown).toContain('Shinkansen Bullet Train Tickets');
      expect(markdown).toContain('**Total Expenses:** $760.00 USD');
      expect(markdown).toContain('**Remaining Budget:** $1740.00 USD');
    });

    it('throws error when exporting non-existent trip', async () => {
      await expect(exportTripMarkdown(db, 'non-existent-trip')).rejects.toThrow('Trip not found');
    });
  });

  // ==========================================================================
  // 4. iCalendar RFC 5545 Export (exportTripIcs)
  // ==========================================================================
  describe('iCalendar RFC 5545 Export (exportTripIcs)', () => {
    it('generates a standards-compliant RFC 5545 calendar feed with stops and reservations', async () => {
      const ics = await exportTripIcs(db, 'trip-kyoto-2026');

      expect(typeof ics).toBe('string');
      expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
      expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);

      // Calendar Envelope
      expect(ics).toContain('VERSION:2.0\r\n');
      expect(ics).toContain('PRODID:-//TripPlanner//TripPlanner Itinerary RFC5545//EN\r\n');
      expect(ics).toContain('CALSCALE:GREGORIAN\r\n');
      expect(ics).toContain('METHOD:PUBLISH\r\n');
      expect(ics).toContain('X-WR-CALNAME:5-Day Kyoto Autumn Expedition\r\n');
      expect(ics).toContain('X-WR-TIMEZONE:Asia/Tokyo\r\n');

      // Scheduled Stops
      expect(ics).toContain('UID:stop-stop-fushimi@tripplanner.dev\r\n');
      expect(ics).toContain('SUMMARY:Fushimi Inari Taisha\r\n');
      expect(ics).toContain('DTSTART;TZID=Asia/Tokyo:20261101T090000\r\n');
      expect(ics).toContain('DTEND;TZID=Asia/Tokyo:20261101T113000\r\n');
      expect(ics).toContain('LOCATION:68 Fukakusa Yabunouchicho\\, Fushimi Ward\\, Kyoto\\, 612-0882\r\n');

      // More stops
      expect(ics).toContain('UID:stop-stop-arashiyama@tripplanner.dev\r\n');
      expect(ics).toContain('SUMMARY:Arashiyama Bamboo Grove\r\n');
      expect(ics).toContain('DTSTART;TZID=Asia/Tokyo:20261102T083000\r\n');

      // Reservations
      expect(ics).toContain('UID:res-res-flight-ana@tripplanner.dev\r\n');
      expect(ics).toContain('SUMMARY:[FLIGHT] ANA Flight NH 123 (HND -> ITM) (All Nippon Airways)\r\n');
      expect(ics).toContain('UID:res-res-hotel-pocket@tripplanner.dev\r\n');
      expect(ics).toContain('SUMMARY:[LODGING] The Pocket Hotel Kyoto Karasuma (The Pocket Hotel)\r\n');
      expect(ics).toContain('LOCATION:Shimogyo Ward\\, Kyoto\r\n');

      // Verify CRLF compliance throughout
      const lines = ics.split('\r\n');
      expect(lines.length).toBeGreaterThan(30);
      for (const line of lines) {
        expect(line.includes('\n')).toBe(false);
      }
    });

    it('throws error when exporting non-existent trip', async () => {
      await expect(exportTripIcs(db, 'non-existent-trip')).rejects.toThrow('Trip not found');
    });
  });

  // ==========================================================================
  // 5. CSV Expense Export (exportExpensesCsv)
  // ==========================================================================
  describe('CSV Expense Export (exportExpensesCsv)', () => {
    it('generates properly formatted and escaped CSV expense report', async () => {
      const csv = await exportExpensesCsv(db, 'trip-kyoto-2026');

      expect(typeof csv).toBe('string');
      const lines = csv.split('\r\n').filter((l) => l.length > 0);

      // Check header
      expect(lines[0]).toBe(
        'Date,Description,Category,Amount,Currency,ConvertedBaseAmount,BaseCurrency,PaidBy,SplitStrategy'
      );

      // Check rows
      expect(lines).toHaveLength(3); // Header + 2 seeded expenses
      expect(lines[1]).toContain('2026-11-01,The Pocket Hotel 4 Nights,lodging,600.00,USD,600.00,USD,Alice Chen,equal');
      expect(lines[2]).toContain('2026-11-01,Shinkansen Bullet Train Tickets,transport,160.00,USD,160.00,USD,Bob Smith,equal');
    });

    it('escapes cells containing commas, quotes, or special characters in CSV', async () => {
      // Insert an expense with quotes and commas
      await db.execute(
        `INSERT INTO expenses (id, trip_id, paid_by_collaborator_id, title, amount, currency, category, date, split_strategy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'exp-special',
          'trip-kyoto-2026',
          'collab-alice',
          'Snacks, "Matcha" Ice Cream & Sweets',
          25.5,
          'USD',
          'food',
          '2026-11-02',
          'equal',
        ]
      );

      const csv = await exportExpensesCsv(db, 'trip-kyoto-2026');
      expect(csv).toContain('"Snacks, ""Matcha"" Ice Cream & Sweets"');
    });

    it('throws error when exporting non-existent trip', async () => {
      await expect(exportExpensesCsv(db, 'non-existent-trip')).rejects.toThrow('Trip not found');
    });
  });

  // ==========================================================================
  // 6. Astro Export API Route Handlers
  // ==========================================================================
  describe('Astro Export API Route Handlers', () => {
    it('GET /api/v1/trips/[tripId]/export/markdown returns text/markdown with attachment header', async () => {
      const response = await getMarkdownExport({
        params: { tripId: 'trip-kyoto-2026' },
        request: new Request('http://localhost:4321/api/v1/trips/trip-kyoto-2026/export/markdown'),
        locals: {},
      } as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/markdown');
      expect(response.headers.get('Content-Disposition')).toContain('attachment; filename="trip-kyoto-2026-itinerary.md"');

      const body = await response.text();
      expect(body).toContain('# 5-Day Kyoto Autumn Expedition');
    });

    it('GET /api/v1/trips/[tripId]/export/markdown returns 404 Problem Details for missing trip', async () => {
      const response = await getMarkdownExport({
        params: { tripId: 'non-existent' },
        request: new Request('http://localhost:4321/api/v1/trips/non-existent/export/markdown'),
        locals: {},
      } as any);

      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Type')).toContain('application/problem+json');
      const problem = await response.json();
      expect(problem.status).toBe(404);
      expect(problem.code).toBe('TRIP_NOT_FOUND');
    });

    it('GET /api/v1/trips/[tripId]/export/ics returns text/calendar with attachment header', async () => {
      const response = await getIcsExport({
        params: { tripId: 'trip-kyoto-2026' },
        request: new Request('http://localhost:4321/api/v1/trips/trip-kyoto-2026/export/ics'),
        locals: {},
      } as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/calendar');
      expect(response.headers.get('Content-Disposition')).toContain('attachment; filename="trip-kyoto-2026-calendar.ics"');

      const body = await response.text();
      expect(body).toContain('BEGIN:VCALENDAR');
      expect(body).toContain('END:VCALENDAR');
    });

    it('GET /api/v1/trips/[tripId]/export/ics returns 404 Problem Details for missing trip', async () => {
      const response = await getIcsExport({
        params: { tripId: 'non-existent' },
        request: new Request('http://localhost:4321/api/v1/trips/non-existent/export/ics'),
        locals: {},
      } as any);

      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Type')).toContain('application/problem+json');
    });

    it('GET /api/v1/trips/[tripId]/export/expenses.csv returns text/csv with attachment header', async () => {
      const response = await getExpensesCsvExport({
        params: { tripId: 'trip-kyoto-2026' },
        request: new Request('http://localhost:4321/api/v1/trips/trip-kyoto-2026/export/expenses.csv'),
        locals: {},
      } as any);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toContain('text/csv');
      expect(response.headers.get('Content-Disposition')).toContain('attachment; filename="trip-kyoto-2026-expenses.csv"');

      const body = await response.text();
      expect(body).toContain('Date,Description,Category,Amount,Currency,ConvertedBaseAmount,BaseCurrency,PaidBy,SplitStrategy');
    });

    it('GET /api/v1/trips/[tripId]/export/expenses.csv returns 404 Problem Details for missing trip', async () => {
      const response = await getExpensesCsvExport({
        params: { tripId: 'non-existent' },
        request: new Request('http://localhost:4321/api/v1/trips/non-existent/export/expenses.csv'),
        locals: {},
      } as any);

      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Type')).toContain('application/problem+json');
    });
  });
});
