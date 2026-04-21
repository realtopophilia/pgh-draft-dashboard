import { NextResponse } from 'next/server';
import { fetchNews } from '@/lib/feeds/news';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const items = await fetchNews(15);
    return NextResponse.json(
      { items, fetchedAt: Date.now() },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=360' } }
    );
  } catch (err) {
    console.error('[news]', err);
    return NextResponse.json({ error: 'Failed to fetch news' }, { status: 502 });
  }
}
