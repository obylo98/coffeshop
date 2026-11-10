import { NextResponse } from 'next/server';
import { updateDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { cleanFavorite } from '@/lib/favorites';

// POST { favorites: [...] } — merge a JSON backup into the user's favourites.
export async function POST(req) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const incoming = Array.isArray(body) ? body : body?.favorites;
  if (!Array.isArray(incoming)) {
    return NextResponse.json({ error: 'That file is not a RoastRoute favourites backup.' }, { status: 400 });
  }
  const clean = incoming.slice(0, 1000).map(cleanFavorite).filter(Boolean);

  const result = await updateDb((db) => {
    const u = db.users[user.key];
    u.favorites ??= [];
    let added = 0;
    let updated = 0;
    for (const fav of clean) {
      const i = u.favorites.findIndex((f) => f.id === fav.id);
      if (i === -1) {
        u.favorites.push(fav);
        added++;
      } else {
        // Merge rather than overwrite, so importing an older backup never wipes notes or logs.
        const prev = u.favorites[i];
        const cupping = [...(prev.cupping || [])];
        for (const c of fav.cupping) if (!cupping.some((x) => x.id === c.id)) cupping.push(c);
        u.favorites[i] = {
          ...prev,
          ...fav,
          note: fav.note || prev.note || '',
          tags: [...new Set([...(prev.tags || []), ...fav.tags])],
          cupping,
          savedAt: prev.savedAt || fav.savedAt,
        };
        updated++;
      }
    }
    return { favorites: u.favorites, added, updated, skipped: incoming.length - clean.length };
  });
  return NextResponse.json(result);
}
