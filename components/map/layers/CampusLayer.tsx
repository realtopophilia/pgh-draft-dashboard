'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import {
  DRAFT_ZONES,
  CAMPUS_LANDMARKS,
  LANDMARK_STYLES,
  zoneToRing,
  DRAFT_VENUES,
  VENUE_COLORS,
  type DraftVenue,
} from '@/lib/data/draftCampus';
import type { GeoJSON } from 'geojson';

// ── source / layer IDs ────────────────────────────────────────────────────────
const ZONES_SRC   = 'draft-zones';
const ZONES_FILL  = 'draft-zones-fill';
const ZONES_LINE  = 'draft-zones-line';
const ZONES_LABEL = 'draft-zones-label';
const VENUES_SRC  = 'draft-campus';
const VENUE_CIRC  = 'campus-circles';
const VENUE_LABEL = 'campus-labels';

// ── helpers ───────────────────────────────────────────────────────────────────
function zonesGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: DRAFT_ZONES.map(z => ({
      type: 'Feature',
      properties: { id: z.id, name: z.name, color: z.color },
      geometry: { type: 'Polygon', coordinates: [zoneToRing(z)] },
    })),
  };
}

function zoneLabelsGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: DRAFT_ZONES.map(z => ({
      type: 'Feature',
      properties: { name: z.name.toUpperCase(), color: z.color },
      geometry: {
        type: 'Point',
        coordinates: [z.center[0], z.center[1] + 0.003],
      },
    })),
  };
}

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
  const popupRef        = useRef<maplibregl.Popup | null>(null);
  const landmarkMarkers = useRef<maplibregl.Marker[]>([]);

  // ── one-time map source + layer init ────────────────────────────────────────
  useEffect(() => {
    const init = () => {
      // ── Zone fill polygons ───────────────────────────────────────────────
      if (!map.getSource(ZONES_SRC)) {
        map.addSource(ZONES_SRC, { type: 'geojson', data: zonesGeoJSON() });

        map.addLayer({
          id: ZONES_FILL, type: 'fill', source: ZONES_SRC,
          paint: {
            'fill-color':   ['get', 'color'],
            'fill-opacity': 0.09,
          },
        });
        map.addLayer({
          id: ZONES_LINE, type: 'line', source: ZONES_SRC,
          paint: {
            'line-color':       ['get', 'color'],
            'line-width':       2,
            'line-dasharray':   [2, 2],
            'line-opacity':     0.9,
          },
        });
      }

      if (!map.getSource(ZONES_LABEL + '-src')) {
        map.addSource(ZONES_LABEL + '-src', { type: 'geojson', data: zoneLabelsGeoJSON() });
        map.addLayer({
          id: ZONES_LABEL, type: 'symbol', source: ZONES_LABEL + '-src',
          layout: {
            'text-field':         ['get', 'name'],
            'text-font':          ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size':          11,
            'text-letter-spacing': 0.16,
            'text-allow-overlap': true,
          },
          paint: {
            'text-color':      '#FFD66B',
            'text-halo-color': 'rgba(14,14,16,.9)',
            'text-halo-width': 1.4,
          },
        });
      }

      // ── Venue dots (5 major venues) ─────────────────────────────────────
      if (!map.getSource(VENUES_SRC)) {
        map.addSource(VENUES_SRC, { type: 'geojson', data: venuesToGeoJSON(DRAFT_VENUES) });

        map.addLayer({
          id: VENUE_CIRC, type: 'circle', source: VENUES_SRC,
          paint: {
            'circle-radius':       ['interpolate', ['linear'], ['zoom'], 10, 8, 13, 12, 15, 16],
            'circle-color':        ['get', 'color'],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#78350f',
            'circle-opacity':      0.9,
            'circle-blur':         0.1,
          },
        });

        map.addLayer({
          id: VENUE_LABEL, type: 'symbol', source: VENUES_SRC,
          layout: {
            'text-field':            ['get', 'name'],
            'text-font':             ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-size':             11,
            'text-offset':           [0, 1.5],
            'text-anchor':           'top',
            'text-allow-overlap':    false,
            'text-ignore-placement': false,
          },
          paint: {
            'text-color':      '#fef3c7',
            'text-halo-color': '#000000',
            'text-halo-width': 1.5,
          },
        });

        // Venue click popup
        const handleClick = (
          e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
        ) => {
          if (!e.features?.length) return;
          const p      = e.features[0].properties as Record<string, string>;
          const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
          popupRef.current?.remove();
          popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
            .setLngLat(coords)
            .setHTML(`
              <div style="font-family:sans-serif;min-width:210px">
                <p style="font-weight:700;font-size:13px;color:${p.color};margin:0 0 5px;line-height:1.3">
                  🏈 ${p.name}
                </p>
                <p style="font-size:12px;color:#d1d5db;margin:0;line-height:1.5">${p.description}</p>
                <p style="font-size:10px;color:#6b7280;margin:6px 0 0">2026 NFL Draft · Pittsburgh</p>
              </div>
            `)
            .addTo(map);
        };

        map.on('click',      VENUE_CIRC, handleClick);
        map.on('mouseenter', VENUE_CIRC, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', VENUE_CIRC, () => { map.getCanvas().style.cursor = ''; });
      }
    };

    if (map.loaded()) init(); else map.once('load', init);

    return () => { popupRef.current?.remove(); };
  }, [map]);

  // ── Landmark HTML markers — show only at zoom ≥ 13.4 ──────────────────────
  useEffect(() => {
    const renderLandmarks = () => {
      landmarkMarkers.current.forEach(m => m.remove());
      landmarkMarkers.current = [];

      if (!visible) return;
      if (map.getZoom() < 13.4) return;

      CAMPUS_LANDMARKS.forEach(L => {
        const s  = LANDMARK_STYLES[L.type];
        const el = document.createElement('div');
        el.className = 'campus-pin';
        el.style.borderColor = s.color;
        el.style.color       = s.color;
        el.innerHTML = `<span style="font-size:10px;line-height:1">${s.icon}</span><span style="color:#F5F1E8;font-size:10.5px">${L.name}</span>`;

        landmarkMarkers.current.push(
          new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([L.lng, L.lat])
            .addTo(map)
        );
      });
    };

    if (map.loaded()) renderLandmarks(); else map.once('load', renderLandmarks);
    map.on('zoomend', renderLandmarks);

    return () => {
      landmarkMarkers.current.forEach(m => m.remove());
      map.off('zoomend', renderLandmarks);
    };
  }, [map, visible]);

  // ── Visibility toggle ──────────────────────────────────────────────────────
  useEffect(() => {
    const vis = visible ? 'visible' : 'none';
    [ZONES_FILL, ZONES_LINE, ZONES_LABEL, VENUE_CIRC, VENUE_LABEL].forEach(id => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    });
    if (!visible) {
      landmarkMarkers.current.forEach(m => m.remove());
      landmarkMarkers.current = [];
    }
  }, [map, visible]);

  return null;
}
