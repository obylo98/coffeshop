import crypto from 'crypto';
import { cookies } from 'next/headers';
import { readDb } from './db';
import { cleanSettings } from './favorites';

export const SESSION_COOKIE = 'coffee_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, expectedHash) {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function newSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === 'production' && process.env.HTTPS === 'true',
  };
}

export const ROLES = ['user', 'admin'];
export const roleOf = (user) => (user?.role === 'admin' ? 'admin' : 'user');

/** Public shape of a user sent to the browser (never includes the password hash). */
export const publicUser = (user) => ({ username: user.username, role: roleOf(user) });

/** Returns { key, username, role, favorites, settings } for the logged-in user, or null. */
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = await readDb();
  const session = db.sessions[token];
  if (!session || session.expires < Date.now()) return null;
  const user = db.users[session.userKey];
  if (!user || user.disabled) return null;
  return {
    key: session.userKey,
    username: user.username,
    role: roleOf(user),
    favorites: user.favorites ?? [],
    settings: user.settings ? cleanSettings(user.settings) : null,
  };
}

export function validateCredentials(username, password) {
  if (typeof username !== 'string' || !/^[A-Za-z0-9_.-]{3,32}$/.test(username)) {
    return 'Username must be 3–32 characters: letters, numbers, _ . -';
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 200) {
    return 'Password must be at least 6 characters.';
  }
  return null;
}

/** The logged-in user if they are an admin, otherwise null. Use in every admin-only route. */
export async function getAdmin() {
  const user = await getCurrentUser();
  return user?.role === 'admin' ? user : null;
}
