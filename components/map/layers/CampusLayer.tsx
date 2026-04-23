'use client';

import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { DRAFT_SITES } from '@/lib/data/draftCampus';
import { P, popupWrap, popupMeta } from '@/lib/map/popup';

interface CampusLayerProps {
  map:     maplibregl.Map;
  visible: boolean;
}

export default function CampusLayer({ map, visible }: CampusLayerProps) {
  const popupRef  = useRef<maplibregl.Popup | null>(null);
  const markerRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => {
    // Remove any old markers first
    markerRef.current.forEach(m => m.remove());
    markerRef.current = [];

    DRAFT_SITES.forEach(site => {
      // ── Pin chip element ───────────────────────────────────────────────────
      const el = document.createElement('div');
      el.className = 'campus-pin';
      el.style.borderColor = site.color;
      el.style.color       = site.color;
      el.innerHTML = `
        <span style="font-size:12px;line-height:1">${site.icon}</span>
        <span style="color:#F5F1E8;font-size:10.5px;font-weight:600">${site.name}</span>
      `;
      el.style.cursor = 'pointer';

      // ── Popup on click ─────────────────────────────────────────────────────
      el.addEventListener('click', () => {
        popupRef.current?.remove();
        popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: '260px' })
          .setLngLat([site.lon, site.lat])
          .setHTML(popupWrap(`
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
              <span style="font-size:14px;line-height:1">${site.icon}</span>
              <p style="font-weight:700;font-size:13px;color:${P.ink};margin:0;line-height:1.25">${site.name}</p>
            </div>
            <p style="font-size:12px;color:${P.inkDim};margin:0;line-height:1.55">${site.description}</p>
            ${popupMeta('2026 NFL Draft · Pittsburgh')}
          `, 220))
          .addTo(map);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([site.lon, site.lat])
        .addTo(map);

      markerRef.current.push(marker);
    });

    return () => {
      popupRef.current?.remove();
      markerRef.current.forEach(m => m.remove());
      markerRef.current = [];
    };
  }, [map]);

  // Visibility toggle
  useEffect(() => {
    markerRef.current.forEach(m => {
      const el = m.getElement();
      el.style.display = visible ? '' : 'none';
    });
    if (!visible) popupRef.current?.remove();
  }, [visible]);

  return null;
}
