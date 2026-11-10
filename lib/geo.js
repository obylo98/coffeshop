// Great-circle distance in metres between two lat/lon points.
export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export const METRES_PER_MILE = 1609.344;

/** Format a distance in metres using the user's preferred units ('km' | 'mi'). */
export function formatDistance(m, units = 'km') {
  if (m == null || Number.isNaN(m)) return '';
  if (units === 'mi') {
    const mi = m / METRES_PER_MILE;
    return mi < 0.1 ? `${Math.round(m * 3.28084)} ft` : `${mi.toFixed(1)} mi`;
  }
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

/** Walking time in minutes at ~4.8 km/h. */
export function walkMinutes(m) {
  return Math.max(1, Math.round(m / 80));
}

