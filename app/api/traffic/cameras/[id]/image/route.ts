import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Sanitize: only allow numeric IDs
  if (!/^\d+$/.test(id)) {
    return new NextResponse('Invalid camera ID', { status: 400 });
  }

  const url = `https://511pa.com/map/Cctv/${id}?t=${Math.floor(Date.now() / 1000)}`;
  const res = await fetch(url, { cache: 'no-store' });

  if (!res.ok) {
    return new NextResponse('Camera unavailable', { status: 502 });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, s-maxage=28, stale-while-revalidate=30',
    },
  });
}
