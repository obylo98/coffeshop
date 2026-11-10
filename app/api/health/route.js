import fs from 'fs/promises';
import path from 'path';
import { NextResponse } from 'next/server';
import { readDb } from '@/lib/db';
import { shopCache } from '@/lib/cache';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Health check. Everyone gets { ok } plus their own data size;
// server-wide diagnostics are only included for administrators.
export async function GET() {
  const started = performance.now();
  const db = await readDb();
  const dbReadMs = performance.now() - started;
  const user = await getCurrentUser();
  const userBytes = user ? Buffer.byteLength(JSON.stringify(db.users[user.key] ?? {})) : 0;

  if (user?.role !== 'admin') return NextResponse.json({ ok: true, userBytes });

  let dbBytes = 0;
  try {
    dbBytes = (await fs.stat(path.join(process.cwd(), 'data', 'db.json'))).size;
  } catch {}
  return NextResponse.json({
    ok: true,
    userBytes,
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    uptimeSec: Math.round(process.uptime()),
    memoryMb: Math.round(process.memoryUsage().rss / 1048576),
    dbFile: 'data/db.json',
    dbBytes,
    dbReadMs: Math.round(dbReadMs * 10) / 10,
    users: Object.keys(db.users).length,
    cachedSearches: shopCache.size,
    mode: process.env.NODE_ENV,
  });
}
