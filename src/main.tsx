import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './client/App.js';
import WorkshopPreview from './client/WorkshopPreview.js';

// TEMP: preview the workshop+lathe geometry. Flip back to <App /> after eyeball pass.
const PREVIEW: boolean = true;

const root = document.getElementById('root');
if (!root) throw new Error('No #root element found');
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
const activeApp = PREVIEW ? <WorkshopPreview /> : <App />;
createRoot(root).render(<StrictMode>{activeApp}</StrictMode>);
