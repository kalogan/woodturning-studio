import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import glsl from 'vite-plugin-glsl';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [react(), glsl()],
  build: {
    // Multi-page build: emit BOTH the product (index.html) and the prop
    // preview harness (preview.html) into dist/, so the harness ships to the
    // same Vercel deploy and is reachable at /preview.html. The harness is a
    // SEPARATE entry — its chunk is only loaded by preview.html and is never
    // imported by the product's index.html bundle (keeps the product bundle
    // clean per PREVIEW_HARNESS.md, while co-deploying for easy access).
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        preview: resolve(root, 'preview.html'),
      },
    },
  },
  server: {
    https: false, // localhost is sufficient for getUserMedia in Chrome
    // Honor a PORT injected by tooling (e.g. preview harness); fall back to Vite default.
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
