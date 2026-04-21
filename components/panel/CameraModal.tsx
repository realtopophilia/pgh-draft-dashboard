'use client';

import { useEffect, useState, useCallback } from 'react';
import type { Camera } from '@/lib/feeds/traffic511';

interface CameraModalProps {
  camera: Camera;
  onClose: () => void;
}

export default function CameraModal({ camera, onClose }: CameraModalProps) {
  const [imgSrc, setImgSrc] = useState(() =>
    `/api/traffic/cameras/${camera.id}/image`
  );
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const refresh = useCallback(() => {
    setImgSrc(`/api/traffic/cameras/${camera.id}/image?t=${Date.now()}`);
    setLastRefresh(new Date());
  }, [camera.id]);

  // Refresh image every 30 seconds
  useEffect(() => {
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [refresh]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden max-w-xl w-full mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div>
            <p className="text-sm font-semibold text-white">{camera.name}</p>
            <p className="text-xs text-gray-400">{camera.road} · {camera.direction}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white text-xl leading-none px-1"
          >×</button>
        </div>

        {/* Camera image */}
        <div className="relative bg-black aspect-video">
          <img
            src={imgSrc}
            alt={`Traffic camera: ${camera.name}`}
            className="w-full h-full object-contain"
            onError={() => setImgSrc('/camera-error.svg')}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            Updated {lastRefresh.toLocaleTimeString('en-US',
              { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
            · Near-real-time · ~30s lag
          </p>
          <button
            onClick={refresh}
            className="text-xs text-amber-400 hover:text-amber-300"
          >Refresh now</button>
        </div>
      </div>
    </div>
  );
}
