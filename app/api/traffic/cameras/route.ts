import { NextResponse } from 'next/server';
import { fetchAllCameras } from '@/lib/feeds/cameras';
 
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
 
export async function GET() {
  try {
    const cameras = await fetchAllCameras();
    return NextResponse.json(
      { cameras, fetchedAt: Date.now() },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
    );
  } catch (err) {
    console.error('[traffic/cameras]', err);
    return NextResponse.json({ error: 'Failed to fetch cameras' }, { status: 502 });
  }
}
 
