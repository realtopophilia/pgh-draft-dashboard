/**
 * /api/timelapse/capture
 *
 * Called by GitHub Actions every 15 minutes during draft weekend.
 * Fetches live civic data, renders a 960×540 PNG frame via ImageResponse,
 * and stores it in Vercel Blob storage.
 *
 * Requires: BLOB_READ_WRITE_TOKEN env var (add via Vercel dashboard →
 * Storage → Blob store → link to project).
 */

import { NextResponse } from 'next/server';
import { put }          from '@vercel/blob';
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

const W = 960;
const H = 540;

const BOUNDS = { minLon:-80.095, maxLon:-79.865, minLat:40.358, maxLat:40.501 };
function lonToX(lon: number) {
  return Math.round(((lon - BOUNDS.minLon) / (BOUNDS.maxLon - BOUNDS.minLon)) * W);
}
function latToY(lat: number) {
  return Math.round(((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * H);
}

async function fetchFeeds(baseUrl: string) {
  const [transit, parking, incidents] = await Promise.allSettled([
    fetch(`${baseUrl}/api/transit/vehicles`).then(r => r.json()),
    fetch(`${baseUrl}/api/parking`).then(r => r.json()),
    fetch(`${baseUrl}/api/traffic/incidents`).then(r => r.json()),
  ]);
  return {
    vehicles:  transit.status   === 'fulfilled' ? (transit.value.vehicles   ?? []) : [],
    garages:   parking.status   === 'fulfilled' ? (parking.value.garages    ?? []) : [],
    incidents: incidents.status === 'fulfilled' ? (incidents.value.incidents ?? []) : [],
  };
}

export async function GET(req: Request) {
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

  const now   = new Date();
  const label = now.toLocaleString('en-US', {
    weekday:'short', month:'short', day:'numeric',
    hour:'numeric', minute:'2-digit', timeZone:'America/New_York',
  }) + ' ET';

  const buses  = vehicles.filter((v: {type:string}) => v.type === 'bus');
  const trains = vehicles.filter((v: {type:string}) => v.type === 'train');

  // ── Build dot arrays as real JSX — no dangerouslySetInnerHTML ──────────────
  const busDots = buses.map((v: {lon:number;lat:number;speedMph:number}, i: number) => {
    const c = v.speedMph < 3 ? '#C8352D' : v.speedMph < 10 ? '#E69545' : '#FFCE1F';
    return (
      <div key={`b${i}`} style={{
        position:'absolute', left: lonToX(v.lon) - 3, top: latToY(v.lat) - 3,
        width:6, height:6, borderRadius:'50%', background:c, opacity:0.85,
      }} />
    );
  });

  const trainDots = trains.map((v: {lon:number;lat:number}, i: number) => (
    <div key={`t${i}`} style={{
      position:'absolute', left: lonToX(v.lon) - 5, top: latToY(v.lat) - 5,
      width:10, height:10, borderRadius:'50%',
      background:'#5EA3C7', border:'1.5px solid #1A1814', opacity:0.9,
    }} />
  ));

  const garageDots = garages.map((g: {lon:number;lat:number;percentFull:number;state:string}, i: number) => {
    const c = g.state === 'closed' ? '#6B7280'
      : g.percentFull >= 90 ? '#C8352D'
      : g.percentFull >= 60 ? '#E69545' : '#7FAA6B';
    return (
      <div key={`g${i}`} style={{
        position:'absolute', left: lonToX(g.lon) - 5, top: latToY(g.lat) - 5,
        width:10, height:10, borderRadius:2, background:c, opacity:0.9,
      }} />
    );
  });

  const incidentDots = incidents.map((inc: {lon:number;lat:number}, i: number) => (
    <div key={`i${i}`} style={{
      position:'absolute', left: lonToX(inc.lon) - 5, top: latToY(inc.lat) - 8,
      width:0, height:0,
      borderLeft:'5px solid transparent',
      borderRight:'5px solid transparent',
      borderBottom:'10px solid #C8352D',
      opacity:0.9,
    }} />
  ));

  const imgRes = new ImageResponse(
    (
      <div style={{
        width:W, height:H, position:'relative', display:'flex',
        background:'#0E0E10', overflow:'hidden',
      }}>

        {/* ── Static background: rivers + bridges ───────────────────────── */}
        <svg
          width={W} height={H}
          viewBox={`0 0 ${W} ${H}`}
          style={{ position:'absolute', top:0, left:0 }}
        >
          {/* Ohio + Allegheny rivers */}
          <path d="M0 300 Q200 310 300 290 Q400 270 480 280 Q520 285 540 270"
            fill="none" stroke="#1E3A5F" strokeWidth="14"/>
          <path d="M540 270 Q600 250 650 265 Q700 280 800 260 Q850 255 960 240"
            fill="none" stroke="#1E3A5F" strokeWidth="14"/>
          {/* Monongahela */}
          <path d="M540 270 Q540 310 535 380 Q530 430 540 540"
            fill="none" stroke="#1E3A5F" strokeWidth="11"/>
          {/* Three Sisters bridges (teal) */}
          <line x1="500" y1="255" x2="490" y2="295" stroke="#00B6B0" strokeWidth="2" opacity="0.5"/>
          <line x1="528" y1="250" x2="518" y2="290" stroke="#00B6B0" strokeWidth="2" opacity="0.5"/>
          <line x1="556" y1="248" x2="546" y2="288" stroke="#00B6B0" strokeWidth="2" opacity="0.5"/>
          {/* North Shore zone hint */}
          <ellipse
            cx={lonToX(-80.0106)} cy={latToY(40.4470)} rx="58" ry="18"
            fill="rgba(255,206,31,.07)" stroke="#FFCE1F" strokeWidth="1" strokeDasharray="4 3"/>
          {/* Point State Park zone hint */}
          <ellipse
            cx={lonToX(-80.0075)} cy={latToY(40.4410)} rx="36" ry="13"
            fill="rgba(94,163,199,.07)" stroke="#5EA3C7" strokeWidth="1" strokeDasharray="4 3"/>
        </svg>

        {/* ── Live data dots (absolute-positioned divs) ─────────────────── */}
        <div style={{ position:'absolute', top:0, left:0, width:W, height:H }}>
          {busDots}
          {trainDots}
          {garageDots}
          {incidentDots}
        </div>

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div style={{
          position:'absolute', top:0, left:0, right:0,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 14px',
          background:'linear-gradient(180deg,rgba(14,14,16,.95) 0%,rgba(14,14,16,0) 100%)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{
              width:22, height:22, border:'1.5px solid #00B6B0',
              borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center',
              background:'#1A1814',
            }}>
              <div style={{
                width:0, height:0,
                borderLeft:'5px solid transparent', borderRight:'5px solid transparent',
                borderBottom:'8px solid #FFCE1F', marginBottom:2,
              }} />
            </div>
            <span style={{ color:'#F5F1E8', fontWeight:700, fontSize:13, fontFamily:'sans-serif' }}>
              Pittsburgh Draft Dashboard
            </span>
          </div>
          <span style={{ color:'#FFCE1F', fontWeight:600, fontSize:11, fontFamily:'monospace', letterSpacing:'.04em' }}>
            {label}
          </span>
        </div>

        {/* ── Stats footer ──────────────────────────────────────────────── */}
        <div style={{
          position:'absolute', bottom:0, left:0, right:0,
          display:'flex', alignItems:'center', gap:18, padding:'8px 14px',
          background:'linear-gradient(0deg,rgba(14,14,16,.9) 0%,rgba(14,14,16,0) 100%)',
        }}>
          {([
            { dot:'#FFCE1F', text:`${buses.length} buses`          },
            { dot:'#5EA3C7', text:`${trains.length} trains`         },
            { dot:'#7FAA6B', text:`${garages.length} garages`       },
            { dot:'#C8352D', text:`${incidents.length} incidents`   },
          ] as { dot: string; text: string }[]).map(s => (
            <div key={s.text} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:s.dot }} />
              <span style={{ color:'#C7C1B8', fontSize:10, fontFamily:'monospace' }}>{s.text}</span>
            </div>
          ))}
          <span style={{ marginLeft:'auto', color:'#00B6B0', fontSize:10, fontFamily:'monospace', letterSpacing:'.1em' }}>
            #LovePGH
          </span>
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
  });
}
