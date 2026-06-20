/**
 * tint.ts — material clone/restore helpers for the harness tint override.
 *
 * HARNESS-ONLY. The workshop props attach SHARED module-scope
 * MeshStandardMaterial instances across many meshes/props. Tinting must NOT
 * mutate those shared materials (that would bleed colour into every other prop),
 * so on tint we CLONE per-mesh, stash the original on `mesh.userData.__origMat`,
 * and recolour the clone. On tint-off / prop-switch / unmount we restore the
 * original and dispose the clone. These helpers hold that invariant; they are
 * unit-tested in tint.test.ts.
 */
import * as THREE from 'three';

interface TintedMaterialUserData {
  /** The original (shared) material, stashed so we can restore it. */
  __origMat?: THREE.Material | THREE.Material[];
}

/** Restore the original material on a mesh and dispose the tint clone(s). No-op if untinted. */
export function restoreMesh(mesh: THREE.Mesh): void {
  const ud = mesh.userData as TintedMaterialUserData;
  const orig = ud.__origMat;
  if (orig === undefined) return;
  const clone = mesh.material;
  mesh.material = orig;
  delete ud.__origMat;
  if (Array.isArray(clone)) {
    for (const m of clone) m.dispose();
  } else {
    clone.dispose();
  }
}

/** Clone (once) and tint a mesh's material to `color`, stashing the shared original. */
export function tintMesh(mesh: THREE.Mesh, color: THREE.Color): void {
  const ud = mesh.userData as TintedMaterialUserData;
  if (ud.__origMat === undefined) {
    ud.__origMat = mesh.material;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => m.clone())
      : mesh.material.clone();
  }
  const mat = mesh.material;
  const apply = (m: THREE.Material): void => {
    const maybe = m as { color?: unknown };
    if (maybe.color instanceof THREE.Color) {
      maybe.color.copy(color);
    }
  };
  if (Array.isArray(mat)) {
    for (const m of mat) apply(m);
  } else {
    apply(mat);
  }
}

/** Tint every Mesh under `root` (traverses children). */
export function tintGroup(root: THREE.Object3D, color: THREE.Color): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) tintMesh(obj as THREE.Mesh, color);
  });
}

/** Restore every Mesh under `root` to its shared original material. */
export function restoreGroup(root: THREE.Object3D): void {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) restoreMesh(obj as THREE.Mesh);
  });
}
