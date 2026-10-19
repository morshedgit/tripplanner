# AGENTS.md — TripPlanner Live Session & Sync Guidelines

These rules govern agent behavior when interacting with the TripPlanner codebase, Web UI, or user trip sessions.

## 1. Always Check Live UI Session Context First
Whenever the user asks a question or gives an instruction about their trip (e.g., *"What's on the itinerary?"*, *"Add this cafe"*, *"Move the stop to tomorrow"*, *"How much do we owe?"*):
- Immediately query the live session state before taking action:
  - Call MCP tool `get_session_context` (or `GET /api/v1/session`).
  - Read `active_trip_id`, `active_day_number`, `active_tab`, and `selected_stop_id`.
- This ensures your actions apply to the exact trip, day, or stop card the user is currently viewing in their browser.

## 2. Use Contextual Defaults
- If the user says "add to today" or "add here", default to `active_day_number` from the session.
- If the user says "move this stop" or "delete it", default `stop_id` to `selected_stop_id` from the session.
- If the user does not specify a trip ID, use `active_trip_id`.

## 3. Perform Mutations Through MCP Tools or the API
- Never directly modify the underlying SQLite file if the TripPlanner server is running.
- Always execute mutations via the TripPlanner MCP tools (`add_stop`, `move_stop`, `delete_stop`, `optimize_day_route`, `add_reservation`, `log_expense`, `manage_checklist`, `navigate_ui`) or the `/api/v1/chat` endpoint.
- Every mutation automatically increments `workspace_sessions.state_version` and records a `session_events` entry with `last_actor = 'agy'`, which triggers real-time SSE hot-reloading in the user's browser.

## 4. Keep Visual State Synchronized
- When adding reservations, switch or inform the user that bookings are on the `bookings` tab (`navigate_ui`).
- When logging expenses or settling balances, direct the user's attention to the `budget` tab.
- When optimizing routes, highlight the time saved and the new stop sequence.
