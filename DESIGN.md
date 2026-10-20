# DESIGN.md — TripPlanner Design System Contract & Craft Guidelines

> **Brand Contract for AI Agents & Developers**  
> Complies with the **OpenDesign** (`nexu-io/open-design`) brand contract protocol and **Taste Skill** (`Leonxlnx/taste-skill`) anti-slop guidelines. All coding agents must review and follow these design tokens and constraints before generating or modifying UI components.

---

## 1. Design Philosophy & Aesthetic Read

* **Vibe Words**: *Editorial, Spatial, Tactile, Calm, High-Agency, Modern Cartographic*
* **Benchmark Archetypes**: Wanderlog, Linear, Mindtrip, Apple Human Interface Guidelines (macOS / iOS spatial split).
* **Core Philosophy**: A travel itinerary is an editorial magazine combined with an interactive cartographic instrument. Information hierarchy must prioritize what travelers need in the moment: where they are, what's next, transit duration, and deep place dossiers on demand.

---

## 2. The Three Configuration Dials

```yaml
DESIGN_VARIANCE: 6.5   # Editorial asymmetry; avoids generic 3-card templates while preserving structured timelines
MOTION_INTENSITY: 5.0  # Subtle spring physics, 200–280ms cubic-bezier transitions, map camera pans; zero dizzying parallax
VISUAL_DENSITY: 5.5    # Breathable itinerary canvas paired with compact, high-utility metadata inspectors
```

---

## 3. Anti-AI-Slop Directives (Strict Enforcement)

* 🚫 **Banned Clichés**:
  * Never use generic purple-to-blue glowing gradients (`linear-gradient(135deg, #6366f1, #a855f7)`).
  * Never place unmotivated floating glowing blur orbs in the background.
  * Never use the generic centered headline + 3 identical feature cards pattern.
  * Never use pure sterile `#000000` text on pure harsh `#ffffff` backgrounds.
* ✅ **Mandatory Craft Rules**:
  * Use negative tracking (`letter-spacing: -0.025em` to `-0.035em`) on display headlines.
  * Use intermediate font weights (`font-weight: 500` Medium and `font-weight: 600` SemiBold) to create subtle, nuanced typographic hierarchy rather than jumping between 400 and 700.
  * Apply `font-variant-numeric: tabular-nums` to all numbers, times, durations, prices, coordinates, and currencies.
  * Cap text line length to `max-width: 65ch` with `text-wrap: balance` for titles and `text-wrap: pretty` for body copy.
  * Every clickable item must support all 4 states: **Default**, **Hover** (`translateY(-1px)` + elevation), **Active** (`transform: scale(0.98)`), and **Focus** (`box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2)`).

---

## 4. Design Tokens & Palette

### 4.1 Typography
* **Display & Body Font**: `'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif`
* **Numeric & Code Font**: `'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace`
* **Scale**:
  * Display 1: `1.5rem` (`24px`), `font-weight: 800`, `letter-spacing: -0.035em`, `line-height: 1.2`
  * Heading 2: `1.25rem` (`20px`), `font-weight: 700`, `letter-spacing: -0.025em`, `line-height: 1.25`
  * Subheading: `0.95rem` (`15.2px`), `font-weight: 600`, `letter-spacing: -0.015em`
  * Body: `0.85rem` (`13.6px`), `font-weight: 400` / `500`, `line-height: 1.55`
  * Caption / Badge: `0.72rem` (`11.5px`), `font-weight: 600`, `letter-spacing: 0.02em`

### 4.2 Color System
* **Canvas Base**: `#f8fafc` (Slate 50)
* **Surface Containers**: `#ffffff` with `1px solid rgba(15, 23, 42, 0.08)`
* **Primary Brand**: `#2563eb` (Royal Blue) | Hover: `#1d4ed8` | Tint: `#eff6ff`
* **Text Hierarchy**:
  * Title / Emphasized: `#0f172a` (Slate 900)
  * Secondary / Labels: `#475569` (Slate 600)
  * Muted / Captions: `#94a3b8` (Slate 400)
* **Day-Anchored Chromatic Palette** (matches map polylines & pins):
  * **Day 1**: `#2563eb` (Blue)
  * **Day 2**: `#16a34a` (Emerald Green)
  * **Day 3**: `#d97706` (Amber Ochre)
  * **Day 4**: `#9333ea` (Royal Purple)
  * **Day 5**: `#e11d48` (Rose Crimson)
  * **Day 6+**: `#0891b2` (Cyan Ocean)

### 4.3 Surface Luminance & Elevation
* **Level 0 (App Canvas)**: `#f8fafc`
* **Level 1 (Card & Section Containers)**:
  `background: #ffffff; border: 1px solid rgba(15, 23, 42, 0.08); box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02);`
* **Level 2 (Hover Elevation)**:
  `transform: translateY(-1px); box-shadow: 0 4px 14px rgba(15, 23, 42, 0.07);`
* **Level 3 (Slide-Over Drawer & Modals)**:
  `box-shadow: -8px 0 32px rgba(15, 23, 42, 0.12);`
* **Frosted Glass (Header & Overlays)**:
  `backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); background: rgba(255, 255, 255, 0.88); border-bottom: 1px solid rgba(15, 23, 42, 0.06);`

---

## 5. Component Patterns

1. **Top Navigation Header**:
   - Fixed 56px frosted glass bar with TripPlanner logo badge, trip switcher dropdown, live sync status pill (`● Live Sync`), export tools popover, and `[✦ AI Assistant]` sidebar toggle.
2. **Pinned Canvas Tabs**:
   - Fixed 46px tab bar above the scrolling itinerary canvas (`flex-shrink: 0;`). Never scrolls out of view.
3. **Interactive Route Spine**:
   - Connecting transit line with interactive pill (`🚶 5 min · 0.3 km`) that highlights the active polyline on the Leaflet map on hover or click.
4. **Slide-over Place Detail Panel**:
   - Slide-in sheet displaying venue photo, star rating, official website link, Google Maps directions, phone call trigger, schedule grid, notes, and transit routing.
5. **Day Filter Anchor**:
   - Pill bar with color dots matching map routes. Selecting a day filters the list and invokes `mapInstance.flyToBounds()` to frame the day's pins.
