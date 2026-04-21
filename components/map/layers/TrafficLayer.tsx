'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSON } from 'geojson';
import type { Incident } from '@/lib/feeds/traffic511';

const INC_SOURCE = 'traffic-incidents';
const INC_MAJOR  = 'incidents-major';
const INC_OTHER  = 'incidents-other';

function incidentsToGeoJSON(incidents: Incident[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: incidents.map(i => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [i.lon, i.lat] },
      properties: { id: i.id, severity: i.severity },
    })),
  };
}

interface TrafficLayerProps {
  map: maplibregl.Map;
  incidents: Incident[];
  incidentsVisible: boolean;
}

export default function TrafficLayer({ map, incidents, incidentsVisible }: TrafficLayerProps) {
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // Init sources + layers once
  useEffect(() => {
    if (!map.getSource(INC_SOURCE)) {
      map.addSource(INC_SOURCE, { type: 'geojson', data: incidentsToGeoJSON([]) });

      map.addLayer({
        id: INC_MAJOR,
        type: 'circle',
        source: INC_SOURCE,
        filter: ['==', ['get', 'severity'], 'major'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 14, 10],
          'circle-color': '#ef4444',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#7f1d1d',
          'circle-opacity': 0.9,
        },
      });

      map.addLayer({
        id: INC_OTHER,
        type: 'circle',
        source: INC_SOURCE,
        filter: ['==', ['get', 'severity'], 'other'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 7],
          'circle-color': '#f97316',
          'circle-stroke-width': 1,
          'circle-stroke-color': '#7c2d12',
          'circle-opacity': 0.85,
        },
      });

      const incClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
        if (!e.features?.length) return;
        const { id, severity } = e.features[0].properties;
        const [lon, lat] = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ maxWidth: '200px' })
          .setLngLat([lon, lat])
          .setHTML(`<div class="text-sm font-sans">
            <p class="font-semibold" style="color:${severity === 'major' ? '#ef4444' : '#f97316'}">
              ${severity === 'major' ? '⚠ Major Incident' : 'Incident'}
            </p>
            <p style="color:#9ca3af;font-size:11px">ID ${id}</p>
            <p style="font-size:10px;color:#6b7280;margin-top:4px">511PA · ~30s lag</p>
          </div>`)
          .addTo(map);
      };

      map.on('click', INC_MAJOR, incClick);
      map.on('click', INC_OTHER, incClick);
      map.on('mouseenter', INC_MAJOR, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', INC_MAJOR, () => { map.getCanvas().style.cursor = ''; });
      map.on('mouseenter', INC_OTHER, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', INC_OTHER, () => { map.getCanvas().style.cursor = ''; });
    }

    return () => { popupRef.current?.remove(); };
  }, [map]);

  // Update data
  useEffect(() => {
    (map.getSource(INC_SOURCE) as maplibregl.GeoJSONSource | undefined)
      ?.setData(incidentsToGeoJSON(incidents));
  }, [map, incidents]);

  // Visibility
  useEffect(() => {
    [INC_MAJOR, INC_OTHER].forEach(id => {
      if (map.getLayer(id))
        map.setLayoutProperty(id, 'visibility', incidentsVisible ? 'visible' : 'none');
    });
  }, [map, incidentsVisible]);

  return null;
}
