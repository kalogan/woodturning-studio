import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  plugins: [react(), glsl()],
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
