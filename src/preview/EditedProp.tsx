/**
 * EditedProp.tsx — applies the harness edit record to the rendered prop.
 *
 * HARNESS-ONLY. Wraps the REAL prop component (never a fork) in a transform
 * <group> and, when a tint is active, recolours it WITHOUT corrupting the shared
 * module-scope materials the props use.
 *
 * TRANSFORM (exact, truthful): a <group position rotation scale> around the prop.
 * rotationDeg → radians here.
 *
 * TINT (clone, never mutate): the workshop props attach SHARED MeshStandardMaterial
 * instances (module scope) across many meshes/props. Setting `.color` on those
 * directly would bleed into every other prop. So on tint we traverse the wrapper
 * group and, per Mesh, CLONE its material the first time, stash the original on
 * `mesh.userData.__origMat`, and tint the clone. On tint-off / prop-change /
 * unmount we restore the original and dispose the clone. Keyed effect on
 * [activeName, tint] re-runs whenever either changes.
 */
import { useLayoutEffect, useRef } from 'react';
import * as THREE from 'three';
import type { PropEdit } from './editStore.js';
import { restoreGroup, tintGroup } from './tint.js';

interface Props {
  /** Drives the keyed tint effect so switching props restores materials. */
  readonly activeName: string;
  readonly edit: PropEdit;
  readonly children: React.ReactNode;
}

const DEG2RAD = Math.PI / 180;

export function EditedProp({ activeName, edit, children }: Props): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  const { tint } = edit;

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (group === null) return;

    if (tint !== null) {
      tintGroup(group, new THREE.Color(tint));
    } else {
      restoreGroup(group);
    }

    // Cleanup: always restore + dispose so leaving a prop (or toggling tint)
    // never leaves a sibling prop wearing a cloned, recoloured material.
    return () => {
      const g = groupRef.current;
      if (g !== null) restoreGroup(g);
    };
    // activeName is in the key so re-mounting on prop switch re-runs restore.
  }, [activeName, tint]);

  return (
    <group
      ref={groupRef}
      position={edit.position}
      rotation={[
        edit.rotationDeg[0] * DEG2RAD,
        edit.rotationDeg[1] * DEG2RAD,
        edit.rotationDeg[2] * DEG2RAD,
      ]}
      scale={edit.scale}
    >
      {children}
    </group>
  );
}
