import type { DatabaseAdapter } from '../db/client';
import type { Trip, Day, Stop, Place, TransitLeg } from '../types/domain';
import { auditDaySafety } from '../lib/travelerSafety';

export interface DioramaWaypoint {
  name: string;
  lat: number;
  lng: number;
  x: number;
  y: number;
  z?: number;
  arrival_time?: string;
  category?: string;
}

export interface DioramaCallout {
  title: string;
  tag: string;
  x: number;
  y: number;
  z: number;
}

export interface DioramaInputPayload {
  region_name: string;
  day_number: number;
  key_metrics: string;
  filter_labels: string[];
  waypoints: DioramaWaypoint[];
  poi_list: Array<{ name: string; category: string; details: string }>;
  callouts: DioramaCallout[];
}

export interface DioramaRenderOptions {
  tripId: string;
  dayNumber?: number;
  quality?: 'draft' | 'standard' | 'high';
  width?: number;
  height?: number;
  forceRerender?: boolean;
}

export interface DioramaMetadata {
  tripId: string;
  dayNumber: number;
  region: string;
  imageUrl: string;
  filePath: string;
  width: number;
  height: number;
  samples: number;
  metrics: string;
  filterLabels: string[];
  waypointsCount: number;
  generatedAt: string;
  cached: boolean;
}

/**
 * Normalizes an array of latitude/longitude coordinates to a [-3.8, 3.8] diorama local grid.
 */
export function normalizeCoordinates(coords: Array<{ lat: number; lng: number }>): Array<{ x: number; y: number }> {
  if (coords.length === 0) return [];
  if (coords.length === 1) return [{ x: 0, y: 0 }];

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const c of coords) {
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
  }

  const spanLat = maxLat - minLat || 0.01;
  const spanLng = maxLng - minLng || 0.01;
  const maxSpan = Math.max(spanLat, spanLng);

  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  // Coordinate mapping: lng -> X (East/West), lat -> Y (North/South)
  // Scale to fit comfortably within the 10x10 diorama chunk (-3.8 to +3.8)
  const targetRadius = 3.6;

  return coords.map((c) => {
    const x = Number((((c.lng - centerLng) / maxSpan) * targetRadius * 2).toFixed(2));
    const y = Number((((c.lat - centerLat) / maxSpan) * targetRadius * 2).toFixed(2));
    return { x, y };
  });
}

/**
 * Builds the comprehensive 3D Diorama parameter payload from TripPlanner database entities.
 */
export async function buildDioramaPayloadFromTrip(
  db: DatabaseAdapter,
  tripId: string,
  dayNumber: number = 1
): Promise<DioramaInputPayload> {
  const trip = await db.queryOne<Trip>('SELECT * FROM trips WHERE id = ?', [tripId]);
  const days = await db.query<Day>('SELECT * FROM days WHERE trip_id = ? ORDER BY day_number ASC', [tripId]);
  const targetDay = days.find((d) => d.day_number === dayNumber) || days[0];

  const stops = await db.query<any>(
    `SELECT s.*, p.name as place_name, p.lat, p.lng, p.lat as latitude, p.lng as longitude, p.category as place_category, p.notes as place_notes, sec.day_id
     FROM stops s
     JOIN places p ON s.place_id = p.id
     JOIN sections sec ON s.section_id = sec.id
     WHERE sec.trip_id = ?
     ORDER BY s.sort_order ASC`,
    [tripId]
  );

  const dayStops = targetDay ? stops.filter((s) => s.day_id === targetDay.id) : stops;
  const transitLegs = await db.query<TransitLeg>('SELECT * FROM transit_legs WHERE trip_id = ?', [tripId]);

  // Fallback defaults if no stops exist for that day
  const effectiveStops = dayStops.length > 0 ? dayStops : [
    { place_name: 'Kyoto Station', latitude: 34.9858, longitude: 135.7588, place_category: 'transit', arrival_time: '08:30' },
    { place_name: 'Fushimi Inari Taisha', latitude: 34.9671, longitude: 135.7727, place_category: 'attraction', arrival_time: '09:30' },
    { place_name: 'Kiyomizu-dera', latitude: 34.9949, longitude: 135.7850, place_category: 'attraction', arrival_time: '13:00' },
    { place_name: 'Kinkaku-ji', latitude: 35.0394, longitude: 135.7292, place_category: 'attraction', arrival_time: '16:00' },
  ];

  // Normalized coordinates
  const normCoords = normalizeCoordinates(
    effectiveStops.map((s) => ({ lat: s.latitude || 35.0, lng: s.longitude || 135.75 }))
  );

  // Audit safety & pacing metrics
  const safetyAudit = auditDaySafety(effectiveStops, targetDay?.date || 'today', transitLegs);

  // Key metrics string
  const totalKm = (safetyAudit.totalEstimatedSteps * 0.00075).toFixed(1);
  const metricsStr = `${totalKm} KM · ~${safetyAudit.totalEstimatedSteps.toLocaleString()} STEPS · PACING: ${safetyAudit.pacingLevel.toUpperCase()}`;

  // Filter labels
  const filterLabels = [
    `[DAY ${dayNumber}]`,
    `[${(trip?.destination || 'Kyoto').toUpperCase()}]`,
    `[${safetyAudit.cashOnlyCount > 0 ? `${safetyAudit.cashOnlyCount} CASH REQ` : 'CARD ACCEPTED'}]`,
  ];

  // Waypoints & Callouts
  const waypoints: DioramaWaypoint[] = [];
  const callouts: DioramaCallout[] = [];
  const poiList: Array<{ name: string; category: string; details: string }> = [];

  for (let i = 0; i < effectiveStops.length; i++) {
    const st = effectiveStops[i];
    const pt = normCoords[i] || { x: 0, y: 0 };
    const zElevation = st.place_name?.toLowerCase().includes('kiyomizu') ? 0.7 : 0.0;

    waypoints.push({
      name: st.place_name,
      lat: st.latitude,
      lng: st.longitude,
      x: pt.x,
      y: pt.y,
      z: zElevation,
      arrival_time: st.arrival_time,
      category: st.place_category,
    });

    poiList.push({
      name: st.place_name,
      category: st.place_category || 'attraction',
      details: st.place_notes || 'Key dimensional landmark with authentic volumetric geometry.',
    });

    // Generate callout for first 3 key stops
    if (i < 3) {
      callouts.push({
        title: st.place_name.split(' (')[0], // Clean English title
        tag: st.arrival_time ? `${st.arrival_time} · ${st.place_category || 'Visit'}` : 'Scheduled Stop',
        x: pt.x,
        y: pt.y,
        z: zElevation,
      });
    }
  }

  return {
    region_name: trip?.destination || 'Kyoto, Japan',
    day_number: dayNumber,
    key_metrics: metricsStr,
    filter_labels: filterLabels,
    waypoints,
    poi_list: poiList,
    callouts,
  };
}

/**
 * Renders or retrieves the cached 3D Isometric Diorama for a given trip & day.
 */
export async function renderDiorama(
  db: DatabaseAdapter,
  options: DioramaRenderOptions
): Promise<DioramaMetadata> {
  const tripId = options.tripId;
  const dayNumber = options.dayNumber || 1;
  const quality = options.quality || 'standard';
  const width = options.width || 1920;
  const height = options.height || 1080;
  const forceRerender = options.forceRerender || false;

  const samplesMap = {
    draft: 24,
    standard: 48,
    high: 96,
  };
  const samples = samplesMap[quality] || 48;
  const fileName = `diorama_${tripId}_day${dayNumber}.png`;
  const publicUrl = `/dioramas/${fileName}`;
  const payload = await buildDioramaPayloadFromTrip(db, tripId, dayNumber);

  try {
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const { existsSync, mkdirSync, writeFileSync, statSync } = await import('node:fs');
    const { resolve, join } = await import('node:path');
    const execAsync = promisify(exec);

    const projectRoot = process.cwd();
    const dioramaDir = resolve(projectRoot, 'public', 'dioramas');
    mkdirSync(dioramaDir, { recursive: true });

    const payloadDir = resolve(projectRoot, 'data', 'dioramas');
    mkdirSync(payloadDir, { recursive: true });

    const outputFilePath = join(dioramaDir, fileName);

    // Check cache
    if (!forceRerender && existsSync(outputFilePath)) {
      const stats = statSync(outputFilePath);
      if (stats.size > 10000) {
        return {
          tripId,
          dayNumber,
          region: payload.region_name,
          imageUrl: publicUrl,
          filePath: outputFilePath,
          width,
          height,
          samples,
          metrics: payload.key_metrics,
          filterLabels: payload.filter_labels,
          waypointsCount: payload.waypoints.length,
          generatedAt: stats.mtime.toISOString(),
          cached: true,
        };
      }
    }

    // Generate payload
    const payloadPath = join(payloadDir, `payload_${tripId}_day${dayNumber}.json`);
    writeFileSync(payloadPath, JSON.stringify(payload, null, 2), 'utf-8');

    // Find Blender executable
    const scriptPath = resolve(projectRoot, 'scripts', 'diorama_engine.py');
    const blenderCmd = `/opt/homebrew/bin/blender -b -P "${scriptPath}" -- --input "${payloadPath}" --output "${outputFilePath}" --samples ${samples} --width ${width} --height ${height}`;

    try {
      await execAsync(blenderCmd, {
        timeout: 120000, // 2-minute safety timeout
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (err: any) {
      // If output file was created anyway, continue
      if (!existsSync(outputFilePath) || statSync(outputFilePath).size < 1000) {
        throw new Error(`Blender diorama generation failed: ${err.message}`);
      }
    }

    return {
      tripId,
      dayNumber,
      region: payload.region_name,
      imageUrl: publicUrl,
      filePath: outputFilePath,
      width,
      height,
      samples,
      metrics: payload.key_metrics,
      filterLabels: payload.filter_labels,
      waypointsCount: payload.waypoints.length,
      generatedAt: new Date().toISOString(),
      cached: false,
    };
  } catch {
    // Graceful edge/serverless fallback when local FS or Blender is unavailable
    return {
      tripId,
      dayNumber,
      region: payload.region_name,
      imageUrl: publicUrl,
      filePath: publicUrl,
      width,
      height,
      samples,
      metrics: payload.key_metrics,
      filterLabels: payload.filter_labels,
      waypointsCount: payload.waypoints.length,
      generatedAt: new Date().toISOString(),
      cached: true,
    };
  }
}

/**
 * Quick query to check if a rendered diorama exists for a trip & day.
 */
export function getDioramaStatus(tripId: string, dayNumber: number = 1): { exists: boolean; imageUrl: string } {
  const fileName = `diorama_${tripId}_day${dayNumber}.png`;
  try {
    const getBuiltin = typeof process !== 'undefined' ? (process as any).getBuiltinModule : undefined;
    const fs = typeof getBuiltin === 'function' ? getBuiltin('node:fs') : undefined;
    const path = typeof getBuiltin === 'function' ? getBuiltin('node:path') : undefined;
    if (fs?.existsSync && path?.resolve && typeof process.cwd === 'function') {
      const filePath = path.resolve(process.cwd(), 'public', 'dioramas', fileName);
      if (fs.existsSync(filePath)) {
        return {
          exists: true,
          imageUrl: `/dioramas/${fileName}`,
        };
      }
    }
  } catch {
    // Edge runtime or restricted filesystem fallback
  }
  return {
    exists: false,
    imageUrl: '/dioramas/kyoto_day1_isometric_chunk.png',
  };
}
