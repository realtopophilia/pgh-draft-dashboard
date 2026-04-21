'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSON } from 'geojson';
import type { TransitVehicle } from '@/lib/feeds/prt';

const SOURCE_ID = 'transit-vehicles';
const BUS_LAYER_ID = 'transit-buses';
const TRAIN_LAYER_ID = 'transit-trains';

function vehiclesToGeoJSON(vehicles: TransitVehicle[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: vehicles.map((v) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
      properties: {
        id: v.id,
        type: v.type,
        route: v.route,
        label: v.label,
        bearing: v.bearing,
        speedMph: v.speedMph,
        timestamp: v.timestamp,
      },
    })),
  };
}

interface TransitLayerProps {
  map: maplibregl.Map;
  vehicles: TransitVehicle[];
  visible: boolean;
}

export default function TransitLayer({ map, vehicles, visible }: TransitLayerProps) {
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // Initialize source and layers once
  useEffect(() => {
    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: vehiclesToGeoJSON([]),
        // Cluster nearby vehicles when zoomed out
        cluster: true,
        clusterMaxZoom: 9,
        clusterRadius: 40,
      });

      // Clustered circles
      map.addLayer({
        id: 'transit-clusters',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#f59e0b',
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 30, 22],
          'circle-opacity': 0.85,
          'circle-stroke-width': 1,
          'circle-stroke-color': '#fff',
        },
      });


      // Individual buses
      map.addLayer({
        id: BUS_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'type'], 'bus']],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            10, 3, 13, 5, 15, 7,
          ],
          'circle-color': '#f59e0b',   // amber = PRT bus
          'circle-stroke-width': 1,
          'circle-stroke-color': '#92400e',
          'circle-opacity': 0.9,
        },
      });

      // Individual trains (light rail)
      map.addLayer({
        id: TRAIN_LAYER_ID,
        type: 'circle',
        source: SOURCE_ID,
        filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'type'], 'train']],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            10, 5, 13, 7, 15, 9,
          ],
          'circle-color': '#3b82f6',   // blue = light rail
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#1e3a8a',
          'circle-opacity': 0.95,
        },
      });
    }

    // Click popup for individual vehicles
    const handleClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
    ) => {
      if (!e.features?.length) return;
      const props = e.features[0].properties;
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '200px' })
        .setLngLat(coords)
        .setHTML(
          `<div class="text-sm font-sans">
            <p class="font-semibold">Route ${props.route || '—'}</p>
            <p class="text-gray-500">Vehicle ${props.label}</p>
            <p>${props.speedMph} mph · ${props.bearing}°</p>
            <p class="text-xs text-gray-400 mt-1">Near-real-time · ~20s lag</p>
          </div>`
        )
        .addTo(map);
    };

    map.on('click', BUS_LAYER_ID, handleClick);
    map.on('click', TRAIN_LAYER_ID, handleClick);
    map.on('mouseenter', BUS_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', BUS_LAYER_ID, () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', TRAIN_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', TRAIN_LAYER_ID, () => { map.getCanvas().style.cursor = ''; });

    return () => {
      popupRef.current?.remove();
    };
  }, [map]);

  // Update vehicle positions when data changes
  useEffect(() => {
    const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    source?.setData(vehiclesToGeoJSON(vehicles));
  }, [map, vehicles]);

  // Toggle layer visibility
  useEffect(() => {
    const vis = visible ? 'visible' : 'none';
    const layers = [BUS_LAYER_ID, TRAIN_LAYER_ID, 'transit-clusters', 'transit-cluster-count'];
    layers.forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', vis);
    });
  }, [map, visible]);

  return null; // renders via MapLibre, not React DOM
}
