import { NextResponse } from 'next/server';
import { updateDb } from '@/lib/db';
import {
  SESSION_COOKIE, SESSION_MAX_AGE, cookieOptions, hashPassword, newSessionToken, validateCredentials,
} from '@/lib/auth';

export async function POST(req) {
  const { username, password } = await req.json().catch(() => ({}));
  const problem = validateCredentials(username, password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const key = username.toLowerCase();
  const token = newSessionToken();
  const result = await updateDb((db) => {
    if (db.users[key]) return { error: 'That username is already taken.' };
    const { salt, hash } = hashPassword(password);
    // The very first account on a fresh install becomes the administrator.
    // Everyone else is a regular user; the role is never read from the request.
    const role = Object.keys(db.users).length === 0 ? 'admin' : 'user';
    const now = new Date().toISOString();
    db.users[key] = { username, salt, hash, role, favorites: [], createdAt: now, lastLoginAt: now };
    db.sessions[token] = { userKey: key, expires: Date.now() + SESSION_MAX_AGE * 1000 };
    return { user: { username, role }, favorites: [], settings: null, isNew: true };
  });

  if (result.error) return NextResponse.json(result, { status: 409 });
  const res = NextResponse.json(result, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return res;
}
