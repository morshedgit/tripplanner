# TripPlanner Design System & UI/UX Agent Guidelines

**Scope**: All workspace agent tasks involving front-end code generation, component design, Astro templates, CSS styling, chat messaging, and UI verification in the TripPlanner application.

---

## 1. Core Visual Tenets

All agents modifying or generating front-end code in TripPlanner must adhere to the **2026 Spatial Travel Workspace** standard (editorial travel magazine meets high-density spatial canvas, benchmarked against Wanderlog, Mindtrip, Linear, and Airbnb Trips).

1. **Editorial Serenity**: Light-mode alabaster surfaces (`#f8fafc`, `#ffffff`), deep charcoal ink (`#0f172a`, `#1e293b`), and hairline borders (`#e2e8f0`).
2. **Absolute Zero-Emoji Strictness**: Never use generic Unicode emojis in HTML templates, client scripts, notifications, or conversational replies. All iconography must use 100% vector SVG icons from `src/lib/icons.ts`.
3. **Non-Destructive In-Place Hydration**: Never invoke `window.location.reload()`. State updates must mutate the DOM in place via `refreshWorkspaceDom()`, preserving `#chatMessages` and Leaflet map state.
4. **Spatial Parity**: Every timeline item corresponds 1:1 with numbered map pins (`1..N`), category semantic pills, and route polylines.

---

## 2. Typography System & Tokens

TripPlanner strictly separates human editorial text from precision telemetry and metrics:

| Role | Font Family | Weight | Line Height | Tracking | Usage |
|---|---|---|---|---|---|
| **Headings & UI** | `'Plus Jakarta Sans', system-ui, sans-serif` | 500 – 800 | 1.2 – 1.45 | -0.025em to 0.00em | Hero titles, day headers, card titles, body copy |
| **Metrics & Code**| `'JetBrains Mono', monospace` | 500 – 700 | 1.20 | -0.020em to +0.020em | Prices, balances, times, coordinates, tool tags |

### Typographic Scale
- `hero-title`: `1.55rem (24px)`, weight `800`, letter-spacing `-0.025em`.
- `section-title`: `0.72rem (11.5px)`, uppercase, weight `700`, letter-spacing `0.05em`.
- `day-num`: `0.95rem (15px)`, weight `800`.
- `stop-name`: `0.88rem (14px)`, weight `700`, color `#1e293b`.
- `stop-meta`: `0.72rem (11.5px)`, weight `500`, color `#475569`.
- `metric-currency`: `font-family: 'JetBrains Mono'`, weight `700`.

---

## 3. Color Tokens & Semantic Palettes

### Primary & Surface Tokens
- `--primary`: `#2563eb` (Royal Blue)
- `--primary-hover`: `#1d4ed8`
- `--primary-light`: `#eff6ff` (Ice Blue tint for active states)
- `--accent`: `#f97316` (Sunset Amber)
- `--bg-main`: `#f8fafc` (Warm Alabaster canvas)
- `--bg-card`: `#ffffff` (Pure card surface)
- `--border`: `#e2e8f0` (Hairline slate border)
- `--text-primary`: `#0f172a` (Deep Slate / Charcoal Ink)
- `--text-secondary`: `#475569`
- `--text-muted`: `#94a3b8`

### Day Accent Colors (Cyclic 1..6)
Map pins, day badges, and polyline routes must match this sequence:
```typescript
const DAY_COLORS = ['#2563eb', '#16a34a', '#d97706', '#9333ea', '#e11d48', '#0891b2'];
```

### Semantic Category Badge Schemes
| Category | Background | Border | Text | Vector Icon |
|---|---|---|---|---|
| **Dining / Food** | `#fff7ed` | `#ffedd5` | `#c2410c` | `tag` |
| **Lodging / Hotels** | `#eff6ff` | `#dbeafe` | `#1d4ed8` | `hotel` |
| **Transit / Train** | `#f5f3ff` | `#ede9fe` | `#6d28d9` | `transit` / `walk` / `car` |
| **Sight / Attraction** | `#ecfdf5` | `#d1fae5` | `#047857` | `map-pin` / `sunrise` |
| **Shopping** | `#fdf2f8` | `#fce7f3` | `#be185d` | `tag` / `suitcase` |
| **Culture / Museum** | `#fffbeb` | `#fef3c7` | `#b45309` | `building` |

---

## 4. Vector Iconography & Zero-Emoji Rule

### The Zero-Emoji Directive
Agents must **never** output Unicode emojis (e.g. ✈️, 🗓️, 🏨, 📍, 💰, 🤖, etc.) in any generated code, commit, or chat response.
Always import and render crisp vector SVG icons from `src/lib/icons.ts`.

### Rendering Icons in Astro / HTML
```html
---
import { getIconSvg } from '../lib/icons';
---
<!-- Server-rendered icon -->
<span class="icon-inline" set:html={getIconSvg('map-pin', 14)}></span>
```

In client-side scripts, use the pre-rendered global vector string constants (e.g., `BOLT_SVG_INLINE`).

---

## 5. Spatial Layout & Viewport Architecture

TripPlanner uses an uncompromising 3-column spatial layout:
- **Top Header**: Fixed `56px` height, `#ffffff`, hairline border.
- **Live Sync Telemetry Bar**: Fixed `40px` height, `#0f172a`, live SSE pulsing dot.
- **Left Pane (Chat Co-Pilot)**: Fixed `360px` width. Scrollable message stream `#chatMessages`.
- **Center Pane (Document Canvas)**: Flex `1`, centered `.canvas-content` constrained to `max-width: 860px`.
- **Right Pane (Cartographic Map)**: Fixed `440px` width. Leaflet map container `#map`.
- **Transitions & Elevators**: Hairline `1px solid #e2e8f0`, smooth `0.15s ease` hover transitions, subtle shadows (`box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03)`).

---

## 6. Cartography & Map Standards

1. **Basemap**: Clean **ESRI World Light Gray Canvas** tile layer (`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`). No dark, saturated, or watermarked tiles.
2. **Teardrop Waypoint Pins**:
   - `width: 28px; height: 28px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg);`
   - Inner label: `transform: rotate(45deg); font-weight: 800; font-size: 11px;` displaying `1..N` matching itinerary stop cards.
   - White border `2px solid #ffffff`, drop shadow `0 4px 10px rgba(0,0,0,0.3)`.
3. **Dual-Stroke Polyline Routes**:
   - Underlay white casing: `weight: 6`, `opacity: 0.90`.
   - Foreground route line: `weight: 3.5`, `dashArray: '6, 6'`, colored with `DAY_COLORS[dayIndex]`.
4. **Rich Floating Popovers**:
   - High-res photo (`height: 95px; object-fit: cover; border-radius: 8px`).
   - Place title, category pill, star rating (`★ 4.8`), day kicker, and street address.

---

## 7. Component Blueprints

### A. Editorial Hero Banner
- Height: `200px`, `border-radius: 14px`, full-bleed destination cover from `src/lib/placeImages.ts`.
- Scrim: `linear-gradient(to top, rgba(15, 23, 42, 0.85) 0%, rgba(15, 23, 42, 0.2) 60%, transparent 100%)`.
- Traveler avatar stack: Overlapping `32×32px` circles with `-8px` margin and `2px solid #ffffff`.

### B. Stop Card & Timeline Spine
- **Spine**: `padding-left: 20px; position: relative;` with `2px solid #e2e8f0` vertical rail (`::before`).
- **Card**: Flex row, `padding: 0.65rem 0.85rem`, `border-radius: 11px`, border `#e2e8f0`.
- **Sequence Pin**: `24×24px` circle with sequence number `1..N`.
- **Photo Thumbnail**:
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
- **Transit Connector**: Inline dashed connector badge along the spine (`border-left: 2px dashed #94a3b8; font-size: 0.72rem;`).

### C. Boarding-Pass Booking Vouchers
- Fixed `80×80px` thumbnail on left.
- Perforated ticket stub: `border-right: 1px dashed #cbd5e1; min-width: 55px;` with uppercase type badge.
- Provider, date/time, and confirmation pill (`background: #dbeafe; color: #1e40af; font-weight: 700;`).
- Emerald cost badge (`.badge-green`) on right.

### D. Budget & Splitwise Ledger
- **Progress Bar**: Spend vs. Cap indicator (`#10b981` -> `#f59e0b` -> `#ef4444`).
- **Debt Transfer Cards**: `Debtor Avatar (Red) -> [arrow-right-left] -> Creditor Avatar (Green)` with transfer amount pill and one-click "Settle Up" action.
- **Collaborator Net Balances**: Individual cards displaying total paid, owed share, and net balance badge.
- **Category Spend Bar**: Proportional distribution segments matching category color tokens.

---

## 8. Interaction & Motion Rules

1. **No Page Reloads**: Never execute `window.location.reload()`. Call `refreshWorkspaceDom()` to swap `.canvas-content` and update state seamlessly.
2. **Preserve Conversation**: Never overwrite, empty, or clear `#chatMessages` during workspace refreshes.
3. **Telemetry Synchronization**: All mutations must increment `workspace_sessions.state_version` and write to `session_events` with `last_actor = 'agy'` to notify open browser tabs via SSE.

---

## 9. Automated Visual QA Checklist & Scoring Rubric

When evaluating UI modifications, testing agents must score against this 100-point rubric:

| Test Item | Pts | Acceptance Criteria |
|---|---|---|
| **1. Zero-Emoji Compliance** | 20 | Zero Unicode emojis in DOM, templates, or assistant replies. |
| **2. Vector SVG Icons** | 10 | All icons render from `icons.ts` with clean vector paths. |
| **3. Typography & Hierarchy** | 10 | Plus Jakarta Sans for UI/titles; JetBrains Mono for metrics/prices. |
| **4. Color Tokens & Semantic Badges**| 10 | Strict adherence to functional color tokens and category schemes. |
| **5. Fixed 76×76px Thumbnails** | 15 | `.stop-thumb` elements measure exactly 76×76px with 10px border radius. |
| **6. Timeline Spine & Sequential Pins**| 10 | Continuous 2px rail; sequence numbers 1..N match map pins. |
| **7. Cartographic Integrity** | 15 | ESRI Light Gray canvas; numbered teardrops; dual-stroke polylines. |
| **8. Non-Destructive Hydration** | 10 | Updates execute via `refreshWorkspaceDom()` without resetting chat. |

**Passing Threshold**: Minimum **95 / 100 points** required for production readiness.
