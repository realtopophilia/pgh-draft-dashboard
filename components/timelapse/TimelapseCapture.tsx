'use client';

/**
 * TimelapseCapture — records map-canvas snapshots during the draft weekend
 * and stitches them into a downloadable animated GIF.
 *
 * Usage: place on the map overlay. Point mapContainer at the div wrapping the
 * MapLibre canvas. Click "Record" to start capturing. Click "Generate GIF"
 * after the draft is over to download the timelapse.
 *
 * Frame cadence: 1 frame every INTERVAL_MS (default 15 min while recording).
 * GIF output: scaled to OUTPUT_W × OUTPUT_H, 3 fps (so 60 frames → ~20 s GIF).
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ── config ────────────────────────────────────────────────────────────────────
const INTERVAL_MS = 15 * 60 * 1000; // 15 min between frames
const OUTPUT_W    = 960;
const OUTPUT_H    = 540;
const GIF_FPS     = 3;              // playback speed (frames per second in GIF)
const MAX_FRAMES  = 120;            // safety cap (~30 hours of draft at 15 min cadence)

interface Frame {
  dataUrl:   string;
  timestamp: number;
  label:     string;   // "Thu 9:00 PM"
}

interface TimelapseCaptureProps {
  /** The element containing the MapLibre canvas */
  mapContainer: HTMLElement | null;
}

export default function TimelapseCapture({ mapContainer }: TimelapseCaptureProps) {
  const [recording, setRecording] = useState(false);
  const [frames,    setFrames]    = useState<Frame[]>([]);
  const [building,  setBuilding]  = useState(false);
  const [open,      setOpen]      = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── capture one frame from the map canvas ──────────────────────────────────
  const captureFrame = useCallback(async () => {
    if (!mapContainer) return;
    const canvas = mapContainer.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas) return;

    // Scale down to OUTPUT_W × OUTPUT_H via an offscreen canvas
    const tmp = document.createElement('canvas');
    tmp.width  = OUTPUT_W;
    tmp.height = OUTPUT_H;
    const ctx = tmp.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(canvas, 0, 0, OUTPUT_W, OUTPUT_H);

    // Stamp timestamp onto the frame
    const now   = new Date();
    const label = now.toLocaleString('en-US', { weekday:'short', hour:'numeric', minute:'2-digit', hour12:true });
    ctx.font      = 'bold 18px "IBM Plex Mono", monospace';
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(10, OUTPUT_H - 36, ctx.measureText(label).width + 20, 28);
    ctx.fillStyle = '#FFB81C';
    ctx.fillText(label, 20, OUTPUT_H - 14);

    const dataUrl = tmp.toDataURL('image/png');
    setFrames(prev => {
      const next = [...prev, { dataUrl, timestamp: now.getTime(), label }];
      return next.slice(-MAX_FRAMES); // keep only the most recent MAX_FRAMES
    });
  }, [mapContainer]);

  // ── start / stop recording ────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    setRecording(true);
    captureFrame();  // immediate first frame
    intervalRef.current = setInterval(captureFrame, INTERVAL_MS);
  }, [captureFrame]);

  const stopRecording = useCallback(() => {
    setRecording(false);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  // ── generate GIF ──────────────────────────────────────────────────────────
  const generateGIF = useCallback(async () => {
    if (!frames.length) return;
    setBuilding(true);
    try {
      // Dynamic import so gifenc doesn't bloat the initial bundle
      const { GIFEncoder, quantize, applyPalette } = await import('gifenc');

      const delay = Math.round(1000 / GIF_FPS); // ms per frame in GIF
      const encoder = GIFEncoder();

      for (const frame of frames) {
        // Decode dataUrl → ImageData via offscreen canvas
        const img = new Image();
        await new Promise<void>(res => { img.onload = () => res(); img.src = frame.dataUrl; });
        const tmp = document.createElement('canvas');
        tmp.width = OUTPUT_W; tmp.height = OUTPUT_H;
        const ctx = tmp.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const { data } = ctx.getImageData(0, 0, OUTPUT_W, OUTPUT_H);

        const palette = quantize(data, 256);
        const indexed = applyPalette(data, palette);
        encoder.writeFrame(indexed, OUTPUT_W, OUTPUT_H, { palette, delay });
      }

      encoder.finish();
      const bytes = encoder.bytes();
      const blob  = new Blob([bytes.buffer as ArrayBuffer], { type: 'image/gif' });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement('a');
      a.href      = url;
      a.download  = `pgh-draft-timelapse-${Date.now()}.gif`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error('[timelapse] GIF generation failed:', err);
      alert('GIF generation failed. Check the browser console for details.');
    } finally {
      setBuilding(false);
    }
  }, [frames]);

  // ── UI ────────────────────────────────────────────────────────────────────
  const btn = (label: string, onClick: () => void, primary = false, disabled = false) => (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        fontFamily: 'inherit', border: '1px solid var(--line)',
        background:  primary ? 'var(--gold)' : 'var(--bg-2)',
        color:       primary ? '#1A1814'      : 'var(--ink)',
        padding:    '5px 11px', borderRadius: 6,
        fontSize:   11, fontWeight: primary ? 700 : 500,
        cursor:     disabled ? 'not-allowed' : 'pointer',
        opacity:    disabled ? .5 : 1, transition: 'all .15s',
        letterSpacing: '.02em',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ position: 'relative' }}>
      {/* Collapsed trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 10px', borderRadius: 999,
          background: 'rgba(23,22,26,.9)', backdropFilter: 'blur(6px)',
          border: `1px solid ${recording ? 'var(--rust)' : 'var(--line)'}`,
          color: recording ? 'var(--rust)' : 'var(--ink-dim)',
          fontSize: 10, fontWeight: 600, cursor: 'pointer',
          letterSpacing: '.08em', textTransform: 'uppercase',
        }}
      >
        {recording && (
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--rust)', animation: 'pulse-ring 1.2s infinite',
          }} />
        )}
        {recording ? `● REC · ${frames.length} frames` : 'Timelapse'}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 20,
          background: 'var(--bg-1)', border: '1px solid var(--line-2)',
          borderRadius: 8, padding: '12px 14px', minWidth: 240,
          boxShadow: '0 12px 32px rgba(0,0,0,.5)',
        }}>
          <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--ink-mute)', fontWeight: 600, marginBottom: 8 }}>
            Draft Timelapse
          </div>
          <p style={{ margin: '0 0 10px', fontSize: 11, color: 'var(--ink-dim)', lineHeight: 1.5 }}>
            Records one map snapshot every 15 min while running.
            Generate the GIF after the draft ends (Wed April 30).
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {!recording
              ? btn('Start Recording', startRecording)
              : btn('Stop Recording',  stopRecording)}
            {btn(
              building ? 'Building…' : `Generate GIF (${frames.length} frames)`,
              generateGIF,
              true,
              frames.length === 0 || building
            )}
          </div>
          {frames.length > 0 && (
            <div style={{ fontSize: 10, color: 'var(--ink-faint)', fontFamily: 'var(--font-mono)' }}>
              First frame: {frames[0].label}<br />
              Last frame:  {frames[frames.length-1].label}
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--ink-faint)', lineHeight: 1.5 }}>
            Note: frames are held in memory — keep this tab open during the draft.
          </div>
        </div>
      )}
    </div>
  );
}
