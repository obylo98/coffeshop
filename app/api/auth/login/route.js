import { NextResponse } from 'next/server';
import { updateDb } from '@/lib/db';
import {
  SESSION_COOKIE, SESSION_MAX_AGE, cookieOptions, newSessionToken, verifyPassword, publicUser,
} from '@/lib/auth';

export async function POST(req) {
  const { username, password } = await req.json().catch(() => ({}));
  if (typeof username !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
  }

  const key = username.toLowerCase();
  const token = newSessionToken();
  const result = await updateDb((db) => {
    // Drop expired sessions while we're here.
    const now = Date.now();
    for (const [t, s] of Object.entries(db.sessions)) if (s.expires < now) delete db.sessions[t];

    const user = db.users[key];
    if (!user || !verifyPassword(password, user.salt, user.hash)) {
      return { error: 'Wrong username or password.' };
    }
    if (user.disabled) return { error: 'This account has been disabled by an administrator.' };
    db.sessions[token] = { userKey: key, expires: now + SESSION_MAX_AGE * 1000 };
    user.lastLoginAt = new Date(now).toISOString();
    return { user: publicUser(user), favorites: user.favorites ?? [], settings: user.settings ?? null };
  });

  if (result.error) return NextResponse.json(result, { status: 401 });
  const res = NextResponse.json(result);
  res.cookies.set(SESSION_COOKIE, token, cookieOptions());
  return res;
}
