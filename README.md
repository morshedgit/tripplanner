# TripPlanner ✈️

> A Wanderlog-inspired collaborative trip planning engine and conversational AI agent built on Astro, TypeScript, Cloudflare Workers, D1 (SQLite), and KV.

TripPlanner enables modern travelers and groups to organize complex multi-day trips with interactive daily itineraries, geographic route optimization, bookings tracking, multi-currency Splitwise debt settlement, checklist management, export capabilities, and a ChatGPT plugin interface.

---

## 🏛️ Architecture Overview

- **Framework**: [Astro](https://astro.build/) (`output: 'server'`) with the `@astrojs/cloudflare` SSR adapter for ultra-low latency edge rendering.
- **Runtime & Compute**: [Cloudflare Workers / Pages](https://workers.cloudflare.com/) serverless execution.
- **Relational Storage**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite at edge) with local development and automated testing fallback powered by `better-sqlite3`.
- **Edge Cache**: [Cloudflare KV](https://developers.cloudflare.com/kv/) for geocoding queries, routing matrix caches, and session state (with in-memory TTL cache fallback).
- **Type Safety & Design**: Strict TypeScript with RFC 7807 self-healing Problem Details error specifications.

---

## ✨ Features

### 📅 Itinerary Builder & Dynamic Scheduling
- Auto-scaffolds sequential calendar days (`Day 1` through `Day N`) upon trip creation.
- Default time-of-day scheduled sections (`Morning`, `Afternoon`, `Evening`) and custom user-defined sections.
- Sequential itinerary stops with duration, arrival/departure estimates, notes, and collaborator up/down votes.

### 📌 Wishlists & Ideation
- Unscheduled `"Places to Visit"` wishlist containers allowing travelers to pin places before assigning them to calendar days.

### 🗺️ Geospatial Search & TSP Route Optimizer
- Place search with OpenStreetMap Nominatim geocoding and local offline POI fallbacks.
- Transit leg calculations with OSRM routing and Haversine distance fallbacks.
- **TSP Route Optimization**: Nearest-Neighbor + 2-Opt Traveling Salesperson Problem solver to eliminate backtracking and reorder stops efficiently for each day.

### 🏨 Reservations & Bookings Ledger
- Comprehensive tracking of flights, lodging, rental cars, activities, and dining reservations.
- Automatic timeline conflict detection and status checks.

### 💰 Multi-Currency Expenses & Splitwise Debt Settlement
- Shared expense tracking across currencies (`USD`, `EUR`, `JPY`, `GBP`, `CAD`, `AUD`, `CHF`).
- Equal, exact, and percentage-based cost splitting among trip collaborators.
- **Minimal Cash Flow Settlement**: Computes net balances and generates the minimum number of debt transfers required to settle up.

### ✅ Checklists & Collaborative Notes
- Pre-trip logistics and packing lists categorized by `packing`, `todo`, `documents`, and `custom`.
- Completion toggles and collaborator assignment by name or ID.
- Collaborative free-form Markdown trip notes.

### 🤖 ChatGPT Plugin & OpenAPI 3.1 Specification
- Official ChatGPT plugin manifest at `/.well-known/ai-plugin.json`.
- OpenAPI 3.1.0 interactive schema at `/api/v1/openapi.json`.
- Conversational assistant endpoint at `/api/v1/chat` capable of executing itinerary queries, stop additions, and day optimizations.

### 📤 Multi-Format Exports
- **Markdown**: Formatted trip summaries for easy reading, sharing, or publishing.
- **iCalendar (`.ics`)**: RFC 5545 calendar export with alarms, geo-locations, and day schedules.
- **CSV**: Detailed expense breakdown with split distributions.

### 🖥️ Split-Screen Companion Web Workspace
- 3-pane interactive interface featuring:
  1. Conversational AI chat agent assistant.
  2. Tabs for Itinerary, Wishlist, Reservations, Expenses/Split, Checklists, and Notes.
  3. Interactive Leaflet map with color-coded stop markers and routed polylines.

---

## 🚀 Getting Started

### Prerequisites
- Node.js `v22.14.0` or higher
- npm `v10.9.0` or higher

### Installation
```bash
git clone https://github.com/morshedgit/tripplanner.git
cd tripplanner
npm install
```

### Development Server
Starts the Astro SSR dev server locally with zero-config SQLite & memory KV fallback:
```bash
npm run dev
```
Open [http://localhost:4321](http://localhost:4321) in your browser.

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

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET`, `POST` | `/api/v1/trips` | List trips or create a new auto-scaffolded trip |
| `GET`, `PATCH`, `DELETE` | `/api/v1/trips/:tripId` | Fetch full/compact trip hierarchy, update, or delete |
| `GET` | `/api/v1/trips/:tripId/summary` | Concise token-efficient trip summary |
| `GET`, `PATCH` | `/api/v1/trips/:tripId/days/:dayNumber` | Get or update day schedule and notes |
| `POST` | `/api/v1/trips/:tripId/sections` | Create custom scheduled or wishlist section |
| `GET`, `POST` | `/api/v1/trips/:tripId/collaborators` | List or invite collaborators |
| `GET`, `POST`, `PATCH` | `/api/v1/trips/:tripId/checklists` | List checklists, add items, or toggle completion |
| `GET`, `POST`, `DELETE` | `/api/v1/trips/:tripId/notes` | List, upsert, or delete Markdown notes |
| `GET`, `POST` | `/api/v1/places/search` | Search places via Nominatim or offline catalog |
| `POST`, `PATCH`, `DELETE` | `/api/v1/trips/:tripId/stops` | Add, reorder, or remove itinerary stops |
| `POST` | `/api/v1/trips/:tripId/optimize` | 2-Opt TSP route optimizer for daily stops |
| `GET`, `POST` | `/api/v1/trips/:tripId/reservations` | List or record travel reservations |
| `GET`, `POST` | `/api/v1/trips/:tripId/expenses` | List or record multi-currency expenses |
| `GET` | `/api/v1/trips/:tripId/settlement` | Calculate Splitwise debt settlement transfers |
| `GET` | `/api/v1/trips/:tripId/export` | Export trip as Markdown, iCalendar (`.ics`), or CSV |
| `POST` | `/api/v1/chat` | Conversational travel planner agent endpoint |
| `GET` | `/.well-known/ai-plugin.json` | ChatGPT Plugin Manifest |
| `GET` | `/api/v1/openapi.json` | OpenAPI 3.1.0 Specification |

---

## 📄 License
MIT
