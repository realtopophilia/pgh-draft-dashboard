'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import type { GeoJSON } from 'geojson';
import type { TransitVehicle } from '@/lib/feeds/prt';
import { ensureMapIcons } from '@/lib/map/icons';
import { P, popupWrap, popupHead, popupMeta } from '@/lib/map/popup';

const SOURCE_ID      = 'transit-vehicles';
const BUS_LAYER_ID   = 'transit-buses';
const TRAIN_LAYER_ID = 'transit-trains';
const CLUSTER_ID     = 'transit-clusters';
const CLUSTER_TEXT   = 'transit-clusters-text';

function vehiclesToGeoJSON(vehicles: TransitVehicle[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: vehicles.map((v) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
      properties: {
        id:        v.id,
        type:      v.type,
        route:     v.route,
        label:     v.label,
        bearing:   v.bearing,
        speedMph:  v.speedMph,
        timestamp: v.timestamp,
        // Pressure-aware icon: stopped=red, slow=amber, moving=gold
        icon: v.type === 'train' ? 'train-icon'
            : v.speedMph < 3    ? 'bus-stopped'
            : v.speedMph < 10   ? 'bus-slow'
            : 'bus-moving',
      },
    })),
  };
}

interface TransitLayerProps {
  map:          maplibregl.Map;
  vehicles:     TransitVehicle[];
  busVisible:   boolean;
  trainVisible: boolean;
}

export default function TransitLayer({ map, vehicles, busVisible, trainVisible }: TransitLayerProps) {
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await ensureMapIcons(map);
      if (cancelled) return;

      if (!map.getSource(SOURCE_ID)) {
        map.addSource(SOURCE_ID, {
          type:           'geojson',
          data:           vehiclesToGeoJSON([]),
          cluster:        true,
          clusterMaxZoom: 9,
          clusterRadius:  40,
        });

        // Cluster "chips" — gold rounded pills with count
        map.addLayer({
          id:     CLUSTER_ID,
          type:   'circle',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          paint: {
            'circle-color':        '#FFCE1F',
            'circle-radius':       ['step', ['get', 'point_count'], 14, 10, 18, 30, 22],
            'circle-opacity':      0.92,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#1A1814',
          },
        });
        map.addLayer({
          id:     CLUSTER_TEXT,
          type:   'symbol',
          source: SOURCE_ID,
          filter: ['has', 'point_count'],
          layout: {
            'text-field':        ['get', 'point_count_abbreviated'],
            'text-font':         ['Open Sans Bold','Arial Unicode MS Bold'],
            'text-size':         12,
            'text-allow-overlap':true,
          },
          paint:  { 'text-color': '#1A1814' },
        });

        // Individual buses — pressure-aware icon + size
        map.addLayer({
          id:     BUS_LAYER_ID,
          type:   'symbol',
          source: SOURCE_ID,
          filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'type'], 'bus']],
          layout: {
            'icon-image': ['get', 'icon'],
            // Stopped buses render ~30% larger — they're creating congestion
            'icon-size': [
              'interpolate', ['linear'], ['zoom'],
              10, ['match', ['get', 'icon'], 'bus-stopped', 0.42, 'bus-slow', 0.36, 0.32],
              12, ['match', ['get', 'icon'], 'bus-stopped', 0.58, 'bus-slow', 0.50, 0.45],
              14, ['match', ['get', 'icon'], 'bus-stopped', 0.78, 'bus-slow', 0.68, 0.60],
              16, ['match', ['get', 'icon'], 'bus-stopped', 1.00, 'bus-slow', 0.88, 0.78],
            ],
            'icon-allow-overlap':    true,
            'icon-ignore-placement': true,
            'icon-anchor':           'bottom',
          },
        });

        // Individual trains
        map.addLayer({
          id:     TRAIN_LAYER_ID,
          type:   'symbol',
          source: SOURCE_ID,
          filter: ['all', ['!', ['has', 'point_count']], ['==', ['get', 'type'], 'train']],
          layout: {
            'icon-image': 'train-icon',
            'icon-size': [
              'interpolate', ['linear'], ['zoom'],
              10, 0.42, 12, 0.56, 14, 0.75, 16, 0.95,
            ],
            'icon-allow-overlap':    true,
            'icon-ignore-placement': true,
            'icon-anchor':           'bottom',
          },
        });
      }
      readyRef.current = true;
      (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)
        ?.setData(vehiclesToGeoJSON(vehicles));
    })();

    // Click popup for individual vehicles
    const handleClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] }
    ) => {
      if (!e.features?.length) return;
      const props  = e.features[0].properties as Record<string, unknown>;
      const coords = (e.features[0].geometry as GeoJSON.Point).coordinates as [number, number];
      const band = props.type === 'bus' ? P.gold : P.steel;
      const speedLabel = Number(props.speedMph) > 0
        ? `${props.speedMph} mph · ${props.bearing}°`
        : null;
      const pressureNote = props.icon === 'bus-stopped' ? `<p style="font-size:11px;color:${P.rust};margin:3px 0 0;font-weight:600">⚠ Stopped / delayed</p>`
        : props.icon === 'bus-slow'    ? `<p style="font-size:11px;color:${P.amber};margin:3px 0 0">Moving slowly</p>`
        : '';

      popupRef.current?.remove();
      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '220px' })
        .setLngLat(coords)
        .setHTML(popupWrap(`
          ${popupHead(props.route ? `Route ${props.route}` : 'No route', band)}
          <p style="font-size:11px;color:${P.inkMute};margin:0">Vehicle ${props.label}</p>
          ${speedLabel ? `<p style="font-size:12px;color:${P.inkDim};margin:3px 0 0">${speedLabel}</p>` : `<p style="font-size:12px;color:${P.inkMute};margin:3px 0 0">Stopped</p>`}
          ${pressureNote}
          ${popupMeta('PRT GTFS-RT · ~20 s lag')}
        `))
        .addTo(map);
    };

    map.on('click', BUS_LAYER_ID,   handleClick);
    map.on('click', TRAIN_LAYER_ID, handleClick);
    map.on('mouseenter', BUS_LAYER_ID,   () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', BUS_LAYER_ID,   () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', TRAIN_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', TRAIN_LAYER_ID, () => { map.getCanvas().style.cursor = ''; });

    // Click cluster → zoom in
    map.on('click', CLUSTER_ID, (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: [CLUSTER_ID] });
      const clusterId = features[0]?.properties?.cluster_id;
      if (clusterId == null) return;
      const src = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
      src.getClusterExpansionZoom(clusterId).then(zoom => {
        const coords = (features[0].geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({ center: coords, zoom });
      }).catch(() => {});
    });
    map.on('mouseenter', CLUSTER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', CLUSTER_ID, () => { map.getCanvas().style.cursor = ''; });

    return () => {
      cancelled = true;
      popupRef.current?.remove();
    };
  }, [map]);

  // Update vehicle positions when data changes
  useEffect(() => {
    if (!readyRef.current) return;
    (map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined)
      ?.setData(vehiclesToGeoJSON(vehicles));
  }, [map, vehicles]);

  // Toggle layer visibility independently
  useEffect(() => {
    if (map.getLayer(BUS_LAYER_ID))
      map.setLayoutProperty(BUS_LAYER_ID, 'visibility', busVisible ? 'visible' : 'none');
    if (map.getLayer(CLUSTER_ID))
      map.setLayoutProperty(CLUSTER_ID, 'visibility', (busVisible || trainVisible) ? 'visible' : 'none');
    if (map.getLayer(CLUSTER_TEXT))
      map.setLayoutProperty(CLUSTER_TEXT, 'visibility', (busVisible || trainVisible) ? 'visible' : 'none');
  }, [map, busVisible, trainVisible]);

  useEffect(() => {
    if (map.getLayer(TRAIN_LAYER_ID))
      map.setLayoutProperty(TRAIN_LAYER_ID, 'visibility', trainVisible ? 'visible' : 'none');
  }, [map, trainVisible]);

  return null;
}
