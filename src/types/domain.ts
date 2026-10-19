/**
 * Wanderlog-style Domain Types for TripPlanner
 * Provides strict TypeScript schemas for all trip planning, scheduling,
 * geographic, reservation, collaborative, and financial domain entities.
 */

// ============================================================================
// Enums and Unions
// ============================================================================

export type CollaboratorRole = 'owner' | 'editor' | 'viewer';

export type SectionType = 'morning' | 'afternoon' | 'evening' | 'custom' | 'wishlist';

export type PlaceCategory =
  | 'attraction'
  | 'restaurant'
  | 'lodging'
  | 'transit'
  | 'shopping'
  | 'other';

export type TransitMode = 'walking' | 'transit' | 'driving' | 'bicycling' | 'flight';

export type ReservationType =
  | 'flight'
  | 'lodging'
  | 'rental_car'
  | 'activity'
  | 'restaurant'
  | 'other';

export type ExpenseCategory =
  | 'food'
  | 'lodging'
  | 'transport'
  | 'activities'
  | 'shopping'
  | 'other';

export type SplitStrategy = 'equal' | 'exact' | 'percentage';

export type ChecklistCategory = 'packing' | 'todo' | 'documents' | 'custom';

export type VoteType = 'up' | 'down';

// ============================================================================
// Core Domain Entities
// ============================================================================

/**
 * Top-level Trip entity containing metadata, scheduling timeframe, and financial parameters.
 */
export interface Trip {
  id: string;
  title: string;
  destination: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  timezone: string;   // e.g. 'Asia/Tokyo'
  currency: string;   // e.g. 'USD', 'JPY'
  budget_cap: number | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Trip Collaborator representing an owner, editor, or viewer participant.
 */
export interface Collaborator {
  id: string;
  trip_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: CollaboratorRole;
  joined_at: string;
}

/**
 * A specific calendar day of a trip.
 */
export interface Day {
  id: string;
  trip_id: string;
  day_number: number; // 1-indexed (Day 1, Day 2, etc.)
  date: string;       // YYYY-MM-DD
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A section within a day (e.g. Morning, Afternoon, Evening)
 * or an unscheduled wishlist container (day_id = null).
 */
export interface Section {
  id: string;
  trip_id: string;
  day_id: string | null; // null for unscheduled wishlist sections
  title: string;
  section_type: SectionType;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Canonical physical Place entity with geographic coordinates and metadata.
 */
export interface Place {
  id: string;
  name: string;
  formatted_address: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
  rating: number | null;
  google_place_id: string | null;
  website: string | null;
  phone_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A Stop represents a planned visit to a Place placed inside a Day Section.
 */
export interface Stop {
  id: string;
  section_id: string;
  place_id: string;
  sort_order: number;
  arrival_time: string | null;   // e.g. '09:30' or ISO time
  departure_time: string | null; // e.g. '11:00' or ISO time
  duration_minutes: number | null;
  user_notes: string | null;
  budget_amount: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Calculated or planned transit leg between two sequential stops.
 */
export interface TransitLeg {
  id: string;
  trip_id: string;
  from_stop_id: string;
  to_stop_id: string;
  transit_mode: TransitMode;
  duration_seconds: number;
  distance_meters: number;
  route_instructions: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Formal travel reservation (flights, hotels, activities).
 */
export interface Reservation {
  id: string;
  trip_id: string;
  type: ReservationType;
  title: string;
  confirmation_code: string | null;
  provider: string | null;
  start_time: string; // ISO 8601 string
  end_time: string | null;
  location: string | null;
  cost: number;
  currency: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Expense record incurred by a collaborator on behalf of the trip.
 */
export interface Expense {
  id: string;
  trip_id: string;
  paid_by_collaborator_id: string;
  title: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  date: string; // YYYY-MM-DD
  split_strategy: SplitStrategy;
  receipt_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Split distribution of an expense assigned to a collaborator.
 */
export interface ExpenseSplit {
  id: string;
  expense_id: string;
  collaborator_id: string;
  amount_owed: number;
  percentage: number | null;
  settled: boolean | number;
  settled_at: string | null;
}

/**
 * Checklist container for trip logistics (Packing, To-Do, Documents).
 */
export interface Checklist {
  id: string;
  trip_id: string;
  title: string;
  category: ChecklistCategory;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * An item inside a checklist.
 */
export interface ChecklistItem {
  id: string;
  checklist_id: string;
  title: string;
  is_completed: boolean | number;
  assigned_to_collaborator_id: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Free-form collaborative note or guide attached to the trip.
 */
export interface TripNote {
  id: string;
  trip_id: string;
  title: string;
  content: string;
  updated_by_collaborator_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Collaborator vote (thumbs up/down) on an itinerary stop.
 */
export interface StopVote {
  id: string;
  stop_id: string;
  collaborator_id: string;
  vote_type: VoteType;
  created_at: string;
}

// ============================================================================
// Composite & Projection DTOs
// ============================================================================

/**
 * Stop with attached Place details, transit info to the next stop, and vote tallies.
 */
export interface StopDetail extends Stop {
  place: Place;
  transit_to_next?: TransitLeg | null;
  votes?: {
    up: number;
    down: number;
    user_vote?: VoteType;
  };
}

/**
 * Section with populated stops.
 */
export interface SectionSchedule extends Section {
  stops: StopDetail[];
}

/**
 * Full day schedule projection with populated sections and stops.
 */
export interface DaySchedule extends Day {
  sections: SectionSchedule[];
}

/**
 * Compact high-level trip summary projection.
 */
export interface TripSummary {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  timezone: string;
  currency: string;
  budget_cap: number | null;
  cover_image_url: string | null;
  collaborator_count: number;
  day_count: number;
  stop_count: number;
  total_expenses: number;
}

/**
 * Balance calculation for an individual collaborator.
 */
export interface CollaboratorBalance {
  collaborator_id: string;
  collaborator_name: string;
  paid: number;
  owed: number;
  net_balance: number; // positive = should receive money, negative = owes money
}

/**
 * Minimal transfer instruction to settle group debts.
 */
export interface SettlementTransfer {
  from_collaborator_id: string;
  from_collaborator_name: string;
  to_collaborator_id: string;
  to_collaborator_name: string;
  amount: number;
  currency: string;
}

/**
 * Overall budget and debt settlement overview for a trip.
 */
export interface BudgetSettlement {
  trip_id: string;
  currency: string;
  total_expenses: number;
  balances: CollaboratorBalance[];
  settlement_transfers: SettlementTransfer[];
}

/**
 * RFC 7807 Problem Details compliant error payload with self-healing hints.
 */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code?: string;
  suggested_alternatives?: string[];
  errors?: Record<string, string[]>;
}
