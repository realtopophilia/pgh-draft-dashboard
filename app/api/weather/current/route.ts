import { NextResponse } from 'next/server';
import { fetchWeather } from '@/lib/feeds/nws';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await fetchWeather();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=60' },
    });
  } catch (err) {
    console.error('[weather/current]', err);
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 502 });
  }
}
