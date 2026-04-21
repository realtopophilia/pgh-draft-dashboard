'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSON } from 'geojson';
import type { Complaint } from '@/lib/feeds/wprdc311';

const SOURCE_ID = '311-complaints';
const LAYER_ID  = '311-layer';

function complaintsToGeoJSON(complaints: Complaint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: complaints
      .filter(c => c.lat !== null && c.lon !== null)
      .map(c => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [c.lon!, c.lat!] },
        properties: {
          id:           c.id,
          type:         c.type,
          status:       c.status,
          neighborhood: c.neighborhood,
          createdAt:    c.createdAt,
        },
      })),
  };
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

interface ThreeOneOneLayerProps {
  map:        maplibregl.Map;
  complaints: Complaint[];
  visible:    boolean;
}

export default function ThreeOneOneLayer({ map, complaints, visible }: ThreeOneOneLayerProps) {
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, { type: 'geojson', data: complaintsToGeoJSON([]) });

      map.addLayer({
        id:     LAYER_ID,
        type:   'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 7],
          'circle-color':        '#fbbf24', // amber
          'circle-stroke-width': 1,
          'circle-stroke-color': '#92400e',
          'circle-opacity':      0.85,
        },
      });
    }

    const handleClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
    ) => {
      if (!e.features?.length) return;
      const p = e.features[0].properties;
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '220px' })
        .setLngLat(coords)
        .setHTML(`
          <div style="font-family:sans-serif;min-width:170px">
            <p style="font-weight:600;font-size:12px;color:#fbbf24;margin:0 0 3px;
                      text-transform:uppercase;letter-spacing:0.05em">
              311 Complaint
            </p>
            <p style="font-size:13px;color:#f3f4f6;margin:0 0 2px">${p.type}</p>
            ${p.neighborhood
              ? `<p style="font-size:11px;color:#9ca3af;margin:0">${p.neighborhood}</p>`
              : ''}
            <p style="font-size:10px;color:#6b7280;margin:6px 0 0">
              ${timeAgo(p.createdAt)} · ${p.status} · Pittsburgh 311
            </p>
          </div>
        `)
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

  useEffect(() => {
    (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)
      ?.setData(complaintsToGeoJSON(complaints));
  }, [map, complaints]);

  useEffect(() => {
    if (map.getLayer(LAYER_ID))
      map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
  }, [map, visible]);

  return null;
}
