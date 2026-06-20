/**
 * tint.test.ts — the no-bleed invariant for the harness tint override.
 *
 * The critical guarantee: tinting a prop must NOT mutate the SHARED material it
 * uses, because that material is also attached to other props/meshes. We assert
 * the shared material's colour is untouched while tinted, and is restored on
 * tint-off — even when two meshes share one material instance.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { restoreGroup, tintGroup, tintMesh, restoreMesh } from './tint.js';

describe('tint clone/restore — no bleed across shared materials', () => {
  it('does not mutate the shared material when tinting', () => {
    const shared = new THREE.MeshStandardMaterial({ color: '#112233' });
    const sharedHex = shared.color.getHex();

    const meshA = new THREE.Mesh(new THREE.BoxGeometry(), shared);
    const meshB = new THREE.Mesh(new THREE.BoxGeometry(), shared); // SAME instance

    tintMesh(meshA, new THREE.Color('#ff0000'));

    // The shared instance is unchanged; meshB (untouched) still wears it.
    expect(shared.color.getHex()).toBe(sharedHex);
    expect(meshB.material).toBe(shared);

    // meshA now wears a CLONE, recoloured.
    expect(meshA.material).not.toBe(shared);
    expect(meshA.material.color.getHex()).toBe(0xff0000);
  });

  it('restores the original shared material and forgets the clone', () => {
    const shared = new THREE.MeshStandardMaterial({ color: '#112233' });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), shared);

    tintMesh(mesh, new THREE.Color('#00ff00'));
    expect(mesh.material).not.toBe(shared);

    restoreMesh(mesh);
    expect(mesh.material).toBe(shared);
    expect(shared.color.getHex()).toBe(0x112233);
    expect(mesh.userData.__origMat).toBeUndefined();
  });

  it('switching props (group restore) leaves the sibling prop uncoloured', () => {
    // Two props share ONE material instance (the real-world footgun).
    const shared = new THREE.MeshStandardMaterial({ color: '#888888' });
    const propGroup = new THREE.Group();
    propGroup.add(new THREE.Mesh(new THREE.BoxGeometry(), shared));

    const siblingMesh = new THREE.Mesh(new THREE.BoxGeometry(), shared);

    // Tint the active prop, then "switch away" (restore its group).
    tintGroup(propGroup, new THREE.Color('#0000ff'));
    expect(shared.color.getHex()).toBe(0x888888); // shared never touched
    restoreGroup(propGroup);

    // Sibling still wears the pristine shared material.
    expect(siblingMesh.material).toBe(shared);
    expect(siblingMesh.material.color.getHex()).toBe(0x888888);
  });

  it('tintMesh is idempotent — re-tint reuses the same clone (no leak chain)', () => {
    const shared = new THREE.MeshStandardMaterial({ color: '#101010' });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), shared);

    tintMesh(mesh, new THREE.Color('#ff0000'));
    const firstClone = mesh.material;
    tintMesh(mesh, new THREE.Color('#00ff00'));
    expect(mesh.material).toBe(firstClone); // still the same clone, recoloured
    expect(mesh.material.color.getHex()).toBe(0x00ff00);
    expect(mesh.userData.__origMat).toBe(shared); // original still the shared one
  });
});
