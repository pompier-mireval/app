import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Base = nom du repo GitHub, car GitHub Pages sert le site depuis
// https://pompier-mireval.github.io/app/ et pas depuis la racine.
export default defineConfig({
  base: '/app/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.jpg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Caserne Mireval',
        short_name: 'Caserne',
        description: 'Planning et gestion de la caserne de Mireval',
        lang: 'fr',
        start_url: '/app/',
        scope: '/app/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#c8102e',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/app/index.html',
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
