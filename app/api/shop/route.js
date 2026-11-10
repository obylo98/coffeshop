import { NextResponse } from 'next/server';
import { lookupOsm } from '@/lib/nominatim';
import { shopFromTags } from '@/lib/osm';

export const dynamic = 'force-dynamic';

const detailCache = new Map();

// GET /api/shop?id=node/123 — full details for one café from OpenStreetMap.
export async function GET(req) {
  const id = new URL(req.url).searchParams.get('id') || '';
  if (!/^(node|way|relation)\/\d+$/.test(id)) {
    return NextResponse.json({ error: 'Unknown coffee shop.' }, { status: 400 });
  }
  const cached = detailCache.get(id);
  if (cached && Date.now() - cached.at < 30 * 60 * 1000) return NextResponse.json({ shop: cached.shop });

  try {
    const hit = await lookupOsm(id);
    if (!hit) return NextResponse.json({ error: 'That coffee shop is no longer on the map.' }, { status: 404 });
    const shop = shopFromTags(
      id,
      Number(hit.lat),
      Number(hit.lon),
      { name: hit.name || hit.namedetails?.name, [hit.category]: hit.type, ...(hit.extratags ?? {}) },
      hit.address ?? {},
    );
    shop.fullAddress = hit.display_name;
    detailCache.set(id, { at: Date.now(), shop });
    return NextResponse.json({ shop });
  } catch (e) {
    return NextResponse.json({ error: `Could not load details (${e.message}).` }, { status: 502 });
  }
}
