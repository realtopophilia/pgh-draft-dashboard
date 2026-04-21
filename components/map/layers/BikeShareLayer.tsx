'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSON } from 'geojson';
import type { BikeStation } from '@/lib/feeds/pogoh';

const SOURCE_ID = 'bikeshare-stations';
const LAYER_ID  = 'bikeshare-layer';

// Color by availability ratio
function stationColor(s: BikeStation): string {
  if (!s.isRenting) return '#6b7280'; // grey — closed/not renting
  if (s.bikesAvailable === 0) return '#ef4444'; // red — empty
  if (s.bikesAvailable <= 2) return '#f97316'; // orange — critical
  if (s.bikesAvailable / s.capacity < 0.25) return '#eab308'; // yellow — low
  return '#06b6d4'; // cyan — good
}

function stationsToGeoJSON(stations: BikeStation[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: stations.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
      properties: {
        id:             s.id,
        name:           s.name,
        bikesAvailable: s.bikesAvailable,
        docksAvailable: s.docksAvailable,
        capacity:       s.capacity,
        isRenting:      s.isRenting,
        isReturning:    s.isReturning,
        lastReported:   s.lastReported,
        color:          stationColor(s),
      },
    })),
  };
}

interface BikeShareLayerProps {
  map:      maplibregl.Map;
  stations: BikeStation[];
  visible:  boolean;
}

export default function BikeShareLayer({ map, stations, visible }: BikeShareLayerProps) {
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // Init source + layer once
  useEffect(() => {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: stationsToGeoJSON([]),
      });

      map.addLayer({
        id:     LAYER_ID,
        type:   'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            10, 5, 13, 8, 15, 12,
          ],
          'circle-color':        ['get', 'color'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#0e7490',
          'circle-opacity':      0.9,
        },
      });
    }

    const handleClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
    ) => {
      if (!e.features?.length) return;
      const p      = e.features[0].properties;
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
      const closed = !p.isRenting;

      const lastSeen = p.lastReported
        ? new Date(p.lastReported).toLocaleTimeString('en-US',
            { hour: 'numeric', minute: '2-digit' })
        : null;

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '220px' })
        .setLngLat(coords)
        .setHTML(`
          <div style="font-family:sans-serif;min-width:180px">
            <p style="font-weight:600;font-size:13px;color:${p.color};margin:0 0 6px;line-height:1.3">
              ${p.name}
            </p>
            ${closed
              ? `<p style="color:#ef4444;font-size:12px;margin:0">Station closed</p>`
              : `<div style="display:flex;gap:16px;margin-bottom:4px">
                   <div style="text-align:center">
                     <p style="font-size:22px;font-weight:700;color:${p.color};margin:0;line-height:1">
                       ${p.bikesAvailable}
                     </p>
                     <p style="color:#9ca3af;font-size:10px;margin:2px 0 0">bikes</p>
                   </div>
                   <div style="text-align:center">
                     <p style="font-size:22px;font-weight:700;color:#d1d5db;margin:0;line-height:1">
                       ${p.docksAvailable}
                     </p>
                     <p style="color:#9ca3af;font-size:10px;margin:2px 0 0">docks</p>
                   </div>
                   <div style="text-align:center">
                     <p style="font-size:22px;font-weight:700;color:#6b7280;margin:0;line-height:1">
                       ${p.capacity}
                     </p>
                     <p style="color:#9ca3af;font-size:10px;margin:2px 0 0">cap</p>
                   </div>
                 </div>`
            }
            <p style="font-size:10px;color:#6b7280;margin:6px 0 0">
              POGOH · GBFS · ~15s${lastSeen ? ` · ${lastSeen}` : ''}
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

  // Update data on every poll
  useEffect(() => {
    (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)
      ?.setData(stationsToGeoJSON(stations));
  }, [map, stations]);

  // Visibility toggle
  useEffect(() => {
    if (map.getLayer(LAYER_ID))
      map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
  }, [map, visible]);

  return null;
}
