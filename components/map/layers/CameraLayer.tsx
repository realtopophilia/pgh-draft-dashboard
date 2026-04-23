'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSON } from 'geojson';
import type { TrafficCamera } from '@/lib/feeds/cameras';
import { ensureMapIcons } from '@/lib/map/icons';
import { P, popupWrap, popupHead, popupMeta } from '@/lib/map/popup';

const SOURCE_ID = 'traffic-cameras';
const LAYER_ID  = 'traffic-cameras-icons';
const ICON_ID   = 'camera-icon';

function camerasToGeoJSON(cams: TrafficCamera[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: cams.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      properties: {
        id: c.id,
        roadway: c.roadway,
        direction: c.direction ?? '',
        location: c.location,
        imageUrl: c.imageUrl,
      },
    })),
  };
}

interface CameraLayerProps {
  map: maplibregl.Map;
  cameras: TrafficCamera[];
  visible: boolean;
}

export default function CameraLayer({ map, cameras, visible }: CameraLayerProps) {
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
          data: camerasToGeoJSON([]),
        });
      }
      if (!map.getLayer(LAYER_ID)) {
        map.addLayer({
          id: LAYER_ID,
          type: 'symbol',
          source: SOURCE_ID,
          layout: {
            'icon-image': ICON_ID,
            'icon-size': [
              'interpolate', ['linear'], ['zoom'],
              10, 0.42, 13, 0.62, 16, 0.85,
            ],
            'icon-allow-overlap':    true,
            'icon-ignore-placement': true,
            'icon-anchor':           'bottom',
          },
        });
      }
      readyRef.current = true;

      // Push any pending data that arrived before icon loaded.
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      source?.setData(camerasToGeoJSON(cameras));
    })();

    const handleClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
    ) => {
      if (!e.features?.length) return;
      const props = e.features[0].properties;
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];

      // Cache-bust so each popup open gets a fresh frame.
      const liveSrc = `${props.imageUrl}?t=${Date.now()}`;

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '320px' })
        .setLngLat(coords)
        .setHTML(popupWrap(`
          ${popupHead(props.roadway || 'Traffic Camera', P.moss)}
          ${props.direction ? `<p style="font-size:11px;color:${P.inkMute};margin:0 0 6px;letter-spacing:.04em;text-transform:uppercase">${props.direction}</p>` : ''}
          ${props.location  ? `<p style="font-size:12px;color:${P.inkDim};margin:0 0 8px">${props.location}</p>` : ''}
          <img src="${liveSrc}" alt="Live traffic camera"
               style="display:block;width:100%;border-radius:5px;background:${P.bg};border:1px solid ${P.line}"
               onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
          <p style="display:none;color:${P.rust};font-size:11px;margin:6px 0 0">Camera offline</p>
          ${popupMeta('511PA · JPG · refreshes ~60 s')}
        `, 270))
        .addTo(map);
    };

    map.on('click', LAYER_ID, handleClick);
    map.on('mouseenter', LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', LAYER_ID, () => { map.getCanvas().style.cursor = ''; });

    return () => {
      cancelled = true;
      map.off('click', LAYER_ID, handleClick);
      popupRef.current?.remove();
    };
  }, [map]);

  useEffect(() => {
    if (!readyRef.current) return;
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(camerasToGeoJSON(cameras));
  }, [map, cameras]);

  useEffect(() => {
    if (map.getLayer(LAYER_ID)) {
      map.setLayoutProperty(LAYER_ID, 'visibility', visible ? 'visible' : 'none');
    }
  }, [map, visible]);

  return null;
}
