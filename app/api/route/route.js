import { NextResponse } from 'next/server';
import { stepIcon, stepText } from '@/lib/route-text';

export const dynamic = 'force-dynamic';

// Free OSRM routing on OpenStreetMap data, run by FOSSGIS (routing.openstreetmap.de).
const PROFILES = { foot: 'routed-foot', bike: 'routed-bike', car: 'routed-car' };
const cache = new Map();

const parsePoint = (s) => {
  const [lat, lon] = String(s || '').split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon } : null;
};

// GET /api/route?from=lat,lon&to=lat,lon&mode=foot|bike|car
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const from = parsePoint(p.get('from'));
  const to = parsePoint(p.get('to'));
  const mode = PROFILES[p.get('mode')] ? p.get('mode') : 'foot';
  if (!from || !to) return NextResponse.json({ error: 'Missing start or destination.' }, { status: 400 });

  const key = `${mode}:${from.lat.toFixed(5)},${from.lon.toFixed(5)}:${to.lat.toFixed(5)},${to.lon.toFixed(5)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 15 * 60 * 1000) return NextResponse.json(hit.data);

  const url =
    `https://routing.openstreetmap.de/${PROFILES[mode]}/route/v1/driving/` +
    `${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=true`;

  let json;
  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'coffeshop-finder-local/1.0' },
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
    });
    json = await r.json();
    if (!r.ok && !json?.code) throw new Error(`routing service responded ${r.status}`);
  } catch (e) {
    return NextResponse.json({ error: `Could not reach the routing service (${e.message}).` }, { status: 502 });
  }

  if (json.code !== 'Ok' || !json.routes?.length) {
    const msg = json.code === 'NoRoute' ? 'No route found between these points.' : json.message || 'No route found.';
    return NextResponse.json({ error: msg }, { status: 404 });
  }

  const route = json.routes[0];
  const steps = route.legs
    .flatMap((leg) => leg.steps)
    .filter((s, i, all) => !(s.maneuver.type === 'depart' && s.distance === 0 && all.length > 2))
    .map((s) => ({
      text: stepText(s, mode),
      icon: stepIcon(s.maneuver.type, s.maneuver.modifier),
      type: s.maneuver.type,
      name: s.name || '',
      distance: s.distance,
      duration: s.duration,
      lat: s.maneuver.location[1],
      lon: s.maneuver.location[0],
    }));

  const data = {
    mode,
    distance: route.distance,
    duration: route.duration,
    coords: route.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
    steps,
  };
  cache.set(key, { at: Date.now(), data });
  if (cache.size > 300) cache.delete(cache.keys().next().value);
  return NextResponse.json(data);
}
