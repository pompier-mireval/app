import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Base = nom du repo GitHub, car GitHub Pages sert le site depuis
// https://pompier-mireval.github.io/app/ et pas depuis la racine.
export default defineConfig({
  base: '/app/',
  build: {
    rollupOptions: {
      output: {
        // Bibliothèques stables à part : elles restent en cache entre deux
        // déploiements, seul le code de l'application est retéléchargé.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
          qrcode: ['html5-qrcode'],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-128.webp', 'apple-touch-icon.png'],
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
        // Gros morceaux chargés à la demande (scan de code, lecture de PDF) :
        // pas dans le pré-cache, qui se télécharge en tâche de fond dès la
        // première visite et ralentirait le réseau d'un téléphone.
        globIgnores: ['**/pdf-*.js', '**/pdf.worker*', '**/qrcode-*.js', '**/logo.jpg'],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/(pdf|pdf\.worker|qrcode)[^/]*\.m?js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'lazy-chunks', expiration: { maxEntries: 8 } },
          },
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
