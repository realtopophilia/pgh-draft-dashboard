'use client';

/**
 * /timelapse — public viewer for server-side captured frames.
 * Shows all stored frames as a filmstrip + animated preview.
 * Works from any device; no tab needs to stay open.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

interface Frame { url: string; uploadedAt: string; size: number; }

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    weekday:'short', month:'short', day:'numeric',
    hour:'numeric', minute:'2-digit', timeZone:'America/New_York',
  }) + ' ET';
}

function TimelapseViewer() {
  const { data, isLoading, error } = useQuery<{ frames: Frame[]; error?: string }>({
    queryKey: ['timelapse-frames'],
    queryFn: () => fetch('/api/timelapse/frames').then(r => r.json()),
    refetchInterval: 60_000,
  });

  const frames = data?.frames ?? [];
  const [current, setCurrent] = useState(0);
  const [playing, setPlaying]  = useState(false);
  const [fps, setFps]          = useState(4);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (frames.length) setCurrent(frames.length - 1);
  }, [frames.length]);

  const stop = useCallback(() => {
    setPlaying(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  const play = useCallback(() => {
    if (!frames.length) return;
    setCurrent(0);
    setPlaying(true);
    intervalRef.current = setInterval(() => {
      setCurrent(c => {
        if (c >= frames.length - 1) { stop(); return c; }
        return c + 1;
      });
    }, Math.round(1000 / fps));
  }, [frames.length, fps, stop]);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // GIF download (client-side gifenc, same as original timelapse)
  const [building, setBuilding] = useState(false);
  const downloadGif = useCallback(async () => {
    if (!frames.length) return;
    setBuilding(true);
    try {
      const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
      const delay   = Math.round(1000 / fps);
      const encoder = GIFEncoder();
      for (const frame of frames) {
        const img = new Image(); img.crossOrigin = 'anonymous';
        await new Promise<void>(res => { img.onload = () => res(); img.src = frame.url; });
        const tmp = document.createElement('canvas'); tmp.width = 960; tmp.height = 540;
        const ctx = tmp.getContext('2d')!; ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, 960, 540);
        const palette  = quantize(data, 256);
        const indexed  = applyPalette(data, palette);
        encoder.writeFrame(indexed, 960, 540, { palette, delay });
      }
      encoder.finish();
      const blob = new Blob([encoder.bytes().buffer as ArrayBuffer], { type: 'image/gif' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a'); a.href = url;
      a.download = `pgh-draft-timelapse-${Date.now()}.gif`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally { setBuilding(false); }
  }, [frames, fps]);

  const s: Record<string, React.CSSProperties> = {
    page:    { minHeight:'100vh', background:'#0E0E10', color:'#F5F1E8', fontFamily:'sans-serif', padding:'0 0 60px' },
    header:  { borderBottom:'1px solid #302C36', padding:'14px 24px', display:'flex', alignItems:'center', gap:16 },
    body:    { maxWidth:1100, margin:'0 auto', padding:'24px 24px 0' },
    card:    { background:'#17161A', border:'1px solid #302C36', borderRadius:10, overflow:'hidden' },
    btn:     { fontFamily:'inherit', border:'1px solid #302C36', background:'#1F1D22', color:'#F5F1E8', padding:'7px 14px', borderRadius:6, fontSize:12, fontWeight:500, cursor:'pointer', letterSpacing:'.02em' },
    btnPrim: { fontFamily:'inherit', border:'none', background:'#FFCE1F', color:'#1A1814', padding:'7px 16px', borderRadius:6, fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:'.02em' },
  };

  return (
    <div style={s.page}>
      <header style={s.header}>
        <a href="/" style={{ color:'#00B6B0', textDecoration:'none', fontSize:11, letterSpacing:'.1em', textTransform:'uppercase', fontWeight:600 }}>← Dashboard</a>
        <div style={{ width:1, height:20, background:'#302C36' }} />
        <span style={{ fontWeight:700, fontSize:16 }}>Draft Timelapse</span>
        <span style={{ fontSize:11, color:'#8A857E', marginLeft:'auto' }}>{frames.length} frames captured</span>
      </header>

      <div style={s.body}>
        {isLoading && <p style={{ color:'#8A857E', textAlign:'center', marginTop:60 }}>Loading frames…</p>}

        {data?.error === 'storage not configured' && (
          <div style={{ ...s.card, padding:'24px', marginTop:24 }}>
            <h2 style={{ color:'#FFCE1F', margin:'0 0 12px', fontSize:16 }}>Blob storage not configured</h2>
            <p style={{ color:'#C7C1B8', lineHeight:1.6, margin:'0 0 14px' }}>
              To activate server-side timelapse capture, you need to connect a Vercel Blob store:
            </p>
            <ol style={{ color:'#C7C1B8', lineHeight:2, margin:0, paddingLeft:20 }}>
              <li>Go to your <strong style={{ color:'#F5F1E8' }}>Vercel dashboard</strong> → your project → <strong style={{ color:'#F5F1E8' }}>Storage</strong> tab</li>
              <li>Click <strong style={{ color:'#F5F1E8' }}>Create → Blob store</strong> → name it anything → <strong style={{ color:'#F5F1E8' }}>Connect to project</strong></li>
              <li>Vercel auto-adds <code style={{ color:'#00B6B0' }}>BLOB_READ_WRITE_TOKEN</code> to your env vars</li>
              <li>Redeploy (or push any commit) — frames start capturing automatically every 15 min</li>
            </ol>
            <p style={{ color:'#8A857E', marginTop:14, fontSize:11 }}>
              Free tier: 500 MB storage, 1 GB/mo egress — more than enough for a 3-day draft.
            </p>
          </div>
        )}

        {frames.length > 0 && (
          <>
            {/* Main viewer */}
            <div style={{ ...s.card, marginTop:24 }}>
              <img
                src={frames[current]?.url}
                alt={`Frame ${current + 1}`}
                style={{ width:'100%', display:'block', aspectRatio:'16/9', objectFit:'cover', background:'#0E0E10' }}
              />
              <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:10, borderTop:'1px solid #302C36' }}>
                <button style={s.btn} onClick={playing ? stop : play}>{playing ? '⏸ Pause' : '▶ Play'}</button>
                <button style={s.btn} onClick={() => setCurrent(c => Math.max(0, c - 1))}>‹</button>
                <input
                  type="range" min={0} max={frames.length - 1} value={current}
                  onChange={e => setCurrent(+e.target.value)}
                  style={{ flex:1, accentColor:'#FFCE1F' }}
                />
                <button style={s.btn} onClick={() => setCurrent(c => Math.min(frames.length - 1, c + 1))}>›</button>
                <span style={{ fontSize:11, color:'#8A857E', minWidth:180, textAlign:'right', fontFamily:'monospace' }}>
                  {frames[current] ? formatTime(frames[current].uploadedAt) : ''}
                  {' '}({current + 1}/{frames.length})
                </span>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginTop:14, flexWrap:'wrap' }}>
              <label style={{ fontSize:11, color:'#8A857E', display:'flex', alignItems:'center', gap:6 }}>
                Speed:
                <select value={fps} onChange={e => setFps(+e.target.value)}
                  style={{ background:'#1F1D22', border:'1px solid #302C36', color:'#F5F1E8', borderRadius:4, padding:'3px 7px', fontSize:11, cursor:'pointer' }}>
                  {[2,3,4,6,8,10,15].map(f => <option key={f} value={f}>{f} fps</option>)}
                </select>
              </label>
              <button
                style={{ ...s.btnPrim, opacity: (frames.length === 0 || building) ? .5 : 1, cursor: (frames.length === 0 || building) ? 'not-allowed' : 'pointer' }}
                onClick={downloadGif}
                disabled={frames.length === 0 || building}
              >
                {building ? 'Building GIF…' : `⬇ Download GIF (${frames.length} frames)`}
              </button>
            </div>

            {/* Filmstrip */}
            <div style={{ display:'flex', gap:6, overflowX:'auto', marginTop:16, paddingBottom:6 }}>
              {frames.map((f, i) => (
                <button key={f.url} onClick={() => setCurrent(i)} style={{
                  padding:0, border: i === current ? '2px solid #FFCE1F' : '2px solid transparent',
                  borderRadius:4, overflow:'hidden', flexShrink:0, cursor:'pointer',
                  background:'transparent', width:96, height:54,
                }}>
                  <img src={f.url} alt="" style={{ width:96, height:54, display:'block', objectFit:'cover' }} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function TimelapsePage() {
  return <QueryClientProvider client={queryClient}><TimelapseViewer /></QueryClientProvider>;
}
