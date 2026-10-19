import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { getIconSvg, ICONS, type IconName } from '../src/lib/icons';

const REQUIRED_ICONS: IconName[] = [
  'plane',
  'logo',
  'luggage',
  'suitcase',
  'map-pin',
  'calendar',
  'wallet',
  'dollar',
  'code',
  'file-code',
  'plug',
  'cpu',
  'download',
  'file-text',
  'table',
  'bar-chart',
  'plus',
  'bolt',
  'zap',
  'bot',
  'sparkles',
  'users',
  'check-square',
  'list-checks',
  'map',
  'bookmark',
  'ticket',
  'hotel',
  'building',
  'train',
  'sunrise',
  'sun',
  'moon',
  'car',
  'footprints',
  'walk',
  'train-front',
  'transit',
  'star',
  'clock',
  'hourglass',
  'timer',
  'tag',
  'trash',
  'x',
  'arrow-right-left',
  'move',
];

const BANNED_EMOJIS = [
  '✈️',
  '🧳',
  '📍',
  '📅',
  '💵',
  '📜',
  '🔌',
  '📥',
  '📊',
  '🟢',
  '📑',
  '⚡',
  '🤖',
  '👋',
  '💸',
  '👥',
  '📋',
  '🗺️',
  '📌',
  '💰',
  '➕',
  '🌅',
  '☀️',
  '🌙',
  '🚗',
  '⭐',
  '🕒',
  '⏳',
  '🏷️',
  '🚶',
  '🚇',
  '🏨',
  '🎟️',
  '✕',
];

describe('Issue #25: UI Event Handlers (No define:vars IIFE) & Crisp Vector SVG Icons', () => {
  const root = process.cwd();
  const indexAstroPath = resolve(root, 'src/pages/index.astro');
  const chatAgentPath = resolve(root, 'src/services/chatAgentService.ts');

  it('1. renders valid 24x24 vector <svg> markup for all required icons in src/lib/icons.ts', () => {
    for (const name of REQUIRED_ICONS) {
      expect(ICONS[name]).toBeDefined();
      expect(ICONS[name]).toContain('<svg');
      expect(ICONS[name]).toContain('viewBox="0 0 24 24"');
      expect(ICONS[name]).toContain('</svg>');

      const customSvg = getIconSvg(name, 20, 'custom-cls');
      expect(customSvg).toContain('width="20"');
      expect(customSvg).toContain('height="20"');
      expect(customSvg).toContain(`tp-icon-${name}`);
      expect(customSvg).toContain('custom-cls');
    }
  });

  it('2. provides standalone vector SVG icon assets in public/icons/logo.svg and public/favicon.svg', () => {
    const logoSvgPath = resolve(root, 'public/icons/logo.svg');
    const faviconSvgPath = resolve(root, 'public/favicon.svg');

    expect(existsSync(logoSvgPath)).toBe(true);
    expect(existsSync(faviconSvgPath)).toBe(true);

    const logoSvg = readFileSync(logoSvgPath, 'utf8');
    const faviconSvg = readFileSync(faviconSvgPath, 'utf8');

    expect(logoSvg).toContain('<svg');
    expect(logoSvg).toContain('viewBox="0 0 24 24"');
    expect(faviconSvg).toContain('<svg');
    expect(faviconSvg).toContain('viewBox="0 0 24 24"');
  });

  it('3. eliminates Astro define:vars IIFE scope trap on client script and serializes tp-initial-data JSON', () => {
    const content = readFileSync(indexAstroPath, 'utf8');

    expect(content).not.toContain('define:vars');
    expect(content).toContain('id="tp-initial-data"');
    expect(content).toContain('type="application/json"');
    expect(content).toContain("JSON.parse(rawDataEl.textContent || '{}')");
  });

  it('4. explicitly attaches all interactive UI button and form handlers to window', () => {
    const content = readFileSync(indexAstroPath, 'utf8');

    const requiredWindowHandlers = [
      'window.handleTabClick = handleTabClick;',
      'window.selectStop = selectStop;',
      'window.sendPrompt = sendPrompt;',
      'window.handleChatSubmit = handleChatSubmit;',
      'window.handleTripChange = handleTripChange;',
      'window.handleDayFilterChange = handleDayFilterChange;',
      'window.handleInlineAddStop = handleInlineAddStop;',
      'window.focusInlineAddStop = focusInlineAddStop;',
      'window.handleInlineAddWishlist = handleInlineAddWishlist;',
      'window.handleOptimizeDayRoute = handleOptimizeDayRoute;',
      'window.handleDeleteStop = handleDeleteStop;',
      'window.handleMoveStop = handleMoveStop;',
      'window.handleScheduleWishlistStop = handleScheduleWishlistStop;',
      'window.handleInlineLogExpense = handleInlineLogExpense;',
      'window.handleInlineAddReservation = handleInlineAddReservation;',
      'window.handleToggleChecklist = handleToggleChecklist;',
      'window.handleInlineAddChecklistItem = handleInlineAddChecklistItem;',
      'window.highlightMapMarker = highlightMapMarker;',
      'window.unhighlightMapMarker = unhighlightMapMarker;',
      'window.exportData = exportData;',
      'window.toggleNewTripPanel = toggleNewTripPanel;',
      'window.handleCreateNewTrip = handleCreateNewTrip;',
      'window.toggleAddReservationPanel = toggleAddReservationPanel;',
    ];

    for (const handlerAssignment of requiredWindowHandlers) {
      expect(content).toContain(handlerAssignment);
    }
  });

  it('5. links exportData(format) to valid export endpoints (/export/markdown, /export/ics, /export/expenses.csv)', () => {
    const content = readFileSync(indexAstroPath, 'utf8');

    expect(content).not.toContain('/export?format=');
    expect(content).toContain('/api/v1/trips/${tripId}/export/markdown');
    expect(content).toContain('/api/v1/trips/${tripId}/export/ics');
    expect(content).toContain('/api/v1/trips/${tripId}/export/expenses.csv');
  });

  it('6. replaces window.prompt() modals with inline forms (#newTripPanel, #addReservationPanel, handleMoveStop)', () => {
    const content = readFileSync(indexAstroPath, 'utf8');

    expect(content).not.toContain("prompt('Enter trip destination");
    expect(content).not.toContain("prompt('Enter booking details");
    expect(content).toContain('id="newTripPanel"');
    expect(content).toContain('handleCreateNewTrip(event)');
    expect(content).toContain('id="addReservationPanel"');
    expect(content).toContain('handleInlineAddReservation(event)');
    expect(content).toContain('handleMoveStop(');
    expect(content).toContain('handleScheduleWishlistStop(');
  });

  it('7. normalizes bookings and reservations tab naming seamlessly', () => {
    const content = readFileSync(indexAstroPath, 'utf8');

    expect(content).toContain("const normalizedActiveTab = activeTab === 'bookings' ? 'reservations' : activeTab;");
    expect(content).toContain("const normalizedTab = tabName === 'bookings' ? 'reservations' : tabName;");
  });

  it('8. contains zero generic Unicode emojis in src/pages/index.astro and src/services/chatAgentService.ts', () => {
    const indexContent = readFileSync(indexAstroPath, 'utf8');
    const chatServiceContent = readFileSync(chatAgentPath, 'utf8');

    for (const emoji of BANNED_EMOJIS) {
      expect(indexContent).not.toContain(emoji);
      expect(chatServiceContent).not.toContain(emoji);
    }

    expect(indexContent).toContain("import { getIconSvg } from '../lib/icons';");
    expect(indexContent).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />');
  });
});
