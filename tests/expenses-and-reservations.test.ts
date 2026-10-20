import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, setTestDb, type DatabaseAdapter } from '../src/db/client';
import {
  listReservations,
  createReservation,
  updateReservation,
  deleteReservation,
  parseReservationFromEmailText,
  normalizeReservationType,
} from '../src/services/reservationService';
import {
  convertCurrency,
  listExpenses,
  createExpense,
  deleteExpense,
  getBudgetSettlement,
  simplifyDebts,
  normalizeExpenseCategory,
  FX_RATES_TO_USD,
} from '../src/services/expenseService';
import { GET as getReservationsRoute, POST as postReservationRoute } from '../src/pages/api/v1/trips/[tripId]/reservations/index';
import { PATCH as patchReservationRoute, DELETE as deleteReservationRoute } from '../src/pages/api/v1/trips/[tripId]/reservations/[reservationId]';
import { GET as getExpensesRoute, POST as postExpenseRoute, DELETE as deleteExpenseRoute } from '../src/pages/api/v1/trips/[tripId]/expenses/index';
import { GET as getBudgetSettleUpRoute } from '../src/pages/api/v1/trips/[tripId]/budget/settle-up';

describe('Issue #4: Reservations Ledger, Multi-Currency Expenses & Splitwise Debt Settlement', () => {
  let db: DatabaseAdapter;
  const TRIP_ID = 'trip-kyoto-2026';

  beforeEach(async () => {
    // Isolated in-memory SQLite database seeded with Kyoto expedition
    db = await createTestDb(true);
    setTestDb(db);
  });

  // ==========================================================================
  // 1. Reservation Ledger CRUD
  // ==========================================================================
  describe('Reservations Ledger CRUD', () => {
    it('creates and lists reservations with normalized types', async () => {
      const flight = await createReservation(db, TRIP_ID, {
        type: 'FLIGHT',
        title: 'United Airlines SFO -> KIX',
        confirmation_code: 'UA9988',
        provider: 'United Airlines',
        start_time: '2026-11-01T10:30:00Z',
        end_time: '2026-11-01T22:30:00Z',
        location: 'Kansai International Airport',
        cost: 950.0,
        currency: 'USD',
        notes: 'Seat 14A',
        auto_create_stops: false,
      });

      expect(flight.id).toMatch(/^res-/);
      expect(flight.type).toBe('flight');
      expect(flight.title).toBe('United Airlines SFO -> KIX');
      expect(flight.cost).toBe(950.0);
      expect(flight.confirmation_code).toBe('UA9988');

      const all = await listReservations(db, TRIP_ID);
      // The seeded trip already has 2 reservations, plus this new one
      expect(all.length).toBeGreaterThanOrEqual(3);

      const flights = await listReservations(db, TRIP_ID, 'flight');
      expect(flights.some((r) => r.id === flight.id)).toBe(true);

      const lodgings = await listReservations(db, TRIP_ID, 'LODGING');
      expect(lodgings.every((r) => r.type === 'lodging')).toBe(true);
    });

    it('updates reservation fields cleanly', async () => {
      const created = await createReservation(db, TRIP_ID, {
        type: 'restaurant',
        title: 'Kitcho Arashiyama Kaiseki Dinner',
        start_time: '2026-11-03T19:00:00Z',
        cost: 400.0,
        currency: 'USD',
        auto_create_stops: false,
      });

      const updated = await updateReservation(db, TRIP_ID, created.id, {
        cost: 450.0,
        confirmation_code: 'KITCHO-776',
        notes: 'Table by the garden confirmed',
      });

      expect(updated).not.toBeNull();
      expect(updated?.cost).toBe(450.0);
      expect(updated?.confirmation_code).toBe('KITCHO-776');
      expect(updated?.notes).toBe('Table by the garden confirmed');
    });

    it('deletes reservation by ID', async () => {
      const created = await createReservation(db, TRIP_ID, {
        type: 'activity',
        title: 'Sagano Romantic Train Tour',
        start_time: '2026-11-02T14:00:00Z',
        cost: 50.0,
        auto_create_stops: false,
      });

      const deleted = await deleteReservation(db, TRIP_ID, created.id);
      expect(deleted).toBe(true);

      const check = await db.queryOne('SELECT * FROM reservations WHERE id = ?', [created.id]);
      expect(check).toBeNull();
    });

    it('normalizes various type strings to domain schema values', () => {
      expect(normalizeReservationType('FLIGHT')).toBe('flight');
      expect(normalizeReservationType('hotel')).toBe('lodging');
      expect(normalizeReservationType('LODGING')).toBe('lodging');
      expect(normalizeReservationType('car_rental')).toBe('rental_car');
      expect(normalizeReservationType('CAR_RENTAL')).toBe('rental_car');
      expect(normalizeReservationType('dining')).toBe('restaurant');
      expect(normalizeReservationType('tour')).toBe('activity');
      expect(normalizeReservationType('TRAIN')).toBe('other');
    });
  });

  // ==========================================================================
  // 2. Auto-Stop Creation for Reservations
  // ==========================================================================
  describe('Auto-Stop Creation for Reservations', () => {
    it('automatically creates arrival / check-in stops in the matching trip day', async () => {
      // 2026-11-01 is Day 1 in the seeded Kyoto Expedition trip
      const lodging = await createReservation(db, TRIP_ID, {
        type: 'lodging',
        title: 'Hoshinoya Kyoto Luxury Ryokan',
        confirmation_code: 'HOSH-2026',
        provider: 'Hoshinoya',
        start_time: '2026-11-01T15:00:00Z',
        end_time: '2026-11-05T11:00:00Z',
        location: 'Arashiyama, Kyoto',
        cost: 1600.0,
        currency: 'USD',
        auto_create_stops: true,
      });

      // Check if a stop was created for check-in on 2026-11-01
      const stops = await db.query<any>(
        `SELECT s.*, p.name as place_name, sec.section_type
         FROM stops s
         JOIN places p ON s.place_id = p.id
         JOIN sections sec ON s.section_id = sec.id
         JOIN days d ON sec.day_id = d.id
         WHERE d.trip_id = ? AND d.date = '2026-11-01' AND p.name = ?`,
        [TRIP_ID, 'Hoshinoya Kyoto Luxury Ryokan']
      );

      expect(stops.length).toBeGreaterThanOrEqual(1);
      const checkinStop = stops[0];
      expect(checkinStop.user_notes).toContain('HOSH-2026');
      expect(checkinStop.budget_amount).toBe(1600.0);

      // Check if a check-out stop was created on 2026-11-05 (Day 5)
      const checkoutStops = await db.query<any>(
        `SELECT s.*, p.name as place_name
         FROM stops s
         JOIN places p ON s.place_id = p.id
         JOIN sections sec ON s.section_id = sec.id
         JOIN days d ON sec.day_id = d.id
         WHERE d.trip_id = ? AND d.date = '2026-11-05' AND p.name = ?`,
        [TRIP_ID, 'Hoshinoya Kyoto Luxury Ryokan']
      );

      expect(checkoutStops.length).toBeGreaterThanOrEqual(1);
      expect(checkoutStops[0].user_notes).toContain('Check-out');
    });

    it('does NOT create stops when auto_create_stops is false', async () => {
      const stopCountBefore = (await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM stops'))!.count;

      await createReservation(db, TRIP_ID, {
        type: 'flight',
        title: 'Secret Standby Flight',
        start_time: '2026-11-01T08:00:00Z',
        cost: 300,
        auto_create_stops: false,
      });

      const stopCountAfter = (await db.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM stops'))!.count;
      expect(stopCountAfter).toBe(stopCountBefore);
    });

    it('assigns realistic coordinates when auto-creating reservation stops', async () => {
      // 1. Rome test
      await createReservation(db, TRIP_ID, {
        type: 'flight',
        title: 'Flight to Rome FCO (Fiumicino)',
        location: 'Leonardo da Vinci-Fiumicino Airport',
        start_time: '2026-11-01T14:00:00Z',
        cost: 650,
        auto_create_stops: true,
      });

      const fcoPlace = await db.queryOne<any>(
        `SELECT p.* FROM places p
         JOIN stops s ON s.place_id = p.id
         WHERE s.user_notes LIKE '%Flight to Rome FCO%'`
      );
      expect(fcoPlace).not.toBeNull();
      expect(fcoPlace.lat).toBe(41.7999);
      expect(fcoPlace.lng).toBe(12.2462);

      // 2. Florence test
      await createReservation(db, TRIP_ID, {
        type: 'lodging',
        title: 'Hotel Brunelleschi Firenze',
        location: 'Florence Historic Center',
        start_time: '2026-11-02T15:00:00Z',
        cost: 450,
        auto_create_stops: true,
      });

      const florencePlace = await db.queryOne<any>(
        `SELECT p.* FROM places p
         JOIN stops s ON s.place_id = p.id
         WHERE s.user_notes LIKE '%Hotel Brunelleschi Firenze%'`
      );
      expect(florencePlace).not.toBeNull();
      expect(florencePlace.lat).toBe(43.7744);
      expect(florencePlace.lng).toBe(11.2562);

      // 3. Fallback to trip destination (Kyoto seeded trip)
      await createReservation(db, TRIP_ID, {
        type: 'activity',
        title: 'Traditional Tea Ceremony Experience',
        start_time: '2026-11-03T10:00:00Z',
        cost: 80,
        auto_create_stops: true,
      });

      const teaPlace = await db.queryOne<any>(
        `SELECT p.* FROM places p
         JOIN stops s ON s.place_id = p.id
         WHERE s.user_notes LIKE '%Traditional Tea Ceremony Experience%'`
      );
      expect(teaPlace).not.toBeNull();
      // Should resolve to Kyoto coordinates (35.0116, 135.7681) because trip destination is Kyoto
      expect(teaPlace.lat).toBe(35.0116);
      expect(teaPlace.lng).toBe(135.7681);
    });
  });

  // ==========================================================================
  // 3. Smart Email Confirmation Parsing
  // ==========================================================================
  describe('Wanderlog-Style Confirmation Email Parser', () => {
    it('parses flight confirmation text accurately', () => {
      const emailText = `
        United Airlines Booking Confirmation
        Confirmation Code: UA741X
        Flight UA 875: San Francisco (SFO) to Tokyo Haneda (HND)
        Departure: 2026-11-01T10:45:00
        Arrival: 2026-11-02T14:30:00
        Total Paid: $1,250.50 USD
        Location: San Francisco International Airport (SFO)
      `;

      const parsed = parseReservationFromEmailText(emailText);
      expect(parsed.type).toBe('flight');
      expect(parsed.provider).toBe('United Airlines');
      expect(parsed.confirmation_code).toBe('UA741X');
      expect(parsed.cost).toBe(1250.5);
      expect(parsed.currency).toBe('USD');
      expect(parsed.start_time).toContain('2026-11-01');
      expect(parsed.end_time).toContain('2026-11-02');
      expect(parsed.location).toContain('San Francisco');
    });

    it('parses hotel reservation email with Euro currency and address', () => {
      const emailText = `
        Thank you for choosing Marriott Hotels!
        Confirmation Number: MH-889922
        Hotel: Tokyo Marriott Hotel
        Address: 4-7-36 Kitashinagawa, Shinagawa-ku, Tokyo
        Check-in: 2026-11-02T15:00:00
        Check-out: 2026-11-06T11:00:00
        Total Price: €840.00 EUR
      `;

      const parsed = parseReservationFromEmailText(emailText);
      expect(parsed.type).toBe('lodging');
      expect(parsed.provider).toBe('Marriott Hotels');
      expect(parsed.confirmation_code).toBe('MH-889922');
      expect(parsed.cost).toBe(840.0);
      expect(parsed.currency).toBe('EUR');
      expect(parsed.start_time).toContain('2026-11-02');
      expect(parsed.end_time).toContain('2026-11-06');
    });

    it('parses car rental confirmation with Japanese Yen', () => {
      const emailText = `
        Hertz Car Rental Confirmation
        Reservation #: HZ-998811
        Pick-up: 2026-11-03T09:00:00
        Drop-off: 2026-11-05T18:00:00
        Location: Kyoto Station Hertz Desk
        Grand Total: ¥31,000 JPY
      `;

      const parsed = parseReservationFromEmailText(emailText);
      expect(parsed.type).toBe('rental_car');
      expect(parsed.provider).toBe('Hertz');
      expect(parsed.confirmation_code).toBe('HZ-998811');
      expect(parsed.cost).toBe(31000);
      expect(parsed.currency).toBe('JPY');
      expect(parsed.start_time).toContain('2026-11-03');
    });
  });

  // ==========================================================================
  // 4. Multi-Currency FX Rate Converter
  // ==========================================================================
  describe('Multi-Currency FX Converter', () => {
    it('converts between foreign currencies and USD correctly', () => {
      // 15,500 JPY to USD at 155.0 rate = 100.00 USD
      const usdFromJpy = convertCurrency(15500, 'JPY', 'USD');
      expect(usdFromJpy).toBe(100.0);

      // 100 USD to JPY at 155.0 rate = 15,500.00 JPY
      const jpyFromUsd = convertCurrency(100, 'USD', 'JPY');
      expect(jpyFromUsd).toBe(15500.0);

      // 92 EUR to USD at 0.92 rate = 100.00 USD
      const usdFromEur = convertCurrency(92, 'EUR', 'USD');
      expect(usdFromEur).toBe(100.0);

      // 79 GBP to USD at 0.79 rate = 100.00 USD
      const usdFromGbp = convertCurrency(79, 'GBP', 'USD');
      expect(usdFromGbp).toBe(100.0);

      // Same currency identity
      expect(convertCurrency(250.75, 'USD', 'USD')).toBe(250.75);
      expect(convertCurrency(5000, 'JPY', 'JPY')).toBe(5000.0);
    });

    it('handles cross-currency conversion (EUR to JPY)', () => {
      // 92 EUR -> 100 USD -> 15,500 JPY
      const jpyFromEur = convertCurrency(92, 'EUR', 'JPY');
      expect(jpyFromEur).toBe(15500.0);
    });
  });

  // ==========================================================================
  // 5. Expense Creation & All 4 Split Strategies
  // ==========================================================================
  describe('Expense Splitting Strategies (EQUAL, EXACT, PERCENTAGE, SHARES)', () => {
    it('splits EQUAL with exact penny rounding conservation', async () => {
      // $100 among 3 participants -> $33.34, $33.33, $33.33
      const exp = await createExpense(db, TRIP_ID, {
        title: 'Group Dinner at Pontocho Alley',
        amount: 100.0,
        currency: 'USD',
        category: 'food',
        paid_by_collaborator_name: 'Alice',
        split_strategy: 'EQUAL',
        splits: [
          { collaborator_name: 'Alice' },
          { collaborator_name: 'Bob' },
          { collaborator_name: 'Charlie' },
        ],
      });

      expect(exp.splits.length).toBe(3);
      const sumOwed = exp.splits.reduce((acc, s) => acc + s.amount_owed, 0);
      expect(Number(sumOwed.toFixed(2))).toBe(100.0);

      const amounts = exp.splits.map((s) => s.amount_owed).sort();
      expect(amounts).toEqual([33.33, 33.33, 33.34]);
    });

    it('splits EXACT by custom participant amounts', async () => {
      const exp = await createExpense(db, TRIP_ID, {
        title: 'Bullet Train Tickets to Hiroshima',
        amount: 180.0,
        currency: 'USD',
        category: 'transport',
        paid_by_collaborator_name: 'Bob',
        split_strategy: 'EXACT',
        splits: [
          { collaborator_name: 'Alice', amount: 60.0 },
          { collaborator_name: 'Bob', amount: 80.0 },
          { collaborator_name: 'Charlie', amount: 40.0 },
        ],
      });

      expect(exp.splits.length).toBe(3);
      const aliceSplit = exp.splits.find((s) => s.collaborator_name?.includes('Alice'));
      const bobSplit = exp.splits.find((s) => s.collaborator_name?.includes('Bob'));
      const charlieSplit = exp.splits.find((s) => s.collaborator_name?.includes('Charlie'));

      expect(aliceSplit?.amount_owed).toBe(60.0);
      expect(bobSplit?.amount_owed).toBe(80.0);
      expect(charlieSplit?.amount_owed).toBe(40.0);
    });

    it('splits PERCENTAGE with custom ratios', async () => {
      const exp = await createExpense(db, TRIP_ID, {
        title: 'Private Tea Ceremony Experience',
        amount: 250.0,
        currency: 'USD',
        category: 'activities',
        paid_by_collaborator_name: 'Alice',
        split_strategy: 'PERCENTAGE',
        splits: [
          { collaborator_name: 'Alice', percentage: 50.0 },
          { collaborator_name: 'Bob', percentage: 30.0 },
          { collaborator_name: 'Charlie', percentage: 20.0 },
        ],
      });

      expect(exp.splits.length).toBe(3);
      const sum = exp.splits.reduce((acc, s) => acc + s.amount_owed, 0);
      expect(Number(sum.toFixed(2))).toBe(250.0);

      const aliceSplit = exp.splits.find((s) => s.collaborator_name?.includes('Alice'));
      const bobSplit = exp.splits.find((s) => s.collaborator_name?.includes('Bob'));
      const charlieSplit = exp.splits.find((s) => s.collaborator_name?.includes('Charlie'));

      expect(aliceSplit?.amount_owed).toBe(125.0);
      expect(bobSplit?.amount_owed).toBe(75.0);
      expect(charlieSplit?.amount_owed).toBe(50.0);
    });

    it('splits SHARES proportionately', async () => {
      // 3 shares (Alice) + 2 shares (Bob) + 1 share (Charlie) = 6 shares total
      // $300 total -> $150, $100, $50
      const exp = await createExpense(db, TRIP_ID, {
        title: 'Shared Airbnb Villa Deposit',
        amount: 300.0,
        currency: 'USD',
        category: 'lodging',
        paid_by_collaborator_name: 'Charlie',
        split_strategy: 'SHARES',
        splits: [
          { collaborator_name: 'Alice', shares: 3 },
          { collaborator_name: 'Bob', shares: 2 },
          { collaborator_name: 'Charlie', shares: 1 },
        ],
      });

      expect(exp.splits.length).toBe(3);
      const sum = exp.splits.reduce((acc, s) => acc + s.amount_owed, 0);
      expect(Number(sum.toFixed(2))).toBe(300.0);

      const aliceSplit = exp.splits.find((s) => s.collaborator_name?.includes('Alice'));
      const bobSplit = exp.splits.find((s) => s.collaborator_name?.includes('Bob'));
      const charlieSplit = exp.splits.find((s) => s.collaborator_name?.includes('Charlie'));

      expect(aliceSplit?.amount_owed).toBe(150.0);
      expect(bobSplit?.amount_owed).toBe(100.0);
      expect(charlieSplit?.amount_owed).toBe(50.0);
    });

    it('auto-creates collaborator when paying or participating by name', async () => {
      await createExpense(db, TRIP_ID, {
        title: 'Souvenirs at Gion',
        amount: 45.0,
        currency: 'USD',
        category: 'shopping',
        paid_by_collaborator_name: 'Diana Prince',
        splits: [
          { collaborator_name: 'Diana Prince' },
          { collaborator_name: 'Evan Wright' },
        ],
      });

      const diana = await db.queryOne('SELECT * FROM collaborators WHERE trip_id = ? AND name = ?', [TRIP_ID, 'Diana Prince']);
      const evan = await db.queryOne('SELECT * FROM collaborators WHERE trip_id = ? AND name = ?', [TRIP_ID, 'Evan Wright']);

      expect(diana).not.toBeNull();
      expect(evan).not.toBeNull();
    });

    it('converts foreign currency expense amount to trip base currency', async () => {
      // Trip base currency is USD. Payer pays in JPY: 31,000 JPY -> 200.00 USD
      const exp = await createExpense(db, TRIP_ID, {
        title: 'Kyoto Kaiseki in JPY',
        amount: 31000.0,
        currency: 'JPY',
        category: 'food',
        paid_by_collaborator_name: 'Alice',
        splits: [{ collaborator_name: 'Alice' }, { collaborator_name: 'Bob' }],
      });

      expect(exp.currency).toBe('JPY');
      expect(exp.amount).toBe(31000.0);
      expect(exp.converted_base_amount).toBe(200.0);
      expect(exp.base_currency).toBe('USD');
    });
  });

  // ==========================================================================
  // 6. Splitwise Debt Simplification Algorithm & Settle Up
  // ==========================================================================
  describe('Splitwise Minimum-Cash-Flow Debt Simplification', () => {
    it('simplifies circular debts (Alice -> Bob -> Charlie -> Alice) to 0 transfers', () => {
      // Alice paid $30 for Bob (Bob owes Alice $30)
      // Bob paid $30 for Charlie (Charlie owes Bob $30)
      // Charlie paid $30 for Alice (Alice owes Charlie $30)
      // Net balances: Alice = 0, Bob = 0, Charlie = 0
      const balances = [
        { collaborator_id: 'c1', collaborator_name: 'Alice', paid: 30, owed: 30, net_balance: 0 },
        { collaborator_id: 'c2', collaborator_name: 'Bob', paid: 30, owed: 30, net_balance: 0 },
        { collaborator_id: 'c3', collaborator_name: 'Charlie', paid: 30, owed: 30, net_balance: 0 },
      ];

      const transfers = simplifyDebts(balances, 'USD');
      expect(transfers.length).toBe(0);
    });

    it('simplifies chain debts (Charlie -> Bob -> Alice) into a single direct transfer', () => {
      // Alice paid $60 for Bob and Charlie ($30 each)
      // Bob paid $30 for Charlie
      // Net balances:
      // Alice: paid 60, owed 0 => net +60 (creditor)
      // Bob: paid 30, owed 30 => net 0
      // Charlie: paid 0, owed 60 => net -60 (debtor)
      const balances = [
        { collaborator_id: 'c1', collaborator_name: 'Alice', paid: 60, owed: 0, net_balance: 60 },
        { collaborator_id: 'c2', collaborator_name: 'Bob', paid: 30, owed: 30, net_balance: 0 },
        { collaborator_id: 'c3', collaborator_name: 'Charlie', paid: 0, owed: 60, net_balance: -60 },
      ];

      const transfers = simplifyDebts(balances, 'USD');
      // Instead of Charlie -> Bob ($30) and Bob -> Alice ($30), Charlie pays Alice directly $60!
      expect(transfers.length).toBe(1);
      expect(transfers[0].from_collaborator_name).toBe('Charlie');
      expect(transfers[0].to_collaborator_name).toBe('Alice');
      expect(transfers[0].amount).toBe(60);
      expect(transfers[0].currency).toBe('USD');
      expect(transfers[0].from_user).toBe('Charlie');
      expect(transfers[0].to_user).toBe('Alice');
    });

    it('computes full budget settlement with cap metrics, categories, and minimal transfers', async () => {
      // Clean slate trip for isolated settlement test
      const testTripId = 'trip-settle-test';
      await db.execute(
        `INSERT INTO trips (id, title, destination, start_date, end_date, currency, budget_cap)
         VALUES (?, 'Tokyo Weekend', 'Tokyo', '2026-12-01', '2026-12-03', 'USD', 1000.0)`,
        [testTripId]
      );

      // Create 3 collaborators
      await db.execute(
        `INSERT INTO collaborators (id, trip_id, name, email, role) VALUES
         ('u1', ?, 'Alice', 'alice@test.com', 'owner'),
         ('u2', ?, 'Bob', 'bob@test.com', 'editor'),
         ('u3', ?, 'Charlie', 'charlie@test.com', 'editor')`,
        [testTripId, testTripId, testTripId]
      );

      // Expense 1: Alice pays $150 for Hotel, split equally ($50 each)
      await createExpense(db, testTripId, {
        title: 'Shinjuku Hotel',
        amount: 150.0,
        currency: 'USD',
        category: 'lodging',
        paid_by_collaborator_id: 'u1',
        split_strategy: 'EQUAL',
        splits: [{ collaborator_id: 'u1' }, { collaborator_id: 'u2' }, { collaborator_id: 'u3' }],
      });

      // Expense 2: Bob pays $90 for Sushi, split equally ($30 each)
      await createExpense(db, testTripId, {
        title: 'Tsukiji Sushi Dinner',
        amount: 90.0,
        currency: 'USD',
        category: 'food',
        paid_by_collaborator_id: 'u2',
        split_strategy: 'EQUAL',
        splits: [{ collaborator_id: 'u1' }, { collaborator_id: 'u2' }, { collaborator_id: 'u3' }],
      });

      // Expense 3: Charlie pays in JPY (15,500 JPY = $100 USD) for Transit, split equally ($33.34, $33.33, $33.33)
      await createExpense(db, testTripId, {
        title: 'Tokyo Metro Pass',
        amount: 15500.0,
        currency: 'JPY',
        category: 'transport',
        paid_by_collaborator_id: 'u3',
        split_strategy: 'EQUAL',
        splits: [{ collaborator_id: 'u1' }, { collaborator_id: 'u2' }, { collaborator_id: 'u3' }],
      });

      const settlement = await getBudgetSettlement(db, testTripId);

      // Total spending: $150 + $90 + $100 = $340.00
      expect(settlement.total_spending).toBe(340.0);
      expect(settlement.total_expenses).toBe(340.0);
      expect(settlement.budget_cap).toBe(1000.0);
      expect(settlement.budget_remaining).toBe(660.0);
      expect(settlement.budget_progress_percentage).toBe(34.0);

      // Category spending
      expect(settlement.spending_by_category.lodging).toBe(150.0);
      expect(settlement.spending_by_category.food).toBe(90.0);
      expect(settlement.spending_by_category.transport).toBe(100.0);

      // Net balances:
      // Alice: paid 150, owed 50 + 30 + 33.34 = 113.34 -> net +36.66
      // Bob: paid 90, owed 50 + 30 + 33.33 = 113.33 -> net -23.33
      // Charlie: paid 100, owed 50 + 30 + 33.33 = 113.33 -> net -13.33
      const aliceBalance = settlement.balances.find((b) => b.collaborator_name === 'Alice');
      const bobBalance = settlement.balances.find((b) => b.collaborator_name === 'Bob');
      const charlieBalance = settlement.balances.find((b) => b.collaborator_name === 'Charlie');

      expect(aliceBalance?.net_balance).toBe(36.67);
      expect(bobBalance?.net_balance).toBe(-23.33);
      expect(charlieBalance?.net_balance).toBe(-13.34);

      // Settle-up transfers:
      // Debtors: Bob ($23.33) and Charlie ($13.34). Creditor: Alice ($36.67).
      // Bob -> Alice ($23.33)
      // Charlie -> Alice ($13.34)
      expect(settlement.settlement_transfers.length).toBe(2);
      const totalTransferred = settlement.settlement_transfers.reduce((acc, t) => acc + t.amount, 0);
      expect(Number(totalTransferred.toFixed(2))).toBe(36.67);
      expect(settlement.settlement_transfers.every((t) => t.to_collaborator_name === 'Alice')).toBe(true);
    });
  });

  // ==========================================================================
  // 7. Expense Deletion
  // ==========================================================================
  describe('Expense Deletion', () => {
    it('deletes an expense and cascades removal of associated splits', async () => {
      const exp = await createExpense(db, TRIP_ID, {
        title: 'Temporary Coffee Break',
        amount: 15.0,
        paid_by_collaborator_name: 'Alice',
      });

      const deleted = await deleteExpense(db, TRIP_ID, exp.id);
      expect(deleted).toBe(true);

      const expCheck = await db.queryOne('SELECT * FROM expenses WHERE id = ?', [exp.id]);
      expect(expCheck).toBeNull();

      const splitsCheck = await db.query('SELECT * FROM expense_splits WHERE expense_id = ?', [exp.id]);
      expect(splitsCheck.length).toBe(0);
    });
  });

  // ==========================================================================
  // 8. Astro REST API Routes Integration
  // ==========================================================================
  describe('Astro REST API Routes Integration', () => {
    it('GET & POST /api/v1/trips/[tripId]/reservations', async () => {
      // POST new reservation
      const postReq = new Request(`http://localhost/api/v1/trips/${TRIP_ID}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'flight',
          title: 'JL 001 Flight to Tokyo',
          cost: 1100.0,
          currency: 'USD',
          auto_create_stops: false,
        }),
      });

      const postRes = await postReservationRoute({
        params: { tripId: TRIP_ID },
        request: postReq,
        locals: {},
      } as any);

      expect(postRes.status).toBe(201);
      const postData: any = await postRes.json();
      expect(postData.title).toBe('JL 001 Flight to Tokyo');
      expect(postData.type).toBe('flight');

      // GET reservations list
      const getRes = await getReservationsRoute({
        params: { tripId: TRIP_ID },
        url: new URL(`http://localhost/api/v1/trips/${TRIP_ID}/reservations?type=flight`),
        locals: {},
      } as any);

      expect(getRes.status).toBe(200);
      const listData: any = await getRes.json();
      expect(Array.isArray(listData)).toBe(true);
      expect(listData.some((r: any) => r.id === postData.id)).toBe(true);
    });

    it('PATCH & DELETE /api/v1/trips/[tripId]/reservations/[reservationId]', async () => {
      const created = await createReservation(db, TRIP_ID, {
        type: 'restaurant',
        title: 'Tempura Matsu Dinner',
        cost: 200,
        auto_create_stops: false,
      });

      // PATCH
      const patchReq = new Request(`http://localhost/api/v1/trips/${TRIP_ID}/reservations/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost: 260.0 }),
      });

      const patchRes = await patchReservationRoute({
        params: { tripId: TRIP_ID, reservationId: created.id },
        request: patchReq,
        locals: {},
      } as any);

      expect(patchRes.status).toBe(200);
      const patchData: any = await patchRes.json();
      expect(patchData.cost).toBe(260.0);

      // DELETE
      const deleteRes = await deleteReservationRoute({
        params: { tripId: TRIP_ID, reservationId: created.id },
        locals: {},
      } as any);

      expect(deleteRes.status).toBe(200);
      const deleteData: any = await deleteRes.json();
      expect(deleteData.success).toBe(true);
      expect(deleteData.deleted_reservation_id).toBe(created.id);
    });

    it('GET, POST & DELETE /api/v1/trips/[tripId]/expenses', async () => {
      // POST expense
      const postReq = new Request(`http://localhost/api/v1/trips/${TRIP_ID}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Gion Izakaya Night',
          amount: 120.0,
          currency: 'USD',
          category: 'food',
          paid_by_collaborator_name: 'Alice',
          split_strategy: 'EQUAL',
          splits: [{ collaborator_name: 'Alice' }, { collaborator_name: 'Bob' }],
        }),
      });

      const postRes = await postExpenseRoute({
        params: { tripId: TRIP_ID },
        request: postReq,
        locals: {},
      } as any);

      expect(postRes.status).toBe(201);
      const postData: any = await postRes.json();
      expect(postData.title).toBe('Gion Izakaya Night');
      expect(postData.splits.length).toBe(2);

      // GET expenses
      const getRes = await getExpensesRoute({
        params: { tripId: TRIP_ID },
        locals: {},
      } as any);

      expect(getRes.status).toBe(200);
      const getExpensesData: any = await getRes.json();
      expect(Array.isArray(getExpensesData)).toBe(true);
      expect(getExpensesData.some((e: any) => e.id === postData.id)).toBe(true);

      // DELETE expense
      const deleteReq = new Request(`http://localhost/api/v1/trips/${TRIP_ID}/expenses?expenseId=${postData.id}`, {
        method: 'DELETE',
      });

      const deleteRes = await deleteExpenseRoute({
        params: { tripId: TRIP_ID },
        request: deleteReq,
        url: new URL(`http://localhost/api/v1/trips/${TRIP_ID}/expenses?expenseId=${postData.id}`),
        locals: {},
      } as any);

      expect(deleteRes.status).toBe(200);
      const deleteData: any = await deleteRes.json();
      expect(deleteData.success).toBe(true);
      expect(deleteData.deleted_expense_id).toBe(postData.id);
    });

    it('GET /api/v1/trips/[tripId]/budget/settle-up', async () => {
      const settleRes = await getBudgetSettleUpRoute({
        params: { tripId: TRIP_ID },
        locals: {},
      } as any);

      expect(settleRes.status).toBe(200);
      const data: any = await settleRes.json();
      expect(data.trip_id).toBe(TRIP_ID);
      expect(data.currency).toBe('USD');
      expect(data.total_spending).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(data.balances)).toBe(true);
      expect(Array.isArray(data.settlement_transfers)).toBe(true);
    });
  });
});
