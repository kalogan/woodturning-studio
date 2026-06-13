import { describe, it, expect } from 'vitest';
import { createWoodState, tickPhysics } from './physics.js';

describe('createWoodState', () => {
  it('creates a cylindrical blank with uniform profile', () => {
    const state = createWoodState(0.3, 0.05);
    expect(state.profile.every(r => Math.abs(r - 0.05) < 1e-6)).toBe(true);
    expect(state.tearout.every(t => t === 0)).toBe(true);
  });
});

describe('tickPhysics', () => {
  it('removes material on a clean bevel-contact cut', () => {
    const state = createWoodState(0.3, 0.05);
    const before = state.profile[32] ?? 0;
    tickPhysics(state, { position: { x: 0, y: 0, z: 0 }, angleX: 0.3, angleY: 0, pressure: 1 }, 'roughing-gouge', 16);
    expect(state.profile[32] ?? 0).toBeLessThan(before);
  });

  it('triggers a catch on steep angle with high pressure', () => {
    const state = createWoodState(0.3, 0.05);
    const result = tickPhysics(state, { position: { x: 0, y: 0, z: 0 }, angleX: 1.2, angleY: 0, pressure: 0.8 }, 'roughing-gouge', 16);
    expect(result.catch).toBe(true);
  });

  it('records tearout when cutting against grain', () => {
    const state = createWoodState(0.3, 0.05);
    tickPhysics(state, { position: { x: 0, y: 0, z: 0 }, angleX: 0.3, angleY: -0.5, pressure: 1 }, 'spindle-gouge', 16);
    expect(state.tearout[32] ?? 0).toBeGreaterThan(0);
  });

  it('does not mutate outside valid station bounds', () => {
    const state = createWoodState(0.3, 0.05);
    const snapshot = Float32Array.from(state.profile);
    // z far outside blank range
    tickPhysics(state, { position: { x: 0, y: 0, z: 99 }, angleX: 0.3, angleY: 0, pressure: 1 }, 'roughing-gouge', 16);
    expect(state.profile).toEqual(snapshot);
  });
});
