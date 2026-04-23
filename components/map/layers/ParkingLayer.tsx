'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSON } from 'geojson';
import type { ParkingGarage } from '@/lib/feeds/parkpgh';
import { ensureMapIcons, parkingIconName } from '@/lib/map/icons';
import { P, popupWrap, popupHead, popupMeta } from '@/lib/map/popup';

const SOURCE_ID = 'parking-garages';
const LAYER_ID  = 'parking-garages-layer';

// Brand-aligned palette for the popup color band (matches icon bg).
function bandColor(g: ParkingGarage): string {
  if (g.state === 'closed')  return '#6B7280';
  const pct = g.percentFull;
  if (pct >= 100) return '#8B1E17';
  if (pct >= 85)  return '#C8352D';
  if (pct >= 60)  return '#E69545';
  if (pct >= 30)  return '#FFCE1F';
  return '#7FAA6B';
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
        icon:             parkingIconName(g.percentFull, g.state),
        bandColor:        bandColor(g),
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
  const readyRef = useRef(false);

  // Init source + symbol layer once
  useEffect(() => {
    let cancelled = false;

    (async () => {
      await ensureMapIcons(map);
      if (cancelled) return;

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type: 'geojson',
          data: garagesToGeoJSON([]),
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
              10, 0.55, 13, 0.8, 15, 1.0,
            ],
            'icon-allow-overlap':    true,
            'icon-ignore-placement': true,
            'icon-anchor':           'bottom',
          },
        });
      }
      readyRef.current = true;
      const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      src?.setData(garagesToGeoJSON(garages));
    })();

    const handleClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
    ) => {
      if (!e.features?.length) return;
      const p      = e.features[0].properties as Record<string, unknown>;
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
      const closed = p.state === 'closed';
      const band   = p.bandColor as string;

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '240px' })
        .setLngLat(coords)
        .setHTML(popupWrap(`
          ${popupHead(p.name as string, band)}
          ${closed
            ? `<p style="color:${P.rust};font-weight:600;margin:0">Closed</p>`
            : `<p style="font-size:26px;font-weight:700;color:${band};margin:0;line-height:1;letter-spacing:-.02em">${p.displaySpaces}</p>
               <p style="font-size:11px;color:${P.inkDim};margin:2px 0 0">spaces open · <span style="color:${band}">${p.percentFull}%</span> full</p>`
          }
          ${popupMeta('ParkPGH · near-real-time · ~30 s')}
        `))
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

  // Data update
  useEffect(() => {
    if (!readyRef.current) return;
    (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)
      ?.setData(garagesToGeoJSON(garages));
  }, [map, garages]);

  // Visibility
  useEffect(() => {
    if (map.getLayer(LAYER_ID))
      map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
  }, [map, visible]);

  return null;
}
