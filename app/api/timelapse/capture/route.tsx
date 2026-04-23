/**
 * /api/timelapse/capture
 * Called by GitHub Actions every 15 min during draft weekend.
 * Renders a 960×540 PNG via ImageResponse (Satori) and saves to Vercel Blob.
 */

import { NextResponse } from 'next/server';
import { put }          from '@vercel/blob';
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const W = 960;
const H = 540;

const BOUNDS = { minLon:-80.095, maxLon:-79.865, minLat:40.358, maxLat:40.501 };
function lonToX(lon: number) {
  return ((lon - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * W;
}
function latToY(lat: number) {
  return ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * H;
}

async function fetchFeeds(baseUrl: string) {
  const [transit, parking, incidents] = await Promise.allSettled([
    fetch(`${baseUrl}/api/transit/vehicles`,      { signal: AbortSignal.timeout(8000) }).then(r => r.json()),
    fetch(`${baseUrl}/api/parking`,               { signal: AbortSignal.timeout(8000) }).then(r => r.json()),
    fetch(`${baseUrl}/api/traffic/incidents`,     { signal: AbortSignal.timeout(8000) }).then(r => r.json()),
  ]);
  return {
    vehicles:  transit.status   === 'fulfilled' ? (transit.value.vehicles   ?? []) : [],
    garages:   parking.status   === 'fulfilled' ? (parking.value.garages    ?? []) : [],
    incidents: incidents.status === 'fulfilled' ? (incidents.value.incidents ?? []) : [],
  };
}

export async function GET(req: Request) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const auth   = req.headers.get('authorization');
    const secret = process.env.CRON_SECRET;
    if (secret && auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN not configured' }, { status: 503 });
    }

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const { vehicles, garages, incidents } = await fetchFeeds(baseUrl);

    const buses  = (vehicles as {type:string;lon:number;lat:number;speedMph:number}[])
      .filter(v => v.type === 'bus');
    const trains = (vehicles as {type:string;lon:number;lat:number}[])
      .filter(v => v.type === 'train');

    const now   = new Date();
    const label = now.toLocaleString('en-US', {
      weekday:'short', month:'short', day:'numeric',
      hour:'numeric', minute:'2-digit', timeZone:'America/New_York',
    }) + ' ET';

    // ── Build dot elements (Satori-safe: no SVG, no CSS tricks) ──────────────
    // Satori supports position:absolute only when parent has position:relative.
    // We render all dots flat inside the root div which has position:relative.

    const busDotEls = buses.map((v, i) => {
      const c = v.speedMph < 3 ? '#C8352D' : v.speedMph < 10 ? '#E69545' : '#FFCE1F';
      return (
        <div
          key={`b${i}`}
          style={{
            position: 'absolute',
            left: Math.round(lonToX(v.lon)) - 3,
            top:  Math.round(latToY(v.lat)) - 3,
            width: 6, height: 6,
            borderRadius: 9999,
            background: c,
          }}
        />
      );
    });

    const trainDotEls = trains.map((v: {lon:number;lat:number}, i) => (
      <div
        key={`t${i}`}
        style={{
          position: 'absolute',
          left: Math.round(lonToX(v.lon)) - 5,
          top:  Math.round(latToY(v.lat)) - 5,
          width: 10, height: 10,
          borderRadius: 9999,
          background: '#5EA3C7',
        }}
      />
    ));

    const garageDotEls = (garages as {lon:number;lat:number;percentFull:number;state:string}[])
      .map((g, i) => {
        const c = g.state === 'closed' ? '#6B7280'
          : g.percentFull >= 90       ? '#C8352D'
          : g.percentFull >= 60       ? '#E69545' : '#7FAA6B';
        return (
          <div
            key={`g${i}`}
            style={{
              position: 'absolute',
              left: Math.round(lonToX(g.lon)) - 5,
              top:  Math.round(latToY(g.lat)) - 5,
              width: 10, height: 10,
              borderRadius: 2,
              background: c,
            }}
          />
        );
      });

    const incidentDotEls = (incidents as {lon:number;lat:number}[]).map((inc, i) => (
      <div
        key={`i${i}`}
        style={{
          position: 'absolute',
          left: Math.round(lonToX(inc.lon)) - 5,
          top:  Math.round(latToY(inc.lat)) - 5,
          width: 10, height: 10,
          borderRadius: 2,
          background: '#C8352D',
          transform: 'rotate(45deg)',
        }}
      />
    ));

    // ── Render frame ─────────────────────────────────────────────────────────
    const imgRes = new ImageResponse(
      (
        <div
          style={{
            width: W, height: H,
            position: 'relative',
            display: 'flex',
            background: '#0E0E10',
            overflow: 'hidden',
          }}
        >
          {/* River bands — simple divs, no SVG */}
          {/* Ohio (horizontal) */}
          <div style={{ position:'absolute', left:0, top:290, width:540, height:16, background:'#1E3A5F', borderRadius:8 }} />
          {/* Allegheny (horizontal) */}
          <div style={{ position:'absolute', left:540, top:255, width:420, height:16, background:'#1E3A5F', borderRadius:8 }} />
          {/* Monongahela (vertical) */}
          <div style={{ position:'absolute', left:530, top:265, width:12, height:275, background:'#1E3A5F', borderRadius:6 }} />

          {/* Data dots */}
          {busDotEls}
          {trainDotEls}
          {garageDotEls}
          {incidentDotEls}

          {/* Header */}
          <div style={{
            position:'absolute', top:0, left:0, right:0,
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'10px 16px',
            background:'rgba(14,14,16,.92)',
          }}>
            <span style={{ color:'#F5F1E8', fontWeight:700, fontSize:14, fontFamily:'sans-serif' }}>
              Pittsburgh Draft Dashboard
            </span>
            <span style={{ color:'#FFCE1F', fontWeight:600, fontSize:12, fontFamily:'monospace' }}>
              {label}
            </span>
          </div>

          {/* Footer */}
          <div style={{
            position:'absolute', bottom:0, left:0, right:0,
            display:'flex', alignItems:'center', gap:20, padding:'10px 16px',
            background:'rgba(14,14,16,.88)',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:9999, background:'#FFCE1F' }} />
              <span style={{ color:'#C7C1B8', fontSize:11, fontFamily:'monospace' }}>{buses.length} buses</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:9999, background:'#5EA3C7' }} />
              <span style={{ color:'#C7C1B8', fontSize:11, fontFamily:'monospace' }}>{trains.length} trains</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:9999, background:'#7FAA6B' }} />
              <span style={{ color:'#C7C1B8', fontSize:11, fontFamily:'monospace' }}>{garages.length} garages</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:9999, background:'#C8352D' }} />
              <span style={{ color:'#C7C1B8', fontSize:11, fontFamily:'monospace' }}>{incidents.length} incidents</span>
            </div>
            <span style={{ marginLeft:'auto', color:'#00B6B0', fontSize:10, fontFamily:'monospace' }}>#LovePGH</span>
          </div>
        </div>
      ),
      { width: W, height: H },
    );

    const buf  = await imgRes.arrayBuffer();
    const blob = await put(
      `timelapse/frame-${now.toISOString().replace(/[:.]/g, '-')}.png`,
      buf,
      { access: 'public', contentType: 'image/png' },
    );

    return NextResponse.json({
      ok: true, url: blob.url, label,
      busCount: buses.length, trainCount: trains.length,
      garageCount: garages.length, incidentCount: incidents.length,
    });

  } catch (err) {
    // Return JSON so GitHub Actions can log the real error instead of HTML
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[timelapse/capture]', msg, stack);
    return NextResponse.json({ error: msg, stack }, { status: 500 });
  }
}
