import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { readDb } from '@/lib/db';
import { shopCache } from '@/lib/cache';
import { adminOnly } from '@/lib/admin';
import { roleOf } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET — server-wide stats and diagnostics for the admin console.
export const GET = adminOnly(async () => {
  const t = performance.now();
  const db = await readDb();
  const dbReadMs = Math.round((performance.now() - t) * 10) / 10;
  let dbBytes = 0;
  try {
    dbBytes = (await fs.stat(path.join(process.cwd(), 'data', 'db.json'))).size;
  } catch {}

  const users = Object.values(db.users);
  const favs = users.flatMap((u) => u.favorites ?? []);
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 864e5).toISOString();

  // Most-saved cafés across all accounts.
  const counts = new Map();
  for (const f of favs) {
    if (f.custom) continue;
    const c = counts.get(f.id) || { id: f.id, name: f.name, neighborhood: f.neighborhood, saves: 0 };
    c.saves++;
    counts.set(f.id, c);
  }

  return NextResponse.json({
    stats: {
      users: users.length,
      admins: users.filter((u) => roleOf(u) === 'admin').length,
      disabled: users.filter((u) => u.disabled).length,
      activeThisWeek: users.filter((u) => (u.lastLoginAt || '') > weekAgo).length,
      activeSessions: Object.values(db.sessions).filter((s) => s.expires > now).length,
      favorites: favs.length,
      customSpots: favs.filter((f) => f.custom).length,
      notes: favs.filter((f) => f.note).length,
      cupping: favs.reduce((n, f) => n + (f.cupping?.length || 0), 0),
    },
    topCafes: [...counts.values()].sort((a, b) => b.saves - a.saves).slice(0, 5),
    server: {
      node: process.version,
      platform: `${process.platform} ${process.arch}`,
      mode: process.env.NODE_ENV,
      uptimeSec: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / 1048576),
      dbFile: 'data/db.json',
      dbBytes,
      dbReadMs,
      cachedSearches: shopCache.size,
    },
  });
});
