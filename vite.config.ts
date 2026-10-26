import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Finance-Achievement/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png'],
      manifest: {
        id: './',
        name: '我的理財手帳｜粉紅小豬',
        short_name: '小豬理財',
        description: '記錄儲蓄、收入與投資基金，登入後跨裝置同步。',
        lang: 'zh-Hant',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#fff1f5',
        background_color: '#ffffff',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        // Only this app's static shell is cached. Auth/API/financial responses are never cached.
        navigateFallbackDenylist: [/\/auth\//, /\/rest\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
      },
    }),
  ],
  build: {
    rollupOptions: { output: { manualChunks: { validation: ['zod'] } } },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
  },
}))
