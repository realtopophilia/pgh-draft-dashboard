import type { Metadata } from 'next';
import { Inter, Space_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const inter        = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space', weight: ['400','500','600','700'] });
const ibmMono      = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono',  weight: ['400','500','600'] });

export const metadata: Metadata = {
  title:       'Pittsburgh Draft Dashboard',
  description: 'Near-real-time civic data for the 2026 NFL Draft in Pittsburgh — transit, traffic, weather, and more.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${ibmMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
