/**
 * EditedProp.tsx — applies the harness edit record to the rendered prop.
 *
 * HARNESS-ONLY. Wraps the REAL prop component (never a fork) in a transform
 * <group> and, when a tint is active, recolours it WITHOUT corrupting the shared
 * module-scope materials the props use.
 *
 * TWO-LAYER TRANSFORM (recenter is harness-only, never exported):
 *
 *   <group ...USER EDIT (scale, rotationDeg→rad, position)... >   // OUTER — exported
 *     <group position={recenterOffset} ref={innerGroupRef}>        // INNER — harness-only
 *       <Prop />
 *     </group>
 *   </group>
 *
 * Many props carry hardcoded in-ROOM world coordinates (Doorways at ±X walls,
 * SpeakerDisplay at Z≈7, …) so on their own they sit off to the side / floating.
 * After mount we measure the prop's world AABB on the INNER group and offset it by
 * `[-center.x, -box.min.y, -center.z]` → X/Z centred on the origin, BOTTOM resting
 * on the grid (y=0). This recenter lives on a separate inner layer the user never
 * edits, so the user's scale/rotate/move apply relative to the centred prop and the
 * exported JSON (editStore) contains ONLY the user's numbers — never the recenter.
 *
 * The measured `size`/`center` are reported up via `onMeasured` so PreviewApp can
 * frame the camera on the same measurement (no double measure). Measurement runs
 * in a useLayoutEffect keyed on the active prop name — once per prop, NOT in
 * useFrame. Scratch Box3/Vector3 are pre-allocated at module scope.
 *
 * TINT (clone, never mutate): the workshop props attach SHARED MeshStandardMaterial
 * instances (module scope) across many meshes/props. Setting `.color` on those
 * directly would bleed into every other prop. So on tint we traverse the wrapper
 * group and, per Mesh, CLONE its material the first time, stash the original on
 * `mesh.userData.__origMat`, and tint the clone. On tint-off / prop-change /
 * unmount we restore the original and dispose the clone. Keyed effect on
 * [activeName, tint] re-runs whenever either changes.
 */
import { useLayoutEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { PropEdit } from './editStore.js';
import { restoreGroup, tintGroup } from './tint.js';

interface Props {
  /** Drives the keyed tint + measure effects so switching props re-runs them. */
  readonly activeName: string;
  readonly edit: PropEdit;
  readonly children: React.ReactNode;
  /**
   * Reports the measured world size + centre of the prop (pre-recenter) so the
   * harness can frame the camera on the SAME measurement. Called once per prop.
   * Both vectors are COPIES safe to retain (not the module scratch).
   */
  readonly onMeasured?: (size: THREE.Vector3, center: THREE.Vector3) => void;
}

const DEG2RAD = Math.PI / 180;

// Pre-allocated scratch — reused across measurements, never per-frame alloc.
// (Measurement runs once per prop in a useLayoutEffect, not in useFrame.)
const SCRATCH_BOX = new THREE.Box3();
const SCRATCH_CENTER = new THREE.Vector3();
const SCRATCH_SIZE = new THREE.Vector3();

const ZERO_OFFSET: [number, number, number] = [0, 0, 0];

export function EditedProp({
  activeName,
  edit,
  children,
  onMeasured,
}: Props): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  const innerGroupRef = useRef<THREE.Group>(null);
  const { tint } = edit;

  // The recenter offset applied to the INNER group (harness-only, not exported).
  const [recenterOffset, setRecenterOffset] = useState<[number, number, number]>(ZERO_OFFSET);

  // ── Measure + recenter (once per prop) ────────────────────────────────────
  useLayoutEffect(() => {
    const inner = innerGroupRef.current;
    if (inner === null) return;

    // Neutralise any prior recenter so the AABB is measured in the prop's OWN
    // (room) coordinates, not relative to a stale offset.
    inner.position.set(0, 0, 0);
    inner.updateWorldMatrix(true, true);

    SCRATCH_BOX.setFromObject(inner);

    // Guard degenerate boxes: props that are mostly lights/empty (e.g. Lighting,
    // CeilingEquipment) produce an empty or non-finite box. Leave the inner group
    // at the origin (don't NaN it) and report identity size so framing falls back.
    const min = SCRATCH_BOX.min;
    const max = SCRATCH_BOX.max;
    const finite =
      Number.isFinite(min.x) && Number.isFinite(min.y) && Number.isFinite(min.z) &&
      Number.isFinite(max.x) && Number.isFinite(max.y) && Number.isFinite(max.z);

    if (SCRATCH_BOX.isEmpty() || !finite) {
      setRecenterOffset(ZERO_OFFSET);
      // Report a unit-ish size so the camera framing has something sane.
      onMeasured?.(new THREE.Vector3(1, 1, 1), new THREE.Vector3(0, 0, 0));
      return;
    }

    SCRATCH_BOX.getCenter(SCRATCH_CENTER);
    SCRATCH_BOX.getSize(SCRATCH_SIZE);

    // Centre X/Z on the origin; rest the prop's BOTTOM on the grid (y = 0).
    const offset: [number, number, number] = [
      -SCRATCH_CENTER.x,
      -min.y,
      -SCRATCH_CENTER.z,
    ];
    setRecenterOffset(offset);

    onMeasured?.(SCRATCH_SIZE.clone(), SCRATCH_CENTER.clone());
    // Keyed on activeName (the prop) — onMeasured is a stable useCallback.
  }, [activeName, onMeasured]);

  // ── Tint (clone / restore) ────────────────────────────────────────────────
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
      <group ref={innerGroupRef} position={recenterOffset}>
        {children}
      </group>
    </group>
  );
}
