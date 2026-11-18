# TripPlanner

> A Wanderlog-inspired collaborative trip planning engine, spatial travel workspace, and conversational AI agent built on Astro, TypeScript, Cloudflare Workers, D1 (SQLite), and KV.

TripPlanner enables modern travelers and groups to organize complex multi-day trips with an interactive 3-pane workspace, geographic route optimization, a traveler operational safety net, 2.5D isometric diorama rendering, bookings tracking, multi-currency Splitwise debt settlement, checklist management, multi-format exports, a ChatGPT plugin interface, and bi-directional Model Context Protocol (MCP) synchronization with Antigravity (`agy`).

---

## Architecture Overview

- **Framework**: [Astro](https://astro.build/) (`output: 'server'`) with the `@astrojs/cloudflare` SSR adapter for ultra-low latency edge rendering.
- **Runtime & Compute**: [Cloudflare Workers / Pages](https://workers.cloudflare.com/) serverless execution.
- **Relational Storage**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite at the edge) with local development and automated testing fallback powered by `better-sqlite3`.
- **Edge Cache**: [Cloudflare KV](https://developers.cloudflare.com/kv/) for geocoding queries, routing matrix caches, and session state (with in-memory TTL cache fallback).
- **3D Rendering Pipeline**: Headless Blender 5.x Cycles Metal GPU rendering engine (`src/services/dioramaEngine.ts`) for 2.5D isometric itinerary dioramas.
- **Type Safety & Error Contracts**: Strict TypeScript with RFC 7807 self-healing Problem Details (`application/problem+json`) error specifications.

---

## Features

### Spatial 3-Pane Travel Workspace
- **Collapsible AI Assistant**: Conversational travel planning drawer capable of querying the active trip, adding stops, optimizing daily routes, logging expenses, and navigating UI tabs in real time.
- **Sticky Canvas Tabs**: Dedicated tabbed views for **Itinerary**, **Wishlist**, **Bookings**, **Budget & Splits**, **Checklists**, and **Notes** (`itinerary`, `wishlist`, `bookings`, `budget`, `checklists`, `notes`).
- **Interactive Retina ESRI Leaflet Map**: Color-coded stop markers, routed polylines, day filtering, and interactive stop selection synchronized with the itinerary canvas.
- **Slide-Over Place Detail Panel**: Contextual inspector displaying stop timings, transit legs, safety metadata, notes, collaborator votes, and quick actions without losing map context.

### Traveler Operational Safety Net
- **Daily Walking Step & Pacing Load Gauge**: Estimates daily step counts and classifies day intensity (`Relaxed`, `Moderate`, `Active`, `Intense`) alongside weather resilience indicators.
- **Cash-Only Venue Alerts**: Highlights attractions, shrines, and eateries that require cash (`cash_only` vs. card / IC card acceptance).
- **Last-Entry Cutoff Badges**: Surfaces venue closing times, last-entry cutoffs, and advance reservation warnings directly on stop cards and day audits.
- **Station Exit & Luggage Locker Guidance**: Provides actionable transit hub exits, last-transit cutoffs, and coin-locker / bag-drop advice (`src/lib/travelerSafety.ts`).
- **Fullscreen Local-Language Taxi Driver Card**: High-contrast native script flashcard modal displaying the venue name, local address, and pronunciation for showing to taxi drivers or locals.

### 2.5D Isometric Diorama Studio
- **Headless Blender 5.x Cycles Metal GPU Rendering**: Generates high-craft 2.5D isometric terrain and architectural dioramas per trip day via `/api/v1/trips/:tripId/diorama`.
- **Universal Destination Archetypes**: Normalizes stop latitude/longitude coordinates onto a diorama local grid with route waypoints, elevation callouts, and safety metric overlays.
- **Interactive Viewport HUD**: In-app studio modal allowing travelers to inspect rendered day dioramas, switch quality levels (`draft`, `standard`, `high`), and trigger re-renders.

### Live Bi-Directional Antigravity (`agy`) Session Sync & MCP Server
- **Live Workspace Session State (`/api/v1/session`)**: Tracks `active_trip_id`, `active_day_number`, `active_tab`, `selected_stop_id`, `last_actor`, and `state_version` in SQLite (`workspace_sessions` and `session_events`).
- **Real-Time Event Stream (`/api/v1/events`)**: Supports Server-Sent Events (`text/event-stream` via `Accept: text/event-stream` or `?stream=true`) and version-delta JSON polling (`?since_version=N`) for instant browser UI hot-reloading.
- **Model Context Protocol Server (`/api/v1/mcp` & `scripts/agy-mcp-server.mjs`)**: Dual-transport MCP server supporting Streamable HTTP JSON-RPC 2.0 (`POST /api/v1/mcp`) and stdio bridging (`node scripts/agy-mcp-server.mjs`), exposing itinerary, route optimization, reservation, expense, checklist, and UI navigation tools to Antigravity (`agy`).

### Itinerary Builder & Dynamic Scheduling
- Auto-scaffolds sequential calendar days (`Day 1` through `Day N`) upon trip creation.
- Default time-of-day scheduled sections (`Morning`, `Afternoon`, `Evening`) and custom user-defined sections.
- Sequential itinerary stops with duration, arrival/departure estimates, notes, drag/move reordering, and collaborator up/down votes.

### Wishlists & Ideation
- Unscheduled `"Places to Visit"` wishlist containers allowing travelers to pin places and vote on candidates before assigning them to calendar days.

### Geospatial Search & TSP Route Optimizer
- Place search with OpenStreetMap Nominatim geocoding and local offline POI fallbacks.
- Transit leg calculations with OSRM routing and Haversine distance fallbacks.
- **TSP Route Optimization**: Nearest-Neighbor + 2-Opt Traveling Salesperson Problem solver (`/api/v1/trips/:tripId/days/:dayNumber/optimize-route`) to eliminate backtracking and reorder stops efficiently for each day.

### Reservations & Bookings Ledger
- Comprehensive tracking of flights, lodging, rental cars, activities, and dining reservations (`GET`, `POST`, `PATCH`, `DELETE`).
- Automatic timeline conflict detection and confirmation code organization.

### Multi-Currency Expenses & Splitwise Debt Settlement
- Shared expense tracking across currencies (`USD`, `EUR`, `JPY`, `GBP`, `CAD`, `AUD`, `CHF`).
- Equal, exact, and percentage-based cost splitting among trip collaborators.
- **Minimal Cash Flow Settlement**: Computes net balances and generates the minimum number of peer-to-peer debt transfers via `/api/v1/trips/:tripId/budget/settle-up`.

### Checklists & Collaborative Notes
- Pre-trip logistics and packing lists categorized by `packing`, `todo`, `documents`, and `custom`.
- Completion toggles and collaborator assignment by name or ID.
- Collaborative free-form Markdown trip notes.

### ChatGPT Plugin & OpenAPI 3.1 Specification
- Official ChatGPT plugin manifest at `/.well-known/ai-plugin.json`.
- Complete OpenAPI 3.1.0 interactive schema at `/api/v1/openapi.json`.
- Conversational assistant endpoint at `/api/v1/chat` capable of executing itinerary queries, stop additions, and day optimizations.

### Multi-Format Exports
- **Markdown** (`/api/v1/trips/:tripId/export/markdown`): Formatted trip summaries for reading, sharing, or publishing.
- **iCalendar (`.ics`)** (`/api/v1/trips/:tripId/export/ics`): RFC 5545 calendar export with geo-locations, reservations, and day schedules.
- **CSV** (`/api/v1/trips/:tripId/export/expenses.csv`): Detailed expense breakdown with base-currency conversions and split strategies.

---

## Getting Started

### Prerequisites
- Node.js `v22.14.0` or higher
- npm `v10.9.0` or higher
- Optional for 2.5D Diorama rendering: Blender 5.x (macOS Metal GPU or headless CLI)

### Installation
```bash
git clone https://github.com/morshedgit/tripplanner.git
cd tripplanner
npm install
```

### Development Server
Starts the Astro SSR dev server locally with zero-config SQLite and in-memory KV fallback:
```bash
npm run dev
```
Open [http://localhost:4321](http://localhost:4321) in your browser.

### Antigravity (`agy`) MCP Connection
Connect directly over Streamable HTTP or use the included stdio bridge:
```bash
node scripts/agy-mcp-server.mjs
```
Or discover live server capabilities and client configuration snippets at `GET http://localhost:4321/api/v1/mcp`.

### Automated Testing
Runs the comprehensive Vitest unit and integration test suite:
```bash
npm test
```

### Type Checking
Ensures all TypeScript contracts compile cleanly:
```bash
npx tsc --noEmit
```

### Production Build
Builds the edge server bundle for Cloudflare deployment:
```bash
npm run build
```

---

## REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET`, `POST` | `/api/v1/trips` | List trips or create a new auto-scaffolded trip |
| `GET`, `PATCH`, `DELETE` | `/api/v1/trips/:tripId` | Fetch full/compact trip hierarchy, update, or delete |
| `GET` | `/api/v1/trips/:tripId/summary` | Concise token-efficient trip summary |
| `GET`, `PATCH` | `/api/v1/trips/:tripId/days/:dayNumber` | Get or update day schedule and notes |
| `POST` | `/api/v1/trips/:tripId/days/:dayNumber/optimize-route` | 2-Opt TSP route optimizer for daily stops |
| `POST` | `/api/v1/trips/:tripId/sections` | Create custom scheduled or wishlist section |
| `POST` | `/api/v1/trips/:tripId/stops` | Add a planned or wishlist stop to a section |
| `PATCH`, `DELETE` | `/api/v1/trips/:tripId/stops/:stopId` | Update stop timings/notes or delete a stop |
| `POST` | `/api/v1/trips/:tripId/stops/:stopId/move` | Move a stop across sections or reorder within a day |
| `POST` | `/api/v1/trips/:tripId/stops/:stopId/vote` | Upvote or downvote a planned or wishlist stop |
| `GET`, `POST` | `/api/v1/trips/:tripId/diorama` | Inspect diorama status or render a 2.5D Blender Cycles diorama |
| `GET`, `POST` | `/api/v1/trips/:tripId/reservations` | List or record travel reservations |
| `PATCH`, `DELETE` | `/api/v1/trips/:tripId/reservations/:reservationId` | Update or delete an existing reservation |
| `GET`, `POST` | `/api/v1/trips/:tripId/expenses` | List or record multi-currency expenses |
| `GET` | `/api/v1/trips/:tripId/budget/settle-up` | Calculate Splitwise-style debt settlement transfers |
| `GET`, `POST` | `/api/v1/trips/:tripId/collaborators` | List or invite collaborators |
| `GET`, `POST`, `PATCH` | `/api/v1/trips/:tripId/checklists` | List checklists, add items, or toggle completion |
| `GET`, `POST`, `DELETE` | `/api/v1/trips/:tripId/notes` | List, upsert, or delete Markdown notes |
| `GET` | `/api/v1/trips/:tripId/export/markdown` | Export trip itinerary guide as Markdown |
| `GET` | `/api/v1/trips/:tripId/export/ics` | Export trip stops and reservations as RFC 5545 iCalendar (`.ics`) |
| `GET` | `/api/v1/trips/:tripId/export/expenses.csv` | Export trip expenses report as CSV |
| `GET` | `/api/v1/places/search` | Search places via Nominatim or offline catalog |
| `POST` | `/api/v1/chat` | Conversational travel planner agent endpoint |
| `GET`, `POST`, `PUT`, `PATCH` | `/api/v1/session` | Read or mutate live workspace session context (`state_version`) |
| `GET`, `POST` | `/api/v1/events` | Stream SSE session events (`text/event-stream`) or poll JSON deltas |
| `GET`, `POST` | `/api/v1/mcp` | MCP server discovery metadata and Streamable HTTP JSON-RPC 2.0 endpoint |
| `GET` | `/.well-known/ai-plugin.json` | ChatGPT Plugin Manifest |
| `GET` | `/api/v1/openapi.json` | OpenAPI 3.1.0 Specification |

---

## License
MIT
