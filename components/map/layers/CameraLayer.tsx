'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSON } from 'geojson';
import type { TrafficCamera } from '@/lib/feeds/cameras';

const SOURCE_ID = 'traffic-cameras';
const LAYER_ID = 'traffic-cameras-icons';
const ICON_ID = 'camera-marker';

const CAMERA_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
  <circle cx="18" cy="18" r="14" fill="#10b981" stroke="#064e3b" stroke-width="2"/>
  <path d="M13 14h3l1.5-2h3L22 14h3v10H11V14h2zm5 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
        fill="#052e1a"/>
</svg>`.trim();

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

async function loadCameraIcon(map: maplibregl.Map): Promise<void> {
  if (map.hasImage(ICON_ID)) return;
  const blob = new Blob([CAMERA_SVG], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image(36, 36);
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('camera icon failed'));
      img.src = url;
    });
    if (!map.hasImage(ICON_ID)) map.addImage(ICON_ID, img);
  } finally {
    URL.revokeObjectURL(url);
  }
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
      await loadCameraIcon(map);
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
              10, 0.4, 13, 0.6, 16, 0.85,
            ],
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
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
        .setHTML(
          `<div class="text-sm font-sans" style="min-width:260px;max-width:300px">
            <p class="font-semibold" style="color:#10b981;font-size:12px;text-transform:uppercase;letter-spacing:0.05em">
              ${props.roadway || 'Traffic camera'}${props.direction ? ` · ${props.direction}` : ''}
            </p>
            <p style="color:#d1d5db;font-size:12px;margin-top:2px">${props.location || ''}</p>
            <img src="${liveSrc}" alt="Live traffic camera"
                 style="display:block;width:100%;margin-top:8px;border-radius:4px;background:#111"
                 onerror="this.style.display='none';this.nextElementSibling.style.display='block'" />
            <p style="display:none;color:#f87171;font-size:11px;margin-top:6px">Camera offline</p>
            <p style="font-size:10px;color:#6b7280;margin-top:6px">511PA · JPG refreshes ~60s</p>
          </div>`
        )
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
