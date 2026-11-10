import { NextResponse } from 'next/server';
import { readDb, updateDb } from '@/lib/db';
import { shopCache } from '@/lib/cache';
import { adminOnly } from '@/lib/admin';

export const dynamic = 'force-dynamic';

// POST { action: 'clear-cache' | 'prune-sessions' }
export const POST = adminOnly(async (req) => {
  const { action } = await req.json().catch(() => ({}));
  if (action === 'clear-cache') {
    const cleared = shopCache.size;
    shopCache.clear();
    return NextResponse.json({ message: `Cleared ${cleared} cached search${cleared === 1 ? '' : 'es'}.` });
  }
  if (action === 'prune-sessions') {
    const removed = await updateDb((db) => {
      let n = 0;
      for (const [t, s] of Object.entries(db.sessions)) {
        if (s.expires < Date.now() || !db.users[s.userKey] || db.users[s.userKey].disabled) {
          delete db.sessions[t];
          n++;
        }
      }
      return n;
    });
    return NextResponse.json({ message: `Removed ${removed} expired or orphaned session${removed === 1 ? '' : 's'}.` });
  }
  return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
});

// GET — download a full backup of the database (session tokens are left out).
export const GET = adminOnly(async () => {
  const db = await readDb();
  const backup = { app: 'RoastRoute', exportedAt: new Date().toISOString(), users: db.users };
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="roastroute-db-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      'Cache-Control': 'no-store',
    },
  });
});
