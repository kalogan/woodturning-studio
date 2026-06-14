/**
 * SetupScene — Lesson 0 "Set Up Your Lathe".
 *
 * Scene3D: first-person FPS walk. The player walks to the ToolBench, grabs
 *   each accessory with E, carries it to the lathe, and mounts it at the
 *   correct point (E again). Wrong piece at a point → coaching nudge.
 *   The player can also remove a mounted piece (E near a mounted mount point).
 *
 * Overlay: checklist HUD + carried-item line + hint nudge + completion button.
 *   The old click-to-grab toolbox and click-to-mount button list are REMOVED —
 *   the 3D interaction replaces them entirely.
 *
 * ── Tunable constants ────────────────────────────────────────────────────────
 *   BENCH_POS        World position of the ToolBench (tweak for layout).
 *   SPAWN_POS        FPS spawn position (x, z) — faces lathe + bench.
 *   GRAB_RADIUS      XZ distance within which a bench slot is grabbable.
 *   MOUNT_RADIUS     XZ distance within which a mount point is usable.
 *   IN_HAND_OFFSET   Camera-relative position of the carried accessory mesh.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Constraint compliance:
 *   - NO per-frame heap allocation: scratch Vector3 / scalars pre-allocated.
 *   - FPSCamera.onMove(x,z) called each frame with current player XZ (scalars).
 *   - FPSCamera.onInteract() called edge-triggered on E key — wired to the
 *     proximity-based grab/mount/unmount handler in this component.
 *   - dependency-cruiser: SetupScene imports from client/workshop/session but
 *     NOT from src/core (no circular, no arch-guard violation).
 */

import { useEffect, useRef, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Lighting, Room, Furniture } from '../../workshop/index.js';
import { Lathe } from '../../lathe/index.js';
import {
  ToolBench,
  BENCH_ACCESSORY_IDS,
  benchSlotPosition,
} from '../../setup/ToolBench.js';
import { ACCESSORY_REGISTRY } from '../../setup/AccessoryMesh.js';
import { getMountPointWorldPositions } from '../../lathe/mountPoints.js';
import { FPSCamera } from '../FPSCamera.js';
import { useSetupStore } from '../../../workshop/setupStore.js';
import { getLatheSetup, mountPointLabel, type MountPoint } from '../../../session/setup.js';
import {
  nearestTarget,
  type ProximityTarget,
  type BenchTarget,
  type MountTarget,
} from '../../../workshop/setupProximity.js';
import type { SceneCtx } from '../sceneCtx.js';

// ── Tunable constants ─────────────────────────────────────────────────────────

/** World position of the ToolBench (XYZ). Bench sits to the +Z side of the lathe,
 *  slightly to the right (+X), reachable in a few WASD steps from spawn. */
const BENCH_POS: [number, number, number] = [1.0, 0, 2.0];

/** FPS spawn position (XZ) — a few metres back from the lathe + bench. */
const SPAWN_X = 0;
const SPAWN_Z = 2.8;   // Note: FPSCamera.WALK_SPAWN already handles reset; we
                        // just position the bench so spawn-to-bench is walkable.

/** XZ distance (metres) within which a bench slot becomes grabbable. */
const GRAB_RADIUS = 1.0;

/** XZ distance (metres) within which a mount point becomes usable (mount/unmount). */
const MOUNT_RADIUS = 1.2;

/**
 * Camera-relative offset for the carried accessory "in hand" group.
 * +X = right, +Y = down (in camera view), +Z = forward into scene.
 * Tweak these to dial in the "holding in right hand, near bottom of view" feel.
 */
const IN_HAND_X =  0.25;
const IN_HAND_Y = -0.30;
const IN_HAND_Z = -0.45;

/** Scale of the in-hand accessory mesh (shrink a little for believable "held" size). */
const IN_HAND_SCALE = 0.55;

// ── Step-id → mount-point mapping (derived from setup JSON, never hardcoded) ──
// We need to look up which step covers each mount point for the unmount case.
// The setup has a 'wall-outlet' mount which has no lathe geometry — we place
// a virtual proximity target at a fixed world position near the wall.
const WALL_OUTLET_POS_X = -2.5;
const WALL_OUTLET_POS_Z =  0.0;

// ── Pre-allocated scratch objects (module scope — never re-created per frame) ──
// These satisfy constraint #3 (no per-frame heap allocation).
const _camWorldPos = new THREE.Vector3();
const _camForward  = new THREE.Vector3();
const _camRight    = new THREE.Vector3();
const _camUp       = new THREE.Vector3();
const _inHandPos   = new THREE.Vector3();

// ── Per-component player-position refs (scalars — no object alloc) ────────────
// Updated by FPSCamera.onMove each frame; read by the proximity tick.
// Declared outside the component so useFrame closure captures a stable ref.
// (Two separate refs per scalar avoids any object wrapper.)

interface Props { ctx: SceneCtx }

// ── Scene3D ───────────────────────────────────────────────────────────────────

export function SetupScene3D(_props: Props) {
  // Player XZ stored as a ref pair — mutable, no re-render on move.
  const playerXRef = useRef(SPAWN_X);
  const playerZRef = useRef(SPAWN_Z);

  // The carried-accessory group lives in world space but is repositioned
  // each frame to sit in front of the camera (camera-relative).
  const inHandGroupRef = useRef<THREE.Group | null>(null);

  // Track the nearest interactable so the overlay can show a prompt.
  // We write to a ref to avoid React re-renders in useFrame.
  const nearestRef = useRef<ProximityTarget | null>(null);

  // ── Build proximity target list (only needs rebuild when completed changes) ──
  // We do this inside the component so the closure has access to the store.
  // The list is rebuilt in a ref (no allocation inside useFrame).
  const targetsRef = useRef<ProximityTarget[]>([]);

  const { camera } = useThree();

  // Zustand slices — we subscribe only to what we need for rendering.
  const carrying       = useSetupStore((s) => s.carrying);
  const completedStepIds = useSetupStore((s) => s.completedStepIds);

  // ── Rebuild proximity targets whenever completedStepIds changes ──────────────
  useEffect(() => {
    const setup = getLatheSetup();
    const pts = getMountPointWorldPositions();  // pure, cheap

    const targets: ProximityTarget[] = [];

    // Bench slots — one per accessory id.
    for (let i = 0; i < BENCH_ACCESSORY_IDS.length; i++) {
      const id = BENCH_ACCESSORY_IDS[i];
      if (id === undefined) continue;
      const [lx, , lz] = benchSlotPosition(i);
      targets.push({
        kind: 'bench',
        accessoryId: id,
        x: BENCH_POS[0] + lx,
        z: BENCH_POS[2] + lz,
      } satisfies BenchTarget);
    }

    // Mount points (lathe geometry).
    const latheMountPoints: Array<{ mountPoint: MountPoint; x: number; z: number }> = [
      { mountPoint: 'headstock-spindle', x: pts['headstock-spindle'][0], z: pts['headstock-spindle'][2] },
      { mountPoint: 'tailstock-quill',   x: pts['tailstock-quill'][0],   z: pts['tailstock-quill'][2]   },
      { mountPoint: 'bed',               x: pts['bed'][0],               z: pts['bed'][2]               },
    ];
    for (const mp of latheMountPoints) {
      const step = setup.steps.find((s) => s.mountPoint === mp.mountPoint);
      const mountedStepId = step !== undefined && completedStepIds.includes(step.id)
        ? step.id
        : null;
      targets.push({
        kind: 'mount',
        mountPoint: mp.mountPoint,
        mountedStepId,
        x: mp.x,
        z: mp.z,
      } satisfies MountTarget);
    }

    // Wall outlet — virtual proximity target (no geometry).
    const wallStep = setup.steps.find((s) => s.mountPoint === 'wall-outlet');
    const wallMountedId = wallStep !== undefined && completedStepIds.includes(wallStep.id)
      ? wallStep.id
      : null;
    targets.push({
      kind: 'mount',
      mountPoint: 'wall-outlet',
      mountedStepId: wallMountedId,
      x: WALL_OUTLET_POS_X,
      z: WALL_OUTLET_POS_Z,
    } satisfies MountTarget);

    targetsRef.current = targets;
  }, [completedStepIds]);

  // ── FPSCamera callbacks (stable refs — wrapped in useCallback) ────────────────

  const handleMove = useCallback((x: number, z: number) => {
    playerXRef.current = x;
    playerZRef.current = z;
  }, []);

  const handleInteract = useCallback(() => {
    const state  = useSetupStore.getState();
    const nearest = nearestRef.current;
    if (nearest === null) return;

    if (nearest.kind === 'bench') {
      // Grab the accessory from the bench slot.
      state.grab(nearest.accessoryId);
    } else {
      // Mount point.
      if (state.carrying !== null) {
        // Carrying something → try to mount it.
        state.tryMount(nearest.mountPoint as MountPoint);
      } else if (nearest.mountedStepId !== null) {
        // Not carrying, but something is mounted here → unmount it.
        state.unmount(nearest.mountedStepId);
      }
    }
  }, []);

  // ── useFrame: proximity check + in-hand positioning ───────────────────────────
  useFrame(() => {
    const px = playerXRef.current;
    const pz = playerZRef.current;

    // Pick the largest radius so both grab and mount are checked together;
    // the overlay reads nearestRef and applies the correct label + threshold.
    const maxR = Math.max(GRAB_RADIUS, MOUNT_RADIUS);
    nearestRef.current = nearestTarget(px, pz, targetsRef.current, maxR);

    // ── Position the in-hand group ────────────────────────────────────────────
    const group = inHandGroupRef.current;
    if (group === null) return;

    // Get camera world position + basis vectors (no allocation — reuse scratches).
    camera.getWorldPosition(_camWorldPos);
    camera.getWorldDirection(_camForward);
    _camRight.crossVectors(_camForward, camera.up).normalize();
    _camUp.crossVectors(_camRight, _camForward).normalize();

    // in-hand world pos = camPos + right*X + up*Y + forward*(-Z offset)
    // Note: _camForward points INTO the scene (+Z in camera space = -Z world for
    // a default facing camera), so we add forward * IN_HAND_Z (negative = closer).
    _inHandPos.copy(_camWorldPos);
    _inHandPos.addScaledVector(_camRight,   IN_HAND_X);
    _inHandPos.addScaledVector(_camUp,      IN_HAND_Y);
    _inHandPos.addScaledVector(_camForward, IN_HAND_Z);

    group.position.copy(_inHandPos);
    group.quaternion.copy(camera.quaternion);
  });

  // Resolve which component to render in hand.
  const carriedEntry = carrying !== null ? ACCESSORY_REGISTRY[carrying] : undefined;
  const CarriedComp = carriedEntry?.Component ?? null;

  // Bare-lathe mount flags — show a part only when its step is completed.
  const done = (id: string) => completedStepIds.includes(id);

  return (
    <>
      <Lighting />
      <Room />
      <Furniture />

      {/* ── Bare lathe: mountable parts appear only when seated ─────────────── */}
      <Lathe
        position={[0, 0, 0]}
        mounted={{
          spurDrive:  done('mount-spur-drive'),
          liveCenter: done('mount-live-center'),
          toolRest:   done('fit-tool-rest'),
        }}
      />

      {/* ── Tool bench — reachable to the right of the lathe ────────────────── */}
      <ToolBench position={BENCH_POS} />

      {/* ── FPS walk controller ─────────────────────────────────────────────── */}
      <FPSCamera onMove={handleMove} onInteract={handleInteract} />

      {/* ── Carried accessory in hand ────────────────────────────────────────── */}
      {/* The group is always mounted; it is only visible when CarriedComp != null. */}
      {/* useFrame repositions it camera-relative each frame (no per-frame alloc). */}
      <group ref={inHandGroupRef} scale={IN_HAND_SCALE} visible={CarriedComp !== null}>
        {CarriedComp !== null && <CarriedComp />}
      </group>
    </>
  );
}

// ── Overlay ───────────────────────────────────────────────────────────────────

export function SetupOverlay({ ctx }: Props) {
  const setup           = getLatheSetup();
  const carrying        = useSetupStore((s) => s.carrying);
  const completedStepIds = useSetupStore((s) => s.completedStepIds);
  const hint            = useSetupStore((s) => s.hint);
  const isComplete      = useSetupStore((s) => s.isComplete());

  // Fresh start each time the lesson is entered.
  useEffect(() => {
    useSetupStore.getState().reset();
  }, []);

  // Derive carried accessory display name.
  const allAccessories = [
    ...setup.steps.map((s) => ({ id: s.accessoryId, name: s.accessoryName })),
    ...setup.decoys.map((d) => ({ id: d.accessoryId, name: d.accessoryName })),
  ];
  const carriedName = allAccessories.find((a) => a.id === carrying)?.name ?? null;

  // ── Styles ──────────────────────────────────────────────────────────────────
  const panel: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 300,
    maxWidth: '92vw',
    background: 'rgba(20,18,16,0.88)',
    color: '#e8e2d0',
    padding: '16px 16px',
    overflowY: 'auto',
    font: "13px/1.5 system-ui, sans-serif",
    boxShadow: '-6px 0 20px rgba(0,0,0,0.4)',
    zIndex: 20,
    maxHeight: '100vh',
    boxSizing: 'border-box',
  };
  const h1: React.CSSProperties = {
    color: '#c8873a', fontSize: '1.2rem', fontWeight: 700, margin: '0 0 4px',
  };
  const section: React.CSSProperties = {
    margin: '14px 0 5px', color: '#c8873a', fontSize: '0.75rem',
    textTransform: 'uppercase', letterSpacing: '0.06em',
  };
  const chipBase: React.CSSProperties = {
    display: 'inline-block', margin: '3px 5px 0 0', padding: '5px 10px',
    borderRadius: 6, border: '1px solid #4a443a', cursor: 'pointer',
    background: '#2a2620', color: '#e8e2d0', fontSize: '0.82rem',
  };

  return (
    <div style={panel}>
      <h1 style={h1}>{setup.title}</h1>
      <p style={{ color: '#aaa', margin: '0 0 2px', fontSize: '0.82rem' }}>{setup.intro}</p>

      {/* ── Controls hint ────────────────────────────────────────────────────── */}
      <p style={{ color: '#6a8a6a', margin: '6px 0 0', fontSize: '0.75rem', fontStyle: 'italic' }}>
        WASD walk · mouse look · E to pick up / mount / remove · Esc to free cursor
      </p>

      {/* ── Checklist ────────────────────────────────────────────────────────── */}
      <div style={section}>Checklist</div>
      {setup.steps.map((step) => {
        const done = completedStepIds.includes(step.id);
        return (
          <div key={step.id} style={{
            display: 'flex', gap: 7, padding: '3px 0',
            color: done ? '#7dcea0' : '#cfc8b8',
          }}>
            <span>{done ? '✓' : '○'}</span>
            <span>{step.accessoryName} → {mountPointLabel(step.mountPoint)}</span>
          </div>
        );
      })}

      {/* ── In hand ──────────────────────────────────────────────────────────── */}
      <div style={section}>In hand</div>
      <div style={{ color: carriedName ? '#e8e2d0' : '#888' }}>
        {carriedName ?? 'nothing — walk to the bench and press E'}
        {carriedName !== null && (
          <button
            style={{ ...chipBase, marginLeft: 8, padding: '2px 7px', fontSize: '0.78rem' }}
            onClick={() => { useSetupStore.getState().dropCarried(); }}
          >
            put back
          </button>
        )}
      </div>

      {/* ── Hint / coaching nudge ─────────────────────────────────────────────── */}
      {hint !== null && (
        <div style={{
          marginTop: 12, padding: '7px 9px', borderRadius: 7,
          background: 'rgba(150,60,30,0.25)', color: '#f0c0a0', fontStyle: 'italic',
          fontSize: '0.82rem',
        }}>
          {hint}
        </div>
      )}

      {/* ── Completion ───────────────────────────────────────────────────────── */}
      {isComplete && (
        <div style={{ marginTop: 16 }}>
          <div style={{ color: '#7dcea0', fontWeight: 600, marginBottom: 8 }}>
            Lathe is set up and ready to turn.
          </div>
          <button
            style={{ ...chipBase, background: '#c8873a', color: '#1a1a1a', fontWeight: 700, border: 'none' }}
            onClick={() => { ctx.finishSetup(); }}
          >
            Back to lessons →
          </button>
        </div>
      )}
    </div>
  );
}
