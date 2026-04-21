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
import { Badge } from '@/components/ui/badge';

const DraftMap     = dynamic(() => import('@/components/map/DraftMap'), { ssr: false });
const TransitLayer = dynamic(() => import('@/components/map/layers/TransitLayer'), { ssr: false });
const TrafficLayer = dynamic(() => import('@/components/map/layers/TrafficLayer'), { ssr: false });
const CameraLayer  = dynamic(() => import('@/components/map/layers/CameraLayer'), { ssr: false });
const ParkingLayer = dynamic(() => import('@/components/map/layers/ParkingLayer'), { ssr: false });

interface VehiclesResponse  { vehicles: TransitVehicle[]; fetchedAt: number; }
interface IncidentsResponse { incidents: Incident[];       fetchedAt: number; }
interface CamerasResponse   { cameras: TrafficCamera[];    fetchedAt: number; }
interface ParkingResponse   { garages: ParkingGarage[];    fetchedAt: number; }

const queryClient = new QueryClient();

// ── small helpers ──────────────────────────────────────────────────────────
function WeatherWidget({ data }: { data: WeatherData }) {
  const { current, draftDays } = data;
  return (
    <section className="border-t border-gray-800 pt-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
        Weather · KPIT
      </h2>

      {/* current conditions */}
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-2xl font-mono text-white">
          {current.tempF != null ? `${current.tempF}°F` : '—'}
        </span>
        <span className="text-xs text-gray-400 text-right leading-tight max-w-[90px]">
          {current.description}
        </span>
      </div>
      <div className="text-xs text-gray-500 mb-3">
        {current.windMph != null && (
          <span>{current.windDir} {current.windMph} mph</span>
        )}
        {current.humidity != null && (
          <span className="ml-2">{current.humidity}% RH</span>
        )}
      </div>

      {/* Draft weekend forecast */}
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

// ── main dashboard ─────────────────────────────────────────────────────────
function Dashboard() {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [busVisible,       setBusVisible]       = useState(true);
  const [trainVisible,     setTrainVisible]     = useState(true);
  const [incidentsVisible, setIncidentsVisible] = useState(true);
  const [cameraVisible,    setCameraVisible]    = useState(true);
  const [parkingVisible,   setParkingVisible]   = useState(true);

  const { data: transitData, isError: transitError } = useQuery<VehiclesResponse>({
    queryKey: ['transit-vehicles'],
    queryFn:  () => fetch('/api/transit/vehicles').then(r => r.json()),
    refetchInterval: 20_000,
    staleTime:       18_000,
  });

  const { data: incidentData } = useQuery<IncidentsResponse>({
    queryKey: ['incidents'],
    queryFn:  () => fetch('/api/traffic/incidents').then(r => r.json()),
    refetchInterval: 30_000,
    staleTime:       28_000,
  });

  const { data: cameraData } = useQuery<CamerasResponse>({
    queryKey: ['cameras'],
    queryFn:  () => fetch('/api/cameras').then(r => r.json()),
    refetchInterval: 600_000,
    staleTime:       590_000,
  });

  const { data: weatherData } = useQuery<WeatherData>({
    queryKey: ['weather'],
    queryFn:  () => fetch('/api/weather/current').then(r => r.json()),
    refetchInterval: 600_000,
    staleTime:       590_000,
  });

  const { data: parkingData } = useQuery<ParkingResponse>({
    queryKey: ['parking'],
    queryFn:  () => fetch('/api/parking').then(r => r.json()),
    refetchInterval: 30_000,
    staleTime:       28_000,
  });

  const handleMapReady = useCallback((m: maplibregl.Map) => setMap(m), []);

  const vehicles = transitData?.vehicles ?? [];
  const buses    = vehicles.filter(v => v.type === 'bus');
  const trains   = vehicles.filter(v => v.type === 'train');
  const cameras  = cameraData?.cameras ?? [];
  const garages  = parkingData?.garages ?? [];

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
          {map && (
            <TransitLayer
              map={map}
              vehicles={vehicles}
              busVisible={busVisible}
              trainVisible={trainVisible}
            />
          )}
          {map && (
            <TrafficLayer
              map={map}
              incidents={incidentData?.incidents ?? []}
              incidentsVisible={incidentsVisible}
            />
          )}
          {map && (
            <CameraLayer
              map={map}
              cameras={cameras}
              visible={cameraVisible}
            />
          )}
          {map && (
            <ParkingLayer
              map={map}
              garages={garages}
              visible={parkingVisible}
            />
          )}
        </div>

        {/* Side panel */}
        <aside className="w-56 shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col p-3 gap-3 overflow-y-auto">

          {/* Layers */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Layers
            </h2>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={busVisible}
                onChange={e => setBusVisible(e.target.checked)}
                className="accent-amber-400" />
              <span className="text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />
                PRT Buses
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
              <input type="checkbox" checked={trainVisible}
                onChange={e => setTrainVisible(e.target.checked)}
                className="accent-blue-400" />
              <span className="text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />
                Light Rail
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
              <input type="checkbox" checked={incidentsVisible}
                onChange={e => setIncidentsVisible(e.target.checked)}
                className="accent-red-400" />
              <span className="text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />
                Incidents
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
              <input type="checkbox" checked={cameraVisible}
                onChange={e => setCameraVisible(e.target.checked)}
                className="accent-emerald-400" />
              <span className="text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" />
                Traffic Cams
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
              <input type="checkbox" checked={parkingVisible}
                onChange={e => setParkingVisible(e.target.checked)}
                className="accent-green-400" />
              <span className="text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 mr-1" />
                Parking
              </span>
            </label>
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
                <span className="font-mono text-green-400">
                  {garages.filter(g => g.state === 'open').length}
                </span>
              </div>
            </div>
          </section>

          {/* Weather */}
          {weatherData && !('error' in weatherData) && (
            <WeatherWidget data={weatherData} />
          )}

          {/* Footer */}
          <section className="border-t border-gray-800 pt-3 mt-auto">
            <p className="text-xs text-gray-600 leading-relaxed">
              Transit: TrueTime GTFS-RT · 20s<br />
              Incidents: 511PA · 30s<br />
              Cameras: 511PA · JPG ~60s<br />
              Weather: NWS KPIT · 10 min<br />
              Parking: ParkPGH · 30s
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
