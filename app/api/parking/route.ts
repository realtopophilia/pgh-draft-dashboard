import { NextResponse } from 'next/server';
import { fetchParkingGarages } from '@/lib/feeds/parkpgh';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const garages = await fetchParkingGarages();
    return NextResponse.json(
      { garages, fetchedAt: Date.now() },
      { headers: { 'Cache-Control': 'public, s-maxage=28, stale-while-revalidate=30' } }
    );
  } catch (err) {
    console.error('[parking]', err);
    return NextResponse.json({ error: 'Failed to fetch parking data' }, { status: 502 });
  }
}
