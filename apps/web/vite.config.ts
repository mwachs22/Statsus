import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.svg'],
      manifest: {
        name: 'Statsus',
        short_name: 'Statsus',
        description: 'Self-hosted webmail — mail, calendar, and contacts in one place.',
        theme_color: '#1e293b',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: '/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache all built JS, CSS, HTML, fonts, and SVG assets
        globPatterns: ['**/*.{js,css,html,svg,woff2,ico}'],

        // Runtime caching strategies
        runtimeCaching: [
          // API reads: NetworkFirst so you always get fresh data when online,
          // but fall back to cached response when offline
          {
            urlPattern: /^\/api\/(messages\/threads|messages\/thread|calendar\/events|contacts|todos|snippets|filters)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-reads',
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Google Fonts: CacheFirst (essentially immutable)
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
      // Dev mode: generate SW in development for easier testing
      devOptions: {
        enabled: false,
      },
    }),
  ],

  resolve: {
    alias: {
      '@statsus/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
