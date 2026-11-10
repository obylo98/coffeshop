import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { updateDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { cleanFavorite, cleanTags } from '@/lib/favorites';
import { geocode } from '@/lib/nominatim';

export const dynamic = 'force-dynamic';

const unauthorized = () =>
  NextResponse.json({ error: 'Please log in to save favourites.' }, { status: 401 });

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return NextResponse.json({ favorites: user.favorites });
}

// Save a coffee shop — either one found on the map, or a custom spot
// ({ custom: true, name, address, tags, note }) which we geocode here.
export async function POST(req) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => ({}));

  if (body.custom) {
    if (!body.name?.trim() || !body.address?.trim()) {
      return NextResponse.json({ error: 'Name and address are required.' }, { status: 400 });
    }
    let place = null;
    if (Number.isFinite(Number(body.lat)) && Number.isFinite(Number(body.lon)) && body.lat !== '' && body.lon !== '') {
      place = { lat: Number(body.lat), lon: Number(body.lon) };
    } else {
      try {
        place = await geocode(body.address);
      } catch (e) {
        return NextResponse.json({ error: `Could not look up that address (${e.message}).` }, { status: 502 });
      }
      if (!place) return NextResponse.json({ error: `Couldn't find "${body.address}" on the map.` }, { status: 404 });
    }
    body.id = `custom/${crypto.randomUUID()}`;
    body.lat = place.lat;
    body.lon = place.lon;
    body.neighborhood ||= place.short || '';
    body.kind ||= 'Custom Spot';
  }

  const fav = cleanFavorite({ ...body, savedAt: new Date().toISOString(), cupping: [] });
  if (!fav) return NextResponse.json({ error: 'Invalid coffee shop.' }, { status: 400 });

  const favorites = await updateDb((db) => {
    const u = db.users[user.key];
    u.favorites ??= [];
    if (!u.favorites.some((f) => f.id === fav.id)) u.favorites.unshift(fav);
    return u.favorites;
  });
  return NextResponse.json({ favorites, saved: fav });
}

// Update a favourite's personal note / tags: { id, note?, tags? }
export async function PATCH(req) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const body = await req.json().catch(() => ({}));
  const result = await updateDb((db) => {
    const u = db.users[user.key];
    const fav = (u.favorites ?? []).find((f) => f.id === body.id);
    if (!fav) return null;
    if (typeof body.note === 'string') fav.note = body.note.trim().slice(0, 2000);
    if (body.tags !== undefined) fav.tags = cleanTags(body.tags);
    fav.updatedAt = new Date().toISOString();
    return u.favorites;
  });
  if (!result) return NextResponse.json({ error: 'Favourite not found.' }, { status: 404 });
  return NextResponse.json({ favorites: result });
}

// DELETE /api/favorites?id=node/123   or   DELETE /api/favorites?all=1
export async function DELETE(req) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const p = new URL(req.url).searchParams;
  const id = p.get('id');
  const all = p.get('all') === '1';
  const favorites = await updateDb((db) => {
    const u = db.users[user.key];
    u.favorites = all ? [] : (u.favorites ?? []).filter((f) => f.id !== id);
    return u.favorites;
  });
  return NextResponse.json({ favorites });
}
