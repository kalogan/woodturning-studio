/**
 * main.tsx — preview harness entry (PREVIEW_HARNESS.md §A).
 *
 * Mirrors src/main.tsx but mounts <PreviewApp /> instead of the product <App />.
 * Loaded only by preview.html, so the harness shell + preview.css never reach the
 * product bundle.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PreviewApp } from './PreviewApp.js';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element found');
createRoot(root).render(
  <StrictMode>
    <PreviewApp />
  </StrictMode>,
);
