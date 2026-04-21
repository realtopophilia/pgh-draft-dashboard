import { NextResponse } from 'next/server';
import { fetchBikeStations } from '@/lib/feeds/pogoh';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stations = await fetchBikeStations();
    return NextResponse.json(
      { stations, fetchedAt: Date.now() },
      { headers: { 'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=20' } }
    );
  } catch (err) {
    console.error('[bikeshare]', err);
    return NextResponse.json({ error: 'Failed to fetch bikeshare data' }, { status: 502 });
  }
}
