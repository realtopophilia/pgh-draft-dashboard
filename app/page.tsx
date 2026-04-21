'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import maplibregl from 'maplibre-gl';
import type { TransitVehicle } from '@/lib/feeds/prt';
import { Badge } from '@/components/ui/badge';

// Dynamic import keeps MapLibre out of SSR — it needs window
const DraftMap = dynamic(() => import('@/components/map/DraftMap'), { ssr: false });
const TransitLayer = dynamic(
  () => import('@/components/map/layers/TransitLayer'),
  { ssr: false }
);

interface VehiclesResponse {
  vehicles: TransitVehicle[];
  fetchedAt: number;
}

const queryClient = new QueryClient();

function Dashboard() {
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [transitVisible, setTransitVisible] = useState(true);

  const { data, dataUpdatedAt, isError } = useQuery<VehiclesResponse>({
    queryKey: ['transit-vehicles'],
    queryFn: () => fetch('/api/transit/vehicles').then((r) => r.json()),
    refetchInterval: 20_000,  // match PRT feed cadence
    staleTime: 18_000,
  });

  const handleMapReady = useCallback((m: maplibregl.Map) => setMap(m), []);

  const buses = data?.vehicles.filter((v) => v.type === 'bus').length ?? 0;
  const trains = data?.vehicles.filter((v) => v.type === 'train').length ?? 0;

  const lastUpdate = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      })
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
          {isError && (
            <span className="text-red-400">Feed error — retrying</span>
          )}
          {lastUpdate && (
            <span>Updated {lastUpdate} · ~20s lag</span>
          )}
        </div>
      </header>

      {/* Map + side panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map fills remaining space */}
        <div className="relative flex-1">
          <DraftMap onMapReady={handleMapReady} />

          {map && data && (
            <TransitLayer
              map={map}
              vehicles={data.vehicles}
              visible={transitVisible}
            />
          )}
        </div>

        {/* Side panel */}
        <aside className="w-56 shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col p-3 gap-3 overflow-y-auto">
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Layers
            </h2>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={transitVisible}
                onChange={(e) => setTransitVisible(e.target.checked)}
                className="accent-amber-400"
              />
              <span className="text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />
                PRT Buses
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
              <input
                type="checkbox"
                checked={transitVisible}
                onChange={(e) => setTransitVisible(e.target.checked)}
                className="accent-blue-400"
              />
              <span className="text-sm">
                <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />
                Light Rail
              </span>
            </label>
          </section>

          <section className="border-t border-gray-800 pt-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
              Near-Real-Time Counts
            </h2>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Buses active</span>
                <span className="font-mono text-amber-400">{buses}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Rail vehicles</span>
                <span className="font-mono text-blue-400">{trains}</span>
              </div>
            </div>
          </section>

          <section className="border-t border-gray-800 pt-3 mt-auto">
            <p className="text-xs text-gray-600 leading-relaxed">
              Transit data from Port Authority of Allegheny County via TrueTime GTFS-RT.
              Refreshes every 20 seconds.
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
