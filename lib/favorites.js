import crypto from 'crypto';
import { DEFAULT_SETTINGS } from './defaults';

export { DEFAULT_SETTINGS };

const str = (v, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const AMENITY_KEYS = ['wifi', 'outdoor', 'wheelchair', 'takeaway', 'vegan', 'dogs', 'roastery'];

export function cleanTags(tags) {
  const list = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(/[,\n]/) : [];
  const out = [];
  for (const t of list) {
    const tag = str(t, 40).replace(/^#+/, '').replace(/\s+/g, ' ');
    if (tag && !out.some((o) => o.toLowerCase() === tag.toLowerCase())) out.push(tag);
  }
  return out.slice(0, 12);
}

const num = (v, min, max) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : null;
};

export function cleanCupping(e = {}) {
  const scores = {};
  for (const k of ['acidity', 'sweetness', 'body', 'aftertaste']) scores[k] = num(e.scores?.[k], 0, 5) ?? 0;
  return {
    id: str(e.id, 64) || crypto.randomUUID(),
    bean: str(e.bean, 160),
    roastProfile: str(e.roastProfile, 40),
    roastDate: str(e.roastDate, 20),
    method: str(e.method, 40),
    temp: str(e.temp, 30),
    ratio: str(e.ratio, 40),
    descriptors: cleanTags(e.descriptors),
    scores,
    journal: str(e.journal, 3000),
    createdAt: str(e.createdAt, 40) || new Date().toISOString(),
  };
}

/** Normalise a favourite coming from the client or an imported backup. Returns null if invalid. */
export function cleanFavorite(b = {}) {
  const lat = Number(b.lat);
  const lon = Number(b.lon);
  const id = str(b.id, 100);
  if (!id || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const amenities = {};
  for (const k of AMENITY_KEYS) amenities[k] = Boolean(b.amenities?.[k]);
  return {
    id,
    name: str(b.name, 200) || 'Unnamed café',
    lat,
    lon,
    address: str(b.address),
    neighborhood: str(b.neighborhood, 120),
    kind: str(b.kind, 60) || 'Café',
    cuisine: str(b.cuisine, 120),
    openingHours: str(b.openingHours),
    website: str(b.website),
    phone: str(b.phone, 60),
    amenities,
    custom: Boolean(b.custom) || id.startsWith('custom/'),
    note: str(b.note, 2000),
    tags: cleanTags(b.tags),
    cupping: Array.isArray(b.cupping) ? b.cupping.slice(0, 200).map(cleanCupping) : [],
    savedAt: str(b.savedAt, 40) || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function cleanSettings(s = {}) {
  const pick = (v, allowed, d) => (allowed.includes(v) ? v : d);
  const lat = num(s.fixedLat, -90, 90);
  const lon = num(s.fixedLon, -180, 180);
  return {
    anchor: pick(s.anchor, ['gps', 'fixed'], DEFAULT_SETTINGS.anchor),
    fixedAddress: str(s.fixedAddress, 200),
    fixedLat: lat,
    fixedLon: lon,
    fixedLabel: str(s.fixedLabel, 300),
    radius: num(s.radius, 200, 25000) ?? DEFAULT_SETTINGS.radius,
    units: pick(s.units, ['km', 'mi'], DEFAULT_SETTINGS.units),
    sort: pick(s.sort, ['distance', 'name', 'open'], DEFAULT_SETTINGS.sort),
    theme: pick(s.theme, ['warm', 'espresso', 'linen'], DEFAULT_SETTINGS.theme),
    mapStyle: pick(s.mapStyle, ['warm', 'topo', 'mono'], DEFAULT_SETTINGS.mapStyle),
  };
}
