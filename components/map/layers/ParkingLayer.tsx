'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSON } from 'geojson';
import type { ParkingGarage } from '@/lib/feeds/parkpgh';

const SOURCE_ID = 'parking-garages';
const LAYER_ID  = 'parking-garages-layer';

// Green (empty) → yellow → orange → red (full). Closed = grey.
function garageColor(g: ParkingGarage): string {
  if (g.state === 'closed') return '#6b7280';
  const pct = g.percentFull;
  if (pct >= 90) return '#ef4444'; // red   — nearly full
  if (pct >= 70) return '#f97316'; // orange
  if (pct >= 45) return '#eab308'; // yellow
  return '#22c55e';                // green  — plenty of space
}

function garagesToGeoJSON(garages: ParkingGarage[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: garages.map((g) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [g.lon, g.lat] },
      properties: {
        id:               g.id,
        name:             g.name,
        percentFull:      g.percentFull,
        percentAvailable: g.percentAvailable,
        state:            g.state,
        displaySpaces:    g.displaySpaces,
        hexColor:         garageColor(g),
      },
    })),
  };
}

interface ParkingLayerProps {
  map:     maplibregl.Map;
  garages: ParkingGarage[];
  visible: boolean;
}

export default function ParkingLayer({ map, garages, visible }: ParkingLayerProps) {
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // Init source + layer once
  useEffect(() => {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: garagesToGeoJSON([]),
      });

      map.addLayer({
        id:     LAYER_ID,
        type:   'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            10, 9, 13, 13, 15, 17,
          ],
          'circle-color':        ['get', 'hexColor'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#111827',
          'circle-opacity':      0.92,
        },
      });
    }

    const handleClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
    ) => {
      if (!e.features?.length) return;
      const p     = e.features[0].properties;
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
      const closed = p.state === 'closed';

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '220px' })
        .setLngLat(coords)
        .setHTML(
          `<div style="font-family:sans-serif;min-width:160px">
            <p style="font-weight:600;font-size:13px;color:${p.hexColor};margin:0 0 4px">
              ${p.name}
            </p>
            ${closed
              ? `<p style="color:#ef4444;margin:0">Closed</p>`
              : `<p style="font-size:22px;font-weight:700;color:${p.hexColor};margin:0">
                   ${p.displaySpaces}
                 </p>
                 <p style="color:#9ca3af;font-size:11px;margin:2px 0 0">
                   spaces available · ${p.percentFull}% full
                 </p>`
            }
            <p style="font-size:10px;color:#6b7280;margin:8px 0 0">
              ParkPGH · near-real-time · ~30s
            </p>
          </div>`
        )
        .addTo(map);
    };

    map.on('click',      LAYER_ID, handleClick);
    map.on('mouseenter', LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', LAYER_ID, () => { map.getCanvas().style.cursor = ''; });

    return () => {
      popupRef.current?.remove();
      map.off('click', LAYER_ID, handleClick);
    };
  }, [map]);

  // Update data when garages change
  useEffect(() => {
    (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)
      ?.setData(garagesToGeoJSON(garages));
  }, [map, garages]);

  // Toggle visibility
  useEffect(() => {
    if (map.getLayer(LAYER_ID))
      map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
  }, [map, visible]);

  return null;
}
