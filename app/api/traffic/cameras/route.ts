import { NextResponse } from 'next/server';
import { PITTSBURGH_CAMERAS } from '@/lib/feeds/traffic511';

// Camera list is static — just return the curated Pittsburgh list.
// Refresh cadence: ~30s for the images themselves (handled client-side).
export async function GET() {
  return NextResponse.json(
    { cameras: PITTSBURGH_CAMERAS },
    { headers: { 'Cache-Control': 'public, s-maxage=3600' } }
  );
}
