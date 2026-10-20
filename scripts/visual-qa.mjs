#!/usr/bin/env node

/**
 * scripts/visual-qa.mjs
 *
 * Universal Headless Visual Quality Assurance & Multi-Viewport Capture CLI
 *
 * Automates headless Google Chrome via Chrome DevTools Protocol (CDP) to:
 * - Emulate responsive breakpoints (Desktop, Laptop, Tablet, Mobile, Custom)
 * - Wait for network idle, custom selectors, and web fonts (document.fonts.ready)
 * - Capture crisp viewport and full-page screenshots
 * - Crop specific CSS selector elements or regions of interest
 * - Execute in-browser visual defect heuristic audits (horizontal overflow,
 *   unconstrained media, distorted aspect ratios, font loading, cartographic tiles)
 * - Generate a structured JSON manifest of captures and defect findings.
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';

// Standard Responsive Breakpoints
const VIEWPORT_PRESETS = {
  desktop: {
    name: 'desktop',
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
    hasTouch: false,
    description: 'Desktop standard (1440x900)',
  },
  laptop: {
    name: 'laptop',
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
    hasTouch: false,
    description: 'Laptop compact (1280x800)',
  },
  tablet: {
    name: 'tablet',
    width: 768,
    height: 1024,
    deviceScaleFactor: 2,
    mobile: true,
    hasTouch: true,
    description: 'Tablet portrait iPad (768x1024)',
  },
  mobile: {
    name: 'mobile',
    width: 375,
    height: 812,
    deviceScaleFactor: 3,
    mobile: true,
    hasTouch: true,
    description: 'Mobile phone iPhone X/11/12/13/Mini (375x812)',
  },
};

// Common Chrome binary locations across operating systems
const CANDIDATE_CHROME_PATHS = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);

/**
 * Resolve an accessible Google Chrome executable
 */
function resolveChromePath(explicitPath) {
  if (explicitPath) {
    if (fs.existsSync(explicitPath)) return explicitPath;
    throw new Error(`Specified Chrome executable not found at: ${explicitPath}`);
  }
  for (const candidate of CANDIDATE_CHROME_PATHS) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(
    'Could not find Google Chrome binary. Please install Google Chrome or set CHROME_PATH environment variable.'
  );
}

/**
 * Find an available local TCP port
 */
function getFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => {
      const port = s.address().port;
      s.close(() => resolve(port));
    });
  });
}

/**
 * Parse command line flags
 */
function parseArgs(args) {
  const options = {
    url: 'http://localhost:4321',
    outDir: path.join(process.cwd(), 'scratch', 'visual-qa'),
    viewports: ['desktop', 'tablet', 'mobile'],
    delay: 1000,
    waitForSelector: null,
    fullPage: false,
    selector: null,
    audit: true,
    chromePath: null,
    prefix: '',
    deviceScaleFactor: null,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('--url=')) {
      options.url = arg.slice(6);
    } else if (arg.startsWith('--outDir=')) {
      options.outDir = path.resolve(arg.slice(9));
    } else if (arg.startsWith('--viewports=')) {
      const raw = arg.slice(12);
      if (raw.toLowerCase() === 'all') {
        options.viewports = ['desktop', 'laptop', 'tablet', 'mobile'];
      } else {
        options.viewports = raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
      }
    } else if (arg.startsWith('--delay=')) {
      options.delay = parseInt(arg.slice(8), 10) || 1000;
    } else if (arg.startsWith('--waitForSelector=')) {
      options.waitForSelector = arg.slice(18);
    } else if (arg === '--fullPage') {
      options.fullPage = true;
    } else if (arg.startsWith('--fullPage=')) {
      options.fullPage = arg.slice(11).toLowerCase() === 'true';
    } else if (arg.startsWith('--selector=')) {
      options.selector = arg.slice(11);
    } else if (arg === '--audit') {
      options.audit = true;
    } else if (arg === '--no-audit') {
      options.audit = false;
    } else if (arg.startsWith('--chromePath=')) {
      options.chromePath = arg.slice(13);
    } else if (arg.startsWith('--prefix=')) {
      options.prefix = arg.slice(9);
    } else if (arg.startsWith('--deviceScaleFactor=')) {
      options.deviceScaleFactor = parseFloat(arg.slice(20)) || null;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Visual QA Headless Capture CLI (visual-qa.mjs)

USAGE:
  node scripts/visual-qa.mjs [options]

OPTIONS:
  --url=<url>               Target web page URL (default: http://localhost:4321)
  --outDir=<dir>            Destination directory for PNG captures and manifest.json
                            (default: ./scratch/visual-qa)
  --viewports=<list>        Comma-separated viewports: desktop,laptop,tablet,mobile,all
                            Or custom dimension <width>x<height> (e.g. 1920x1080)
                            (default: desktop,tablet,mobile)
  --delay=<ms>              Additional settle delay in ms after fonts & selector ready
                            (default: 1000)
  --waitForSelector=<sel>   Wait for matching CSS selector to be visible in DOM
  --fullPage                Also capture full document scroll-height screenshot
  --selector=<sel>          Crop screenshot to the bounding box of a specific element
  --audit                   Run automated in-browser visual QA defect heuristic audit
                            (default: true)
  --no-audit                Disable in-browser visual audit
  --chromePath=<path>       Explicit path to Google Chrome binary
  --prefix=<name>           Filename prefix (default: page or slug from URL)
  --deviceScaleFactor=<n>   Override DPR device scale factor
  -h, --help                Show this help message

EXAMPLES:
  # Capture default breakpoints and audit localhost:
  node scripts/visual-qa.mjs --url=http://localhost:4321 --outDir=./scratch/qa

  # Capture all 4 standard breakpoints with full-page scroll:
  node scripts/visual-qa.mjs --url=http://localhost:4321 --viewports=all --fullPage --outDir=./captures

  # Wait for map or dynamic element before capture:
  node scripts/visual-qa.mjs --url=http://localhost:4321 --waitForSelector="#map" --delay=1500
`);
}

/**
 * Normalize viewport configuration entries
 */
function resolveViewportConfigs(requestedViewports, dsfOverride) {
  return requestedViewports.map((vp) => {
    if (VIEWPORT_PRESETS[vp]) {
      const preset = { ...VIEWPORT_PRESETS[vp] };
      if (dsfOverride) preset.deviceScaleFactor = dsfOverride;
      return preset;
    }

    // Match custom WxH e.g. 1920x1080
    const match = vp.match(/^(\d+)x(\d+)$/);
    if (match) {
      const width = parseInt(match[1], 10);
      const height = parseInt(match[2], 10);
      return {
        name: `custom_${width}x${height}`,
        width,
        height,
        deviceScaleFactor: dsfOverride || 1,
        mobile: width <= 768,
        hasTouch: width <= 768,
        description: `Custom Viewport (${width}x${height})`,
      };
    }

    throw new Error(
      `Unknown viewport '${vp}'. Choose from: desktop, laptop, tablet, mobile, all, or <width>x<height>`
    );
  });
}

/**
 * In-browser visual QA heuristics audit script
 */
const IN_PAGE_AUDIT_SCRIPT = `(() => {
  const doc = document.documentElement;
  const body = document.body || doc;
  const winW = window.innerWidth;
  const winH = window.innerHeight;

  // 1. Layout Stability & Overflow
  const scrollWidth = Math.max(doc.scrollWidth, body.scrollWidth);
  const scrollHeight = Math.max(doc.scrollHeight, body.scrollHeight);
  const hasHorizontalScroll = scrollWidth > winW + 2;

  // Find elements exceeding viewport horizontal bounds (unconstrained blowouts)
  const overflowingElements = [];
  const isClippedByAncestor = (el) => {
    let p = el.parentElement;
    while (p && p !== doc && p !== body) {
      try {
        const s = window.getComputedStyle(p);
        if (['hidden', 'auto', 'scroll', 'clip'].includes(s.overflowX)) return true;
      } catch (e) {}
      p = p.parentElement;
    }
    return false;
  };

  const allElements = document.querySelectorAll('*');
  for (const el of allElements) {
    if (['HTML', 'BODY', 'SCRIPT', 'STYLE', 'SVG', 'PATH', 'HEAD', 'META'].includes(el.tagName)) continue;
    try {
      const rect = el.getBoundingClientRect();
      if (rect.right > winW + 3 && rect.width > 0 && rect.height > 0) {
        // If an ancestor clips or scrolls this element, it is not an unconstrained page blowout
        if (isClippedByAncestor(el)) continue;

        const id = el.id ? '#' + el.id : '';
        const cls = typeof el.className === 'string' && el.className
          ? '.' + el.className.trim().split(/\\s+/).filter(Boolean).slice(0, 3).join('.')
          : '';
        overflowingElements.push({
          selector: (el.tagName.toLowerCase() + id + cls).slice(0, 80),
          width: Math.round(rect.width),
          right: Math.round(rect.right),
          overflowPx: Math.round(rect.right - winW)
        });
        if (overflowingElements.length >= 10) break;
      }
    } catch (e) {}
  }

  // 2. Media Constraints & Aspect Ratio Distortions
  const images = Array.from(document.querySelectorAll('img'));
  const brokenImages = [];
  const distortedImages = [];
  const unconstrainedImages = [];

  for (const img of images) {
    // Check broken images
    if (!img.complete || img.naturalWidth === 0) {
      brokenImages.push({
        src: (img.src || img.getAttribute('src') || '').slice(0, 100),
        alt: (img.alt || '').slice(0, 50)
      });
      continue;
    }

    if (img.clientWidth > 0 && img.clientHeight > 0) {
      const style = window.getComputedStyle(img);
      const objectFit = style.objectFit || 'fill';

      // Aspect ratio distortion test (only applies when object-fit is not preserving ratio)
      if (objectFit !== 'cover' && objectFit !== 'contain' && objectFit !== 'scale-down' && objectFit !== 'none') {
        const naturalRatio = img.naturalWidth / img.naturalHeight;
        const renderedRatio = img.clientWidth / img.clientHeight;
        const skew = Math.abs(renderedRatio - naturalRatio) / naturalRatio;
        if (skew > 0.08) { // >8% skew
          distortedImages.push({
            src: (img.src || '').slice(0, 100),
            rendered: [img.clientWidth, img.clientHeight],
            natural: [img.naturalWidth, img.naturalHeight],
            objectFit,
            skewPercent: Math.round(skew * 100)
          });
        }
      }

      // Check unconstrained image blowing out container
      if (img.naturalWidth > 600 && img.clientWidth > winW) {
        unconstrainedImages.push({
          src: (img.src || '').slice(0, 100),
          clientWidth: img.clientWidth,
          naturalWidth: img.naturalWidth
        });
      }
    }
  }

  // 3. Typography & Web Font Rendering
  const fontStatus = document.fonts ? document.fonts.status : 'unsupported';
  let totalFonts = 0;
  let loadedFonts = 0;
  if (document.fonts) {
    totalFonts = document.fonts.size;
    document.fonts.forEach(f => {
      if (f.status === 'loaded') loadedFonts++;
    });
  }

  // Text clipping & line-height issues
  const clippedTextElements = [];
  for (const el of allElements) {
    if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'BUTTON', 'A'].includes(el.tagName)) {
      if (el.children.length === 0 && el.textContent && el.textContent.trim().length > 0) {
        const style = window.getComputedStyle(el);
        if (style.overflow === 'hidden' || style.textOverflow === 'ellipsis') {
          if (el.scrollWidth > el.clientWidth + 3 || el.scrollHeight > el.clientHeight + 3) {
            clippedTextElements.push({
              tag: el.tagName.toLowerCase(),
              text: el.textContent.trim().slice(0, 40),
              scroll: [el.scrollWidth, el.scrollHeight],
              client: [el.clientWidth, el.clientHeight]
            });
            if (clippedTextElements.length >= 8) break;
          }
        }
      }
    }
  }

  // Contrast check helpers (WCAG AA)
  const parseRgb = (str) => {
    const m = str && str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
    if (!m) return null;
    return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
  };
  const getLuminance = ([r, g, b]) => {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  };
  const getEffectiveBgColor = (el) => {
    let p = el;
    while (p) {
      try {
        const s = window.getComputedStyle(p);
        const rgb = parseRgb(s.backgroundColor);
        if (rgb && (s.backgroundColor.indexOf('rgba') === -1 || !s.backgroundColor.includes(', 0)'))) {
          return rgb;
        }
      } catch (e) {}
      p = p.parentElement;
    }
    return [255, 255, 255]; // fallback white background
  };

  const lowContrastElements = [];
  for (const el of allElements) {
    if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'BUTTON', 'A', 'LABEL'].includes(el.tagName)) {
      if (el.children.length === 0 && el.textContent && el.textContent.trim().length > 2) {
        try {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
          const fg = parseRgb(style.color);
          if (fg) {
            const bg = getEffectiveBgColor(el);
            const l1 = getLuminance(fg);
            const l2 = getLuminance(bg);
            const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
            const fontSize = parseFloat(style.fontSize) || 16;
            const isLarge = fontSize >= 24 || (fontSize >= 18.5 && style.fontWeight >= 700);
            const minRatio = isLarge ? 3.0 : 4.5;
            if (ratio < minRatio) {
              lowContrastElements.push({
                tag: el.tagName.toLowerCase(),
                text: el.textContent.trim().slice(0, 35),
                contrast: Math.round(ratio * 100) / 100,
                required: minRatio,
                fg: style.color,
                bg: 'rgb(' + bg.join(',') + ')'
              });
              if (lowContrastElements.length >= 6) break;
            }
          }
        } catch (e) {}
      }
    }
  }

  // 4. Cartographic / Map Tile Integrity
  const mapContainer = document.querySelector('.leaflet-container, .mapboxgl-map, [data-map], #map');
  let mapStatus = null;
  if (mapContainer) {
    const brokenTiles = Array.from(mapContainer.querySelectorAll('img.leaflet-tile, img'))
      .filter(t => !t.complete || t.naturalWidth === 0);
    const hasWatermarkError = mapContainer.innerText.includes('development purposes only') ||
      mapContainer.innerText.includes('Map data not available');

    mapStatus = {
      detected: true,
      containerTag: mapContainer.tagName.toLowerCase(),
      brokenTilesCount: brokenTiles.length,
      hasWatermarkError,
      rect: {
        width: Math.round(mapContainer.getBoundingClientRect().width),
        height: Math.round(mapContainer.getBoundingClientRect().height)
      }
    };
  }

  // 5. Interactive Overlays & Modals
  const activeModals = Array.from(document.querySelectorAll('[role="dialog"], [aria-modal="true"], .modal.show, .modal-open'))
    .map(m => ({
      tag: m.tagName.toLowerCase(),
      visible: window.getComputedStyle(m).display !== 'none' && window.getComputedStyle(m).visibility !== 'hidden'
    }));

  return {
    viewport: { width: winW, height: winH },
    dimensions: { scrollWidth, scrollHeight },
    layout: {
      hasHorizontalScroll,
      scrollWidthDiff: Math.max(0, scrollWidth - winW),
      overflowingElementsCount: overflowingElements.length,
      overflowingElements: overflowingElements.slice(0, 5)
    },
    media: {
      totalImagesCount: images.length,
      brokenImagesCount: brokenImages.length,
      brokenImages: brokenImages.slice(0, 5),
      distortedImagesCount: distortedImages.length,
      distortedImages: distortedImages.slice(0, 5),
      unconstrainedImagesCount: unconstrainedImages.length
    },
    typography: {
      fontStatus,
      totalFonts,
      loadedFonts,
      clippedTextElementsCount: clippedTextElements.length,
      clippedTextElements: clippedTextElements.slice(0, 5),
      lowContrastElementsCount: lowContrastElements.length,
      lowContrastElements: lowContrastElements.slice(0, 5)
    },
    cartographic: mapStatus,
    interactive: {
      activeModalsCount: activeModals.filter(m => m.visible).length
    }
  };
})()`;

/**
 * Main Capture Routine
 */
async function runVisualQA() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const chromePath = resolveChromePath(options.chromePath);
  const viewports = resolveViewportConfigs(options.viewports, options.deviceScaleFactor);
  fs.mkdirSync(options.outDir, { recursive: true });

  const port = await getFreePort();
  const tempProfileDir = path.join(os.tmpdir(), `visual-qa-chrome-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(tempProfileDir, { recursive: true });

  let chromeProcess = null;
  let pageWs = null;

  // Cleanup handler
  const cleanup = () => {
    if (pageWs && pageWs.readyState === pageWs.OPEN) {
      try { pageWs.close(); } catch (e) {}
    }
    if (chromeProcess) {
      try { chromeProcess.kill('SIGKILL'); } catch (e) {}
    }
    // Asynchronous cleanup retry for temp user dir
    setTimeout(() => {
      try { fs.rmSync(tempProfileDir, { recursive: true, force: true }); } catch (e) {}
    }, 400);
  };

  process.on('SIGINT', () => { cleanup(); process.exit(130); });
  process.on('SIGTERM', () => { cleanup(); process.exit(143); });

  try {
    // 1. Spawn Chrome in modern headless mode with isolated clean profile
    chromeProcess = spawn(
      chromePath,
      [
        '--headless=new',
        `--remote-debugging-port=${port}`,
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-sync',
        '--disable-extensions',
        '--disable-default-apps',
        '--hide-scrollbars',
        `--user-data-dir=${tempProfileDir}`,
        'about:blank',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );

    chromeProcess.stderr.on('data', () => {}); // Drain stderr

    // 2. Poll for Chrome DevTools HTTP endpoint
    let wsUrl = null;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 120));
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        if (res.ok) {
          const list = await res.json();
          const page = list.find((item) => item.type === 'page');
          if (page && page.webSocketDebuggerUrl) {
            wsUrl = page.webSocketDebuggerUrl;
            break;
          }
        }
      } catch (e) {}
    }

    if (!wsUrl) {
      throw new Error(`Failed to connect to Chrome DevTools Protocol on port ${port} within 10s`);
    }

    // 3. Connect to Page WebSocket
    pageWs = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      pageWs.onopen = resolve;
      pageWs.onerror = reject;
    });

    let msgId = 1;
    const pendingRequests = new Map();
    pageWs.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && pendingRequests.has(msg.id)) {
          const { resolve, reject } = pendingRequests.get(msg.id);
          pendingRequests.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          else resolve(msg.result);
        }
      } catch (e) {}
    };

    function cdpCall(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = msgId++;
        pendingRequests.set(id, { resolve, reject });
        pageWs.send(JSON.stringify({ id, method, params }));
      });
    }

    // Enable domains
    await cdpCall('Page.enable');
    await cdpCall('DOM.enable');
    await cdpCall('Runtime.enable');

    // 4. Initial Navigation
    await cdpCall('Page.navigate', { url: options.url });

    // Wait for document load
    await new Promise((r) => setTimeout(r, 600));

    // Wait for document.fonts.ready
    try {
      await cdpCall('Runtime.evaluate', {
        expression: 'document.fonts ? document.fonts.ready.then(() => true) : Promise.resolve(true)',
        awaitPromise: true,
        timeout: 5000,
      });
    } catch (e) {}

    // Wait for custom selector if provided
    if (options.waitForSelector) {
      const waitStart = Date.now();
      let found = false;
      while (Date.now() - waitStart < 10000) {
        const res = await cdpCall('Runtime.evaluate', {
          expression: `Boolean(document.querySelector(${JSON.stringify(options.waitForSelector)}))`,
          returnByValue: true,
        });
        if (res?.result?.value) {
          found = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 150));
      }
      if (!found) {
        console.warn(`[visual-qa] Warning: selector '${options.waitForSelector}' not found within 10s`);
      }
    }

    // Settle delay
    if (options.delay > 0) {
      await new Promise((r) => setTimeout(r, options.delay));
    }

    // Prepare filename prefix
    let prefix = options.prefix;
    if (!prefix) {
      try {
        const parsed = new URL(options.url);
        prefix = parsed.hostname.replace(/[^a-zA-Z0-9]/g, '_');
        if (parsed.pathname && parsed.pathname !== '/') {
          prefix += parsed.pathname.replace(/[^a-zA-Z0-9]/g, '_');
        }
      } catch (e) {
        prefix = 'capture';
      }
    }

    const manifest = {
      timestamp: new Date().toISOString(),
      url: options.url,
      outDir: options.outDir,
      screenshots: [],
      audits: {},
      summary: {
        totalScreenshots: 0,
        hasHorizontalOverflow: false,
        brokenImagesCount: 0,
        distortedImagesCount: 0,
        unconstrainedImagesCount: 0,
        clippedTextCount: 0,
        lowContrastElementsCount: 0,
        cartographicIssues: false,
      },
    };

    // 5. Capture screenshots for each requested viewport
    for (const vp of viewports) {
      // Set responsive metrics
      await cdpCall('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: vp.deviceScaleFactor || 1,
        mobile: vp.mobile || false,
      });

      if (vp.hasTouch) {
        await cdpCall('Emulation.setTouchEmulationEnabled', { enabled: true });
      } else {
        await cdpCall('Emulation.setTouchEmulationEnabled', { enabled: false });
      }

      // Small delay for responsive layout recalibration
      await new Promise((r) => setTimeout(r, 350));

      // In-browser audit check
      if (options.audit) {
        const auditRes = await cdpCall('Runtime.evaluate', {
          expression: IN_PAGE_AUDIT_SCRIPT,
          returnByValue: true,
        });
        if (auditRes?.exceptionDetails) {
          console.error('[visual-qa audit exception]:', auditRes.exceptionDetails);
        }
        const auditData = auditRes?.result?.value || null;
        if (auditData) {
          manifest.audits[vp.name] = auditData;
          if (auditData.layout?.hasHorizontalScroll) manifest.summary.hasHorizontalOverflow = true;
          if (auditData.media?.brokenImagesCount > 0) {
            manifest.summary.brokenImagesCount = Math.max(
              manifest.summary.brokenImagesCount,
              auditData.media.brokenImagesCount
            );
          }
          if (auditData.media?.distortedImagesCount > 0) {
            manifest.summary.distortedImagesCount = Math.max(
              manifest.summary.distortedImagesCount,
              auditData.media.distortedImagesCount
            );
          }
          if (auditData.media?.unconstrainedImagesCount > 0) {
            manifest.summary.unconstrainedImagesCount = Math.max(
              manifest.summary.unconstrainedImagesCount,
              auditData.media.unconstrainedImagesCount
            );
          }
          if (auditData.typography?.clippedTextElementsCount > 0) {
            manifest.summary.clippedTextCount = Math.max(
              manifest.summary.clippedTextCount,
              auditData.typography.clippedTextElementsCount
            );
          }
          if (auditData.typography?.lowContrastElementsCount > 0) {
            manifest.summary.lowContrastElementsCount = Math.max(
              manifest.summary.lowContrastElementsCount,
              auditData.typography.lowContrastElementsCount
            );
          }
          if (auditData.cartographic?.hasWatermarkError || auditData.cartographic?.brokenTilesCount > 0) {
            manifest.summary.cartographicIssues = true;
          }
        }
      }

      // 5a. Viewport Screenshot
      const filename = `${prefix}_${vp.name}_${vp.width}x${vp.height}.png`;
      const filePath = path.join(options.outDir, filename);

      const shot = await cdpCall('Page.captureScreenshot', {
        format: 'png',
        clip: {
          x: 0,
          y: 0,
          width: vp.width,
          height: vp.height,
          scale: 1,
        },
      });

      const buffer = Buffer.from(shot.data, 'base64');
      fs.writeFileSync(filePath, buffer);

      manifest.screenshots.push({
        viewport: vp.name,
        type: 'viewport',
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: vp.deviceScaleFactor || 1,
        filename,
        path: filePath,
        sizeBytes: buffer.length,
      });

      // 5b. Full-Page Screenshot (if requested)
      if (options.fullPage) {
        const fullFilename = `${prefix}_${vp.name}_${vp.width}x${vp.height}_fullpage.png`;
        const fullFilePath = path.join(options.outDir, fullFilename);

        const fullShot = await cdpCall('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: true,
        });

        const fullBuffer = Buffer.from(fullShot.data, 'base64');
        fs.writeFileSync(fullFilePath, fullBuffer);

        manifest.screenshots.push({
          viewport: vp.name,
          type: 'fullpage',
          width: vp.width,
          height: 'scroll',
          filename: fullFilename,
          path: fullFilePath,
          sizeBytes: fullBuffer.length,
        });
      }

      // 5c. Element Selector Screenshot (if requested)
      if (options.selector) {
        const rectRes = await cdpCall('Runtime.evaluate', {
          expression: `(() => {
            const el = document.querySelector(${JSON.stringify(options.selector)});
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          })()`,
          returnByValue: true,
        });

        const rect = rectRes?.result?.value;
        if (rect && rect.width > 0 && rect.height > 0) {
          const selFilename = `${prefix}_${vp.name}_selector.png`;
          const selFilePath = path.join(options.outDir, selFilename);

          const selShot = await cdpCall('Page.captureScreenshot', {
            format: 'png',
            clip: {
              x: Math.max(0, rect.x),
              y: Math.max(0, rect.y),
              width: Math.ceil(rect.width),
              height: Math.ceil(rect.height),
              scale: 1,
            },
          });

          const selBuffer = Buffer.from(selShot.data, 'base64');
          fs.writeFileSync(selFilePath, selBuffer);

          manifest.screenshots.push({
            viewport: vp.name,
            type: 'element',
            selector: options.selector,
            width: Math.ceil(rect.width),
            height: Math.ceil(rect.height),
            filename: selFilename,
            path: selFilePath,
            sizeBytes: selBuffer.length,
          });
        }
      }
    }

    manifest.summary.totalScreenshots = manifest.screenshots.length;

    // Write manifest.json
    const manifestPath = path.join(options.outDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

    // Output formatted JSON manifest to stdout
    console.log(JSON.stringify(manifest, null, 2));
  } finally {
    cleanup();
  }
}

runVisualQA().catch((err) => {
  console.error(`[visual-qa error]: ${err.stack || err.message}`);
  process.exit(1);
});
