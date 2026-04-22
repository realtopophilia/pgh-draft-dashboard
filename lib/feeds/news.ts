// Pittsburgh local news via RSS — WPXI and TribLive Pittsburgh.
// Only returns stories that appear to be draft-related.

export interface NewsItem {
  title:       string;
  url:         string;
  source:      string;
  publishedAt: string; // ISO string
  description: string;
}

const FEEDS: { url: string; source: string }[] = [
  { url: 'https://www.wpxi.com/news/local/rss.xml', source: 'WPXI' },
  { url: 'https://triblive.com/feed/',              source: 'TribLive' },
];

// Keywords that strongly suggest NFL Draft relevance.
// Checked case-insensitively against title + description.
const DRAFT_KEYWORDS = [
  'nfl draft', 'draft pick', 'draft class', 'draft prospect',
  'draft day', 'draft night', 'draft weekend', 'draft round',
  ' draft',      // space-prefixed to avoid "drafter", "drafty", etc.
  'acrisure',
  'north shore',
  'point state park',
  'commissioner',
  'goodell',
  'draft theater',
  'fan experience',
  'nfl experience',
  'round 1', 'round 2', 'round 3',
];

function isDraftRelated(title: string, description: string): boolean {
  const haystack = `${title} ${description}`.toLowerCase();
  return DRAFT_KEYWORDS.some(kw => haystack.includes(kw));
}

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
      .replace(/<[^>]+>/g, '')
      .slice(0, 200);

    if (!title || !link) continue;
    if (!isDraftRelated(title, desc)) continue;

    const url = link.startsWith('http') ? link
      : source === 'WPXI' ? `https://www.wpxi.com${link}` : link;

    let publishedAt: string;
    try { publishedAt = new Date(pubDate).toISOString(); }
    catch { publishedAt = new Date().toISOString(); }

    items.push({ title, url, source, publishedAt, description: desc });
  }

  return items;
}

async function fetchFeed(url: string, source: string): Promise<NewsItem[]> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PghDraftDashboard/1.0 (civic data project)' },
    next: { revalidate: 300 },
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

  return all
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, limit);
}
