-- ============================================================================
-- TripPlanner D1 / SQLite Relational Schema
-- Wanderlog-style collaborative trip planning database
-- ============================================================================

PRAGMA foreign_keys = ON;

-- Trips
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  currency TEXT NOT NULL DEFAULT 'USD',
  budget_cap REAL DEFAULT NULL,
  cover_image_url TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Collaborators
CREATE TABLE IF NOT EXISTS collaborators (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT DEFAULT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner', 'editor', 'viewer')) DEFAULT 'editor',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

-- Calendar Days
CREATE TABLE IF NOT EXISTS days (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  date TEXT NOT NULL,
  notes TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

-- Sections (Morning, Afternoon, Evening, Custom, or Wishlist with day_id = NULL)
CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  day_id TEXT DEFAULT NULL,
  title TEXT NOT NULL,
  section_type TEXT NOT NULL CHECK(section_type IN ('morning', 'afternoon', 'evening', 'custom', 'wishlist')) DEFAULT 'custom',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (day_id) REFERENCES days(id) ON DELETE CASCADE
);

-- Canonical Places
CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  formatted_address TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('attraction', 'restaurant', 'lodging', 'transit', 'shopping', 'other')) DEFAULT 'attraction',
  rating REAL DEFAULT NULL,
  google_place_id TEXT DEFAULT NULL,
  website TEXT DEFAULT NULL,
  phone_number TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Itinerary Stops
CREATE TABLE IF NOT EXISTS stops (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  arrival_time TEXT DEFAULT NULL,
  departure_time TEXT DEFAULT NULL,
  duration_minutes INTEGER DEFAULT NULL,
  user_notes TEXT DEFAULT NULL,
  budget_amount REAL DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE CASCADE,
  FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE RESTRICT
);

-- Transit Legs between stops
CREATE TABLE IF NOT EXISTS transit_legs (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  from_stop_id TEXT NOT NULL,
  to_stop_id TEXT NOT NULL,
  transit_mode TEXT NOT NULL CHECK(transit_mode IN ('walking', 'transit', 'driving', 'bicycling', 'flight')) DEFAULT 'walking',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  distance_meters INTEGER NOT NULL DEFAULT 0,
  route_instructions TEXT DEFAULT NULL,
  departure_time TEXT DEFAULT NULL,
  arrival_time TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (from_stop_id) REFERENCES stops(id) ON DELETE CASCADE,
  FOREIGN KEY (to_stop_id) REFERENCES stops(id) ON DELETE CASCADE
);

-- Reservations (flights, hotels, activities)
CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('flight', 'lodging', 'rental_car', 'activity', 'restaurant', 'other')),
  title TEXT NOT NULL,
  confirmation_code TEXT DEFAULT NULL,
  provider TEXT DEFAULT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT DEFAULT NULL,
  location TEXT DEFAULT NULL,
  cost REAL NOT NULL DEFAULT 0.0,
  currency TEXT NOT NULL DEFAULT 'USD',
  notes TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  paid_by_collaborator_id TEXT NOT NULL,
  title TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0.0,
  currency TEXT NOT NULL DEFAULT 'USD',
  category TEXT NOT NULL CHECK(category IN ('food', 'lodging', 'transport', 'activities', 'shopping', 'other')) DEFAULT 'other',
  date TEXT NOT NULL,
  split_strategy TEXT NOT NULL CHECK(split_strategy IN ('equal', 'exact', 'percentage')) DEFAULT 'equal',
  receipt_url TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (paid_by_collaborator_id) REFERENCES collaborators(id) ON DELETE CASCADE
);

-- Expense Splits
CREATE TABLE IF NOT EXISTS expense_splits (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL,
  collaborator_id TEXT NOT NULL,
  amount_owed REAL NOT NULL DEFAULT 0.0,
  percentage REAL DEFAULT NULL,
  settled INTEGER NOT NULL DEFAULT 0 CHECK(settled IN (0, 1)),
  settled_at TEXT DEFAULT NULL,
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (collaborator_id) REFERENCES collaborators(id) ON DELETE CASCADE
);

-- Checklists
CREATE TABLE IF NOT EXISTS checklists (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('packing', 'todo', 'documents', 'custom')) DEFAULT 'todo',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

-- Checklist Items
CREATE TABLE IF NOT EXISTS checklist_items (
  id TEXT PRIMARY KEY,
  checklist_id TEXT NOT NULL,
  title TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0 CHECK(is_completed IN (0, 1)),
  assigned_to_collaborator_id TEXT DEFAULT NULL,
  due_date TEXT DEFAULT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (checklist_id) REFERENCES checklists(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to_collaborator_id) REFERENCES collaborators(id) ON DELETE SET NULL
);

-- Collaborative Trip Notes
CREATE TABLE IF NOT EXISTS trip_notes (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_by_collaborator_id TEXT DEFAULT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by_collaborator_id) REFERENCES collaborators(id) ON DELETE SET NULL
);

-- Stop Votes
CREATE TABLE IF NOT EXISTS stop_votes (
  id TEXT PRIMARY KEY,
  stop_id TEXT NOT NULL,
  collaborator_id TEXT NOT NULL,
  vote_type TEXT NOT NULL CHECK(vote_type IN ('up', 'down')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (stop_id) REFERENCES stops(id) ON DELETE CASCADE,
  FOREIGN KEY (collaborator_id) REFERENCES collaborators(id) ON DELETE CASCADE,
  UNIQUE (stop_id, collaborator_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_collaborators_trip_id ON collaborators(trip_id);
CREATE INDEX IF NOT EXISTS idx_days_trip_id ON days(trip_id);
CREATE INDEX IF NOT EXISTS idx_sections_trip_id ON sections(trip_id);
CREATE INDEX IF NOT EXISTS idx_sections_day_id ON sections(day_id);
CREATE INDEX IF NOT EXISTS idx_stops_section_id ON stops(section_id);
CREATE INDEX IF NOT EXISTS idx_stops_place_id ON stops(place_id);
CREATE INDEX IF NOT EXISTS idx_transit_legs_trip_id ON transit_legs(trip_id);
CREATE INDEX IF NOT EXISTS idx_transit_legs_from_to ON transit_legs(from_stop_id, to_stop_id);
CREATE INDEX IF NOT EXISTS idx_reservations_trip_id ON reservations(trip_id);
CREATE INDEX IF NOT EXISTS idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense_id ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_collaborator_id ON expense_splits(collaborator_id);
CREATE INDEX IF NOT EXISTS idx_checklists_trip_id ON checklists(trip_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_trip_notes_trip_id ON trip_notes(trip_id);
CREATE INDEX IF NOT EXISTS idx_stop_votes_stop_id ON stop_votes(stop_id);
