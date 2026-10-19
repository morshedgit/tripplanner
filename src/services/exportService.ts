import type { DatabaseAdapter } from '../db/client';
import type { Trip } from '../types/domain';

/**
 * Escapes text for RFC 5545 iCalendar values.
 * RFC 5545 requires escaping backslashes, semicolons, commas, and newlines.
 */
function escapeIcsText(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n');
}

/**
 * Folds an iCalendar line according to RFC 5545 (max 75 octets per line).
 */
function foldIcsLine(line: string): string {
  const MAX_LEN = 75;
  if (line.length <= MAX_LEN) return line;

  let result = '';
  let remaining = line;
  let first = true;

  while (remaining.length > 0) {
    if (first) {
      result += remaining.slice(0, MAX_LEN);
      remaining = remaining.slice(MAX_LEN);
      first = false;
    } else {
      result += '\r\n ' + remaining.slice(0, MAX_LEN - 1);
      remaining = remaining.slice(MAX_LEN - 1);
    }
  }

  return result;
}

/**
 * Formats a JavaScript Date to an iCalendar UTC timestamp: YYYYMMDDTHHMMSSZ
 */
function formatUtcIcs(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const mins = pad(date.getUTCMinutes());
  const secs = pad(date.getUTCSeconds());
  return `${year}${month}${day}T${hours}${mins}${secs}Z`;
}

/**
 * Escapes a string or number for CSV output according to RFC 4180.
 */
function escapeCsv(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Exports a complete, Wanderlog-style Markdown trip guide for the given trip.
 */
export async function exportTripMarkdown(db: DatabaseAdapter, tripId: string): Promise<string> {
  const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]);
  if (!trip) {
    throw new Error(`Trip not found: ${tripId}`);
  }

  const lines: string[] = [];

  // Title and Core Details
  lines.push(`# ${trip.title}`);
  lines.push('');
  lines.push(`**Destination:** ${trip.destination}`);
  lines.push(`**Dates:** ${trip.start_date} to ${trip.end_date}`);
  lines.push(`**Timezone:** ${trip.timezone}`);
  lines.push(`**Currency:** ${trip.currency}`);
  if (trip.budget_cap !== null && trip.budget_cap !== undefined) {
    lines.push(`**Budget Cap:** $${Number(trip.budget_cap).toFixed(2)} ${trip.currency}`);
  }
  lines.push('');

  // Collaborators
  const collaborators = await db.query<{ name: string; email: string; role: string }>(
    `SELECT name, email, role FROM collaborators WHERE trip_id = ? ORDER BY role = 'owner' DESC, name ASC`,
    [tripId]
  );
  if (collaborators.length > 0) {
    lines.push('## Collaborators');
    lines.push('');
    for (const c of collaborators) {
      lines.push(`- **${c.name}** (${c.role}) — ${c.email}`);
    }
    lines.push('');
  }

  // Trip Notes & Travel Tips
  const notes = await db.query<{ title: string; content: string }>(
    `SELECT title, content FROM trip_notes WHERE trip_id = ? ORDER BY created_at ASC`,
    [tripId]
  );
  if (notes.length > 0) {
    lines.push('## Travel Notes & Tips');
    lines.push('');
    for (const note of notes) {
      lines.push(`### ${note.title}`);
      lines.push(note.content);
      lines.push('');
    }
  }

  // Daily Itinerary
  const days = await db.query<{ id: string; day_number: number; date: string; notes: string | null }>(
    `SELECT id, day_number, date, notes FROM days WHERE trip_id = ? ORDER BY day_number ASC`,
    [tripId]
  );

  if (days.length > 0) {
    lines.push('## Itinerary');
    lines.push('');

    for (const day of days) {
      lines.push(`### Day ${day.day_number}: ${day.date}`);
      if (day.notes) {
        lines.push(`*${day.notes}*`);
      }
      lines.push('');

      const sections = await db.query<{ id: string; title: string; section_type: string; sort_order: number }>(
        `SELECT id, title, section_type, sort_order FROM sections WHERE trip_id = ? AND day_id = ? ORDER BY sort_order ASC`,
        [tripId, day.id]
      );

      for (const section of sections) {
        lines.push(`#### ${section.title}`);
        lines.push('');

        const stops = await db.query<any>(
          `SELECT s.*,
                  p.name AS place_name,
                  p.formatted_address,
                  p.category AS place_category,
                  p.rating,
                  p.google_place_id,
                  p.website,
                  p.phone_number,
                  p.notes AS place_notes
           FROM stops s
           JOIN places p ON s.place_id = p.id
           WHERE s.section_id = ?
           ORDER BY s.sort_order ASC`,
          [section.id]
        );

        if (stops.length === 0) {
          lines.push('*No stops scheduled in this section.*');
          lines.push('');
          continue;
        }

        for (const stop of stops) {
          lines.push(`- **${stop.place_name}** (${stop.place_category})`);

          // Timing
          if (stop.arrival_time && stop.departure_time) {
            lines.push(`  - **Time:** ${stop.arrival_time} – ${stop.departure_time}${stop.duration_minutes ? ` (${stop.duration_minutes} mins)` : ''}`);
          } else if (stop.arrival_time) {
            lines.push(`  - **Arrival:** ${stop.arrival_time}${stop.duration_minutes ? ` (${stop.duration_minutes} mins)` : ''}`);
          }

          // Address
          if (stop.formatted_address) {
            lines.push(`  - **Address:** ${stop.formatted_address}`);
          }

          // Rating
          if (stop.rating !== null && stop.rating !== undefined) {
            lines.push(`  - **Rating:** ⭐ ${stop.rating} / 5.0`);
          }

          // Contact / Website
          if (stop.website) {
            lines.push(`  - **Website:** ${stop.website}`);
          }
          if (stop.phone_number) {
            lines.push(`  - **Phone:** ${stop.phone_number}`);
          }

          // Budget
          if (stop.budget_amount !== null && stop.budget_amount !== undefined) {
            lines.push(`  - **Estimated Cost:** $${Number(stop.budget_amount).toFixed(2)}`);
          }

          // User Notes
          if (stop.user_notes) {
            lines.push(`  - **Notes:** ${stop.user_notes}`);
          }

          // Place Notes
          if (stop.place_notes) {
            lines.push(`  - **About Place:** ${stop.place_notes}`);
          }

          // Transit Leg to Next Stop
          const leg = await db.queryOne<{
            transit_mode: string;
            duration_seconds: number;
            distance_meters: number;
            route_instructions: string | null;
          }>(
            `SELECT transit_mode, duration_seconds, distance_meters, route_instructions
             FROM transit_legs
             WHERE trip_id = ? AND from_stop_id = ?
             LIMIT 1`,
            [tripId, stop.id]
          );

          if (leg) {
            const mins = Math.round(leg.duration_seconds / 60);
            const km = (leg.distance_meters / 1000).toFixed(1);
            const mode = leg.transit_mode.charAt(0).toUpperCase() + leg.transit_mode.slice(1);
            lines.push(`  - 🚗 **Transit to next:** ${mode} · ~${mins} min (${km} km)${leg.route_instructions ? ` — ${leg.route_instructions}` : ''}`);
          }

          lines.push('');
        }
      }
    }
  }

  // Wishlist & Unscheduled Sections
  const wishlistSections = await db.query<{ id: string; title: string }>(
    `SELECT id, title FROM sections WHERE trip_id = ? AND day_id IS NULL ORDER BY sort_order ASC`,
    [tripId]
  );

  if (wishlistSections.length > 0) {
    let wishlistHasStops = false;
    const wishlistLines: string[] = ['## Wishlist & Unscheduled Places', ''];

    for (const section of wishlistSections) {
      const stops = await db.query<any>(
        `SELECT s.*, p.name AS place_name, p.formatted_address, p.category AS place_category
         FROM stops s
         JOIN places p ON s.place_id = p.id
         WHERE s.section_id = ?
         ORDER BY s.sort_order ASC`,
        [section.id]
      );

      if (stops.length > 0) {
        wishlistHasStops = true;
        wishlistLines.push(`### ${section.title}`);
        for (const stop of stops) {
          wishlistLines.push(`- **${stop.place_name}** (${stop.place_category}) — ${stop.formatted_address}${stop.user_notes ? ` [Notes: ${stop.user_notes}]` : ''}`);
        }
        wishlistLines.push('');
      }
    }

    if (wishlistHasStops) {
      lines.push(...wishlistLines);
    }
  }

  // Reservations
  const reservations = await db.query<{
    type: string;
    title: string;
    confirmation_code: string | null;
    provider: string | null;
    start_time: string;
    end_time: string | null;
    location: string | null;
    cost: number;
    currency: string;
    notes: string | null;
  }>(`SELECT * FROM reservations WHERE trip_id = ? ORDER BY start_time ASC`, [tripId]);

  if (reservations.length > 0) {
    lines.push('## Reservations');
    lines.push('');
    lines.push('| Type | Title | Provider | Confirmation Code | Dates / Time | Location | Cost |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');

    for (const r of reservations) {
      const typeStr = r.type.charAt(0).toUpperCase() + r.type.slice(1);
      const conf = r.confirmation_code ? `\`${r.confirmation_code}\`` : '—';
      const prov = r.provider || '—';
      const timeStr = r.end_time ? `${r.start_time} to ${r.end_time}` : r.start_time;
      const loc = r.location || '—';
      const costStr = `$${Number(r.cost).toFixed(2)} ${r.currency}`;
      lines.push(`| ${typeStr} | ${r.title} | ${prov} | ${conf} | ${timeStr} | ${loc} | ${costStr} |`);
    }
    lines.push('');
  }

  // Checklists
  const checklists = await db.query<{ id: string; title: string; category: string }>(
    `SELECT id, title, category FROM checklists WHERE trip_id = ? ORDER BY sort_order ASC`,
    [tripId]
  );

  if (checklists.length > 0) {
    lines.push('## Checklists');
    lines.push('');

    for (const chk of checklists) {
      lines.push(`### ${chk.title} (${chk.category})`);

      const items = await db.query<{
        title: string;
        is_completed: number;
        collaborator_name: string | null;
      }>(
        `SELECT ci.title, ci.is_completed, c.name AS collaborator_name
         FROM checklist_items ci
         LEFT JOIN collaborators c ON ci.assigned_to_collaborator_id = c.id
         WHERE ci.checklist_id = ?
         ORDER BY ci.sort_order ASC`,
        [chk.id]
      );

      for (const item of items) {
        const checkbox = item.is_completed ? '[x]' : '[ ]';
        const assignee = item.collaborator_name ? ` *(Assigned to: ${item.collaborator_name})*` : '';
        lines.push(`- ${checkbox} ${item.title}${assignee}`);
      }
      lines.push('');
    }
  }

  // Expenses & Budget
  const expenses = await db.query<{
    title: string;
    amount: number;
    currency: string;
    category: string;
    date: string;
    split_strategy: string;
    paid_by_name: string | null;
  }>(
    `SELECT e.title, e.amount, e.currency, e.category, e.date, e.split_strategy, c.name AS paid_by_name
     FROM expenses e
     LEFT JOIN collaborators c ON e.paid_by_collaborator_id = c.id
     WHERE e.trip_id = ?
     ORDER BY e.date ASC, e.created_at ASC`,
    [tripId]
  );

  if (expenses.length > 0) {
    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    lines.push('## Expenses & Budget');
    lines.push('');
    lines.push(`- **Total Expenses:** $${total.toFixed(2)} ${trip.currency}`);
    if (trip.budget_cap !== null && trip.budget_cap !== undefined) {
      lines.push(`- **Budget Cap:** $${Number(trip.budget_cap).toFixed(2)} ${trip.currency}`);
      const remaining = Number(trip.budget_cap) - total;
      lines.push(`- **Remaining Budget:** $${remaining.toFixed(2)} ${trip.currency}`);
    }
    lines.push('');

    lines.push('| Date | Description | Category | Paid By | Amount | Split Strategy |');
    lines.push('| --- | --- | --- | --- | --- | --- |');

    for (const exp of expenses) {
      const payer = exp.paid_by_name || 'Unknown';
      lines.push(`| ${exp.date} | ${exp.title} | ${exp.category} | ${payer} | $${Number(exp.amount).toFixed(2)} ${exp.currency} | ${exp.split_strategy} |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Exports a standards-compliant RFC 5545 .ics iCalendar feed containing
 * all scheduled itinerary stops and reservations for calendar synchronization.
 */
export async function exportTripIcs(db: DatabaseAdapter, tripId: string): Promise<string> {
  const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]);
  if (!trip) {
    throw new Error(`Trip not found: ${tripId}`);
  }

  const icsLines: string[] = [];
  const nowUtc = formatUtcIcs(new Date());

  // VCALENDAR Header
  icsLines.push('BEGIN:VCALENDAR');
  icsLines.push('VERSION:2.0');
  icsLines.push('PRODID:-//TripPlanner//TripPlanner Itinerary RFC5545//EN');
  icsLines.push('CALSCALE:GREGORIAN');
  icsLines.push('METHOD:PUBLISH');
  icsLines.push(`X-WR-CALNAME:${escapeIcsText(trip.title)}`);
  icsLines.push(`X-WR-TIMEZONE:${trip.timezone || 'UTC'}`);

  // 1. Scheduled Itinerary Stops
  const scheduledStops = await db.query<{
    id: string;
    arrival_time: string | null;
    departure_time: string | null;
    duration_minutes: number | null;
    user_notes: string | null;
    day_date: string;
    place_name: string;
    formatted_address: string;
    place_category: string;
  }>(
    `SELECT s.id, s.arrival_time, s.departure_time, s.duration_minutes, s.user_notes,
            d.date AS day_date, p.name AS place_name, p.formatted_address, p.category AS place_category
     FROM stops s
     JOIN sections sec ON s.section_id = sec.id
     JOIN days d ON sec.day_id = d.id
     JOIN places p ON s.place_id = p.id
     WHERE sec.trip_id = ? AND d.date IS NOT NULL
     ORDER BY d.date ASC, s.sort_order ASC`,
    [tripId]
  );

  for (const stop of scheduledStops) {
    icsLines.push('BEGIN:VEVENT');
    icsLines.push(`UID:stop-${stop.id}@tripplanner.dev`);
    icsLines.push(`DTSTAMP:${nowUtc}`);

    const dateClean = stop.day_date.replace(/-/g, '');

    if (stop.arrival_time) {
      const [arrH, arrM] = stop.arrival_time.split(':').map((v) => parseInt(v, 10) || 0);
      const startStr = `${dateClean}T${String(arrH).padStart(2, '0')}${String(arrM).padStart(2, '0')}00`;

      let endStr: string;
      if (stop.departure_time) {
        const [depH, depM] = stop.departure_time.split(':').map((v) => parseInt(v, 10) || 0);
        endStr = `${dateClean}T${String(depH).padStart(2, '0')}${String(depM).padStart(2, '0')}00`;
      } else {
        const duration = stop.duration_minutes || 60;
        const totalEndMinutes = arrH * 60 + arrM + duration;
        const endH = Math.floor(totalEndMinutes / 60) % 24;
        const endM = totalEndMinutes % 60;
        endStr = `${dateClean}T${String(endH).padStart(2, '0')}${String(endM).padStart(2, '0')}00`;
      }

      const tzid = trip.timezone || 'UTC';
      icsLines.push(`DTSTART;TZID=${tzid}:${startStr}`);
      icsLines.push(`DTEND;TZID=${tzid}:${endStr}`);
    } else {
      // All-day event
      icsLines.push(`DTSTART;VALUE=DATE:${dateClean}`);
      icsLines.push(`DTEND;VALUE=DATE:${dateClean}`);
    }

    icsLines.push(`SUMMARY:${escapeIcsText(stop.place_name)}`);

    const descParts: string[] = [];
    if (stop.user_notes) descParts.push(stop.user_notes);
    descParts.push(`Category: ${stop.place_category}`);
    if (stop.formatted_address) descParts.push(`Address: ${stop.formatted_address}`);
    icsLines.push(`DESCRIPTION:${escapeIcsText(descParts.join('\n'))}`);

    if (stop.formatted_address) {
      icsLines.push(`LOCATION:${escapeIcsText(stop.formatted_address)}`);
    }

    icsLines.push('STATUS:CONFIRMED');
    icsLines.push('END:VEVENT');
  }

  // 2. Reservations (Flights, Hotels, Activities)
  const reservations = await db.query<{
    id: string;
    type: string;
    title: string;
    confirmation_code: string | null;
    provider: string | null;
    start_time: string;
    end_time: string | null;
    location: string | null;
    cost: number;
    currency: string;
    notes: string | null;
  }>(`SELECT * FROM reservations WHERE trip_id = ? ORDER BY start_time ASC`, [tripId]);

  for (const res of reservations) {
    icsLines.push('BEGIN:VEVENT');
    icsLines.push(`UID:res-${res.id}@tripplanner.dev`);
    icsLines.push(`DTSTAMP:${nowUtc}`);

    const startDate = new Date(res.start_time);
    const startUtcStr = isNaN(startDate.getTime())
      ? nowUtc
      : formatUtcIcs(startDate);

    let endUtcStr: string;
    if (res.end_time) {
      const endDate = new Date(res.end_time);
      endUtcStr = isNaN(endDate.getTime()) ? startUtcStr : formatUtcIcs(endDate);
    } else {
      // Default to 1 hour after start
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      endUtcStr = formatUtcIcs(endDate);
    }

    icsLines.push(`DTSTART:${startUtcStr}`);
    icsLines.push(`DTEND:${endUtcStr}`);

    const summary = `[${res.type.toUpperCase()}] ${res.title}${res.provider ? ` (${res.provider})` : ''}`;
    icsLines.push(`SUMMARY:${escapeIcsText(summary)}`);

    if (res.location) {
      icsLines.push(`LOCATION:${escapeIcsText(res.location)}`);
    }

    const descLines: string[] = [];
    if (res.confirmation_code) descLines.push(`Confirmation Code: ${res.confirmation_code}`);
    if (res.provider) descLines.push(`Provider: ${res.provider}`);
    if (res.cost) descLines.push(`Cost: $${Number(res.cost).toFixed(2)} ${res.currency}`);
    if (res.notes) descLines.push(`Notes: ${res.notes}`);
    icsLines.push(`DESCRIPTION:${escapeIcsText(descLines.join('\n'))}`);

    icsLines.push('STATUS:CONFIRMED');
    icsLines.push('END:VEVENT');
  }

  icsLines.push('END:VCALENDAR');

  // Fold lines and append RFC 5545 CRLF endings
  return icsLines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/**
 * Exports all trip expenses in properly escaped CSV format.
 * Header: Date,Description,Category,Amount,Currency,ConvertedBaseAmount,BaseCurrency,PaidBy,SplitStrategy
 */
export async function exportExpensesCsv(db: DatabaseAdapter, tripId: string): Promise<string> {
  const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]);
  if (!trip) {
    throw new Error(`Trip not found: ${tripId}`);
  }

  const rows: string[] = [];

  // CSV Header
  rows.push('Date,Description,Category,Amount,Currency,ConvertedBaseAmount,BaseCurrency,PaidBy,SplitStrategy');

  const expenses = await db.query<{
    title: string;
    amount: number;
    currency: string;
    category: string;
    date: string;
    split_strategy: string;
    paid_by_name: string | null;
  }>(
    `SELECT e.title, e.amount, e.currency, e.category, e.date, e.split_strategy, c.name AS paid_by_name
     FROM expenses e
     LEFT JOIN collaborators c ON e.paid_by_collaborator_id = c.id
     WHERE e.trip_id = ?
     ORDER BY e.date ASC, e.created_at ASC`,
    [tripId]
  );

  for (const exp of expenses) {
    const date = escapeCsv(exp.date);
    const description = escapeCsv(exp.title);
    const category = escapeCsv(exp.category);
    const amount = Number(exp.amount).toFixed(2);
    const currency = escapeCsv(exp.currency);
    const convertedAmount = Number(exp.amount).toFixed(2); // Same 1:1 if same currency
    const baseCurrency = escapeCsv(trip.currency);
    const paidBy = escapeCsv(exp.paid_by_name || 'Unknown');
    const splitStrategy = escapeCsv(exp.split_strategy);

    rows.push(`${date},${description},${category},${amount},${currency},${convertedAmount},${baseCurrency},${paidBy},${splitStrategy}`);
  }

  return rows.join('\r\n') + '\r\n';
}
