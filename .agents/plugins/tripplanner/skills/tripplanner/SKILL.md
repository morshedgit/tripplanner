---
name: tripplanner
description: >-
  Connects Antigravity (agy) to the local TripPlanner application (http://localhost:4321),
  allowing the agent to inspect the user's active UI session (selected trip, day, tab, stop),
  execute trip itinerary mutations via MCP tools or HTTP API, and keep the open Web UI
  synchronized in real time.
---

# TripPlanner Companion Skill

This skill guides the agent in collaborating with the user on trip planning using the **TripPlanner** Wanderlog-style web application and its Model Context Protocol (MCP) server.

## Overview

TripPlanner runs locally at `http://localhost:4321` with an interactive Web UI backed by SQLite / Cloudflare D1. The web interface and Antigravity share persistent bi-directional session state (`workspace_sessions` and `session_events`).

When the user opens the Web UI in their browser and talks to Antigravity (`agy`), both agents (the human in the browser and the AI in `agy`) interact on the exact same live workspace:
- Any click or selection in the browser updates `workspace_sessions` (`last_actor = 'ui'`).
- Any tool call or command from `agy` updates the database and bumps `state_version` (`last_actor = 'agy'`), which immediately hot-reloads the user's open browser view.

---

## 1. Verifying Application Status

Ensure the TripPlanner local server is running:
- Web UI: `http://localhost:4321`
- MCP Server Endpoint: `http://localhost:4321/api/v1/mcp`
- Session API: `http://localhost:4321/api/v1/session`

If the development server is not running, run:
```bash
npm run dev
```

---

## 2. Inspecting Live UI Context

Before suggesting or executing actions, inspect what the user is currently viewing:

### Via MCP Tool
Call `get_session_context`:
```json
{
  "session_id": "default"
}
```
Returns:
- `session.active_trip_id`: The trip currently open in the browser.
- `session.active_day_number`: The day schedule the user is viewing (e.g. Day 1, Day 2).
- `session.active_tab`: Currently selected tab (`itinerary`, `wishlist`, `bookings`, `budget`, `checklists`).
- `session.selected_stop_id`: The stop card or map marker currently clicked/highlighted.
- `session.last_event_summary`: What the user did recently in the UI.
- `session.state_version`: The monotonic version counter.
- `trip`: Overview and statistics of the active trip.
- `selected_stop`: Place details (coordinates, address, category, notes) of the selected stop.

### Via HTTP API
```bash
curl http://localhost:4321/api/v1/session
```

---

## 3. Controlling and Navigating the Web UI

You can programmatically drive the user's browser view using the `navigate_ui` tool:
```json
{
  "active_tab": "itinerary",
  "active_day_number": 2,
  "selected_stop_id": "stop_abc123",
  "message": "Switched to Day 2 to inspect Kinkaku-ji"
}
```
This triggers an instant UI update in the user's browser, scrolling to Day 2 and highlighting the stop pin on the interactive map.

---

## 4. Trip Planning & Itinerary Tools

Use the following MCP tools to modify trip data. Every mutating call increments `state_version` with `last_actor = 'agy'`, causing connected browsers to immediately hot-reload:

### Itinerary & Stops
- `add_stop`: Adds an attraction, restaurant, or custom place to a day schedule or wishlist. Defaults to `active_trip_id` and `active_day_number` if omitted.
- `move_stop`: Moves a stop across sections or days, or reorders within a day. Defaults `stop_id` to `selected_stop_id`.
- `delete_stop`: Removes a stop from the itinerary. Defaults `stop_id` to `selected_stop_id`.
- `optimize_day_route`: Solves the Traveling Salesperson Problem (TSP) using 2-Opt local search to minimize walking or driving transit time. Defaults to `active_day_number`.

### Bookings & Reservations
- `add_reservation`: Logs flights, hotels, trains, or car rentals with confirmation numbers and dates. Automatically switches the active tab to `bookings`.

### Budget & Splitwise Debt Settlement
- `log_expense`: Records multi-currency expenses, converts to base trip currency, and splits costs among travelers (equal, exact, percentage, shares). Automatically switches active tab to `budget`.
- `get_budget_settlement`: Computes minimized debt transfers between travelers ("who owes whom").

### Checklists & Notes
- `manage_checklist`: Adds (`action: "add"`) or toggles (`action: "toggle"`) items in packing, todo, or documents checklists. Automatically switches active tab to `checklists`.

### Conversational Natural-Language Execution
- `chat_with_tripplanner`: Sends a natural language command (e.g. *"Plan 3 days in Kyoto"*, *"Add Gion to tonight"*, *"Who owes whom?"*) and executes it through the TripPlanner conversational assistant.

---

## 5. Best Practices for Pairing with the User

1. **Check Session First**: When the user refers to "this place", "today", or "the hotel", always check `get_session_context` to infer their context from the open browser.
2. **Contextual Defaults**: Omit `trip_id`, `day_number`, and `stop_id` when the user refers to the current view; the MCP tools will automatically use the live session state.
3. **Notify Visually**: Provide clear feedback on what was changed, knowing that the user will simultaneously see the UI react on their screen.
