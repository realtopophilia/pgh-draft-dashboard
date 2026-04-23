'use client';

/**
 * HeatmapLayer — ambient "city filling up" thermal glow.
 *
 * Renders a MapLibre heatmap under all other layers using bus positions +
 * parking fill as heat weight. As the city fills with people and vehicles
 * during the draft, the warm glow visually expands from dense areas.
 *
 * Color ramp: cool teal (sparse) → gold (moderate) → rust-red (dense).
 * This mirrors the draft brand palette while making pressure readable
 * at the city-wide zoom level where individual icons are too small.
 */

import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSON } from 'geojson';
import type { TransitVehicle } from '@/lib/feeds/prt';
import type { ParkingGarage }  from '@/lib/feeds/parkpgh';

const SRC   = 'heatmap-pressure';
const LAYER = 'heatmap-fill';

interface PressurePoint {
  lon:    number;
  lat:    number;
  weight: number; // 0–1
}

/** Merge vehicles + parking into a weighted point cloud. */
function toPoints(vehicles: TransitVehicle[], garages: ParkingGarage[]): PressurePoint[] {
  const pts: PressurePoint[] = [];

  // Each vehicle = weight 1. Stopped buses get 1.8 (more pressure).
  for (const v of vehicles) {
    pts.push({ lon: v.lon, lat: v.lat, weight: v.speedMph < 3 ? 1.8 : 1 });
  }

  // Each garage = weight proportional to fill (0→0, 100%→3).
  for (const g of garages) {
    if (g.state === 'closed') continue;
    pts.push({ lon: g.lon, lat: g.lat, weight: (g.percentFull / 100) * 3 });
  }

  return pts;
}

function toGeoJSON(pts: PressurePoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pts.map(p => ({
      type:       'Feature',
      geometry:   { type: 'Point', coordinates: [p.lon, p.lat] },
      properties: { weight: p.weight },
    })),
  };
}

interface HeatmapLayerProps {
  map:      maplibregl.Map;
  vehicles: TransitVehicle[];
  garages:  ParkingGarage[];
  visible:  boolean;
}

export default function HeatmapLayer({ map, vehicles, garages, visible }: HeatmapLayerProps) {

  // Init source + layer once
  useEffect(() => {
    const init = () => {
      if (map.getSource(SRC)) return;

      map.addSource(SRC, { type: 'geojson', data: toGeoJSON([]) });

      map.addLayer({
        id:     LAYER,
        type:   'heatmap',
        source: SRC,
        maxzoom: 14,  // fades out at street level where icons are legible
        paint: {
          // Weight from the feature property (stopped buses + full garages = heavier)
          'heatmap-weight': [
            'interpolate', ['linear'], ['get', 'weight'],
            0, 0,  3, 1,
          ],
          // Intensity scales with zoom: denser at city level
          'heatmap-intensity': [
            'interpolate', ['linear'], ['zoom'],
            0, 0.6,  9, 1.8,  11, 3,  14, 5,
          ],
          // Color ramp: transparent → teal → gold → rust
          'heatmap-color': [
            'interpolate', ['linear'], ['heatmap-density'],
            0,    'rgba(0,0,0,0)',
            0.15, 'rgba(0,182,176,.3)',   // teal — sparse
            0.4,  'rgba(0,182,176,.55)',  // teal — light
            0.6,  'rgba(255,206,31,.65)', // gold — moderate
            0.8,  'rgba(230,149,69,.75)', // amber — busy
            1.0,  'rgba(200,53,45,.85)',  // rust-red — packed
          ],
          // Radius: large at city zoom, tightens at street zoom
          'heatmap-radius': [
            'interpolate', ['linear'], ['zoom'],
            0, 8,  9, 20,  11, 35,  13, 55,
          ],
          // Fade out as zoom approaches 14 (icons take over)
          'heatmap-opacity': [
            'interpolate', ['linear'], ['zoom'],
            11, 0.8,  13, 0.45,  14, 0,
          ],
        },
      }, LAYER); // insert before itself (i.e., under everything else)
    };

    if (map.loaded()) init(); else map.once('load', init);
  }, [map]);

  // Update on every data change
  useEffect(() => {
    const src = map.getSource(SRC) as maplibregl.GeoJSONSource | undefined;
    src?.setData(toGeoJSON(toPoints(vehicles, garages)));
  }, [map, vehicles, garages]);

  // Visibility
  useEffect(() => {
    if (map.getLayer(LAYER))
      map.setLayoutProperty(LAYER, 'visibility', visible ? 'visible' : 'none');
  }, [map, visible]);

  return null;
}
