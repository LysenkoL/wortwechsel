import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Optional self-signed HTTPS for testing on a phone over local Wi-Fi
// (the microphone only works over HTTPS). Enabled by `npm run dev:phone` (mode "phone").
async function phoneHttps(mode: string) {
  if (mode !== 'phone') return [];
  const { default: basicSsl } = await import('@vitejs/plugin-basic-ssl');
  return [basicSsl()];
}

// GitHub Pages serves under /wortwechsel/; Netlify sets BASE_PATH=/ (see netlify.toml).
declare const process: { env: Record<string, string | undefined> };
const BASE = process.env.BASE_PATH ?? '/wortwechsel/';

export default defineConfig(async ({ mode }) => ({
  base: BASE,
  plugins: [
    react(),
    ...(await phoneHttps(mode)),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg'],
      manifest: {
        name: 'Wortwechsel',
        short_name: 'Wortwechsel',
        description: 'Aktiver Wortschatz aus der eigenen Sprache',
        lang: 'ru',
        display: 'standalone',
        id: `${BASE}app-v2`,
        start_url: BASE,
        scope: BASE,
        theme_color: '#ff5e7e',
        background_color: '#fbf6ec',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] },
    }),
  ],
  server: { host: mode === 'phone' ? true : 'localhost' },
}));
