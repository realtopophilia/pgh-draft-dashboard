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

/**
 * Post-process Protomaps dark layers so icons dominate:
 * - Road labels hidden below zoom 14 (city-scale view is icon-first)
 * - Road lines dimmed ~30% so they read as infrastructure, not foreground
 * - Building fills darkened to near-black so they don't compete with chips
 * - POI / place labels kept for navigation context
 */
function tuneBaseLayers(baseLayers: maplibregl.LayerSpecification[]): maplibregl.LayerSpecification[] {
  return baseLayers.map(layer => {
    const id = layer.id ?? '';

    // Hide street-level road labels at city zoom — they crowd icon chips
    if (layer.type === 'symbol' && (id.includes('road') || id.includes('street') || id.includes('path'))) {
      return {
        ...layer,
        layout: {
          ...(layer as maplibregl.SymbolLayerSpecification).layout,
          visibility: 'visible',
          'text-size': [
            'interpolate', ['linear'], ['zoom'],
            12, 0,   // invisible at city zoom
            14, ((layer as maplibregl.SymbolLayerSpecification).layout?.['text-size'] as number) ?? 11,
          ],
        },
      };
    }

    // Dim road line layers — reduce opacity so roads read as structure, not foreground
    if (layer.type === 'line' && (id.includes('road') || id.includes('street') || id.includes('tunnel') || id.includes('bridge'))) {
      return {
        ...layer,
        paint: {
          ...(layer as maplibregl.LineLayerSpecification).paint,
          'line-opacity': 0.45,
        },
      };
    }

    // Darken building fills so icon chips pop off them
    if (layer.type === 'fill' && id.includes('building')) {
      return {
        ...layer,
        paint: {
          ...(layer as maplibregl.FillLayerSpecification).paint,
          'fill-color': '#0A090C',
          'fill-opacity': 0.9,
        },
      };
    }

    return layer;
  });
}

function buildMapStyle(): maplibregl.StyleSpecification {
  if (PROTOMAPS_KEY) {
    const baseLayers = layers('protomaps', namedFlavor('dark'));
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
      layers: tuneBaseLayers(baseLayers),
    } as unknown as maplibregl.StyleSpecification;
  }

  // Fallback: CartoDB Dark Matter — free dark raster, no API key needed.
  // Much better contrast for colored data icons than bright OSM tiles.
  return {
    version: 8,
    sources: {
      carto: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> © <a href="https://carto.com">CARTO</a>',
        maxzoom: 19,
      },
    },
    layers: [{
      id: 'carto-dark',
      type: 'raster',
      source: 'carto',
      paint: {
        // Slightly lighter than full Dark Matter so street labels
        // stay legible while icon chips still dominate.
        'raster-brightness-max': 0.92,
        'raster-saturation': -0.05,
      },
    }],
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
