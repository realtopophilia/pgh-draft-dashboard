import { NextResponse } from 'next/server';
import { fetchIncidents } from '@/lib/feeds/traffic511';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const incidents = await fetchIncidents();
    return NextResponse.json(
      { incidents, fetchedAt: Date.now() },
      { headers: { 'Cache-Control': 'public, s-maxage=28, stale-while-revalidate=30' } }
    );
  } catch (err) {
    console.error('[traffic/incidents]', err);
    return NextResponse.json({ error: 'fetch failed' }, { status: 502 });
  }
}
