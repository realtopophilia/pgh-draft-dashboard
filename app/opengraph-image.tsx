import { ImageResponse } from 'next/og';

// OG card — rendered on demand at /opengraph-image.
// Mirrors the header mark (offset teal/gold silkscreen) so link previews
// feel continuous with the dashboard.

export const runtime     = 'edge';
export const size        = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt         = 'Pittsburgh Draft Dashboard — near-real-time civic data for the 2026 NFL Draft';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(135deg,#0E0E10 0%,#17161A 60%,#1F1D22 100%)',
          padding: '72px 84px', color: '#F5F1E8',
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {/* background pop-art triangles */}
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position:'absolute', inset:0, opacity:.12 }}>
          <path d="M860 520 L1040 180 L1220 520 Z" fill="none" stroke="#00B6B0" strokeWidth="6"/>
          <path d="M820 520 L1000 180 L1180 520 Z" fill="none" stroke="#FFCE1F" strokeWidth="6"/>
        </svg>

        {/* top row — mark + eyebrow */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="72" height="72" viewBox="0 0 34 34">
            <rect x="1" y="1" width="32" height="32" rx="6" fill="#1A1814" stroke="#00B6B0" strokeWidth="1.2"/>
            <path d="M11 23 L19 9 L26 23 Z" fill="none" stroke="#00B6B0" strokeWidth="1.3" strokeLinejoin="round" opacity=".9"/>
            <path d="M9 23 L17 9 L25 23 Z" fill="none" stroke="#FFCE1F" strokeWidth="1.5" strokeLinejoin="round"/>
            <circle cx="17" cy="18" r="2.3" fill="#FFCE1F"/>
          </svg>
          <div style={{ display:'flex', flexDirection:'column', lineHeight:1.1 }}>
            <div style={{ fontSize: 20, color: '#8A857E', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 600 }}>
              2026 NFL Draft · Pittsburgh
            </div>
            <div style={{ fontSize: 18, color: '#FFCE1F', letterSpacing: '.08em', marginTop: 6, fontWeight: 600 }}>
              Greatness is on the Clock
            </div>
          </div>
        </div>

        {/* headline */}
        <div style={{
          fontSize: 92, fontWeight: 800, letterSpacing: '-.02em',
          marginTop: 72, lineHeight: 1.02, color: '#F5F1E8',
          display: 'flex', flexDirection: 'column',
        }}>
          <span>Pittsburgh</span>
          <span style={{ color: '#FFCE1F' }}>Draft Dashboard</span>
        </div>

        {/* subhead */}
        <div style={{ fontSize: 28, color: '#C7C1B8', marginTop: 24, maxWidth: 900, lineHeight: 1.35 }}>
          Near-real-time transit, parking, weather, traffic cams & social chatter — all on one map.
        </div>

        {/* footer row */}
        <div style={{ marginTop: 'auto', display:'flex', alignItems:'center', gap:18, fontSize: 20, color: '#8A857E', letterSpacing: '.1em', textTransform: 'uppercase', fontWeight: 600 }}>
          <span style={{ display:'inline-flex', alignItems:'center', gap:8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 999, background: '#7FAA6B' }} />
            Live
          </span>
          <span style={{ color: '#423D4A' }}>·</span>
          <span>Apr 23 – 25, 2026</span>
          <span style={{ color: '#423D4A' }}>·</span>
          <span style={{ color: '#00B6B0' }}>#LovePGH</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
