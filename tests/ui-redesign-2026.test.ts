import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Issue #27: 2026 Spatial Travel Workspace UI Redesign', () => {
  const root = process.cwd();
  const indexAstroPath = resolve(root, 'src/pages/index.astro');
  const indexContent = readFileSync(indexAstroPath, 'utf8');

  it('1. Preserves all critical element IDs for session sync, tools, and DOM queries', () => {
    const requiredIds = [
      '#map',
      '#tripSelect',
      '#sessionStatusBar',
      '#sessionVersionLabel',
      '#sessionTripBadge',
      '#sessionTabBadge',
      '#sessionDayBadge',
      '#sessionStopBadge',
      '#sessionEventBadge',
      '#sessionEventText',
      '#agyToast',
      '#agyToastDesc',
      '#chatMessages',
      '#chatForm',
      '#chatInput',
      '#chatSubmitBtn',
      '#tab-itinerary',
      '#tab-wishlist',
      '#tab-reservations',
      '#tab-budget',
      '#tab-checklists',
      '#tp-initial-data',
      '#newTripPanel',
      '#addReservationPanel',
      '#inlineAddPlace',
      '#inlineAddDay',
      '#inlineAddSection',
      '#inlineAddTime',
      '#inlineWishlistPlace',
      '#inlineExpTitle',
      '#inlineExpAmount',
      '#inlineExpCurrency',
      '#inlineExpPayer',
    ];

    for (const selector of requiredIds) {
      const id = selector.replace('#', '');
      expect(indexContent).toContain(`id="${id}"`);
    }
  });

  it('2. Implements Editorial Trip Hero Header with Unsplash cover and collaborator avatars', () => {
    expect(indexContent).toContain('trip-hero-banner');
    expect(indexContent).toContain('hero-title');
    expect(indexContent).toContain('hero-dest-pill');
    expect(indexContent).toContain('hero-collaborators');
    expect(indexContent).toContain('hero-avatar');
    expect(indexContent).toContain('getDestinationCoverUrl(activeTrip.destination, activeTrip.cover_image_url)');
    expect(indexContent).toContain('linear-gradient(to top, rgba(15,23,42,0.85) 0%');
  });

  it('3. Renders stop cards with 76x76 visual thumbnails and semantic category badges', () => {
    expect(indexContent).toContain('stop-thumb');
    expect(indexContent).toContain('width: 76px;');
    expect(indexContent).toContain('height: 76px;');
    expect(indexContent).toContain('category-badge');
    expect(indexContent).toContain('rating-badge');
    expect(indexContent).toContain('getPlaceImageUrl(');
  });

  it('4. Provides connected vertical timeline spine and sticky day-pill carousel in Itinerary tab', () => {
    expect(indexContent).toContain('id="dayPillCarousel"');
    expect(indexContent).toContain('day-pill');
    expect(indexContent).toContain('handleDayPillSelect');
    expect(indexContent).toContain('timeline-spine');
    expect(indexContent).toContain('transit-connector');
    expect(indexContent).toContain('move-dropdown');
    expect(indexContent).toContain('Move to Day:');
  });

  it('5. Renders boarding-pass booking cards and visual Splitwise debt settlement with progress bar', () => {
    // Bookings tab
    expect(indexContent).toContain('booking-ticket-card');
    expect(indexContent).toContain('booking-ticket-stub');
    expect(indexContent).toContain('booking-thumb');
    expect(indexContent).toContain('cost-badge');

    // Budget tab
    expect(indexContent).toContain('getBudgetSettlement');
    expect(indexContent).toContain('budget-overview-card');
    expect(indexContent).toContain('settlement-card');
    expect(indexContent).toContain('transfer-flow');
    expect(indexContent).toContain('transfer-amount-pill');
    expect(indexContent).toContain('category-breakdown-card');
    expect(indexContent).toContain('category-progress-bar');
    expect(indexContent).toContain('collaborator-balances-grid');
    expect(indexContent).toContain('collab-balance-card');
  });

  it('6. Utilizes CartoDB Voyager Retina tile layer, dual-stroke polylines, and teardrop pins', () => {
    expect(indexContent).toContain('basemaps.cartocdn.com/rastertiles/voyager');
    expect(indexContent).toContain('subdomains: \'abcd\'');
    expect(indexContent).toContain('detectRetina: true');
    expect(indexContent).toContain('map-retina-pin');
    expect(indexContent).toContain('custom-map-pin');
    expect(indexContent).toContain('casing = L.polyline');
    expect(indexContent).toContain('weight: 6');
    expect(indexContent).toContain('weight: 3.5');
  });

  it('7. Replaces all window.location.reload() calls with zero-reload refreshWorkspaceDom()', () => {
    expect(indexContent).not.toContain('window.location.reload()');
    expect(indexContent).not.toContain('location.reload()');
    expect(indexContent).toContain('async function refreshWorkspaceDom(');
    expect(indexContent).toContain('window.refreshWorkspaceDom = refreshWorkspaceDom;');
  });

  it('8. Consolidates header tools into an Export & Tools popover dropdown', () => {
    expect(indexContent).toContain('class="header-menu"');
    expect(indexContent).toContain('Export &amp; Tools ▾');
    expect(indexContent).toContain('header-dropdown-menu');
    expect(indexContent).toContain('OpenAPI Specification');
    expect(indexContent).toContain('ChatGPT / AI Plugin');
  });
});
