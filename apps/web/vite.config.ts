import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'],
      manifest: {
        name: 'CONTRO · obras da contorno',
        short_name: 'CONTRO',
        description: 'Planeje e acompanhe as obras das unidades Contorno do Corpo.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f6f6',
        theme_color: '#181818',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Não precachear os SVGs de marca (PNG embutido pesado). Só o essencial.
        globPatterns: ['**/*.{js,css,html,woff,woff2}', 'icons/*.png'],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
