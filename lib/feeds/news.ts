// Pittsburgh local news via RSS — WPXI and TribLive Pittsburgh.
// Parses RSS XML server-side with no dependencies (simple regex approach).

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  publishedAt: string; // ISO string
  description: string;
}

const FEEDS: { url: string; source: string }[] = [
  { url: 'https://www.wpxi.com/news/local/rss.xml', source: 'WPXI' },
  { url: 'https://triblive.com/feed/',              source: 'TribLive' },
];

function extractTag(xml: string, tag: string): string {
  const cdataMatch = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>`, 'i').exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();
  const plainMatch = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i').exec(xml);
  return plainMatch ? plainMatch[1].trim() : '';
}

function parseItems(xml: string, source: string): NewsItem[] {
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  const items: NewsItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link  = extractTag(block, 'link') || extractTag(block, 'guid');
    const pubDate = extractTag(block, 'pubDate');
    const desc  = extractTag(block, 'description')
      .replace(/<[^>]+>/g, '')   // strip HTML tags
      .slice(0, 200);

    if (!title || !link) continue;

    // Normalise link to absolute URL
    const url = link.startsWith('http') ? link
      : source === 'WPXI' ? `https://www.wpxi.com${link}` : link;

    let publishedAt: string;
    try {
      publishedAt = new Date(pubDate).toISOString();
    } catch {
      publishedAt = new Date().toISOString();
    }

    items.push({ title, url, source, publishedAt, description: desc });
  }

  return items;
}

async function fetchFeed(url: string, source: string): Promise<NewsItem[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PghDraftDashboard/1.0 (civic data project)' },
    next: { revalidate: 300 }, // 5-min server cache
  });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseItems(xml, source);
}

export async function fetchNews(limit = 15): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    FEEDS.map(f => fetchFeed(f.url, f.source))
  );

  const all: NewsItem[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  // Sort newest first, return top N
  return all
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}
