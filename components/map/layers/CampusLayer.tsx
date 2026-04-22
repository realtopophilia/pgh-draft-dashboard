'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { DRAFT_VENUES, VENUE_COLORS, type DraftVenue } from '@/lib/data/draftCampus';
import type { GeoJSON } from 'geojson';

const SOURCE_ID  = 'draft-campus';
const CIRCLE_ID  = 'campus-circles';
const LABEL_ID   = 'campus-labels';

function venuesToGeoJSON(venues: DraftVenue[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: venues.map(v => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
      properties: {
        id:          v.id,
        name:        v.name,
        description: v.description,
        type:        v.type,
        color:       VENUE_COLORS[v.type],
      },
    })),
  };
}

interface CampusLayerProps {
  map:     maplibregl.Map;
  visible: boolean;
}

export default function CampusLayer({ map, visible }: CampusLayerProps) {
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: venuesToGeoJSON(DRAFT_VENUES),
      });

      // Glowing circle
      map.addLayer({
        id:     CIRCLE_ID,
        type:   'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            10, 10, 13, 16, 15, 22,
          ],
          'circle-color':        ['get', 'color'],
          'circle-stroke-width': 2.5,
          'circle-stroke-color': '#78350f',
          'circle-opacity':      0.9,
          'circle-blur':         0.15,
        },
      });

      // Label
      map.addLayer({
        id:     LABEL_ID,
        type:   'symbol',
        source: SOURCE_ID,
        layout: {
          'text-field':          ['get', 'name'],
          'text-font':           ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size':           11,
          'text-offset':         [0, 1.6],
          'text-anchor':         'top',
          'text-allow-overlap':  false,
          'text-ignore-placement': false,
        },
        paint: {
          'text-color':        '#fef3c7',
          'text-halo-color':   '#000000',
          'text-halo-width':   1.5,
        },
      });
    }

    const handleClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
    ) => {
      if (!e.features?.length) return;
      const p     = e.features[0].properties;
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '240px' })
        .setLngLat(coords)
        .setHTML(`
          <div style="font-family:sans-serif;min-width:200px">
            <p style="font-weight:700;font-size:13px;color:${p.color};margin:0 0 5px;line-height:1.3">
              🏈 ${p.name}
            </p>
            <p style="font-size:12px;color:#d1d5db;margin:0;line-height:1.5">
              ${p.description}
            </p>
            <p style="font-size:10px;color:#6b7280;margin:6px 0 0">
              2026 NFL Draft · Pittsburgh
            </p>
          </div>
        `)
        .addTo(map);
    };

    map.on('click',      CIRCLE_ID, handleClick);
    map.on('mouseenter', CIRCLE_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', CIRCLE_ID, () => { map.getCanvas().style.cursor = ''; });

    return () => {
      popupRef.current?.remove();
      map.off('click', CIRCLE_ID, handleClick);
    };
  }, [map]);

  useEffect(() => {
    [CIRCLE_ID, LABEL_ID].forEach(id => {
      if (map.getLayer(id))
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    });
  }, [map, visible]);

  return null;
}
