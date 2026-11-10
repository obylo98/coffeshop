import { NextResponse } from 'next/server';
import { readDb, updateDb } from '@/lib/db';
import { adminOnly, adminCount, userSummary } from '@/lib/admin';
import { hashPassword, roleOf, validateCredentials } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET — every account with usage stats (no password hashes).
export const GET = adminOnly(async () => {
  const db = await readDb();
  const users = Object.entries(db.users)
    .map(([key, u]) => userSummary(key, u, db))
    .sort((a, b) => (b.role === 'admin') - (a.role === 'admin') || a.username.localeCompare(b.username));
  return NextResponse.json({ users });
});

const ACTIONS = ['promote', 'demote', 'disable', 'enable', 'signout', 'reset-password'];

// PATCH { username, action, password? }
export const PATCH = adminOnly(async (req, admin) => {
  const { username, action, password } = await req.json().catch(() => ({}));
  if (!ACTIONS.includes(action)) return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  const key = String(username || '').toLowerCase();

  // Admins can't lock themselves out.
  if (key === admin.key && ['demote', 'disable'].includes(action)) {
    return NextResponse.json({ error: "You can't remove your own admin access. Ask another admin." }, { status: 400 });
  }
  if (action === 'reset-password') {
    const problem = validateCredentials('placeholder', password);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  }

  const result = await updateDb((db) => {
    const u = db.users[key];
    if (!u) return { error: 'User not found.', status: 404 };
    const isAdmin = roleOf(u) === 'admin';
    if ((action === 'demote' || action === 'disable') && isAdmin && adminCount(db) <= 1) {
      return { error: 'There must always be at least one active administrator.', status: 400 };
    }
    const dropSessions = () => {
      for (const [t, s] of Object.entries(db.sessions)) if (s.userKey === key) delete db.sessions[t];
    };
    switch (action) {
      case 'promote':
        u.role = 'admin';
        break;
      case 'demote':
        u.role = 'user';
        break;
      case 'disable':
        u.disabled = true;
        dropSessions();
        break;
      case 'enable':
        delete u.disabled;
        break;
      case 'signout':
        dropSessions();
        break;
      case 'reset-password': {
        const { salt, hash } = hashPassword(password);
        u.salt = salt;
        u.hash = hash;
        dropSessions();
        break;
      }
    }
    u.updatedBy = admin.username;
    return { user: userSummary(key, u, db) };
  });

  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
});

// DELETE ?username= — remove an account and all of its data.
export const DELETE = adminOnly(async (req, admin) => {
  const key = (new URL(req.url).searchParams.get('username') || '').toLowerCase();
  if (key === admin.key) return NextResponse.json({ error: "You can't delete your own account here." }, { status: 400 });
  const result = await updateDb((db) => {
    const u = db.users[key];
    if (!u) return { error: 'User not found.', status: 404 };
    if (roleOf(u) === 'admin' && adminCount(db) <= 1) return { error: 'You cannot delete the last administrator.', status: 400 };
    delete db.users[key];
    for (const [t, s] of Object.entries(db.sessions)) if (s.userKey === key) delete db.sessions[t];
    return { ok: true };
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
});
