# TripPlanner Live Session Synchronization Rule

**Scope**: Workspace conversations related to trip planning, itineraries, reservations, expenses, or UI navigation in TripPlanner.

## Core Rules

1. **Check Live UI State First**:
   Before modifying trips or answering contextual questions, inspect `get_session_context` (or `GET /api/v1/session`) to detect what the user is currently viewing in the browser:
   - `active_trip_id`
   - `active_day_number`
   - `active_tab` (`itinerary`, `wishlist`, `bookings`, `budget`, `checklists`)
   - `selected_stop_id`

2. **Contextual Fallbacks**:
   - If `trip_id` is omitted in a command, default to `session.active_trip_id`.
   - If `day_number` is omitted when scheduling a stop, default to `session.active_day_number`.
   - If `stop_id` is omitted for reordering/moving/deleting, default to `session.selected_stop_id`.

3. **Mutations Through TripPlanner MCP Server**:
   - Execute all mutations using MCP tools (`add_stop`, `move_stop`, `delete_stop`, `optimize_day_route`, `add_reservation`, `log_expense`, `manage_checklist`, `navigate_ui`) or the `/api/v1/chat` endpoint.
   - Every mutation updates `workspace_sessions` (`state_version = state_version + 1`, `last_actor = 'agy'`) and inserts into `session_events`, enabling the connected Web UI to immediately hot-reload.
