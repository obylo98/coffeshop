import { NextResponse } from 'next/server';
import { updateDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { cleanSettings } from '@/lib/favorites';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  return NextResponse.json({ settings: user.settings });
}

export async function PUT(req) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Please log in first.' }, { status: 401 });
  const settings = cleanSettings(await req.json().catch(() => ({})));
  await updateDb((db) => {
    db.users[user.key].settings = settings;
  });
  return NextResponse.json({ settings });
}
