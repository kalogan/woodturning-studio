/**
 * rpmFormat.test.ts — unit tests for the RPM display helper.
 */

import { describe, it, expect } from 'vitest';
import { formatRpm } from './rpmFormat.js';

describe('formatRpm — rounding', () => {
  it('rounds 0.4 down to 0', () => {
    expect(formatRpm(0.4)).toBe('0');
  });

  it('rounds 0.5 up to 1', () => {
    expect(formatRpm(0.5)).toBe('1');
  });

  it('rounds 1199.4 down to 1199', () => {
    expect(formatRpm(1199.4)).toBe('1199');
  });

  it('rounds 1199.6 up to 1200', () => {
    expect(formatRpm(1199.6)).toBe('1200');
  });

  it('rounds 3199.9 up to 3200', () => {
    expect(formatRpm(3199.9)).toBe('3200');
  });

  it('leaves an exact integer unchanged', () => {
    expect(formatRpm(800)).toBe('800');
  });
});

describe('formatRpm — negative clamping', () => {
  it('clamps -1 to 0', () => {
    expect(formatRpm(-1)).toBe('0');
  });

  it('clamps -0.1 to 0', () => {
    expect(formatRpm(-0.1)).toBe('0');
  });

  it('clamps -3200 to 0', () => {
    expect(formatRpm(-3200)).toBe('0');
  });

  it('leaves 0 as 0', () => {
    expect(formatRpm(0)).toBe('0');
  });
});

describe('formatRpm — boundary and typical values', () => {
  it('returns "0" at rest', () => {
    expect(formatRpm(0)).toBe('0');
  });

  it('returns the max RPM as a plain string', () => {
    expect(formatRpm(3200)).toBe('3200');
  });

  it('returns "600" for a common low-speed setting', () => {
    expect(formatRpm(600)).toBe('600');
  });

  it('returns a plain decimal string (no padding)', () => {
    const result = formatRpm(42);
    expect(result).toBe('42');
    // Ensure no leading spaces or zeroes
    expect(result.startsWith(' ')).toBe(false);
    expect(result).not.toMatch(/^0\d/);
  });
});
