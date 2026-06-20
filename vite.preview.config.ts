/**
 * vite.preview.config.ts — static, server-less build of the PREVIEW HARNESS only
 * (PREVIEW_HARNESS.md §A / §E).
 *
 * Builds ONLY preview.html (the harness entry), emits it as index.html with
 * relative asset URLs (base: './') into dist-preview/, so the gallery deploys to
 * any static host at "/". The product index.html is never pulled into this build.
 */
import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import glsl from 'vite-plugin-glsl';

/**
 * Rename the emitted preview.html to index.html so the static bundle is served
 * at "/" by any host with no rewrite rules (PREVIEW_HARNESS.md §E).
 */
function emitAsIndexHtml(): Plugin {
  return {
    name: 'preview-emit-as-index-html',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const html = bundle['preview.html'];
      if (html && html.type === 'asset') {
        html.fileName = 'index.html';
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), glsl(), emitAsIndexHtml()],
  base: './',
  build: {
    outDir: 'dist-preview',
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL('./preview.html', import.meta.url)),
    },
  },
});
