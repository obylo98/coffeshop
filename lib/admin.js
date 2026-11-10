import { NextResponse } from 'next/server';
import { getAdmin, roleOf } from './auth';

/** Wrap an admin-only route handler: 401 if logged out, 403 if not an admin. */
export function adminOnly(handler) {
  return async (req, ctx) => {
    const admin = await getAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Administrator access required.' }, { status: 403 });
    }
    return handler(req, admin, ctx);
  };
}

export function userSummary(key, u, db) {
  const now = Date.now();
  const sessions = Object.values(db.sessions).filter((s) => s.userKey === key && s.expires > now).length;
  const favorites = u.favorites ?? [];
  return {
    key,
    username: u.username,
    role: roleOf(u),
    disabled: Boolean(u.disabled),
    createdAt: u.createdAt ?? null,
    lastLoginAt: u.lastLoginAt ?? null,
    favorites: favorites.length,
    notes: favorites.filter((f) => f.note).length,
    cupping: favorites.reduce((n, f) => n + (f.cupping?.length || 0), 0),
    customSpots: favorites.filter((f) => f.custom).length,
    activeSessions: sessions,
    bytes: Buffer.byteLength(JSON.stringify(u)),
  };
}

export const adminCount = (db) => Object.values(db.users).filter((u) => roleOf(u) === 'admin' && !u.disabled).length;
