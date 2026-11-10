import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { updateDb } from '@/lib/db';
import { SESSION_COOKIE } from '@/lib/auth';

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    await updateDb((db) => {
      delete db.sessions[token];
    });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
