'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import maplibregl from 'maplibre-gl';
import type { TransitVehicle } from '@/lib/feeds/prt';
import type { WeatherData }    from '@/lib/feeds/nws';
import type { Incident }       from '@/lib/feeds/traffic511';
import type { TrafficCamera }  from '@/lib/feeds/cameras';
import type { ParkingGarage }  from '@/lib/feeds/parkpgh';
import type { BikeStation }    from '@/lib/feeds/pogoh';
import type { NewsItem }       from '@/lib/feeds/news';
import type { SocialPost }     from '@/lib/feeds/social';
import ScheduleWidget          from '@/components/panel/ScheduleWidget';

const DraftMap         = dynamic(() => import('@/components/map/DraftMap'),                    { ssr: false });
const TransitLayer     = dynamic(() => import('@/components/map/layers/TransitLayer'),         { ssr: false });
const TrafficLayer     = dynamic(() => import('@/components/map/layers/TrafficLayer'),         { ssr: false });
const CameraLayer      = dynamic(() => import('@/components/map/layers/CameraLayer'),          { ssr: false });
const ParkingLayer     = dynamic(() => import('@/components/map/layers/ParkingLayer'),         { ssr: false });
const BikeShareLayer   = dynamic(() => import('@/components/map/layers/BikeShareLayer'),       { ssr: false });
const CampusLayer        = dynamic(() => import('@/components/map/layers/CampusLayer'),          { ssr: false });
const HeatmapLayer       = dynamic(() => import('@/components/map/layers/HeatmapLayer'),         { ssr: false });
const TimelapseCapture   = dynamic(() => import('@/components/timelapse/TimelapseCapture'),     { ssr: false });

interface VehiclesResponse   { vehicles:   TransitVehicle[]; fetchedAt: number; }
interface IncidentsResponse  { incidents:  Incident[];        fetchedAt: number; }
interface CamerasResponse    { cameras:    TrafficCamera[];   fetchedAt: number; }
interface ParkingResponse    { garages:    ParkingGarage[];   fetchedAt: number; }
interface BikeShareResponse  { stations:   BikeStation[];     fetchedAt: number; }
interface NewsResponse       { items:      NewsItem[];         fetchedAt: number; }
interface SocialResponse     { posts:      SocialPost[];       fetchedAt: number; }

const queryClient = new QueryClient();

// ── utility ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

function distKm(a: [number,number], b: [number,number]) {
  const dx = (b[0]-a[0]) * 111.32 * Math.cos(a[1]*Math.PI/180);
  const dy = (b[1]-a[1]) * 110.574;
  return Math.sqrt(dx*dx + dy*dy);
}
const FOOTPRINTS: [number,number][] = [[-80.0106,40.4470],[-80.0075,40.4410]];
function inFootprint(lon: number, lat: number) {
  return FOOTPRINTS.some(c => distKm([lon,lat], c) <= 0.65);
}

// ── crowding index ─────────────────────────────────────────────────────────────
function useCrowding(
  garages:   ParkingGarage[],
  vehicles:  TransitVehicle[],
  incidents: Incident[],
) {
  return useMemo(() => {
    const near  = garages.filter(g => inFootprint(g.lon, g.lat));
    const wgted = near.reduce((s, g) => s + g.percentFull, 0);
    const fillPct = near.length ? Math.round(wgted / near.length) : 0;
    const freeSpots = near.reduce((s, g) => s + g.displaySpaces * (1 - g.percentFull/100), 0);

    const buses  = vehicles.filter(v => v.type==='bus'   && inFootprint(v.lon, v.lat)).length;
    const trains = vehicles.filter(v => v.type==='train' && inFootprint(v.lon, v.lat)).length;
    const incs   = incidents.filter(i => inFootprint(i.lon, i.lat)).length;

    const parkPts    = (fillPct / 100) * 40;
    const transitPts = Math.min(1, buses / 25) * 30;
    const incPts     = Math.min(1, incs  / 5)  * 20;
    const delay      = Math.min(15, Math.round(buses/8 + incs*1.5));
    const index      = Math.min(100, Math.round(parkPts + transitPts + incPts));

    return { index, fillPct, freeSpots: Math.round(freeSpots), nearBuses: buses, nearTrains: trains, nearIncs: incs, delay };
  }, [garages, vehicles, incidents]);
}

// ── live clock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const hhmm = now.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true });
  const ss   = now.getSeconds().toString().padStart(2,'0');
  return (
    <span className="font-mono" style={{ color:'var(--ink-dim)', fontSize:11, letterSpacing:'.04em' }}>
      {hhmm}<span style={{ color:'var(--ink-faint)' }}>:{ss}</span>
    </span>
  );
}

// ── pulse dot ────────────────────────────────────────────────────────────────
function FreshDot({ state='live', label }: { state?:'live'|'slow'|'stale'; label?: string }) {
  const C = { live:'var(--moss)', slow:'var(--gold)', stale:'var(--rust)' }[state];
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5 }}>
      <span className="pulse-dot" style={{
        width:6, height:6, borderRadius:'50%',
        background:C, display:'inline-block',
        ['--pc' as string]: C+'99',
      }} />
      {label && <span className="font-mono" style={{ fontSize:10, color:'var(--ink-mute)' }}>{label}</span>}
    </span>
  );
}

// ── map-overlay error chip ───────────────────────────────────────────────────
function MapErrorChip({ label }: { label: string }) {
  return (
    <div style={{
      padding:'5px 10px', background:'rgba(200,53,45,.18)',
      border:'1px solid var(--rust)', borderRadius:999,
      fontSize:10.5, color:'var(--rust)', fontWeight:600,
      letterSpacing:'.04em', whiteSpace:'nowrap',
    }}>
      {label} feed down
    </div>
  );
}

// ── feed-unavailable inline notice ───────────────────────────────────────────
function FeedError({ name }: { name: string }) {
  return (
    <div
      role="status"
      style={{
        fontSize: 11, color: 'var(--ink-mute)', padding: '8px 10px',
        background: 'rgba(200,53,45,.06)', border: '1px dashed var(--line-2)',
        borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rust)' }} />
      {name} feed unavailable — retrying.
    </div>
  );
}

// ── section header helper ────────────────────────────────────────────────────
function SectionHead({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
      <span className="font-space" style={{ fontSize:10, letterSpacing:'.16em', textTransform:'uppercase', color:'var(--ink-mute)', fontWeight:600 }}>
        {label}
      </span>
      {right}
    </div>
  );
}

// ── Draft schedule / countdown ───────────────────────────────────────────────
const DRAFT_ROUNDS = [
  { label:'Round 1',   start: new Date('2026-04-23T20:00:00-04:00'), end: new Date('2026-04-24T00:00:00-04:00') },
  { label:'Rounds 2–3',start: new Date('2026-04-24T19:00:00-04:00'), end: new Date('2026-04-25T00:00:00-04:00') },
  { label:'Rounds 4–7',start: new Date('2026-04-25T12:00:00-04:00'), end: new Date('2026-04-25T20:00:00-04:00') },
];

function DraftCountdownStrip() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const draftEnd = DRAFT_ROUNDS[DRAFT_ROUNDS.length - 1].end;
  if (now > draftEnd) return null; // draft over — strip disappears

  // Find the current or next round
  const live  = DRAFT_ROUNDS.find(r => now >= r.start && now < r.end);
  const next  = DRAFT_ROUNDS.find(r => now < r.start);

  let label = '';
  let detail = '';
  let color = 'var(--teal)';

  if (live) {
    label = `🏈 ${live.label} — ON THE CLOCK`;
    color = 'var(--gold)';
    const msLeft = live.end.getTime() - now.getTime();
    const h = Math.floor(msLeft / 3_600_000);
    const m = Math.floor((msLeft % 3_600_000) / 60_000);
    detail = h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
  } else if (next) {
    label = `${next.label} starts`;
    const msUntil = next.start.getTime() - now.getTime();
    const h = Math.floor(msUntil / 3_600_000);
    const m = Math.floor((msUntil % 3_600_000) / 60_000);
    const s = Math.floor((msUntil % 60_000) / 1_000);
    detail = h > 0
      ? `in ${h}h ${m}m · ${next.start.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}`
      : m > 0 ? `in ${m}m ${s}s` : `in ${s}s`;
  }

  return (
    <div style={{
      background: live ? 'rgba(255,206,31,.10)' : 'rgba(0,182,176,.07)',
      borderBottom: `1px solid ${live ? 'rgba(255,206,31,.25)' : 'rgba(0,182,176,.2)'}`,
      padding:'5px 18px', display:'flex', alignItems:'center', gap:14, flexShrink:0,
    }}>
      <span style={{ fontSize:10, fontWeight:700, letterSpacing:'.14em', textTransform:'uppercase', color, whiteSpace:'nowrap' }}>
        {label}
      </span>
      <span className="font-mono" style={{ fontSize:10.5, color:'var(--ink-dim)' }}>{detail}</span>
      {live && (
        <span className="pulse-dot" style={{
          width:7, height:7, borderRadius:'50%', background:'var(--gold)',
          marginLeft:'auto', flexShrink:0,
          ['--pc' as string]: 'rgba(255,206,31,.5)',
        }} />
      )}
    </div>
  );
}

// ── TopBar ────────────────────────────────────────────────────────────────────
function TopBar({ onAbout }: { onAbout: () => void }) {
  return (
    <header style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'8px 18px', background:'var(--bg-1)',
      borderBottom:'1px solid var(--line)', zIndex:10, flexShrink:0, gap:16,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        {/* bespoke mark — Warhol-style offset silkscreen (teal under gold) */}
        <svg width="32" height="32" viewBox="0 0 34 34" aria-hidden="true">
          <rect x="1" y="1" width="32" height="32" rx="6" fill="#1A1814" stroke="var(--teal)" strokeWidth="1.1"/>
          {/* offset teal triangle = silkscreen misregistration */}
          <path d="M11 23 L19 9 L26 23 Z" fill="none" stroke="var(--teal)" strokeWidth="1.2" strokeLinejoin="round" opacity=".85"/>
          {/* primary gold triangle */}
          <path d="M9 23 L17 9 L25 23 Z" fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeLinejoin="round"/>
          <circle cx="17" cy="18" r="2.2" fill="var(--gold)"/>
        </svg>
        <div style={{ lineHeight:1.15 }}>
          <div className="font-space" style={{ fontWeight:700, fontSize:14, letterSpacing:'.01em', color:'var(--ink)' }}>
            Pittsburgh Draft Dashboard
          </div>
          <div className="topbar-subtitle" style={{ fontSize:10, color:'var(--ink-mute)', letterSpacing:'.14em', textTransform:'uppercase', fontWeight:500 }}>
            Greatness is on the clock · city-wide civic view
          </div>
        </div>
        <div className="topbar-divider" style={{ width:1, height:24, background:'var(--line)' }} />
        <span className="font-space topbar-date-chip" style={{
          display:'inline-flex', alignItems:'center', gap:6,
          color:'var(--gold)', fontWeight:700, fontSize:11, letterSpacing:'.08em',
        }}>
          <span style={{ width:7, height:7, borderRadius:2, background:'var(--teal)', display:'inline-block' }} />
          NFL DRAFT · APR 23–25, 2026
        </span>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:14 }}>
        <FreshDot state="live" label="Live" />
        <span className="topbar-clock"><LiveClock /></span>
        <button
          className="topbar-about"
          onClick={onAbout}
          style={{
            fontFamily:'inherit', border:'1px solid var(--line)', background:'var(--bg-2)',
            color:'var(--ink)', padding:'5px 11px', borderRadius:6, fontSize:11,
            fontWeight:500, cursor:'pointer', letterSpacing:'.02em', transition:'all .15s',
          }}
          onMouseOver={e => (e.currentTarget.style.borderColor='var(--line-2)')}
          onMouseOut={e  => (e.currentTarget.style.borderColor='var(--line)')}
        >
          How this works
        </button>
      </div>
    </header>
  );
}

// ── AboutModal ────────────────────────────────────────────────────────────────
const ABOUT_SOURCES = [
  { layer:'Buses',           source:'Pittsburgh Regional Transit · GTFS-RT',  cadence:'20 s' },
  { layer:'Light Rail',      source:'Pittsburgh Regional Transit · GTFS-RT',  cadence:'20 s' },
  { layer:'Road Incidents',  source:'PennDOT 511PA',                           cadence:'30 s' },
  { layer:'Traffic Cameras', source:'PennDOT 511PA · JPG stills',              cadence:'60 s' },
  { layer:'Parking Garages', source:'ParkPGH availability',                   cadence:'30 s' },
  { layer:'POGOH Bikes',     source:'POGOH GBFS v3',                          cadence:'15 s' },
  { layer:'Weather',         source:'National Weather Service · KPIT',        cadence:'10 min' },
  { layer:'News',            source:'WPXI · TribLive · draft keywords filter', cadence:'5 min' },
  { layer:'Social',          source:'Bluesky AT Protocol · Reddit JSON API',  cadence:'60 s' },
  { layer:'Draft Campus',    source:'NFL.com campus map · static',            cadence:'—' },
];

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding:'20px 24px 16px', borderBottom:'1px solid var(--line)', flexShrink:0,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:12 }}>
            <svg width="38" height="38" viewBox="0 0 34 34" aria-hidden="true">
              <rect x="1" y="1" width="32" height="32" rx="6" fill="#1A1814" stroke="var(--teal)" strokeWidth="1.1"/>
              <path d="M11 23 L19 9 L26 23 Z" fill="none" stroke="var(--teal)" strokeWidth="1.2" strokeLinejoin="round" opacity=".85"/>
              <path d="M9 23 L17 9 L25 23 Z" fill="none" stroke="var(--gold)" strokeWidth="1.4" strokeLinejoin="round"/>
              <circle cx="17" cy="18" r="2.2" fill="var(--gold)"/>
            </svg>
            <div>
              <div className="font-space" style={{ fontSize:10, letterSpacing:'.16em', color:'var(--ink-mute)', textTransform:'uppercase', fontWeight:600 }}>
                2026 NFL Draft · Pittsburgh
              </div>
              <h2 className="font-space" style={{ fontSize:22, color:'var(--ink)', margin:'3px 0 0', fontWeight:700, lineHeight:1.2 }}>
                Pittsburgh Draft Dashboard
              </h2>
            </div>
          </div>
          <p style={{ fontSize:13.5, color:'var(--ink-dim)', lineHeight:1.65, margin:0 }}>
            A near-real-time civic view of what&apos;s happening city-wide during the 2026 NFL Draft
            (April 23–25). Transit, parking, weather, and social chatter, all in one map.
          </p>
        </div>

        {/* Body */}
        <div style={{ padding:'16px 24px', overflowY:'auto', flex:1 }}>
          <p style={{ fontSize:12.5, color:'var(--ink-dim)', lineHeight:1.6, marginTop:0, marginBottom:14 }}>
            Every data feed shown is <strong style={{ color:'var(--ink)' }}>near-real-time</strong>,
            not real-time — there&apos;s a refresh delay for every layer, noted below.
            No personal data is collected. All APIs are publicly available with no login required.
          </p>
          <p style={{ fontSize:12.5, color:'var(--ink-dim)', lineHeight:1.6, marginTop:0, marginBottom:16 }}>
            <strong style={{ color:'var(--ink-dim)' }}>How the crowding index works:</strong> The 0–100
            score is a composite of parking garage fill % near the draft footprint (from ParkPGH), active
            PRT bus count within 0.65 km of the North Shore and Point State Park (from GTFS-RT), and
            active traffic incidents in the same radius (from 511PA). It&apos;s a useful proxy but not a
            people-counter — it reflects vehicle and transit pressure, not foot traffic directly.
          </p>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['Layer','Source','Refresh'].map(h => (
                  <th key={h} style={{
                    padding:'8px 8px', borderBottom:'1px solid var(--line)',
                    textAlign:'left', fontSize:10, letterSpacing:'.14em',
                    textTransform:'uppercase', color:'var(--ink-mute)', fontWeight:600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ABOUT_SOURCES.map(s => (
                <tr key={s.layer} style={{ borderBottom:'1px solid var(--line)' }}>
                  <td style={{ padding:'9px 8px', color:'var(--ink)', fontWeight:500 }}>{s.layer}</td>
                  <td style={{ padding:'9px 8px', color:'var(--ink-dim)' }}>{s.source}</td>
                  <td className="font-mono" style={{ padding:'9px 8px', color:'var(--ink-mute)' }}>{s.cadence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer CTA */}
        <div style={{
          padding:'14px 24px', borderTop:'1px solid var(--line)',
          display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0,
        }}>
          <span style={{ fontSize:11, color:'var(--ink-faint)' }}>
            Independent civic project · not affiliated with the NFL or Visit Pittsburgh · <span style={{ color:'var(--teal)' }}>#LovePGH</span>
          </span>
          <button
            onClick={onClose}
            style={{
              fontFamily:'inherit', background:'var(--gold)', color:'#1A1814',
              border:'none', padding:'8px 20px', borderRadius:7,
              fontSize:13, fontWeight:700, cursor:'pointer', letterSpacing:'.02em',
            }}
          >
            Enter Dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── RightNowCard ──────────────────────────────────────────────────────────────
interface CrowdStats { index:number; fillPct:number; freeSpots:number; nearBuses:number; delay:number; }

// Crowding thresholds — calibrated so "starting to fill" begins around 25,
// not 0. A score of 32 = "starting to fill", not "busy".
const CROWD_TONES = [
  { max:25, label:'light crowd',      color:'var(--moss)',    advice:'Great time to head in — roads and transit are clear.' },
  { max:48, label:'starting to fill', color:'var(--gold)',    advice:'Mild build-up near the venues. Plan a few extra minutes.' },
  { max:68, label:'getting busy',     color:'#E69545',        advice:'Noticeably busy. Transit is faster than driving right now.' },
  { max:85, label:'very busy',        color:'var(--rust)',    advice:'Expect waits. Light rail or walking strongly recommended.' },
  { max:Infinity, label:'packed',     color:'#9B1C1C',        advice:'Avoid driving in. Light rail is the only reliable option.' },
] as const;

function crowdTone(index: number) {
  return CROWD_TONES.find(t => index < t.max) ?? CROWD_TONES[CROWD_TONES.length - 1];
}

function RightNowCard({ stats }: { stats: CrowdStats }) {
  const { index } = stats;
  const [infoOpen, setInfoOpen] = useState(false);
  const tone = crowdTone(index);

  return (
    <div className="pgh-card" style={{ padding:'14px 16px', flexShrink:0 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <div style={{ fontSize:10, letterSpacing:'.16em', color:'var(--ink-mute)', textTransform:'uppercase', fontWeight:600 }}>
          Near the Draft footprint
        </div>
        <button
          onClick={() => setInfoOpen(o => !o)}
          aria-label="How crowding index is calculated"
          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--ink-faint)', fontSize:13, padding:'0 2px', lineHeight:1 }}
        >ⓘ</button>
      </div>

      {infoOpen && (
        <div style={{ background:'var(--bg-2)', borderRadius:6, padding:'9px 11px', marginBottom:10, fontSize:11, color:'var(--ink-dim)', lineHeight:1.55 }}>
          Score = <strong style={{ color:'var(--ink)' }}>parking fill</strong> near venues (40 pts)
          + <strong style={{ color:'var(--ink)' }}>bus density</strong> within 0.65 km (30 pts)
          + <strong style={{ color:'var(--ink)' }}>active incidents</strong> nearby (20 pts).
          It measures vehicle &amp; transit pressure, not a people-counter.
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:10, marginBottom:10 }}>
        <div>
          <div className="font-space" style={{ fontSize:16, color:'var(--ink)', fontWeight:600, lineHeight:1.3 }}>
            It&apos;s <span style={{ color:tone.color }}>{tone.label}</span>{' '}
            around North Shore &amp; Point State Park.
          </div>
          <div style={{ fontSize:11.5, color:'var(--ink-dim)', marginTop:5, lineHeight:1.45 }}>
            {tone.advice}
          </div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:10, color:'var(--ink-mute)', letterSpacing:'.14em', textTransform:'uppercase' }}>Pressure</div>
          <div className="font-mono" style={{ fontSize:28, fontWeight:600, color:tone.color, letterSpacing:'-.02em', lineHeight:1 }}>
            {index}<span style={{ fontSize:12, color:'var(--ink-faint)', fontWeight:400 }}>/100</span>
          </div>
        </div>
      </div>

      <div style={{ position:'relative', marginBottom:8 }}>
        <div className="gauge-bar">
          <div className="gauge-fill" style={{ width:'100%' }} />
          <div className="gauge-pin" style={{ left:`calc(${index}% - 1px)` }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:5, fontSize:9, color:'var(--ink-faint)', letterSpacing:'.06em', textTransform:'uppercase' }}>
          <span>Light</span><span>Filling</span><span>Busy</span><span>Packed</span>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
        {[
          { label:'Garages', val:`${stats.fillPct}%`, sub:'full near venues', hi:80, mid:55 },
          { label:'Delay',   val:`+${stats.delay}m`,  sub:'vs. typical',      hi:8,  mid:4 },
          { label:'Buses',   val:String(stats.nearBuses), sub:'near venues',   hi:20, mid:10 },
        ].map(({ label, val, sub, hi, mid }) => {
          const raw = parseFloat(val);
          const c = raw >= hi ? 'var(--rust)' : raw >= mid ? 'var(--gold)' : 'var(--moss)';
          return (
            <div key={label} style={{ background:'var(--bg-2)', borderRadius:5, padding:'7px 9px' }}>
              <div style={{ fontSize:9, letterSpacing:'.12em', color:'var(--ink-mute)', textTransform:'uppercase', fontWeight:600 }}>{label}</div>
              <div className="font-mono" style={{ fontSize:16, color:c, fontWeight:600, marginTop:2, lineHeight:1 }}>{val}</div>
              <div style={{ fontSize:9.5, color:'var(--ink-faint)', marginTop:2 }}>{sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── LayerPills ────────────────────────────────────────────────────────────────
const LAYER_DEFS = [
  { key:'heatmap',   label:'Pressure',     color:'#C8352D', cadence:'20s' },
  { key:'buses',     label:'Buses',        color:'#FFCE1F', cadence:'20s' },
  { key:'trains',    label:'Rail',         color:'#5EA3C7', cadence:'20s' },
  { key:'incidents', label:'Incidents',    color:'#C8352D', cadence:'30s' },
  { key:'cameras',   label:'Cams',         color:'#7FAA6B', cadence:'60s' },
  { key:'parking',   label:'Parking',      color:'#E83E8C', cadence:'30s' },
  { key:'bikes',     label:'POGOH',        color:'#00B6B0', cadence:'15s' },
  { key:'campus',    label:'Draft campus', color:'#FFCE1F', cadence:'static' },
] as const;

type LayerKey = typeof LAYER_DEFS[number]['key'];

interface LayerState { heatmap:boolean; buses:boolean; trains:boolean; incidents:boolean; cameras:boolean; parking:boolean; bikes:boolean; campus:boolean; }

function LayerPills({ state, onToggle }: { state: LayerState; onToggle: (k: LayerKey) => void }) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
      {LAYER_DEFS.map(L => (
        <button
          key={L.key}
          className={`layer-pill ${state[L.key] ? 'on' : 'off'}`}
          onClick={() => onToggle(L.key)}
          title={`Updates every ${L.cadence}`}
        >
          <span className="dot" style={{ background: L.color }} />
          <span>{L.label}</span>
        </button>
      ))}
    </div>
  );
}

// ── GaragePanel ───────────────────────────────────────────────────────────────
function GaragePanel({ garages, isError }: { garages: ParkingGarage[]; isError?: boolean }) {
  const sorted = useMemo(() =>
    [...garages]
      .filter(g => g.state !== 'closed')
      .sort((a, b) => {
        const da = FOOTPRINTS.reduce((best, c) => Math.min(best, distKm([a.lon, a.lat], c)), Infinity);
        const db = FOOTPRINTS.reduce((best, c) => Math.min(best, distKm([b.lon, b.lat], c)), Infinity);
        return da - db;
      })
      .slice(0, 8),
    [garages]
  );

  if (isError) {
    return (
      <section style={{ flexShrink:0 }}>
        <SectionHead label="Garages · nearest event first" right={<FreshDot state="stale" label="ParkPGH" />} />
        <FeedError name="ParkPGH" />
      </section>
    );
  }
  if (!sorted.length) return null;
  return (
    <section style={{ flexShrink:0 }}>
      <SectionHead label="Garages · nearest event first" right={<FreshDot state="live" label="ParkPGH · 30s" />} />
      <div>
        {sorted.map(g => {
          const pct = g.percentFull;
          const C   = pct>=90?'var(--rust)':pct>=70?'var(--gold)':'var(--moss)';
          return (
            <div key={g.id} style={{ padding:'6px 0', borderBottom:'1px solid var(--line)' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:3 }}>
                <span style={{ fontSize:11.5, color:'var(--ink-dim)', fontWeight:500 }}>{g.name}</span>
                <span className="font-mono" style={{ fontSize:11, color:C, fontWeight:500 }}>
                  {pct>=100 ? 'FULL' : `${Math.round(100-pct)}% open`}
                </span>
              </div>
              <div style={{ height:3, background:'var(--bg-3)', borderRadius:2, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${pct}%`, background:C, borderRadius:2 }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── WeatherWidget ─────────────────────────────────────────────────────────────
function WeatherWidget({ data }: { data: WeatherData }) {
  const { current, draftDays } = data;
  return (
    <section style={{ flexShrink:0 }}>
      <SectionHead label="Draft weekend weather" right={<FreshDot state="live" label="NWS · 10m" />} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
        {/* Now */}
        <div style={{ padding:'9px 11px', background:'var(--bg-2)', borderRadius:6 }}>
          <div style={{ fontSize:9.5, color:'var(--ink-mute)', letterSpacing:'.14em', textTransform:'uppercase', marginBottom:4, fontWeight:600 }}>Now</div>
          <div className="font-mono" style={{ fontSize:20, color:'var(--ink)', fontWeight:500, lineHeight:1 }}>
            {current.tempF != null ? `${current.tempF}°` : '—'}
          </div>
          <div style={{ fontSize:10.5, color:'var(--ink-dim)', marginTop:3 }}>{current.description}</div>
          {current.windMph != null && (
            <div className="font-mono" style={{ fontSize:9.5, color:'var(--ink-faint)', marginTop:2 }}>
              {current.windDir} {current.windMph} mph
            </div>
          )}
        </div>
        {draftDays.slice(0, 2).map(d => (
          <div key={d.label} style={{ padding:'9px 11px', background:'var(--bg-2)', borderRadius:6 }}>
            <div style={{ fontSize:9.5, color:'var(--ink-mute)', letterSpacing:'.14em', textTransform:'uppercase', marginBottom:4, fontWeight:600 }}>{d.label}</div>
            <div className="font-mono" style={{ fontSize:20, color:'var(--ink)', fontWeight:500, lineHeight:1 }}>
              {d.highF}°<span style={{ fontSize:11, color:'var(--ink-faint)', fontWeight:400 }}>/{d.lowF}°</span>
            </div>
            <div style={{ fontSize:10.5, color:'var(--ink-dim)', marginTop:3 }}>{d.description}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── SocialPanel ───────────────────────────────────────────────────────────────
const PLATFORM = {
  bluesky: { label:'Bluesky', color:'#60a5fa', bg:'rgba(96,165,250,.08)',  bgHover:'rgba(96,165,250,.15)' },
  reddit:  { label:'Reddit',  color:'#fb923c', bg:'rgba(251,146,60,.08)',   bgHover:'rgba(251,146,60,.15)' },
};

function SocialPanel({ posts, isError }: { posts: SocialPost[]; isError?: boolean }) {
  if (isError) {
    return (
      <section style={{ flexShrink:0 }}>
        <SectionHead label="Social · live posts" right={<FreshDot state="stale" label="Bluesky/Reddit" />} />
        <FeedError name="Social" />
      </section>
    );
  }
  if (!posts.length) return null;
  return (
    <section style={{ flexShrink:0 }}>
      <SectionHead label="Social · live posts" right={<FreshDot state="live" label="60s" />} />
      <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
        {posts.slice(0, 8).map(p => {
          const m = PLATFORM[p.platform];
          return (
            <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer"
              style={{
                display:'block', borderRadius:6, padding:'7px 9px',
                background: m.bg, border:'1px solid var(--line)',
                textDecoration:'none', transition:'background .15s',
              }}
              onMouseOver={e => (e.currentTarget.style.background = m.bgHover)}
              onMouseOut={e  => (e.currentTarget.style.background = m.bg)}
            >
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                <span style={{ fontSize:10, fontWeight:600, color: m.color }}>{m.label}</span>
                <span style={{ fontSize:10, color:'var(--ink-faint)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.handle}</span>
              </div>
              <p style={{ margin:0, fontSize:11.5, color:'var(--ink-dim)', lineHeight:1.45, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                {p.text}
              </p>
              <p style={{ margin:'3px 0 0', fontSize:10, color:'var(--ink-faint)' }}>
                {p.author} · {timeAgo(p.publishedAt)}{p.likes>0 && ` · ♥ ${p.likes}`}
              </p>
            </a>
          );
        })}
      </div>
    </section>
  );
}

// ── NewsPanel ─────────────────────────────────────────────────────────────────
function NewsPanel({ items, isError }: { items: NewsItem[]; isError?: boolean }) {
  if (isError) {
    return (
      <section style={{ flexShrink:0 }}>
        <SectionHead label="Local news · draft only" right={<FreshDot state="stale" label="WPXI/Trib" />} />
        <FeedError name="News" />
      </section>
    );
  }
  if (!items.length) return null;
  return (
    <section style={{ flexShrink:0 }}>
      <SectionHead label="Local news · draft only" right={<FreshDot state="live" label="5 min" />} />
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {items.slice(0, 8).map(item => (
          <a key={item.url} href={item.url} target="_blank" rel="noopener noreferrer"
            style={{ display:'block', textDecoration:'none' }}
          >
            <p style={{ margin:0, fontSize:12, color:'var(--ink-dim)', lineHeight:1.45, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
              {item.title}
            </p>
            <p style={{ margin:'2px 0 0', fontSize:10, color:'var(--ink-faint)' }}>
              {item.source} · {timeAgo(item.publishedAt)}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}

// ── Ticker ────────────────────────────────────────────────────────────────────
function Ticker({ items }: { items: NewsItem[] }) {
  if (!items.length) return null;
  const duped = [...items, ...items]; // double for seamless loop
  return (
    <div style={{
      borderTop:'1px solid var(--line)', background:'var(--bg-1)',
      padding:'6px 0', overflow:'hidden', display:'flex', alignItems:'center', gap:12, flexShrink:0,
    }}>
      <div style={{
        flexShrink:0, padding:'3px 11px', margin:'0 8px',
        fontSize:9.5, letterSpacing:'.16em', color:'var(--bg-0)',
        fontWeight:700, background:'var(--gold)', borderRadius:3,
        textTransform:'uppercase', whiteSpace:'nowrap',
        boxShadow: '2px 2px 0 0 var(--teal)',   /* offset silkscreen nod */
      }}>
        LIVE · LOCAL NEWS
      </div>
      <div style={{ flex:1, overflow:'hidden', position:'relative' }}>
        <div className="ticker-track">
          {duped.map((n, i) => (
            <a
              key={i}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ticker-item"
              title={`Open: ${n.title}`}
            >
              <span className="font-mono" style={{ fontSize:9.5, color:'var(--gold)', letterSpacing:'.1em' }}>{n.source}</span>
              <span style={{ color:'var(--ink-dim)' }}>{n.title}</span>
              <span style={{ color:'var(--ink-faint)', fontSize:10 }}>{timeAgo(n.publishedAt)}</span>
              <span style={{ color:'var(--line-2)' }}>◆</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── LiveCountRow ──────────────────────────────────────────────────────────────
function LiveCounts({
  buses, trains, cameras, garages, stations,
}: {
  buses: number; trains: number; cameras: number;
  garages: number; stations: number;
}) {
  const rows = [
    { label:'Buses active', val:buses,   color:'var(--gold)'  },
    { label:'Rail vehicles',val:trains,  color:'var(--steel)' },
    { label:'Traffic cams', val:cameras, color:'var(--moss)'  },
    { label:'Garages open', val:garages, color:'var(--magenta)' },
    { label:'Bike stations',val:stations,color:'var(--teal)'  },
  ];
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, background:'var(--line)', borderRadius:7, overflow:'hidden', border:'1px solid var(--line)' }}>
      {rows.map(r => (
        <div key={r.label} style={{ padding:'9px 11px', background:'var(--bg-1)' }}>
          <div style={{ fontSize:9.5, color:'var(--ink-mute)', letterSpacing:'.1em', textTransform:'uppercase', fontWeight:500, marginBottom:4 }}>{r.label}</div>
          <div className="font-mono" style={{ fontSize:18, fontWeight:600, color:r.color, lineHeight:1 }}>{r.val}</div>
        </div>
      ))}
    </div>
  );
}

// ── main Dashboard ────────────────────────────────────────────────────────────
function Dashboard() {
  const [map, setMap]    = useState<maplibregl.Map | null>(null);
  // Show welcome modal on first visit of each browser session
  const [aboutOpen, setAboutOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    const seen = sessionStorage.getItem('pgh-dash-welcomed');
    return !seen;
  });
  const mapContainerRef  = useRef<HTMLDivElement | null>(null);

  const closeAbout = useCallback(() => {
    sessionStorage.setItem('pgh-dash-welcomed', '1');
    setAboutOpen(false);
  }, []);

  const [sheetOpen, setSheetOpen] = useState(false);

  const [layers, setLayers] = useState<LayerState>({
    heatmap:true, buses:true, trains:true, incidents:true, cameras:true,
    parking:true, bikes:true, campus:true,
  });
  const toggleLayer = useCallback((k: LayerKey) => {
    setLayers(prev => ({ ...prev, [k]: !prev[k] }));
  }, []);

  const { data: transitData,  isError: transitError } = useQuery<VehiclesResponse>({
    queryKey: ['transit-vehicles'],
    queryFn:  () => fetch('/api/transit/vehicles').then(r => r.json()),
    refetchInterval: 20_000, staleTime: 18_000,
  });
  const { data: incidentData, isError: incidentError } = useQuery<IncidentsResponse>({
    queryKey: ['incidents'],
    queryFn:  () => fetch('/api/traffic/incidents').then(r => r.json()),
    refetchInterval: 30_000, staleTime: 28_000,
  });
  const { data: cameraData, isError: cameraError } = useQuery<CamerasResponse>({
    queryKey: ['cameras'],
    queryFn:  () => fetch('/api/cameras').then(r => r.json()),
    refetchInterval: 600_000, staleTime: 590_000,
  });
  const { data: weatherData, isError: weatherError } = useQuery<WeatherData>({
    queryKey: ['weather'],
    queryFn:  () => fetch('/api/weather/current').then(r => r.json()),
    refetchInterval: 600_000, staleTime: 590_000,
  });
  const { data: parkingData, isError: parkingError } = useQuery<ParkingResponse>({
    queryKey: ['parking'],
    queryFn:  () => fetch('/api/parking').then(r => r.json()),
    refetchInterval: 30_000, staleTime: 28_000,
  });
  const { data: bikeData, isError: bikeError } = useQuery<BikeShareResponse>({
    queryKey: ['bikeshare'],
    queryFn:  () => fetch('/api/bikeshare').then(r => r.json()),
    refetchInterval: 15_000, staleTime: 13_000,
  });
  const { data: newsData, isError: newsError } = useQuery<NewsResponse>({
    queryKey: ['news'],
    queryFn:  () => fetch('/api/news').then(r => r.json()),
    refetchInterval: 300_000, staleTime: 290_000,
  });
  const { data: socialData, isError: socialError } = useQuery<SocialResponse>({
    queryKey: ['social'],
    queryFn:  () => fetch('/api/social').then(r => r.json()),
    refetchInterval: 60_000, staleTime: 55_000,
  });

  const handleMapReady = useCallback((m: maplibregl.Map) => setMap(m), []);

  const vehicles    = transitData?.vehicles   ?? [];
  const buses       = vehicles.filter(v => v.type === 'bus');
  const trains      = vehicles.filter(v => v.type === 'train');
  const cameras     = cameraData?.cameras     ?? [];
  const garages     = parkingData?.garages    ?? [];
  const stations    = bikeData?.stations      ?? [];
  const newsItems   = newsData?.items         ?? [];
  const socialPosts = socialData?.posts       ?? [];
  const incidents   = incidentData?.incidents ?? [];

  const crowd = useCrowding(garages, vehicles, incidents);

  const lastUpdate = transitData?.fetchedAt
    ? new Date(transitData.fetchedAt).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', second:'2-digit' })
    : null;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg-0)', color:'var(--ink)', overflow:'hidden' }}>
      <TopBar onAbout={() => setAboutOpen(true)} />
      <DraftCountdownStrip />

      <div className="pgh-shell">
        {/* Map */}
        <div ref={mapContainerRef} className="pgh-map">
          <DraftMap onMapReady={handleMapReady} />
          {map && <HeatmapLayer     map={map} vehicles={vehicles} garages={garages}   visible={layers.heatmap} />}
          {map && <TransitLayer     map={map} vehicles={vehicles}                   busVisible={layers.buses}    trainVisible={layers.trains} />}
          {map && <TrafficLayer     map={map} incidents={incidents}                 incidentsVisible={layers.incidents} />}
          {map && <CameraLayer      map={map} cameras={cameras}                     visible={layers.cameras} />}
          {map && <ParkingLayer     map={map} garages={garages}                     visible={layers.parking} />}
          {map && <BikeShareLayer   map={map} stations={stations}                   visible={layers.bikes} />}
          {map && <CampusLayer      map={map}                                        visible={layers.campus} />}

          {/* Map top-left status + timelapse control */}
          <div style={{
            position:'absolute', top:12, left:12, display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', zIndex:5,
          }}>
            <TimelapseCapture mapContainer={mapContainerRef.current} />
            {transitError  && <MapErrorChip label="Transit" />}
            {incidentError && <MapErrorChip label="Incidents" />}
            {cameraError   && <MapErrorChip label="Cameras" />}
            {bikeError     && <MapErrorChip label="Bikes" />}
            {lastUpdate && (
              <div style={{ padding:'5px 10px', background:'rgba(23,22,26,.9)', backdropFilter:'blur(6px)', border:'1px solid var(--line)', borderRadius:999, fontSize:10, color:'var(--ink-faint)', fontFamily:'var(--font-mono)' }}>
                Transit {lastUpdate}
              </div>
            )}
          </div>

          {/* Map legend bottom-left (hidden on mobile via .pgh-map-legend) */}
          <div className="pgh-map-legend" style={{
            position:'absolute', left:12, bottom:12,
            background:'rgba(23,22,26,.88)', backdropFilter:'blur(8px)',
            border:'1px solid var(--line)', borderRadius:8, padding:'10px 12px', maxWidth:200, zIndex:5,
          }}>
            <div style={{ fontSize:9.5, letterSpacing:'.16em', color:'var(--ink-mute)', textTransform:'uppercase', marginBottom:6, fontWeight:600 }}>Legend</div>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:10.5, color:'var(--gold)', marginBottom:5, paddingBottom:5, borderBottom:'1px solid var(--line)' }}>
              <span style={{ width:14, height:10, border:'1.5px dashed var(--gold)', flexShrink:0, display:'inline-block' }}/>
              <span>Draft footprint zones</span>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'3px 8px' }}>
              {LAYER_DEFS.filter(L => layers[L.key]).map(L => (
                <div key={L.key} style={{ display:'flex', alignItems:'center', gap:5, fontSize:10, color:'var(--ink-dim)' }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background:L.color, flexShrink:0 }} />
                  <span>{L.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Side panel — aside on desktop, bottom-sheet on mobile */}
        <aside className={`pgh-aside ${sheetOpen ? 'open' : ''}`}>
          {/* Mobile drag-handle */}
          <button
            type="button"
            className="pgh-sheet-handle"
            onClick={() => setSheetOpen(o => !o)}
            aria-expanded={sheetOpen}
            aria-label={sheetOpen ? 'Collapse panel' : 'Expand panel'}
          >
            <span className="ctx-title">
              {sheetOpen ? 'Hide details' : `Crowding ${crowd.index}/100 · tap for details`}
            </span>
            <span className="ctx-caret">▲</span>
          </button>

          {/* Right-now card */}
          <RightNowCard stats={crowd} />

          {/* Layer toggles */}
          <section style={{ flexShrink:0 }}>
            <SectionHead label="What you're seeing" right={<FreshDot state="live" label="All feeds live" />} />
            <LayerPills state={layers} onToggle={toggleLayer} />
          </section>

          {/* Live counts */}
          <section style={{ flexShrink:0 }}>
            <SectionHead label="City-wide · right now" />
            <LiveCounts
              buses={buses.length}
              trains={trains.length}
              cameras={cameras.length}
              garages={garages.filter(g => g.state==='open').length}
              stations={stations.filter(s => s.isRenting).length}
            />
          </section>

          {/* Parking garages */}
          <GaragePanel garages={garages} isError={parkingError} />

          {/* Weather */}
          {weatherError ? (
            <section style={{ flexShrink:0 }}>
              <SectionHead label="Draft weekend weather" right={<FreshDot state="stale" label="NWS" />} />
              <FeedError name="Weather" />
            </section>
          ) : weatherData && !('error' in weatherData) ? (
            <WeatherWidget data={weatherData} />
          ) : null}

          {/* Draft schedule */}
          <ScheduleWidget />

          {/* Social */}
          <SocialPanel posts={socialPosts} isError={socialError} />

          {/* News */}
          <NewsPanel items={newsItems} isError={newsError} />

          {/* Footer */}
          <section style={{ marginTop:'auto', paddingTop:10, borderTop:'1px solid var(--line)', flexShrink:0 }}>
            <p className="font-mono" style={{ fontSize:9.5, color:'var(--ink-faint)', lineHeight:1.7, margin:0 }}>
              Transit: PRT GTFS-RT · 20s<br />
              Traffic: 511PA · 30s<br />
              Cameras: 511PA JPG · 60s<br />
              Weather: NWS KPIT · 10 min<br />
              Parking: ParkPGH · 30s<br />
              Bikes: POGOH GBFS · 15s<br />
              Social: Bluesky + Reddit · 60s<br />
              News: WPXI/TribLive · 5 min
            </p>
            <button
              onClick={() => setAboutOpen(true)}
              style={{ background:'none', border:0, color:'var(--gold)', padding:'4px 0 0', cursor:'pointer', fontSize:10, fontFamily:'inherit', letterSpacing:'.02em', textDecoration:'underline', textUnderlineOffset:3 }}
            >
              See all data sources →
            </button>
          </section>
        </aside>
      </div>

      {/* News ticker */}
      <Ticker items={newsItems} />

      {/* About modal */}
      {aboutOpen && <AboutModal onClose={closeAbout} />}
    </div>
  );
}

export default function Home() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
