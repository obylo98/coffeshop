const UA = 'coffeshop-finder-local/1.0';

/** Geocode free text to { lat, lon, label } or null. */
export async function geocode(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Nominatim responded ${r.status}`);
  const [hit] = await r.json();
  if (!hit) return null;
  const a = hit.address ?? {};
  const short =
    a.neighbourhood || a.suburb || a.quarter || a.city_district || a.city || a.town || a.village || hit.name;
  return { lat: Number(hit.lat), lon: Number(hit.lon), label: hit.display_name, short: short || hit.display_name };
}

/** Look up one OSM element (e.g. "node/123") with tags + address. */
export async function lookupOsm(id) {
  const m = /^(node|way|relation)\/(\d+)$/.exec(id);
  if (!m) return null;
  const code = { node: 'N', way: 'W', relation: 'R' }[m[1]] + m[2];
  const url = `https://nominatim.openstreetmap.org/lookup?format=jsonv2&addressdetails=1&extratags=1&osm_ids=${code}`;
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en' },
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!r.ok) throw new Error(`Nominatim responded ${r.status}`);
  const [hit] = await r.json();
  return hit ?? null;
}
