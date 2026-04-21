import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // Prevent maplibre-gl from trying to import canvas in Node/server contexts
      canvas: { browser: 'canvas', default: './lib/canvas-stub.ts' },
    },
  },
};

export default nextConfig;
