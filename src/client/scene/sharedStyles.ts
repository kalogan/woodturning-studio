/**
 * sharedStyles — shared CSS-in-JS style objects used across overlay components.
 *
 * Extracted from App.tsx so each overlay can import what it needs without
 * duplicating the definitions.
 */

import type React from 'react';

export const hudStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 32,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 50,
  display: 'flex',
  gap: 12,
  alignItems: 'center',
  background: 'rgba(26,26,26,0.85)',
  borderRadius: 8,
  padding: '12px 20px',
  fontFamily: 'sans-serif',
  fontSize: 14,
  color: '#e0e0e0',
};

export const kbdStyle: React.CSSProperties = {
  display: 'inline-block',
  background: '#444',
  color: '#fff',
  borderRadius: 4,
  padding: '1px 6px',
  fontFamily: 'monospace',
  fontSize: 13,
  border: '1px solid #666',
};

export const escapeBtnStyle: React.CSSProperties = {
  padding: '8px 14px',
  background: 'transparent',
  color: '#888',
  border: '1px solid #444',
  borderRadius: 6,
  fontSize: 13,
  cursor: 'pointer',
};
