import { NextResponse } from 'next/server';
import { updateDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { cleanCupping } from '@/lib/favorites';

const unauthorized = () => NextResponse.json({ error: 'Please log in first.' }, { status: 401 });

// POST { favId, entry } — add (or replace, if entry.id matches) a cupping note on a favourite.
export async function POST(req) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const { favId, entry } = await req.json().catch(() => ({}));
  const clean = cleanCupping(entry);
  const favorites = await updateDb((db) => {
    const u = db.users[user.key];
    const fav = (u.favorites ?? []).find((f) => f.id === favId);
    if (!fav) return null;
    fav.cupping ??= [];
    const i = fav.cupping.findIndex((c) => c.id === clean.id);
    if (i === -1) fav.cupping.unshift(clean);
    else fav.cupping[i] = clean;
    fav.updatedAt = new Date().toISOString();
    return u.favorites;
  });
  if (!favorites) return NextResponse.json({ error: 'Save this café to your favourites first.' }, { status: 404 });
  return NextResponse.json({ favorites });
}

// DELETE ?favId=..&entryId=..
export async function DELETE(req) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const p = new URL(req.url).searchParams;
  const favorites = await updateDb((db) => {
    const u = db.users[user.key];
    const fav = (u.favorites ?? []).find((f) => f.id === p.get('favId'));
    if (fav) fav.cupping = (fav.cupping ?? []).filter((c) => c.id !== p.get('entryId'));
    return u.favorites ?? [];
  });
  return NextResponse.json({ favorites });
}
