import { NextResponse } from 'next/server';
import { fetchBlueSkyPosts } from '@/lib/feeds/bluesky';
import { fetchRedditPosts } from '@/lib/feeds/reddit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [bsky, reddit] = await Promise.allSettled([
      fetchBlueSkyPosts(20),
      fetchRedditPosts(20),
    ]);

    const posts = [
      ...(bsky.status   === 'fulfilled' ? bsky.value   : []),
      ...(reddit.status === 'fulfilled' ? reddit.value : []),
    ].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
     .slice(0, 30);

    return NextResponse.json(
      { posts, fetchedAt: Date.now() },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=90' } }
    );
  } catch (err) {
    console.error('[social]', err);
    return NextResponse.json({ error: 'Failed to fetch social posts' }, { status: 502 });
  }
}
