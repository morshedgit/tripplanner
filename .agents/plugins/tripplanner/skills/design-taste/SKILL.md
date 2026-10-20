---
name: design-taste
description: Implements the Taste Skill and OpenDesign anti-slop frontend engineering standards. Directs AI coding agents to produce high-taste, editorial, spatial, and responsive web user interfaces with strict typography hierarchy, calibrated design dials, surface layering, and zero cliché AI tells.
---

# Design Taste Frontend Skill (`design-taste`)

> Built upon the open-source **`Leonxlnx/taste-skill`** and **`nexu-io/open-design`** standards.  
> Use this skill whenever designing, modifying, or refactoring user interfaces, landing pages, or workspace components.

---

## 1. The Core Sequence: Read → Calibrate → Execute

Before writing markup or styles, every agent must perform this 3-step sequence:

1. **Read the Room (Brief Inference)**:
   - Identify the user's domain and intent: is this a data-dense tool, an editorial travel workspace, a luxury portfolio, or a high-converting landing page?
   - Output an explicit one-line design read:
     `Design Read: [Vibe Words] | [Archetype Benchmark] | [Target User Feeling]`
2. **Calibrate the Three Dials**:
   - Explicitly declare the dial values:
     - `DESIGN_VARIANCE` (1–10): Layout asymmetry and uniqueness vs. safe symmetry.
     - `MOTION_INTENSITY` (1–10): Static/calm vs. spring physics, drawers, and camera transitions.
     - `VISUAL_DENSITY` (1–10): Spacious art gallery vs. high-information cockpit.
3. **Execute Against Brand Contract**:
   - Check if a `DESIGN.md` exists in the repository. If so, its color tokens, font families, and component contracts take precedence over generic AI defaults.

---

## 2. Anti-AI-Slop Directives

### 2.1 Banned Patterns
* **No Generic AI Gradients**: Never use unmotivated diagonal gradients between purple and indigo (`#6366f1` to `#a855f7`).
* **No Floating Glowing Orbs**: Never inject blurry pseudo-futuristic glowing radial circles into the background.
* **No Cookie-Cutter 3-Card Grids**: Break predictable card repetition with varied weights, featured items, or timeline layouts.
* **No Harsh Contrast Extremes**: Avoid `#000000` text on `#ffffff` backgrounds. Use deep tinted slate (`#0f172a`) and warm off-white canvas backgrounds (`#f8fafc`).

### 2.2 Typographic Hierarchy Rules
* **Negative Letter-Spacing**:
  - Headings >= 24px: `letter-spacing: -0.025em` to `-0.035em`
  - Headings >= 18px: `letter-spacing: -0.015em` to `-0.02em`
* **Intermediate Font Weights**:
  - Never oscillate solely between `font-weight: 400` and `700`.
  - Use `font-weight: 500` (Medium) for labels, card secondary text, and interactive pills.
  - Use `font-weight: 600` (SemiBold) for section titles, buttons, and badges.
* **Tabular Figures for Numbers**:
  - Always apply `font-variant-numeric: tabular-nums` to financial sums, timestamps, durations, and coordinate values to prevent jitter.
* **Orphan Control**:
  - Always apply `text-wrap: balance` to headings and `text-wrap: pretty` to body text.
  - Constrain body text blocks to `max-width: 65ch`.

---

## 3. Surface Luminance & Micro-Interactions

* **Layered Surfaces**:
  - Use subtle 1px border separators (`rgba(15, 23, 42, 0.08)`) and multi-layer soft shadows rather than harsh dark outlines.
* **4-State Component Contract**:
  - Every button, card, and interactive link must implement:
    1. `default`: Rest state with crisp border and subtle ambient shadow.
    2. `hover`: `transform: translateY(-1px);` + elevated shadow `0 4px 14px rgba(15, 23, 42, 0.07);`.
    3. `active` (pressed): `transform: scale(0.98);`.
    4. `focus-visible`: `outline: none; box-shadow: 0 0 0 2px var(--primary-light), 0 0 0 4px var(--primary);`.
* **Motion Physics**:
  - Slide-overs and drawers must use cubic-bezier easing: `transition: transform 0.26s cubic-bezier(0.16, 1, 0.3, 1)`.
  - Only animate GPU-accelerated properties (`transform`, `opacity`). Never animate `width`, `height`, or `margin` directly during continuous transitions.

---

## 4. Pre-Flight Quality Checklist

Before completing any frontend task, verify:
- [ ] No unmotivated purple or floating glowing orb aesthetics.
- [ ] Headings have negative tracking and balanced text wrapping.
- [ ] Numbers and timestamps use `font-variant-numeric: tabular-nums`.
- [ ] Fixed header bars use frosted glass backdrop blur where appropriate.
- [ ] Interactive elements support hover elevation and active press states.
- [ ] Color anchors match between UI pills and cartographic lines.
- [ ] Zero horizontal overflow across desktop, tablet, and mobile breakpoints.
