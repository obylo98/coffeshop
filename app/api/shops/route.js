import { NextResponse } from 'next/server';
import { haversine } from '@/lib/geo';
import { shopFromTags } from '@/lib/osm';
import { shopCache } from '@/lib/cache';

export const dynamic = 'force-dynamic';

const UA = 'coffeshop-finder-local/1.0';

// Public Overpass mirrors. Availability varies a lot by network, so we query
// them all at once and use whichever answers first.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const OVERPASS_PREFERRED_WAIT_MS = 8000; // how long to wait for richer Overpass data
const OVERPASS_MAX_WAIT_MS = 30000;

const CACHE_TTL_MS = 10 * 60 * 1000;

async function fromOverpass(lat, lon, radius, signal) {
  const around = `(around:${radius},${lat},${lon})`;
  const query = `[out:json][timeout:25];
(
  node["amenity"="cafe"]${around};
  way["amenity"="cafe"]${around};
  node["shop"="coffee"]${around};
  node["craft"="coffee_roaster"]${around};
);
out center tags;`;

  const controllers = OVERPASS_ENDPOINTS.map(() => new AbortController());
  signal.addEventListener('abort', () => controllers.forEach((c) => c.abort()));

  const data = await Promise.any(
    OVERPASS_ENDPOINTS.map(async (url, i) => {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: 'data=' + encodeURIComponent(query),
        signal: controllers[i].signal,
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`Overpass ${r.status}`);
      const json = await r.json();
      if (!Array.isArray(json.elements)) throw new Error('Bad Overpass response');
      return json;
    }),
  );
  controllers.forEach((c) => c.abort()); // cancel the slower mirrors

  return data.elements
    .map((el) => {
      const sLat = el.lat ?? el.center?.lat;
      const sLon = el.lon ?? el.center?.lon;
      if (sLat == null || sLon == null) return null;
      return shopFromTags(`${el.type}/${el.id}`, sLat, sLon, el.tags ?? {});
    })
    .filter(Boolean);
}

async function fromNominatim(lat, lon, radius, signal) {
  const dLat = radius / 111320;
  const dLon = radius / (111320 * Math.cos((lat * Math.PI) / 180));
  const viewbox = [lon - dLon, lat + dLat, lon + dLon, lat - dLat].join(',');
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&q=cafe&bounded=1&limit=50' +
    `&addressdetails=1&extratags=1&namedetails=1&viewbox=${viewbox}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
    signal,
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);
  const hits = await r.json();
  return hits
    .filter((h) => h.category === 'amenity' && h.type === 'cafe')
    .map((h) =>
      shopFromTags(
        `${h.osm_type}/${h.osm_id}`,
        Number(h.lat),
        Number(h.lon),
        { name: h.name, amenity: 'cafe', ...(h.extratags ?? {}) },
        h.address ?? {},
      ),
    );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Run both sources in parallel. Prefer Overpass if it answers quickly,
// otherwise use Nominatim; if Nominatim fails too, keep waiting for Overpass.
async function findCafes(lat, lon, radius) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), OVERPASS_MAX_WAIT_MS);
  const overpass = fromOverpass(lat, lon, radius, abort.signal);
  const nominatim = fromNominatim(lat, lon, radius, AbortSignal.timeout(15000));
  overpass.catch(() => {});
  nominatim.catch(() => {});

  try {
    const quick = await Promise.race([overpass, sleep(OVERPASS_PREFERRED_WAIT_MS).then(() => null)]).catch(() => null);
    if (quick) return { shops: quick, source: 'overpass' };
    try {
      const fallback = await nominatim;
      abort.abort();
      return { shops: fallback, source: 'nominatim' };
    } catch {
      return { shops: await overpass, source: 'overpass' };
    }
  } finally {
    clearTimeout(timer);
  }
}

// GET /api/shops?lat=..&lon=..&radius=1500  ->  nearest cafes from OpenStreetMap
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  const lat = Number(p.get('lat'));
  const lon = Number(p.get('lon'));
  const radius = Math.min(Math.max(Number(p.get('radius')) || 1500, 200), 25000);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: 'Invalid coordinates.' }, { status: 400 });
  }

  const key = `${lat.toFixed(4)},${lon.toFixed(4)},${radius}`;
  const hit = shopCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return NextResponse.json({ shops: hit.shops, source: hit.source });

  let result;
  try {
    result = await findCafes(lat, lon, radius);
  } catch {
    return NextResponse.json(
      { error: 'Could not reach the map data service. Check your internet connection and try again.' },
      { status: 502 },
    );
  }

  const seen = new Set();
  const shops = result.shops
    .filter((s) => !seen.has(s.id) && seen.add(s.id))
    .map((s) => ({ ...s, distance: haversine(lat, lon, s.lat, s.lon) }))
    .filter((s) => s.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 100);

  shopCache.set(key, { at: Date.now(), shops, source: result.source });
  return NextResponse.json({ shops, source: result.source });
}
