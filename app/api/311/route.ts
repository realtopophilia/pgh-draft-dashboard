import { NextResponse } from 'next/server';
import { fetchRecentComplaints } from '@/lib/feeds/wprdc311';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const complaints = await fetchRecentComplaints(48);
    return NextResponse.json(
      { complaints, fetchedAt: Date.now() },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=90' } }
    );
  } catch (err) {
    console.error('[311]', err);
    return NextResponse.json({ error: 'Failed to fetch 311 data' }, { status: 502 });
  }
}
