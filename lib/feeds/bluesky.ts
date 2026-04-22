// Bluesky social posts via the public AT Protocol API — no key required.
// Searches for posts mentioning the Pittsburgh NFL Draft.

import type { SocialPost } from './social';
export type { SocialPost };

const BASE = 'https://public.api.bsky.app/xrpc';

interface BskyAuthor {
  did:         string;
  handle:      string;
  displayName?: string;
}

interface BskyRecord {
  $type:     string;
  text:      string;
  createdAt: string;
}

interface BskyPost {
  uri:          string;
  author:       BskyAuthor;
  record:       BskyRecord;
  indexedAt:    string;
  likeCount?:   number;
  repostCount?: number;
}

function uriToUrl(uri: string, handle: string): string {
  // at://did:plc:xxx/app.bsky.feed.post/rkey → https://bsky.app/profile/handle/post/rkey
  const rkey = uri.split('/').pop() ?? '';
  return `https://bsky.app/profile/${handle}/post/${rkey}`;
}

export async function fetchBlueSkyPosts(limit = 25): Promise<SocialPost[]> {
  // Search for multiple relevant queries and deduplicate
  const queries = [
    'pittsburgh nfl draft',
    '#NFLDraft pittsburgh',
    'nfl draft 2026',
  ];

  const seen = new Set<string>();
  const posts: SocialPost[] = [];

  for (const q of queries) {
    const url = `${BASE}/app.bsky.feed.searchPosts?q=${encodeURIComponent(q)}&limit=25&sort=latest`;
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'PghDraftDashboard/1.0 (civic data project)',
          'Accept':     'application/json',
        },
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const json: { posts?: BskyPost[] } = await res.json();
      for (const p of json.posts ?? []) {
        if (seen.has(p.uri)) continue;
        seen.add(p.uri);
        posts.push({
          id:          p.uri,
          platform:    'bluesky',
          author:      p.author.displayName || p.author.handle,
          handle:      p.author.handle,
          text:        p.record.text,
          url:         uriToUrl(p.uri, p.author.handle),
          publishedAt: p.record.createdAt ?? p.indexedAt,
          likes:       p.likeCount   ?? 0,
          reposts:     p.repostCount ?? 0,
        });
      }
    } catch {
      // silently skip failed queries
    }
  }

  return posts
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}
