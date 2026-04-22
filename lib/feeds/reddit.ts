// Reddit posts from r/pittsburgh and r/nfl via the public JSON API.
// No OAuth required for read-only search — just needs a valid User-Agent.

import type { SocialPost } from './social';
export type { SocialPost };

interface RedditChild {
  data: {
    id:           string;
    title:        string;
    permalink:    string;
    url:          string;
    author:       string;
    selftext:     string;
    created_utc:  number;
    score:        number;
    num_comments: number;
    subreddit:    string;
    is_self:      boolean;
  };
}

interface RedditResponse {
  data: { children: RedditChild[] };
}

const SUBREDDITS: { sub: string; query: string }[] = [
  { sub: 'pittsburgh', query: 'nfl draft'    },
  { sub: 'nfl',        query: 'pittsburgh draft 2026' },
];

const HEADERS = {
  'User-Agent': 'PghDraftDashboard/1.0 (civic data project; contact via github)',
  'Accept':     'application/json',
};

async function fetchSub(sub: string, query: string): Promise<SocialPost[]> {
  const url =
    `https://www.reddit.com/r/${sub}/search.json` +
    `?q=${encodeURIComponent(query)}&sort=new&restrict_sr=1&limit=25`;

  const res = await fetch(url, { headers: HEADERS, cache: 'no-store' });
  if (!res.ok) return [];

  const json: RedditResponse = await res.json();
  return (json.data?.children ?? []).map(({ data: d }): SocialPost => ({
    id:          `reddit-${d.id}`,
    platform:    'reddit',
    author:      d.author,
    handle:      `r/${d.subreddit}`,
    text:        d.title,
    url:         `https://www.reddit.com${d.permalink}`,
    publishedAt: new Date(d.created_utc * 1000).toISOString(),
    likes:       d.score,
    reposts:     d.num_comments,
  }));
}

export async function fetchRedditPosts(limit = 25): Promise<SocialPost[]> {
  const results = await Promise.allSettled(
    SUBREDDITS.map(({ sub, query }) => fetchSub(sub, query))
  );

  const seen = new Set<string>();
  const posts: SocialPost[] = [];

  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const p of r.value) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      posts.push(p);
    }
  }

  return posts
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}
