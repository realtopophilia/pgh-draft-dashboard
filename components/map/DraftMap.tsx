'use client';

import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { layers, namedFlavor } from '@protomaps/basemaps';
import 'maplibre-gl/dist/maplibre-gl.css';
import { PITTSBURGH_CENTER, PITTSBURGH_ZOOM, MAP_BOUNDS } from '@/lib/bounds';

// Protomaps basemap source. Set NEXT_PUBLIC_PROTOMAPS_KEY in .env.local.
// Get a free key (no credit card) at https://protomaps.com/dashboard
const PROTOMAPS_KEY = process.env.NEXT_PUBLIC_PROTOMAPS_KEY;

function buildMapStyle(): maplibregl.StyleSpecification {
  if (PROTOMAPS_KEY) {
    // Full Protomaps vector tiles — labels, roads, buildings
    return {
      version: 8,
      glyphs: 'https://protomaps.github.io/basemaps-assets/fonts/{fontstack}/{range}.pbf',
      sprite: 'https://protomaps.github.io/basemaps-assets/sprites/v4/light',
      sources: {
        protomaps: {
          type: 'vector',
          url: `https://api.protomaps.com/tiles/v4.json?key=${PROTOMAPS_KEY}`,
          attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        },
      },
      layers: layers('protomaps', namedFlavor('dark')),
    } as unknown as maplibregl.StyleSpecification;
  }

  // Fallback: MapLibre demo raster tiles (no key needed, dev only)
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxzoom: 19,
      },
    },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  };
}

interface DraftMapProps {
  onMapReady: (map: maplibregl.Map) => void;
}

export default function DraftMap({ onMapReady }: DraftMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  onMapReadyRef.current = onMapReady;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Register PMTiles protocol so MapLibre can load pmtiles:// URLs
    const protocol = new Protocol();
    maplibregl.addProtocol('pmtiles', protocol.tile);

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: buildMapStyle(),
      center: PITTSBURGH_CENTER,
      zoom: PITTSBURGH_ZOOM,
      maxBounds: [
        [MAP_BOUNDS[0][0] - 0.05, MAP_BOUNDS[0][1] - 0.05],
        [MAP_BOUNDS[1][0] + 0.05, MAP_BOUNDS[1][1] + 0.05],
      ],
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(
      new maplibregl.ScaleControl({ unit: 'imperial' }),
      'bottom-left'
    );

    map.on('load', () => {
      mapRef.current = map;
      onMapReadyRef.current(map);
    });

    return () => {
      maplibregl.removeProtocol('pmtiles');
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      aria-label="Pittsburgh near-real-time map"
    />
  );
}
