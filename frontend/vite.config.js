import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Dev server runs on :5173 and talks to the PHP API served by XAMPP on :80.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Ala Eh! Inventory & Monitoring',
        short_name: 'Ala Eh! Inventory',
        description: 'Production, Packing and Logistics inventory tracking for Ala Eh Product Ventures.',
        theme_color: '#16211B',
        background_color: '#E7E1CB',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        // App shell (HTML/JS/CSS) is precached automatically so the Logistics
        // pages still load with no connection - see navigateFallback below.
        // The API is a different origin (XAMPP on :80 vs the Vite app), so
        // it's not precached; only these read-only lookups get a runtime
        // cache, since serving them stale is harmless (unlike a write).
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' && (url.pathname === '/api/products' || url.pathname === '/api/units'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'picker-data',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    open: true,
  },
});
