// Shared social post type used by bluesky.ts, reddit.ts, and the UI.
export interface SocialPost {
  id:          string;
  platform:    'bluesky' | 'reddit';
  author:      string;
  handle:      string;   // subreddit or @handle
  text:        string;
  url:         string;
  publishedAt: string;
  likes:       number;
  reposts:     number;   // retweets / comments
}
