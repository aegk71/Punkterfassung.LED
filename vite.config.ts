import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/Punkterfassung.LED/',
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/lethe-logo.jpg'],
      manifest: {
        name: 'Punkterfassung',
        short_name: 'Punkterfassung',
        description: 'Punkterfassung an Bord (LETHE)',
        lang: 'de',
        start_url: '/Punkterfassung.LED/',
        scope: '/Punkterfassung.LED/',
        display: 'standalone',
        background_color: '#f6f7f9',
        theme_color: '#143868',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,jpg,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
})
