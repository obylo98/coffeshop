import { NextResponse } from 'next/server';
import { geocode } from '@/lib/nominatim';

export const dynamic = 'force-dynamic';

// GET /api/geocode?q=Brooklyn  ->  { lat, lon, label, short }  (via OpenStreetMap Nominatim)
export async function GET(req) {
  const q = new URL(req.url).searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ error: 'Enter a place to search for.' }, { status: 400 });
  try {
    const hit = await geocode(q);
    if (!hit) return NextResponse.json({ error: `No place found for "${q}".` }, { status: 404 });
    return NextResponse.json(hit);
  } catch (err) {
    return NextResponse.json({ error: `Place search failed (${err.message}).` }, { status: 502 });
  }
}
