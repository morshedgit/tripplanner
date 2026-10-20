# TripPlanner Design System & UI/UX Guidelines
**Authoritative Spatial Travel Workspace Specification (2026 Edition)**

---

## 1. Executive Summary & Design System Manifesto

TripPlanner is an AI-native spatial travel workspace engineered to bridge high-touch editorial travel journalism with the real-time precision of spatial operating tools (benchmarked against Wanderlog, Mindtrip, Linear, and Airbnb Trips). 

The interface marries three primary modalities:
1. **Conversational Co-Pilot (Left Pane)**: A persistent, proactive travel assistant powered by the Antigravity (AGY) agentic runtime.
2. **Spatial Canvas (Center Pane)**: An editorial, magazine-inspired document surface supporting multi-day itineraries, visual booking vouchers, and collaborative peer-to-peer expense settlement.
3. **Cartographic Intelligence (Right Pane)**: An interactive, low-contrast GIS map featuring numbered teardrop waypoint pins, dual-stroke polylines, and rich photo popovers.

### Core Tenets
- **Editorial Elegance**: Clean light-mode alabaster surfaces, generous whitespace, deliberate typographic hierarchy, and curated imagery replace dense utilitarian spreadsheets.
- **Zero-Emoji Vector Strictness**: 100% crisp, currentColor SVG vector iconography. Raw Unicode emojis are strictly forbidden in UI components, notifications, and AI conversational generation.
- **Non-Destructive In-Place Hydration**: The UI never triggers a full-page browser refresh (`window.location.reload()`). State mutations stream over Server-Sent Events (SSE) or poll loops, hydrating the DOM seamlessly via `refreshWorkspaceDom` while preserving user input, scroll states, and active chat threads.
- **Immediate Spatial Parity**: Every stop card on the itinerary timeline corresponds 1:1 with a numbered map pin, category color badge, and route waypoint.

---

## 2. Visual Philosophy & Aesthetic Benchmarks

TripPlanner balances high-density utility with serene aesthetic calm:

| Dimension | Standard Specification |
|---|---|
| **Aesthetic Baseline** | Editorial magazine meets high-velocity spatial canvas (Linear + Wanderlog + Mindtrip + Airbnb Trips). |
| **Canvas Tone** | Warm Alabaster (`#f8fafc`) and pure Studio White (`#ffffff`), avoiding stark `#000000` pitch blacks in favor of Deep Slate / Charcoal Ink (`#0f172a`, `#1e293b`). |
| **Material & Depth** | Hairline 1px borders (`#e2e8f0`), glassmorphic backdrop filters (`backdrop-filter: blur(8px)` with translucent white/slate fills), and layered ambient elevation shadows. |
| **Radii & Contours** | Modern rounded geometry: 14px for editorial hero banners, 11px-12px for interactive cards, 8px-10px for photo thumbnails, and full pill borders (9999px) for status indicators, category tags, and action chips. |

---

## 3. Typography System

The typography scale utilizes **Plus Jakarta Sans** for all editorial headings, display titles, and UI body copy, paired with **JetBrains Mono** for numerical values, financial amounts, times, coordinates, and telemetry badges.

```
Headings & Interface:  'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif
Metrics & Financial:   'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace
```

### Typographic Hierarchy Scale

| Token / Class | Font Family | Size | Weight | Line Height | Tracking | Usage / Context |
|---|---|---|---|---|---|---|
| `display-hero` | Plus Jakarta Sans | 24px (1.55rem) | 800 (Bold) | 1.20 | -0.025em | Destination cover title |
| `h1-section` | Plus Jakarta Sans | 18px (1.15rem) | 800 (Bold) | 1.30 | -0.020em | Tab headers, modal titles |
| `h2-day-title` | Plus Jakarta Sans | 15px (0.95rem) | 800 (Bold) | 1.35 | -0.015em | Day card headers ("Day 1 — Arrival") |
| `h3-card-title`| Plus Jakarta Sans | 14px (0.88rem) | 700 (Semi) | 1.40 | -0.010em | Stop names, booking titles, budget widgets |
| `body-ui` | Plus Jakarta Sans | 13.2px (0.825rem) | 500 (Reg) | 1.45 | 0.000em | Standard UI copy, chat message bubbles |
| `caption-meta` | Plus Jakarta Sans | 11.5px (0.72rem) | 600 (Semi) | 1.40 | +0.010em | Stop metadata (address, duration, category) |
| `badge-kicker` | Plus Jakarta Sans | 10.5px (0.65rem) | 700 (Semi) | 1.20 | +0.050em | Section kickers, booking type badges (UPPERCASE) |
| `metric-number`| JetBrains Mono | 13.5px (0.85rem) | 700 (Semi) | 1.20 | -0.020em | Prices, net balances, ledger amounts |
| `time-badge` | JetBrains Mono | 11.5px (0.72rem) | 600 (Semi) | 1.20 | 0.000em | Arrival timestamps, duration minutes |
| `telemetry-mono`| JetBrains Mono | 10px (0.625rem) | 500 (Reg) | 1.20 | +0.020em | Agent tool invocations, state versions |

---

## 4. Color Palette & Semantic Tokens

TripPlanner enforces a strict functional color token matrix to prevent arbitrary hex proliferation.

### CSS Custom Properties (`:root`)
```css
:root {
  /* Brand & Interactive */
  --primary: #2563eb;          /* Royal Travel Blue */
  --primary-hover: #1d4ed8;    /* Deep Blue Hover */
  --primary-light: #eff6ff;    /* Ice Blue Active Tint */
  --accent: #f97316;           /* Sunset Amber / Highlights */
  --accent-light: #fff7ed;     /* Soft Amber Tint */

  /* Surface & Canvas */
  --bg-main: #f8fafc;          /* Slate 50 Neutral Canvas */
  --bg-card: #ffffff;          /* Pure Card Surface */
  --bg-subtle: #f1f5f9;        /* Slate 100 Recessed Surface */
  --border: #e2e8f0;           /* Slate 200 Hairline Border */
  --border-focus: #3b82f6;     /* Slate Active Border */

  /* Typography Ink */
  --text-primary: #0f172a;     /* Slate 900 Deep Charcoal */
  --text-secondary: #475569;   /* Slate 600 Secondary Body */
  --text-muted: #94a3b8;       /* Slate 400 Micro Copy */

  /* Feedback & Telemetry */
  --success: #10b981;          /* Emerald Green (Live SSE, Settled) */
  --success-bg: #ecfdf5;       /* Emerald 50 */
  --warning: #f59e0b;          /* Amber 500 (Ratings, Attention) */
  --warning-bg: #fffbeb;       /* Amber 50 */
  --danger: #ef4444;           /* Rose Red (Deletions, Debt) */
  --danger-bg: #fef2f2;        /* Rose 50 */

  /* Spatial Geometry */
  --header-height: 56px;
  --session-bar-height: 40px;
}
```

### Day Sequence Accents (Cyclic 1..6)
Each day in an itinerary is assigned a signature accent that coordinates the sticky carousel pill, day header, timeline spine pin, map marker teardrop, and polyline route:

```typescript
export const DAY_COLORS = [
  '#2563eb', // Day 1: Royal Blue
  '#16a34a', // Day 2: Emerald Green
  '#d97706', // Day 3: Warm Ochre Amber
  '#9333ea', // Day 4: Deep Violet
  '#e11d48', // Day 5: Ruby Rose
  '#0891b2', // Day 6+: Cyan Teal
];
```

### Category Semantic Badges
Every place, stop, booking, and expense category adheres to dedicated chromatic badge pairings:

| Category | Pill Background | Border / Accent | Text Color | Associated Vector Icon |
|---|---|---|---|---|
| **Dining & Food** | `#fff7ed` (Orange 50) | `#ffedd5` | `#c2410c` (Orange 700) | `tag` / `sparkles` |
| **Lodging & Hotels** | `#eff6ff` (Blue 50) | `#dbeafe` | `#1d4ed8` (Blue 700) | `hotel` / `building` |
| **Transit & Travel** | `#f5f3ff` (Purple 50) | `#ede9fe` | `#6d28d9` (Purple 700) | `transit` / `train` / `car` / `walk` |
| **Sight & Attraction** | `#ecfdf5` (Green 50) | `#d1fae5` | `#047857` (Green 700) | `map-pin` / `sunrise` |
| **Shopping** | `#fdf2f8` (Pink 50) | `#fce7f3` | `#be185d` (Pink 700) | `tag` / `suitcase` |
| **Culture & Heritage** | `#fffbeb` (Amber 50) | `#fef3c7` | `#b45309` (Amber 700) | `building` / `bookmark` |
| **Other / General** | `#f1f5f9` (Slate 100) | `#e2e8f0` | `#475569` (Slate 600) | `map-pin` |

---

## 5. Iconography Standards & Strict Zero-Emoji Rule

To maintain enterprise-grade visual authority and crisp pixel clarity on retina displays:

### The Absolute Zero-Emoji Rule
> [!CAUTION]
> **NO UNICODE EMOJIS UNDER ANY CIRCUMSTANCES.**
> Never render emojis (such as 📍, ✈️, 🗓️, 🏨, 🍜, 💰, 🤖, etc.) in templates, Astro pages, generated markdown, flash toasts, or AI chat agent responses. All visual iconography must use the vector library in `src/lib/icons.ts`.

### Vector SVG Icon Implementation
All icons are rendered as 24×24 viewBox SVGs styled via `currentColor`:

```typescript
import { getIconSvg } from '../lib/icons';

// Standard server-side Astro template invocation:
<span class="icon-inline" set:html={getIconSvg('plane', 16)}></span>
```

### Standard Icon Specifications
- **Stroke Width**: `stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`.
- **Default Sizes**:
  - `11px - 12px`: Micro-metadata badges, star ratings, move dropdown chevrons.
  - `14px - 16px`: Form buttons, section subheadings, pill prefixes, chat send buttons.
  - `20px - 24px`: Top navbar logo, booking stub primary glyphs, empty state illustrations.
- **Available Icons in `src/lib/icons.ts`**:
  `plane`, `logo`, `luggage`, `suitcase`, `map-pin`, `calendar`, `wallet`, `dollar`, `code`, `file-code`, `plug`, `cpu`, `download`, `file-text`, `table`, `bar-chart`, `plus`, `bolt`, `zap`, `bot`, `sparkles`, `users`, `check-square`, `list-checks`, `map`, `bookmark`, `ticket`, `hotel`, `building`, `train`, `sunrise`, `sun`, `moon`, `car`, `footprints`, `walk`, `train-front`, `transit`, `star`, `clock`, `hourglass`, `timer`, `tag`, `trash`, `x`, `arrow-right-left`, `move`.

---

## 6. Spatial Grid & Layout Architecture

The application layout uses an unyielding full-height 3-column spatial architecture:

```
+-----------------------------------------------------------------------------------------------+
| TOP NAVBAR (56px) - Logo, Trip Switcher, Quick Actions, Agent Profile, Export Dropdown        |
+-----------------------------------------------------------------------------------------------+
| LIVE TELEMETRY SUB-BAR (40px) - Trip ID, Day, Tab, Selected Stop, Version, SSE Pulse Indicator|
+-----------------------------------+-----------------------------------+-----------------------+
| LEFT PANE: CHAT CO-PILOT          | CENTER PANE: DOCUMENT CANVAS      | RIGHT PANE: MAP GIS   |
| (360px Fixed)                     | (Flex 1, Max-Width 860px)         | (440px Fixed)         |
|                                   |                                   |                       |
| - Header w/ Agent Status          | - Editorial Hero Banner (200px)   | - ESRI Canvas Tiles   |
| - #chatMessages Scroll Area       | - Sticky Canvas Navigation Tabs   | - Overlay Controls    |
| - Prompt Chips                    | - Itinerary / Wishlist / Bookings /| - Teardrop Pins 1..N  |
| - Fast Query Input Form           |   Budget & Splitwise Ledger       | - Dual-Stroke Polylines|
|                                   | - Timeline Spine & Stop Cards     | - Photo Popovers      |
+-----------------------------------+-----------------------------------+-----------------------+
```

### Exact Grid Dimensions
- **Top Header**: `height: 56px`, `z-index: 1000`, `background: #ffffff`, hairline bottom border `1px solid #e2e8f0`.
- **Live Sync Telemetry Bar**: `height: 40px`, `z-index: 998`, `background: #0f172a`, `color: #e2e8f0`, glowing Emerald live pulse indicator.
- **Left Pane (Chat Co-Pilot)**: `width: 360px`, fixed, scrollable messages thread, sticky bottom input.
- **Center Pane (Document Canvas)**: `flex: 1`, background `#ffffff`, child `.canvas-content` constrained to `max-width: 860px; margin: 0 auto;`.
- **Right Pane (Cartographic Map)**: `width: 440px`, flex-shrink `0`, houses full-bleed Leaflet container `#map` and floating glassmorphic filter controls.
- **Responsive Adaptations**:
  - Tablet (`<= 1100px`): Pane Map reduces to `340px`, Chat reduces to `320px`.
  - Mobile / Narrow (`<= 900px`): Collapses from 3 columns into vertical stack (`flex-direction: column`).

---

## 7. Cartography & Map Standards

The map pane provides spatial anchoring with uncompromising visual clarity.

### 1. Basemap Selection: ESRI World Light Gray Canvas
Watermarked, cluttered, or saturated basemaps are strictly banned.
```javascript
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 16,
  attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
}).addTo(mapInstance);
```

### 2. Numbered Teardrop Markers (Retina SVG/CSS)
Waypoints are styled as rotated rounded squares forming custom teardrop pins:
- **Geometry**: `width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg);`
- **Internal Text**: Inverted counter-rotation `transform: rotate(45deg);` displaying sequence number `1..N` matching the stop card on the timeline.
- **Border & Shadow**: `2px solid #ffffff` casing with `box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3)`.
- **Dynamic Accent**: Filled with corresponding `DAY_COLORS[(dayNum - 1) % 6]`.

```html
<div class="map-retina-pin" style="
  background: ${color};
  color: #ffffff;
  width: 28px;
  height: 28px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #ffffff;
  box-shadow: 0 4px 10px rgba(0,0,0,0.3);
">
  <span style="transform: rotate(45deg); font-weight: 800; font-size: 11px; font-family: 'Plus Jakarta Sans', system-ui, sans-serif;">
    ${pinLabel}
  </span>
</div>
```

### 3. Dual-Stroke Route Polylines
Connecting paths between stops must never be drawn with a single thin hairline. TripPlanner requires a dual-stroke compound polyline for high contrast:
1. **Underlay Casing**: White solid line (`color: '#ffffff'`, `weight: 6`, `opacity: 0.90`).
2. **Foreground Dashed Route**: Day accent line (`color: DAY_COLORS[dayIndex]`, `weight: 3.5`, `opacity: 0.85`, `dashArray: '6, 6'`).

### 4. Rich Floating Popovers
Clicking any pin opens a rich popover containing:
- High-resolution place photography (`height: 95px; object-fit: cover; border-radius: 8px`).
- Bold place title (`13px; font-weight: 700; color: #0f172a`).
- Category pill and star rating badge (`★ 4.8`).
- Day and section indicator (`Day 1 (Morning)`).
- Formatted street address in muted micro-copy.

---

## 8. Component Specifications & Design Blueprints

### A. Editorial Destination Hero Banner
The top of the center canvas displays a cinematic cover banner establishing place context:

```
+----------------------------------------------------------------------------------+
| [Destination Badge] ROME, ITALY                                                  |
|                                                                                  |
| Ancient Marvels & Trastevere Evenings                                            |
|                                                                                  |
| [Date Pill] Oct 24 - 28   [Duration Pill] 5 Days   (Avatar Stack) (4 Travelers)  |
+----------------------------------------------------------------------------------+
```
- **Height**: Fixed `200px` with `border-radius: 14px`, `overflow: hidden`.
- **Scrim**: High-contrast bottom gradient `linear-gradient(to top, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0.2) 60%, transparent 100%)`.
- **Collaborator Stack**: Overlapping 32×32px circular avatars with `margin-left: -8px; border: 2px solid #ffffff;`.

### B. Stop Card & Timeline Spine
The core of the itinerary experience. Stop cards are connected by a vertical spine rail representing chronological transit:

```
   (1) --- [76x76 Photo]  Colosseum                      ★ 4.8  [Sight]
    |                      09:00 AM · 120 min · Piazza del Colosseo, 1
    |                      [Move ▾] [x]
    |
    |---- [Walk] 12 min (850 m) via Via dei Fori Imperiali
    |
   (2) --- [76x76 Photo]  Roman Forum                    ★ 4.7  [Sight]
                           11:15 AM · 90 min · Via della Salara Vecchia
```

#### Stop Card Specifications
- **Dimensions & Layout**: Flex row, `padding: 0.65rem 0.85rem`, `border-radius: 11px`, `border: 1px solid #e2e8f0`.
- **Active State (`.highlighted`)**: `border-color: #2563eb; background: #eff6ff; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);`.
- **Sequence Pin**: `24×24px`, circle, filled with `DAY_COLORS[dayIndex]`.
- **Fixed Photo Thumbnail**:
  ```css
  .stop-thumb {
    width: 76px !important;
    height: 76px !important;
    min-width: 76px !important;
    max-width: 76px !important;
    min-height: 76px !important;
    max-height: 76px !important;
    border-radius: 10px;
    object-fit: cover !important;
    flex-shrink: 0 !important;
    border: 1px solid rgba(0, 0, 0, 0.06);
    background: #f1f5f9;
  }
  ```
- **Timeline Spine**: `padding-left: 20px; position: relative;` with a `::before` pseudo-element providing a `2px solid #e2e8f0` continuous vertical rail.
- **Transit Connector Badge**: Inline badge positioned along the spine (`border-left: 2px dashed #94a3b8; background: #f8fafc; font-size: 0.72rem;`).

### C. Boarding-Pass Booking Vouchers
Reservations (flights, lodging, rail tickets, activities) render in a voucher style:

```
+------------------------------------------------------------------------------------------+
| [80x80 Photo] |  (Icon)  |  ANA Flight NH105                                             |
|               |  FLIGHT  |  [Conf: NH78210]  ANA Airlines · Oct 24, 11:30 AM             |
|               |  (Dashed)|  Terminal 1 · Gate 42                                         |
|               |  Divider |                                             [USD $650.00]     |
+------------------------------------------------------------------------------------------+
```
- **Left Thumbnail**: Fixed 80×80px photo thumbnail.
- **Perforated Ticket Stub**: `border-right: 1px dashed #cbd5e1; padding-right: 0.75rem; min-width: 55px;` displaying the vector mode icon and uppercase type badge.
- **Confirmation Code Pill**: High-contrast blue badge (`background: #dbeafe; color: #1e40af; font-weight: 700;`).
- **Cost Badge**: Emerald price badge anchored on the right.

### D. Budget & Splitwise Settlement Ledger
The collaborative finance experience provides instant debt reconciliation:

```
+------------------------------------------------------------------------------------------+
| SPEND OVERVIEW: USD $1,240.00 spent of USD $2,000.00 cap                     [62% used]  |
| [========================-----------------]                                              |
| Remaining: USD $760.00                                                                   |
+------------------------------------------------------------------------------------------+
| DEBT SETTLEMENT (SPLITWISE)                                            [Who Owes Whom?]  |
|                                                                                          |
| (A) Alice [owes] -------- [Arrow-Right-Left] --------> (B) Bob [gets back]               |
|                                                        [USD $125.00]  [Settle Up]        |
+------------------------------------------------------------------------------------------+
| COLLABORATOR BALANCES:                                                                   |
| [ (A) Alice: Paid $200 · Share $325   (Owes $125.00) ]                                   |
| [ (B) Bob:   Paid $600 · Share $475   (Gets back $125.00) ]                              |
+------------------------------------------------------------------------------------------+
| SPENDING BY CATEGORY:                                                                    |
| [=== Lodging 45% ===][== Food 30% ==][= Transit 15% =][= Activities 10% =]              |
+------------------------------------------------------------------------------------------+
```
- **Spend Progress Bar**: 9px bar transitioning from Green (`<75%`) to Amber (`75-90%`) to Red (`>90%`).
- **Visual Settlement Flow**: Payer avatar in red tint (`#ef4444`) flowing via an interactive vector arrow to receiver avatar in green tint (`#10b981`), displaying calculated transfer pills.
- **One-Click Settle Button**: Automatically invokes conversational debt settlement without leaving the screen.
- **Multi-Segment Category Spend Bar**: Proportional distribution segments matching category semantic tokens.

---

## 9. Interaction, Motion & Live Sync Standards

TripPlanner operates as a reactive spatial environment:

### In-Place DOM Hydration (`refreshWorkspaceDom`)
Full browser reloads (`window.location.reload()`) are strictly prohibited because they disrupt the user's active viewport, disconnect Leaflet map instances, and flush chat context.

```javascript
// Authoritative pattern for seamless DOM hydration:
async function refreshWorkspaceDom(targetTripId) {
  const currentUrl = new URL(window.location.href);
  if (targetTripId) currentUrl.searchParams.set('trip_id', targetTripId);

  const res = await fetch(currentUrl.toString());
  if (!res.ok) return;
  const htmlText = await res.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');

  // 1. Refresh initial data state
  const newRawData = doc.getElementById('tp-initial-data');
  if (newRawData) {
    document.getElementById('tp-initial-data').textContent = newRawData.textContent;
    Object.assign(clientState, JSON.parse(newRawData.textContent || '{}'));
  }

  // 2. Hydrate center document canvas in place
  const newContent = doc.querySelector('.canvas-content');
  const curContent = document.querySelector('.canvas-content');
  if (newContent && curContent) curContent.innerHTML = newContent.innerHTML;

  // 3. Hydrate telemetry status bar
  const newBar = doc.querySelector('.session-status-bar');
  const curBar = document.querySelector('.session-status-bar');
  if (newBar && curBar) curBar.innerHTML = newBar.innerHTML;

  // 4. Re-render map pins without moving user camera
  renderMapPins(activeDayFilter, true);
}
```

### Preservation of `#chatMessages`
During background updates triggered by agent mutations or polling, the `#chatMessages` element must **never** be overwritten or cleared. Conversation threads persist across tab navigation and canvas updates.

### Real-Time Live Sync Loop
- UI polls `/api/v1/events?since_version=N` every `1.2s`.
- When an agent mutation increments `state_version`, the live telemetry badge flashes a green notification toast (`.agy-toast`) and calls `refreshWorkspaceDom()`.

---

## 10. Visual QA Checklist & Automated Scoring Rubric

This rubric is used by automated visual testing agents and human reviewers to inspect and grade front-end changes.

| Category | Weight | Evaluation Criteria | Pass Criteria (100% Target) |
|---|---|---|---|
| **Zero-Emoji Compliance** | 20 pts | Grep DOM and rendered text for Unicode emojis. | Zero emojis found in template code, generated cards, or assistant chat responses. |
| **Vector Icon Integrity** | 10 pts | Verify all icons use `tp-icon` SVG vectors from `icons.ts`. | Clean SVG vectors rendered at proper size with `currentColor` stroke. |
| **Typography & Font Tokens** | 10 pts | Check font families, tracking, and font weights. | Plus Jakarta Sans used for UI/titles; JetBrains Mono used for metrics/prices/times. |
| **Color System & Badges** | 10 pts | Inspect hex tokens and category pill colors. | No arbitrary un-tokenized colors; categories match semantic color table. |
| **Stop Card Photo Thumbnails**| 15 pts | Inspect `.stop-thumb` dimensions across all tabs. | Strict fixed 76×76px size with `border-radius: 10px` and `object-fit: cover`. |
| **Timeline Spine & Sequence** | 10 pts | Check chronological numbers and connector rail. | Waypoint numbers 1..N match itinerary cards and map markers; 2px spine visible. |
| **Map Rendering & Basemap** | 15 pts | Verify ESRI Light Gray canvas and retina pins. | Zero watermarked tiles; teardrop pins numbered 1..N with dual-stroke polylines. |
| **In-Place Hydration** | 10 pts | Validate async updates without full page reloads. | No `window.location.reload()`; chat state and map viewport preserved. |

### Scoring Scale
- **95 – 100 pts**: **Exemplary (Gold Standard)**. Ready for production deployment.
- **85 – 94 pts**: **Minor Defect**. Passable with non-breaking aesthetic polish items.
- **< 85 pts**: **Failed QA**. Must be remediated immediately prior to release.

---

## 11. Agent Implementation Rules & Guardrails

When modifying TripPlanner templates or writing agent responses:

### Do's:
1. **Always use vector SVGs**: Call `getIconSvg('icon-name', size)` in Astro files or use the `<span class="icon-inline">` pattern.
2. **Always format monetary amounts**: Wrap currency in JetBrains Mono with 2 decimal places (`$120.00`).
3. **Always trigger live events**: Every REST or MCP mutation must increment `workspace_sessions.state_version` and emit a `session_events` entry with `last_actor = 'agy'`.
4. **Always cross-link Map & Timeline**: Maintain `selectStop(stopId)` and `highlightMapMarker(stopId)` event handlers on every stop card.

### Don'ts:
1. **NEVER insert Unicode emojis** (e.g., ✈️, 🗓️, 🏨, 📍, 💰) anywhere in code or AI output.
2. **NEVER call `location.reload()`** in client scripts.
3. **NEVER modify stop thumbnail dimensions** away from the fixed 76×76px standard.
4. **NEVER use saturated, watermarked, or dark map tiles** that clash with the light editorial palette.
