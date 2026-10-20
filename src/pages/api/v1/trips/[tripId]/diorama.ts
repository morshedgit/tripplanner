import type { APIRoute } from 'astro';
import { getDb } from '../../../../../db/client';
import { jsonResponse, problemResponse } from '../../../../../lib/http';
import { renderDiorama, getDioramaStatus, buildDioramaPayloadFromTrip } from '../../../../../services/dioramaEngine';

export const prerender = false;

export const GET: APIRoute = async ({ params, request, locals }) => {
  try {
    const { tripId } = params;
    if (!tripId) {
      return problemResponse({
        status: 400,
        title: 'Bad Request',
        detail: 'tripId URL parameter is required',
        code: 'MISSING_TRIP_ID',
      });
    }

    const url = new URL(request.url);
    const dayNumber = parseInt(url.searchParams.get('day') || '1', 10);
    const shouldRender = url.searchParams.get('render') === 'true';

    const db = await getDb(locals);

    if (shouldRender) {
      const metadata = await renderDiorama(db, {
        tripId,
        dayNumber,
        quality: (url.searchParams.get('quality') as any) || 'standard',
      });
      return jsonResponse(metadata);
    }

    const status = getDioramaStatus(tripId, dayNumber);
    const payload = await buildDioramaPayloadFromTrip(db, tripId, dayNumber);

    return jsonResponse({
      tripId,
      dayNumber,
      exists: status.exists,
      imageUrl: status.imageUrl,
      region: payload.region_name,
      metrics: payload.key_metrics,
      filterLabels: payload.filter_labels,
      waypointsCount: payload.waypoints.length,
      waypoints: payload.waypoints,
      callouts: payload.callouts,
    });
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Diorama Service Error',
      detail: error.message || 'Failed to process diorama request',
      code: 'DIORAMA_ERROR',
    });
  }
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const { tripId } = params;
    if (!tripId) {
      return problemResponse({
        status: 400,
        title: 'Bad Request',
        detail: 'tripId URL parameter is required',
        code: 'MISSING_TRIP_ID',
      });
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      // Body optional
    }

    const db = await getDb(locals);
    const dayNumber = body.day_number || body.day || 1;
    const quality = body.quality || 'standard';
    const forceRerender = body.force !== false;

    const metadata = await renderDiorama(db, {
      tripId,
      dayNumber,
      quality,
      forceRerender,
    });

    return jsonResponse(metadata, 201);
  } catch (error: any) {
    return problemResponse({
      status: 500,
      title: 'Diorama Render Failed',
      detail: error.message || 'Failed to render 3D diorama scene',
      code: 'RENDER_DIORAMA_ERROR',
    });
  }
};
