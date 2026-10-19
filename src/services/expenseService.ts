import type { DatabaseAdapter } from '../db/client';
import type {
  Expense,
  ExpenseSplit,
  ExpenseCategory,
  SplitStrategy,
  Collaborator,
  Trip,
  CollaboratorBalance,
  SettlementTransfer,
  BudgetSettlement,
} from '../types/domain';
import { generateId } from '../lib/http';

/**
 * Foreign Exchange Reference Rates relative to 1 USD.
 * Formula: 1 USD = RATE units of foreign currency.
 */
export const FX_RATES_TO_USD: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,      // 1 USD = 0.92 EUR  (1 EUR ~ 1.087 USD)
  GBP: 0.79,      // 1 USD = 0.79 GBP  (1 GBP ~ 1.266 USD)
  JPY: 155.0,     // 1 USD = 155.0 JPY (155 JPY ~ 1.00 USD)
  CAD: 1.38,      // 1 USD = 1.38 CAD
  AUD: 1.52,      // 1 USD = 1.52 AUD
  CHF: 0.90,      // 1 USD = 0.90 CHF
  CNY: 7.25,      // 1 USD = 7.25 CNY
  KRW: 1380.0,    // 1 USD = 1380 KRW
  MXN: 18.5,      // 1 USD = 18.5 MXN
  SGD: 1.35,      // 1 USD = 1.35 SGD
  THB: 36.5,      // 1 USD = 36.5 THB
  INR: 83.5,      // 1 USD = 83.5 INR
  NZD: 1.65,      // 1 USD = 1.65 NZD
  BRL: 5.40,      // 1 USD = 5.40 BRL
  SEK: 10.6,      // 1 USD = 10.6 SEK
  NOK: 10.8,      // 1 USD = 10.8 NOK
  DKK: 6.85,      // 1 USD = 6.85 DKK
  HKD: 7.80,      // 1 USD = 7.80 HKD
  TWD: 32.5,      // 1 USD = 32.5 TWD
};

/**
 * Converts a monetary amount from one currency to another using reference FX rates.
 * Supports USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, KRW, MXN, SGD, THB, etc.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number {
  if (typeof amount !== 'number' || isNaN(amount)) return 0;
  const from = (fromCurrency || 'USD').trim().toUpperCase();
  const to = (toCurrency || 'USD').trim().toUpperCase();

  if (from === to) {
    return Number(amount.toFixed(2));
  }

  const rateFrom = FX_RATES_TO_USD[from] ?? 1.0;
  const rateTo = FX_RATES_TO_USD[to] ?? 1.0;

  // Convert amount -> USD -> target currency
  const amountInUsd = amount / rateFrom;
  const converted = amountInUsd * rateTo;

  return Number(converted.toFixed(2));
}

export type SplitStrategyInput =
  | 'equal'
  | 'exact'
  | 'percentage'
  | 'shares'
  | 'EQUAL'
  | 'EXACT'
  | 'PERCENTAGE'
  | 'SHARES';

export interface SplitInput {
  collaborator_id?: string;
  collaborator_name?: string;
  amount?: number;
  percentage?: number;
  shares?: number;
}

export interface CreateExpenseInput {
  title: string;
  amount: number;
  currency?: string;
  category?: ExpenseCategory | string;
  date?: string;
  paid_by_collaborator_id?: string;
  paid_by_collaborator_name?: string;
  split_strategy?: SplitStrategyInput;
  splits?: SplitInput[];
  receipt_url?: string | null;
  notes?: string | null;
}

export interface SplitDetail extends ExpenseSplit {
  collaborator_name?: string;
}

export interface ExpenseWithSplits extends Expense {
  paid_by_collaborator_name?: string;
  converted_base_amount?: number;
  base_currency?: string;
  splits: SplitDetail[];
}

export interface SettlementTransferDetail extends SettlementTransfer {
  from_user: string;
  to_user: string;
}

export interface BudgetSettlementResult extends BudgetSettlement {
  base_currency: string;
  total_spending: number;
  budget_cap: number | null;
  budget_remaining: number | null;
  budget_progress_percentage: number | null;
  spending_by_category: Record<ExpenseCategory, number>;
  spending_by_collaborator: Record<
    string,
    { name: string; paid: number; owed: number; net_balance: number }
  >;
  settlement_transfers: SettlementTransferDetail[];
}

/**
 * Normalizes category string to schema check constraint:
 * 'food' | 'lodging' | 'transport' | 'activities' | 'shopping' | 'other'
 */
export function normalizeExpenseCategory(rawCategory?: string): ExpenseCategory {
  const lower = (rawCategory || '').trim().toLowerCase();
  if (lower === 'food' || lower === 'dining' || lower === 'restaurant' || lower === 'groceries' || lower === 'drink' || lower === 'drinks') {
    return 'food';
  }
  if (lower === 'lodging' || lower === 'hotel' || lower === 'stay' || lower === 'airbnb' || lower === 'hostel') {
    return 'lodging';
  }
  if (lower === 'transport' || lower === 'transit' || lower === 'flight' || lower === 'train' || lower === 'taxi' || lower === 'uber' || lower === 'car') {
    return 'transport';
  }
  if (lower === 'activities' || lower === 'activity' || lower === 'tour' || lower === 'ticket' || lower === 'museum' || lower === 'entertainment') {
    return 'activities';
  }
  if (lower === 'shopping' || lower === 'souvenir' || lower === 'retail') {
    return 'shopping';
  }
  return 'other';
}

/**
 * Lists all expenses for a given trip along with their calculated splits and payer names.
 */
export async function listExpenses(
  db: DatabaseAdapter,
  tripId: string
): Promise<ExpenseWithSplits[]> {
  const expenses = await db.query<Expense>(
    'SELECT * FROM expenses WHERE trip_id = ? ORDER BY date DESC, created_at DESC',
    [tripId]
  );

  const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]);
  const baseCurrency = trip?.currency || 'USD';

  // Load all collaborators for quick name lookup
  const collaborators = await db.query<Collaborator>(
    'SELECT * FROM collaborators WHERE trip_id = ?',
    [tripId]
  );
  const collabMap = new Map<string, string>();
  for (const c of collaborators) {
    collabMap.set(c.id, c.name);
  }

  // Load splits for all expenses
  const allSplits = await db.query<ExpenseSplit>(
    `SELECT es.* FROM expense_splits es
     JOIN expenses e ON es.expense_id = e.id
     WHERE e.trip_id = ?`,
    [tripId]
  );

  const splitsByExpenseId = new Map<string, SplitDetail[]>();
  for (const s of allSplits) {
    const list = splitsByExpenseId.get(s.expense_id) ?? [];
    list.push({
      ...s,
      collaborator_name: collabMap.get(s.collaborator_id) ?? 'Unknown',
    });
    splitsByExpenseId.set(s.expense_id, list);
  }

  return expenses.map((exp) => {
    const convertedBaseAmount = convertCurrency(exp.amount, exp.currency, baseCurrency);
    return {
      ...exp,
      paid_by_collaborator_name: collabMap.get(exp.paid_by_collaborator_id) ?? 'Unknown',
      converted_base_amount: convertedBaseAmount,
      base_currency: baseCurrency,
      splits: splitsByExpenseId.get(exp.id) ?? [],
    };
  });
}

/**
 * Creates an expense record and partitions splits among trip collaborators
 * according to EQUAL, EXACT, PERCENTAGE, or SHARES distribution strategies.
 */
export async function createExpense(
  db: DatabaseAdapter,
  tripId: string,
  input: CreateExpenseInput
): Promise<ExpenseWithSplits> {
  const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]);
  const baseCurrency = trip?.currency || 'USD';
  const currency = (input.currency || baseCurrency).trim().toUpperCase();
  const amount = Number(Number(input.amount || 0).toFixed(2));
  const category = normalizeExpenseCategory(input.category);
  const date = input.date || new Date().toISOString().split('T')[0];
  const expenseId = generateId('exp');

  // 1. Resolve paid_by_collaborator_id
  let paidByCollaboratorId = input.paid_by_collaborator_id;
  let paidByCollaboratorName = '';

  if (!paidByCollaboratorId && input.paid_by_collaborator_name) {
    const trimmedName = input.paid_by_collaborator_name.trim();
    const existing = await db.queryOne<Collaborator>(
      `SELECT * FROM collaborators WHERE trip_id = ? AND (
         LOWER(name) = LOWER(?) OR
         LOWER(name) LIKE LOWER(?) || ' %' OR
         LOWER(name) LIKE '% ' || LOWER(?)
       ) LIMIT 1`,
      [tripId, trimmedName, trimmedName, trimmedName]
    );

    if (existing) {
      paidByCollaboratorId = existing.id;
      paidByCollaboratorName = existing.name;
    } else {
      // Auto-create collaborator
      const newCollabId = generateId('collab');
      const email = `${trimmedName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'user'}@tripplanner.dev`;
      await db.execute(
        `INSERT INTO collaborators (id, trip_id, name, email, avatar_url, role, joined_at)
         VALUES (?, ?, ?, ?, NULL, 'editor', datetime('now'))`,
        [newCollabId, tripId, trimmedName, email]
      );
      paidByCollaboratorId = newCollabId;
      paidByCollaboratorName = trimmedName;
    }
  } else if (paidByCollaboratorId) {
    const existing = await db.queryOne<Collaborator>(
      'SELECT * FROM collaborators WHERE id = ? AND trip_id = ?',
      [paidByCollaboratorId, tripId]
    );
    if (existing) {
      paidByCollaboratorName = existing.name;
    } else {
      // Create if ID was supplied but does not exist
      paidByCollaboratorName = input.paid_by_collaborator_name || 'Collaborator';
      await db.execute(
        `INSERT INTO collaborators (id, trip_id, name, email, avatar_url, role, joined_at)
         VALUES (?, ?, ?, ?, NULL, 'editor', datetime('now'))`,
        [paidByCollaboratorId, tripId, paidByCollaboratorName, `${paidByCollaboratorId}@tripplanner.dev`]
      );
    }
  } else {
    // Pick the first available collaborator or create a default owner
    const first = await db.queryOne<Collaborator>(
      'SELECT * FROM collaborators WHERE trip_id = ? ORDER BY joined_at ASC',
      [tripId]
    );
    if (first) {
      paidByCollaboratorId = first.id;
      paidByCollaboratorName = first.name;
    } else {
      const newCollabId = generateId('collab');
      paidByCollaboratorName = 'Trip Organizer';
      await db.execute(
        `INSERT INTO collaborators (id, trip_id, name, email, avatar_url, role, joined_at)
         VALUES (?, ?, ?, 'organizer@tripplanner.dev', NULL, 'owner', datetime('now'))`,
        [newCollabId, tripId, paidByCollaboratorName]
      );
      paidByCollaboratorId = newCollabId;
    }
  }

  // 2. Resolve participants for the split
  let participants: Array<{ id: string; name: string; amount?: number; percentage?: number; shares?: number }> = [];

  if (input.splits && input.splits.length > 0) {
    for (const s of input.splits) {
      let pId = s.collaborator_id;
      let pName = s.collaborator_name || '';

      if (!pId && pName) {
        const trimmed = pName.trim();
        const found = await db.queryOne<Collaborator>(
          `SELECT * FROM collaborators WHERE trip_id = ? AND (
             LOWER(name) = LOWER(?) OR
             LOWER(name) LIKE LOWER(?) || ' %' OR
             LOWER(name) LIKE '% ' || LOWER(?)
           ) LIMIT 1`,
          [tripId, trimmed, trimmed, trimmed]
        );
        if (found) {
          pId = found.id;
          pName = found.name;
        } else {
          pId = generateId('collab');
          await db.execute(
            `INSERT INTO collaborators (id, trip_id, name, email, avatar_url, role, joined_at)
             VALUES (?, ?, ?, ?, NULL, 'editor', datetime('now'))`,
            [pId, tripId, trimmed, `${trimmed.toLowerCase().replace(/[^a-z0-9]/g, '')}@tripplanner.dev`]
          );
        }
      } else if (pId && !pName) {
        const found = await db.queryOne<Collaborator>(
          'SELECT * FROM collaborators WHERE id = ?',
          [pId]
        );
        pName = found?.name || 'Collaborator';
      }

      if (pId) {
        participants.push({
          id: pId,
          name: pName,
          amount: s.amount,
          percentage: s.percentage,
          shares: s.shares,
        });
      }
    }
  }

  // If no participants specified, default to all collaborators in the trip
  if (participants.length === 0) {
    const allCollabs = await db.query<Collaborator>(
      'SELECT * FROM collaborators WHERE trip_id = ?',
      [tripId]
    );
    participants = allCollabs.map((c) => ({ id: c.id, name: c.name }));
  }

  // 3. Compute splits across participants
  const rawStrategy = (input.split_strategy || 'equal').toLowerCase();
  let dbStrategy: SplitStrategy = 'equal';
  const computedSplits: Array<{ collaborator_id: string; collaborator_name: string; amount_owed: number; percentage: number | null }> = [];

  const n = participants.length;

  if (rawStrategy === 'exact') {
    dbStrategy = 'exact';
    let sumOwed = 0;
    for (let i = 0; i < n; i++) {
      const p = participants[i];
      const owed = Number((p.amount ?? 0).toFixed(2));
      sumOwed += owed;
      const pct = amount > 0 ? Number(((owed / amount) * 100).toFixed(2)) : 0;
      computedSplits.push({
        collaborator_id: p.id,
        collaborator_name: p.name,
        amount_owed: owed,
        percentage: pct,
      });
    }
  } else if (rawStrategy === 'percentage') {
    dbStrategy = 'percentage';
    let runningTotal = 0;
    for (let i = 0; i < n; i++) {
      const p = participants[i];
      const pct = Number((p.percentage ?? (100 / n)).toFixed(2));
      let owed = 0;
      if (i === n - 1) {
        // Rounding conservation: ensure exact total match
        owed = Number((amount - runningTotal).toFixed(2));
      } else {
        owed = Number(((amount * pct) / 100).toFixed(2));
        runningTotal = Number((runningTotal + owed).toFixed(2));
      }
      computedSplits.push({
        collaborator_id: p.id,
        collaborator_name: p.name,
        amount_owed: owed,
        percentage: pct,
      });
    }
  } else if (rawStrategy === 'shares') {
    // SQLite schema check constraint accepts ('equal', 'exact', 'percentage').
    // Map 'shares' to 'exact' in the DB while maintaining share ratios.
    dbStrategy = 'exact';
    const totalShares = participants.reduce((acc, p) => acc + (p.shares && p.shares > 0 ? p.shares : 1), 0);
    let runningTotal = 0;

    for (let i = 0; i < n; i++) {
      const p = participants[i];
      const s = p.shares && p.shares > 0 ? p.shares : 1;
      const pct = Number(((s / totalShares) * 100).toFixed(2));
      let owed = 0;
      if (i === n - 1) {
        owed = Number((amount - runningTotal).toFixed(2));
      } else {
        owed = Number(((amount * s) / totalShares).toFixed(2));
        runningTotal = Number((runningTotal + owed).toFixed(2));
      }
      computedSplits.push({
        collaborator_id: p.id,
        collaborator_name: p.name,
        amount_owed: owed,
        percentage: pct,
      });
    }
  } else {
    // Default: 'equal'
    dbStrategy = 'equal';
    const totalCents = Math.round(amount * 100);
    const baseCents = Math.floor(totalCents / n);
    const remainder = totalCents - baseCents * n;

    for (let i = 0; i < n; i++) {
      const p = participants[i];
      const cents = baseCents + (i < remainder ? 1 : 0);
      const owed = Number((cents / 100).toFixed(2));
      const pct = amount > 0 ? Number(((owed / amount) * 100).toFixed(2)) : Number((100 / n).toFixed(2));
      computedSplits.push({
        collaborator_id: p.id,
        collaborator_name: p.name,
        amount_owed: owed,
        percentage: pct,
      });
    }
  }

  // 4. Save Expense and Splits to Database
  await db.execute(
    `INSERT INTO expenses (
      id, trip_id, paid_by_collaborator_id, title, amount,
      currency, category, date, split_strategy, receipt_url,
      notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    [
      expenseId,
      tripId,
      paidByCollaboratorId,
      input.title,
      amount,
      currency,
      category,
      date,
      dbStrategy,
      input.receipt_url ?? null,
      input.notes ?? null,
    ]
  );

  const splitsToReturn: SplitDetail[] = [];
  for (const cs of computedSplits) {
    const splitId = generateId('split');
    await db.execute(
      `INSERT INTO expense_splits (id, expense_id, collaborator_id, amount_owed, percentage, settled, settled_at)
       VALUES (?, ?, ?, ?, ?, 0, NULL)`,
      [splitId, expenseId, cs.collaborator_id, cs.amount_owed, cs.percentage]
    );

    splitsToReturn.push({
      id: splitId,
      expense_id: expenseId,
      collaborator_id: cs.collaborator_id,
      collaborator_name: cs.collaborator_name,
      amount_owed: cs.amount_owed,
      percentage: cs.percentage,
      settled: 0,
      settled_at: null,
    });
  }

  const createdExpense = await db.queryOne<Expense>(
    'SELECT * FROM expenses WHERE id = ?',
    [expenseId]
  );

  if (!createdExpense) {
    throw new Error(`Failed to retrieve newly created expense ${expenseId}`);
  }

  const convertedBaseAmount = convertCurrency(amount, currency, baseCurrency);

  return {
    ...createdExpense,
    paid_by_collaborator_name: paidByCollaboratorName,
    converted_base_amount: convertedBaseAmount,
    base_currency: baseCurrency,
    splits: splitsToReturn,
  };
}

/**
 * Deletes an expense by ID. Cascading deletion will remove associated expense_splits.
 */
export async function deleteExpense(
  db: DatabaseAdapter,
  tripId: string,
  expenseId: string
): Promise<boolean> {
  const res = await db.execute(
    'DELETE FROM expenses WHERE id = ? AND trip_id = ?',
    [expenseId, tripId]
  );
  return (res.changes ?? 0) > 0;
}

/**
 * Splitwise Minimum-Cash-Flow Debt Simplification Algorithm.
 * Iteratively matches maximum creditor (largest positive net balance)
 * with maximum debtor (largest negative net balance), creating the
 * minimal set of direct transfers to settle all group debts.
 */
export function simplifyDebts(
  balances: CollaboratorBalance[],
  currency: string
): SettlementTransferDetail[] {
  // Creditors: net_balance > 0.005 (are owed money)
  // Debtors: net_balance < -0.005 (owe money)
  const creditors: Array<{ id: string; name: string; amount: number }> = [];
  const debtors: Array<{ id: string; name: string; amount: number }> = [];

  for (const b of balances) {
    const net = Number(b.net_balance.toFixed(2));
    if (net > 0.005) {
      creditors.push({ id: b.collaborator_id, name: b.collaborator_name, amount: net });
    } else if (net < -0.005) {
      debtors.push({ id: b.collaborator_id, name: b.collaborator_name, amount: -net });
    }
  }

  const transfers: SettlementTransferDetail[] = [];

  while (creditors.length > 0 && debtors.length > 0) {
    // Sort descending by amount
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const maxCreditor = creditors[0];
    const maxDebtor = debtors[0];

    const settleAmount = Number(Math.min(maxCreditor.amount, maxDebtor.amount).toFixed(2));

    if (settleAmount > 0.005) {
      transfers.push({
        from_collaborator_id: maxDebtor.id,
        from_collaborator_name: maxDebtor.name,
        from_user: maxDebtor.name,
        to_collaborator_id: maxCreditor.id,
        to_collaborator_name: maxCreditor.name,
        to_user: maxCreditor.name,
        amount: settleAmount,
        currency,
      });

      maxCreditor.amount = Number((maxCreditor.amount - settleAmount).toFixed(2));
      maxDebtor.amount = Number((maxDebtor.amount - settleAmount).toFixed(2));
    }

    if (maxCreditor.amount <= 0.005) creditors.shift();
    if (maxDebtor.amount <= 0.005) debtors.shift();
  }

  return transfers;
}

/**
 * Computes complete trip budget breakdown and debt settlement:
 * - Total expenditure converted to trip base_currency
 * - Budget cap remaining and progress percentage
 * - Category spending distribution
 * - Per-collaborator breakdown of total paid, total owed, and net balance
 * - Minimal cash-flow settlement transfers (Splitwise algorithm)
 */
export async function getBudgetSettlement(
  db: DatabaseAdapter,
  tripId: string
): Promise<BudgetSettlementResult> {
  const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]);
  if (!trip) {
    throw new Error(`Trip ${tripId} not found`);
  }

  const baseCurrency = trip.currency || 'USD';
  const budgetCap = trip.budget_cap !== null && trip.budget_cap !== undefined ? Number(trip.budget_cap) : null;

  // Load collaborators
  const collaborators = await db.query<Collaborator>(
    'SELECT * FROM collaborators WHERE trip_id = ? ORDER BY joined_at ASC',
    [tripId]
  );

  const collabMap = new Map<string, string>();
  const paidMap = new Map<string, number>();
  const owedMap = new Map<string, number>();

  for (const c of collaborators) {
    collabMap.set(c.id, c.name);
    paidMap.set(c.id, 0);
    owedMap.set(c.id, 0);
  }

  // Load all expenses for this trip
  const expenses = await db.query<Expense>(
    'SELECT * FROM expenses WHERE trip_id = ?',
    [tripId]
  );

  const categoryTotals: Record<ExpenseCategory, number> = {
    food: 0,
    lodging: 0,
    transport: 0,
    activities: 0,
    shopping: 0,
    other: 0,
  };

  let totalExpensesInBase = 0;

  for (const exp of expenses) {
    const baseAmt = convertCurrency(exp.amount, exp.currency, baseCurrency);
    totalExpensesInBase = Number((totalExpensesInBase + baseAmt).toFixed(2));

    const cat = normalizeExpenseCategory(exp.category);
    categoryTotals[cat] = Number(((categoryTotals[cat] || 0) + baseAmt).toFixed(2));

    // Payer paid baseAmt
    const currentPaid = paidMap.get(exp.paid_by_collaborator_id) ?? 0;
    paidMap.set(exp.paid_by_collaborator_id, Number((currentPaid + baseAmt).toFixed(2)));

    // Load splits for this expense and distribute baseAmt with exact penny conservation
    const expSplits = await db.query<ExpenseSplit>(
      'SELECT * FROM expense_splits WHERE expense_id = ? ORDER BY id ASC',
      [exp.id]
    );

    if (expSplits.length > 0) {
      let runningSplitBase = 0;
      for (let i = 0; i < expSplits.length; i++) {
        const s = expSplits[i];
        let splitInBase = 0;
        if (i === expSplits.length - 1) {
          splitInBase = Number((baseAmt - runningSplitBase).toFixed(2));
        } else {
          const ratio = exp.amount > 0 ? s.amount_owed / exp.amount : 1 / expSplits.length;
          splitInBase = Number((baseAmt * ratio).toFixed(2));
          runningSplitBase = Number((runningSplitBase + splitInBase).toFixed(2));
        }

        const currentOwed = owedMap.get(s.collaborator_id) ?? 0;
        owedMap.set(s.collaborator_id, Number((currentOwed + splitInBase).toFixed(2)));
      }
    }
  }

  // Build Collaborator balances
  const balances: CollaboratorBalance[] = [];
  const spendingByCollaborator: Record<string, { name: string; paid: number; owed: number; net_balance: number }> = {};

  for (const c of collaborators) {
    const paid = Number((paidMap.get(c.id) ?? 0).toFixed(2));
    const owed = Number((owedMap.get(c.id) ?? 0).toFixed(2));
    const netBalance = Number((paid - owed).toFixed(2));

    balances.push({
      collaborator_id: c.id,
      collaborator_name: c.name,
      paid,
      owed,
      net_balance: netBalance,
    });

    spendingByCollaborator[c.id] = {
      name: c.name,
      paid,
      owed,
      net_balance: netBalance,
    };
  }

  // Run Splitwise debt simplification
  const settlementTransfers = simplifyDebts(balances, baseCurrency);

  // Calculate budget cap metrics
  let budgetRemaining: number | null = null;
  let budgetProgressPct: number | null = null;

  if (budgetCap !== null && budgetCap > 0) {
    budgetRemaining = Number((budgetCap - totalExpensesInBase).toFixed(2));
    budgetProgressPct = Number(((totalExpensesInBase / budgetCap) * 100).toFixed(1));
  }

  return {
    trip_id: tripId,
    currency: baseCurrency,
    base_currency: baseCurrency,
    total_expenses: totalExpensesInBase,
    total_spending: totalExpensesInBase,
    budget_cap: budgetCap,
    budget_remaining: budgetRemaining,
    budget_progress_percentage: budgetProgressPct,
    spending_by_category: categoryTotals,
    spending_by_collaborator: spendingByCollaborator,
    balances,
    settlement_transfers: settlementTransfers,
  };
}
