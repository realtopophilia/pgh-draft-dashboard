'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSON } from 'geojson';
import type { BikeStation } from '@/lib/feeds/pogoh';
import { ensureMapIcons, bikeIconName } from '@/lib/map/icons';
import { P, popupWrap, popupHead, popupMeta, popupStat } from '@/lib/map/popup';

const SOURCE_ID = 'bikeshare-stations';
const LAYER_ID  = 'bikeshare-layer';

// Popup band color mirrors the chip background.
function bandColor(s: BikeStation): string {
  if (!s.isRenting)                return '#6B7280';
  if (s.bikesAvailable === 0)      return '#C8352D';
  if (s.bikesAvailable <= 2)       return '#E69545';
  if (s.capacity > 0 && s.bikesAvailable / s.capacity < 0.25) return '#FFCE1F';
  return '#00B6B0';
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
        icon:           bikeIconName(s.bikesAvailable, s.capacity, s.isRenting),
        bandColor:      bandColor(s),
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
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await ensureMapIcons(map);
      if (cancelled) return;

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: stationsToGeoJSON([]),
        });
      }
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id:     LAYER_ID,
          type:   'symbol',
          source: SOURCE_ID,
          layout: {
            'icon-image': ['get', 'icon'],
            'icon-size': [
              'interpolate', ['linear'], ['zoom'],
              10, 0.4, 13, 0.62, 15, 0.85,
            ],
            'icon-allow-overlap':    true,
            'icon-ignore-placement': true,
            'icon-anchor':           'bottom',
          },
        });
      }
      readyRef.current = true;
      (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)
        ?.setData(stationsToGeoJSON(stations));
    })();

    const handleClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
    ) => {
      if (!e.features?.length) return;
      const p      = e.features[0].properties as Record<string, unknown>;
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
      const closed = !p.isRenting;
      const band   = p.bandColor as string;

      const lastSeen = p.lastReported
        ? new Date(p.lastReported as string).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' })
        : null;

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '240px' })
        .setLngLat(coords)
        .setHTML(popupWrap(`
          ${popupHead(p.name as string, band)}
          ${closed
            ? `<p style="color:${P.rust};font-weight:600;margin:0">Station closed</p>`
            : `<div style="display:flex;gap:14px;margin:2px 0 6px">
                 ${popupStat(String(p.bikesAvailable), 'bikes', band)}
                 ${popupStat(String(p.docksAvailable), 'docks', P.inkDim)}
                 ${popupStat(String(p.capacity),       'cap',   P.inkMute)}
               </div>`
          }
          ${popupMeta(`POGOH · GBFS · ~15 s${lastSeen ? ` · ${lastSeen}` : ''}`)}
        `, 200))
        .addTo(map);
    };

    map.on('click',      LAYER_ID, handleClick);
    map.on('mouseenter', LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', LAYER_ID, () => { map.getCanvas().style.cursor = ''; });

    return () => {
      cancelled = true;
      popupRef.current?.remove();
      map.off('click', LAYER_ID, handleClick);
    };
  }, [map]);

  // Update data on every poll
  useEffect(() => {
    if (!readyRef.current) return;
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
