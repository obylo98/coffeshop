// Turn raw OpenStreetMap tags (from Overpass, or Nominatim extratags + address)
// into the shape the UI uses.

const yes = (v) => typeof v === 'string' && /^(yes|only|free|wlan|wifi|customers|designated|limited)$/i.test(v);

export function amenitiesFromTags(t = {}) {
  return {
    wifi: yes(t.internet_access) || yes(t.wifi) || t['internet_access:fee'] === 'no',
    outdoor: yes(t.outdoor_seating),
    wheelchair: t.wheelchair === 'yes' || t.wheelchair === 'designated',
    takeaway: yes(t.takeaway),
    vegan: yes(t['diet:vegan']),
    dogs: yes(t.dog),
    roastery:
      t.craft === 'coffee_roaster' ||
      /roast/i.test(t.name || '') ||
      /coffee_roast/i.test(t.cuisine || '') ||
      t['roastery'] === 'yes',
  };
}

export function kindFromTags(t = {}) {
  if (t.craft === 'coffee_roaster' || /roast/i.test(t.name || '')) return 'Coffee Roastery';
  if (t.shop === 'coffee') return 'Coffee Shop';
  if (/coffee_shop/i.test(t.cuisine || '')) return 'Coffee Shop';
  if (/bakery|cake|pastry/i.test(t.cuisine || '')) return 'Café & Bakery';
  if (/tea/i.test(t.cuisine || '')) return 'Café & Tea House';
  return 'Café';
}

export function cuisineLabel(t = {}) {
  if (!t.cuisine) return '';
  return t.cuisine
    .split(';')
    .map((c) => c.trim().replace(/_/g, ' '))
    .filter(Boolean)
    .map((c) => c[0].toUpperCase() + c.slice(1))
    .join(', ');
}

/** Build a shop object from Overpass element tags. */
export function shopFromTags(id, lat, lon, t = {}, addr = null) {
  const street = addr
    ? [addr.house_number, addr.road].filter(Boolean).join(' ')
    : [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
  const city = addr ? addr.city || addr.town || addr.village : t['addr:city'];
  const neighborhood = addr
    ? addr.neighbourhood || addr.suburb || addr.quarter || addr.city_district || ''
    : t['addr:suburb'] || t['addr:neighbourhood'] || t['addr:district'] || '';
  return {
    id,
    name: t.name || t.brand || 'Unnamed café',
    lat,
    lon,
    address: [street, city].filter(Boolean).join(', '),
    neighborhood,
    kind: kindFromTags(t),
    cuisine: cuisineLabel(t),
    brand: t.brand || '',
    openingHours: t.opening_hours || '',
    website: t.website || t['contact:website'] || '',
    phone: t.phone || t['contact:phone'] || '',
    email: t.email || t['contact:email'] || '',
    amenities: amenitiesFromTags(t),
  };
}
