import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null, favorites: [], settings: null });
  return NextResponse.json({ user: { username: user.username, role: user.role }, favorites: user.favorites, settings: user.settings });
}
