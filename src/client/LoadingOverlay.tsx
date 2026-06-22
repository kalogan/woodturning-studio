/**
 * LoadingOverlay — full-screen DOM overlay shown while a heavy 3D scene
 * first mounts. Entering the workshop synchronously builds a lot of
 * procedural geometry (~3–4 s); without this the screen reads as a frozen
 * blank. This overlay paints BEFORE that freeze (see App.tsx deferred-mount
 * mechanism) so the wait looks intentional.
 *
 * Pure DOM — lives outside the R3F <Canvas>. No per-frame work here.
 */

import type React from 'react';

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 1000,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 20,
  background: '#141414',
  color: '#e0e0e0',
  fontFamily: 'sans-serif',
  fontSize: 16,
  letterSpacing: '0.02em',
  // Don't intercept anything once it begins to fade; it's removed from the
  // tree on hide anyway, but be defensive.
  pointerEvents: 'none',
};

const spinnerStyle: React.CSSProperties = {
  width: 44,
  height: 44,
  borderRadius: '50%',
  border: '4px solid #3a3a3a',
  borderTopColor: '#c98a3a',
  animation: 'ws-loading-spin 0.9s linear infinite',
};

/**
 * Keyframes are injected once via a module-level <style> string. Inline
 * styles can't express @keyframes, so we render a <style> tag alongside.
 */
const keyframes = `@keyframes ws-loading-spin { to { transform: rotate(360deg); } }`;

export function LoadingOverlay(): React.ReactElement {
  return (
    <div style={overlayStyle} aria-busy="true" role="status">
      <style>{keyframes}</style>
      <div style={spinnerStyle} />
      <div>Loading workshop…</div>
    </div>
  );
}
