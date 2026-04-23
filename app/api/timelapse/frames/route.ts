import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';

// export const runtime = 'edge';

export async function GET() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ frames: [], error: 'storage not configured' });
  }
  try {
    const { blobs } = await list({ prefix: 'timelapse/frame-' });
    const frames = blobs
      .sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime())
      .map(b => ({ url: b.url, uploadedAt: b.uploadedAt, size: b.size }));
    return NextResponse.json({ frames });
  } catch (err) {
    return NextResponse.json({ frames: [], error: String(err) });
  }
}
