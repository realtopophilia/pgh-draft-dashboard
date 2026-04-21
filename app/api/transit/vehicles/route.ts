import { NextResponse } from 'next/server';
import { fetchAllVehicles } from '@/lib/feeds/prt';

// Force Node.js runtime — gtfs-realtime-bindings needs Buffer/ArrayBuffer
export const runtime = 'nodejs';
// Never serve stale data from Vercel's edge cache
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const vehicles = await fetchAllVehicles();

    return NextResponse.json(
      { vehicles, fetchedAt: Date.now() },
      {
        headers: {
          // Cache at the CDN edge for 18s, allow stale for 20s during revalidation
          'Cache-Control': 'public, s-maxage=18, stale-while-revalidate=20',
        },
      }
    );
  } catch (err) {
    console.error('[transit/vehicles]', err);
    return NextResponse.json(
      { error: 'Failed to fetch transit data' },
      { status: 502 }
    );
  }
}
