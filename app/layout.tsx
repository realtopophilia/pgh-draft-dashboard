import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const inter        = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space', weight: ['400','500','600','700'] });
const ibmMono      = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono',  weight: ['400','500','600'] });

const SITE_URL = 'https://pgh-draft-dashboard.vercel.app';
const TITLE    = 'Pittsburgh Draft Dashboard · 2026 NFL Draft';
const DESCRIPTION =
  'Near-real-time civic data for the 2026 NFL Draft in Pittsburgh — transit, parking, weather, traffic cams, and social chatter, all on one map.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title:       TITLE,
  description: DESCRIPTION,
  openGraph: {
    type:        'website',
    url:          SITE_URL,
    title:        TITLE,
    description:  DESCRIPTION,
    siteName:    'Pittsburgh Draft Dashboard',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Pittsburgh Draft Dashboard' }],
  },
  twitter: {
    card:        'summary_large_image',
    title:        TITLE,
    description:  DESCRIPTION,
    images:       ['/opengraph-image'],
  },
  other: { 'theme-color': '#0E0E10' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0E0E10',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${ibmMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
