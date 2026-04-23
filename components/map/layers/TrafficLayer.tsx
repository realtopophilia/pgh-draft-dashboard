'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSON } from 'geojson';
import type { Incident } from '@/lib/feeds/traffic511';
import { ensureMapIcons } from '@/lib/map/icons';
import { P, popupWrap, popupHead, popupMeta } from '@/lib/map/popup';

const INC_SOURCE = 'traffic-incidents';
const INC_LAYER  = 'incidents-symbol';

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
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await ensureMapIcons(map);
      if (cancelled) return;

      if (!map.getSource(INC_SOURCE)) {
        map.addSource(INC_SOURCE, { type: 'geojson', data: incidentsToGeoJSON([]) });
      }
      if (!map.getLayer(INC_LAYER)) {
        map.addLayer({
          id:     INC_LAYER,
          type:   'symbol',
          source: INC_SOURCE,
          layout: {
            'icon-image': 'incident-icon',
            // Major incidents render larger
            'icon-size': [
              'interpolate', ['linear'], ['zoom'],
              10, ['match', ['get', 'severity'], 'major', 0.55, 0.42],
              13, ['match', ['get', 'severity'], 'major', 0.80, 0.60],
              15, ['match', ['get', 'severity'], 'major', 1.00, 0.75],
            ],
            'icon-allow-overlap':    true,
            'icon-ignore-placement': true,
            'icon-anchor':           'bottom',
          },
        });
      }
      readyRef.current = true;
      (map.getSource(INC_SOURCE) as maplibregl.GeoJSONSource | undefined)
        ?.setData(incidentsToGeoJSON(incidents));
    })();

    const incClick = (e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }) => {
      if (!e.features?.length) return;
      const { id, severity } = e.features[0].properties;
      const [lon, lat] = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
      const band = severity === 'major' ? P.rust : P.amber;
      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ maxWidth: '220px' })
        .setLngLat([lon, lat])
        .setHTML(popupWrap(`
          ${popupHead(severity === 'major' ? 'Major Incident' : 'Incident', band)}
          <p style="font-size:11px;color:${P.inkMute};margin:0">ID ${id}</p>
          ${popupMeta('511PA · ~30 s lag')}
        `))
        .addTo(map);
    };

    map.on('click', INC_LAYER, incClick);
    map.on('mouseenter', INC_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', INC_LAYER, () => { map.getCanvas().style.cursor = ''; });

    return () => {
      cancelled = true;
      popupRef.current?.remove();
    };
  }, [map]);

  useEffect(() => {
    if (!readyRef.current) return;
    (map.getSource(INC_SOURCE) as maplibregl.GeoJSONSource | undefined)
      ?.setData(incidentsToGeoJSON(incidents));
  }, [map, incidents]);

  useEffect(() => {
    if (map.getLayer(INC_LAYER))
      map.setLayoutProperty(INC_LAYER, 'visibility', incidentsVisible ? 'visible' : 'none');
  }, [map, incidentsVisible]);

  return null;
}
