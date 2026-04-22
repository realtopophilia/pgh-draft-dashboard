'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import maplibregl from 'maplibre-gl';
import type { TransitVehicle } from '@/lib/feeds/prt';
import type { WeatherData } from '@/lib/feeds/nws';
import type { Incident } from '@/lib/feeds/traffic511';
import type { TrafficCamera } from '@/lib/feeds/cameras';
import type { ParkingGarage } from '@/lib/feeds/parkpgh';
import type { BikeStation } from '@/lib/feeds/pogoh';
import type { Complaint } from '@/lib/feeds/wprdc311';
import type { NewsItem } from '@/lib/feeds/news';
import type { SocialPost } from '@/lib/feeds/social';
import { Badge } from '@/components/ui/badge';
import ScheduleWidget from '@/components/panel/ScheduleWidget';

const DraftMap          = dynamic(() => import('@/components/map/DraftMap'), { ssr: false });
const TransitLayer      = dynamic(() => import('@/components/map/layers/TransitLayer'), { ssr: false });
const TrafficLayer      = dynamic(() => import('@/components/map/layers/TrafficLayer'), { ssr: false });
const CameraLayer       = dynamic(() => import('@/components/map/layers/CameraLayer'), { ssr: false });
const ParkingLayer      = dynamic(() => import('@/components/map/layers/ParkingLayer'), { ssr: false });
const BikeShareLayer    = dynamic(() => import('@/components/map/layers/BikeShareLayer'), { ssr: false });
const ThreeOneOneLayer  = dynamic(() => import('@/components/map/layers/ThreeOneOneLayer'), { ssr: false });
const CampusLayer       = dynamic(() => import('@/components/map/layers/CampusLayer'), { ssr: false });

interface VehiclesResponse   { vehicles:   TransitVehicle[]; fetchedAt: number; }
interface IncidentsResponse  { incidents:  Incident[];        fetchedAt: number; }
interface CamerasResponse    { cameras:    TrafficCamera[];   fetchedAt: number; }
interface ParkingResponse    { garages:    ParkingGarage[];   fetchedAt: number; }
interface BikeShareResponse  { stations:   BikeStation[];     fetchedAt: number; }
interface ComplaintsResponse { complaints: Complaint[];       fetchedAt: number; }
interface NewsResponse       { items:      NewsItem[];         fetchedAt: number; }
interface SocialResponse     { posts:      SocialPost[];       fetchedAt: number; }

const queryClient = new QueryClient();

// ── helpers ────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diffMin = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 60)  return `${diffMin}m ago`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`;
  return `${Math.floor(diffMin / 1440)}d ago`;
}

function WeatherWidget({ data }: { data: WeatherData }) {
  const { current, draftDays } = data;
  return (
    <section className="border-t border-gray-800 pt-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
        Weather · KPIT
      </h2>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-2xl font-mono text-white">
          {current.tempF != null ? `${current.tempF}°F` : '—'}
        </span>
        <span className="text-xs text-gray-400 text-right leading-tight max-w-[90px]">
          {current.description}
        </span>
      </div>
      <div className="text-xs text-gray-500 mb-3">
        {current.windMph != null && <span>{current.windDir} {current.windMph} mph</span>}
        {current.humidity != null && <span className="ml-2">{current.humidity}% RH</span>}
      </div>
      {draftDays.some(d => d.highF > 0) && (
        <>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
            Draft Weekend
          </p>
          <div className="space-y-1">
            {draftDays.map((day) => (
              <div key={day.label} className="flex items-center justify-between text-xs">
                <span className="text-gray-400 w-16 shrink-0">{day.label}</span>
                <span className="text-gray-300 truncate flex-1 px-1">{day.description}</span>
                <span className="text-white font-mono shrink-0">
                  {day.highF}°<span className="text-gray-500">/{day.lowF}°</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="text-xs text-gray-700 mt-2">NWS · updates ~10 min</p>
    </section>
  );
}

function NewsPanel({ items }: { items: NewsItem[] }) {
  if (!items.length) return null;
  return (
    <section className="border-t border-gray-800 pt-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
        Local News
      </h2>
      <div className="space-y-2">
        {items.slice(0, 8).map((item) => (
          <a
            key={item.url}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <p className="text-xs text-gray-300 leading-tight group-hover:text-white transition-colors line-clamp-2">
              {item.title}
            </p>
            <p className="text-xs text-gray-600 mt-0.5">
              {item.source} · {timeAgo(item.publishedAt)}
            </p>
          </a>
        ))}
      </div>
      <p className="text-xs text-gray-700 mt-2">WPXI · TribLive · ~5 min</p>
    </section>
  );
}

function SocialPanel({ posts }: { posts: SocialPost[] }) {
  if (!posts.length) return null;

  const PLATFORM_META = {
    bluesky: { label: 'Bluesky', color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
    reddit:  { label: 'Reddit',  color: '#fb923c', bg: 'rgba(251,146,60,0.1)'  },
  };

  return (
    <section className="border-t border-gray-800 pt-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
        Social · Live Posts
      </h2>
      <div className="space-y-2">
        {posts.slice(0, 10).map((post) => {
          const meta = PLATFORM_META[post.platform];
          return (
            <a
              key={post.id}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block group rounded px-2 py-1.5 transition-colors hover:bg-gray-800"
              style={{ background: meta.bg }}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs font-semibold" style={{ color: meta.color }}>
                  {meta.label}
                </span>
                <span className="text-xs text-gray-500 truncate">{post.handle}</span>
              </div>
              <p className="text-xs text-gray-300 leading-tight line-clamp-3 group-hover:text-white transition-colors">
                {post.text}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {post.author} · {timeAgo(post.publishedAt)}
                {post.likes > 0 && ` · ♥ ${post.likes}`}
              </p>
            </a>
          );
        })}
      </div>
      <p className="text-xs text-gray-700 mt-2">Bluesky · Reddit · ~60s</p>
    </section>
  );
}

// ── main dashboard ─────────────────────────────────────────────────────────
function Dashboard() {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [busVisible,        setBusVisible]        = useState(true);
  const [trainVisible,      setTrainVisible]      = useState(true);
  const [incidentsVisible,  setIncidentsVisible]  = useState(true);
  const [cameraVisible,     setCameraVisible]     = useState(true);
  const [parkingVisible,    setParkingVisible]    = useState(true);
  const [bikeVisible,       setBikeVisible]       = useState(true);
  const [threeOneOneVisible, setThreeOneOneVisible] = useState(true);
  const [campusVisible,     setCampusVisible]     = useState(true);

  const { data: transitData, isError: transitError } = useQuery<VehiclesResponse>({
    queryKey: ['transit-vehicles'],
    queryFn:  () => fetch('/api/transit/vehicles').then(r => r.json()),
    refetchInterval: 20_000, staleTime: 18_000,
  });
  const { data: incidentData } = useQuery<IncidentsResponse>({
    queryKey: ['incidents'],
    queryFn:  () => fetch('/api/traffic/incidents').then(r => r.json()),
    refetchInterval: 30_000, staleTime: 28_000,
  });
  const { data: cameraData } = useQuery<CamerasResponse>({
    queryKey: ['cameras'],
    queryFn:  () => fetch('/api/cameras').then(r => r.json()),
    refetchInterval: 600_000, staleTime: 590_000,
  });
  const { data: weatherData } = useQuery<WeatherData>({
    queryKey: ['weather'],
    queryFn:  () => fetch('/api/weather/current').then(r => r.json()),
    refetchInterval: 600_000, staleTime: 590_000,
  });
  const { data: parkingData } = useQuery<ParkingResponse>({
    queryKey: ['parking'],
    queryFn:  () => fetch('/api/parking').then(r => r.json()),
    refetchInterval: 30_000, staleTime: 28_000,
  });
  const { data: bikeData } = useQuery<BikeShareResponse>({
    queryKey: ['bikeshare'],
    queryFn:  () => fetch('/api/bikeshare').then(r => r.json()),
    refetchInterval: 15_000, staleTime: 13_000,
  });
  const { data: complaintsData } = useQuery<ComplaintsResponse>({
    queryKey: ['311'],
    queryFn:  () => fetch('/api/311').then(r => r.json()),
    refetchInterval: 60_000, staleTime: 55_000,
  });
  const { data: newsData } = useQuery<NewsResponse>({
    queryKey: ['news'],
    queryFn:  () => fetch('/api/news').then(r => r.json()),
    refetchInterval: 300_000, staleTime: 290_000,
  });
  const { data: socialData } = useQuery<SocialResponse>({
    queryKey: ['social'],
    queryFn:  () => fetch('/api/social').then(r => r.json()),
    refetchInterval: 60_000, staleTime: 55_000,
  });

  const handleMapReady = useCallback((m: maplibregl.Map) => setMap(m), []);

  const vehicles   = transitData?.vehicles   ?? [];
  const buses      = vehicles.filter(v => v.type === 'bus');
  const trains     = vehicles.filter(v => v.type === 'train');
  const cameras    = cameraData?.cameras     ?? [];
  const garages    = parkingData?.garages    ?? [];
  const stations   = bikeData?.stations      ?? [];
  const complaints = complaintsData?.complaints ?? [];
  const newsItems  = newsData?.items         ?? [];
  const socialPosts = socialData?.posts      ?? [];

  const lastUpdate = transitData?.fetchedAt
    ? new Date(transitData.fetchedAt).toLocaleTimeString('en-US',
        { hour: 'numeric', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold tracking-wide uppercase text-amber-400">
            Pittsburgh Draft Dashboard
          </h1>
          <Badge variant="outline" className="text-xs text-gray-400 border-gray-700">
            NFL Draft · Apr 23–25, 2026
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {transitError && <span className="text-red-400">Feed error — retrying</span>}
          {lastUpdate   && <span>Transit updated {lastUpdate} · ~20s lag</span>}
        </div>
      </header>

      {/* Map + side panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="relative flex-1">
          <DraftMap onMapReady={handleMapReady} />
          {map && <TransitLayer map={map} vehicles={vehicles} busVisible={busVisible} trainVisible={trainVisible} />}
          {map && <TrafficLayer map={map} incidents={incidentData?.incidents ?? []} incidentsVisible={incidentsVisible} />}
          {map && <CameraLayer map={map} cameras={cameras} visible={cameraVisible} />}
          {map && <ParkingLayer map={map} garages={garages} visible={parkingVisible} />}
          {map && <BikeShareLayer map={map} stations={stations} visible={bikeVisible} />}
          {map && <ThreeOneOneLayer map={map} complaints={complaints} visible={threeOneOneVisible} />}
          {map && <CampusLayer map={map} visible={campusVisible} />}
        </div>

        {/* Side panel */}
        <aside className="w-56 shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col p-3 gap-3 overflow-y-auto">

          {/* Layers */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">Layers</h2>
            {[
              { label: 'PRT Buses',    color: 'bg-amber-400',  accent: 'accent-amber-400',   checked: busVisible,          onChange: setBusVisible },
              { label: 'Light Rail',   color: 'bg-blue-400',   accent: 'accent-blue-400',    checked: trainVisible,        onChange: setTrainVisible },
              { label: 'Incidents',    color: 'bg-red-500',    accent: 'accent-red-400',     checked: incidentsVisible,    onChange: setIncidentsVisible },
              { label: 'Traffic Cams', color: 'bg-emerald-400',accent: 'accent-emerald-400', checked: cameraVisible,       onChange: setCameraVisible },
              { label: 'Parking',      color: 'bg-green-500',  accent: 'accent-green-400',   checked: parkingVisible,      onChange: setParkingVisible },
              { label: 'POGOH Bikes',  color: 'bg-cyan-400',   accent: 'accent-cyan-400',    checked: bikeVisible,         onChange: setBikeVisible },
              { label: '311 Reports',  color: 'bg-amber-400',  accent: 'accent-yellow-400',  checked: threeOneOneVisible,  onChange: setThreeOneOneVisible },
              { label: 'Draft Campus', color: 'bg-yellow-300', accent: 'accent-yellow-300',  checked: campusVisible,       onChange: setCampusVisible },
            ].map(({ label, color, accent, checked, onChange }) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer select-none mt-1 first:mt-0">
                <input type="checkbox" checked={checked}
                  onChange={e => onChange(e.target.checked)}
                  className={accent} />
                <span className="text-sm">
                  <span className={`inline-block w-2 h-2 rounded-full ${color} mr-1`} />
                  {label}
                </span>
              </label>
            ))}
          </section>

          {/* Live counts */}
          <section className="border-t border-gray-800 pt-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Near-Real-Time Counts
            </h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Buses active</span>
                <span className="font-mono text-amber-400">{buses.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rail vehicles</span>
                <span className="font-mono text-blue-400">{trains.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Traffic cams</span>
                <span className="font-mono text-emerald-400">{cameras.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Garages open</span>
                <span className="font-mono text-green-400">{garages.filter(g => g.state === 'open').length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Bike stations</span>
                <span className="font-mono text-cyan-400">{stations.filter(s => s.isRenting).length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">311 (48h)</span>
                <span className="font-mono text-yellow-400">{complaints.length}</span>
              </div>
            </div>
          </section>

          {/* Draft Schedule */}
          <ScheduleWidget />

          {/* Weather */}
          {weatherData && !('error' in weatherData) && (
            <WeatherWidget data={weatherData} />
          )}

          {/* Social */}
          <SocialPanel posts={socialPosts} />

          {/* News */}
          <NewsPanel items={newsItems} />

          {/* Footer */}
          <section className="border-t border-gray-800 pt-3 mt-auto">
            <p className="text-xs text-gray-600 leading-relaxed">
              Transit: TrueTime GTFS-RT · 20s<br />
              Incidents: 511PA · 30s<br />
              Cameras: 511PA · JPG ~60s<br />
              Weather: NWS KPIT · 10 min<br />
              Parking: ParkPGH · 30s<br />
              Bikes: POGOH GBFS · 15s<br />
              311: WPRDC · 60s<br />
              News: WPXI/TribLive · 5 min (draft only)<br />
              Social: Bluesky/Reddit · 60s<br />
              Campus: static · NFL.com
            </p>
          </section>
        </aside>
      </div>
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
