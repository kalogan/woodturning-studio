/**
 * WireRack.tsx — Chrome wire shelving unit loaded with rough bowl blanks.
 *
 * A light-steel wire shelving unit (the ubiquitous chrome restaurant/garage
 * rack): four thin corner posts, a few thin crossbars per shelf level
 * suggesting the wire grid, and 4 shelves. Loaded with chunky rough turning
 * stock — sawn log rounds (cylinders) and split half-round log pieces in
 * varied brown bark tones, a few with a darker bark rim.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at the player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +7.25], ceiling 3.6 m, floor Y=0.
 *   -Z wall (Z≈-2.5) = lathe wall; +Z wall (Z≈+7.25) = aisle/window wall.
 *
 * PLACEMENT (verified clear): entrance end, against the +Z aisle wall.
 *   WIRE_RACK_POS = [-15.4, 0, 6.5]. The StockCubbies sit at X=-13 / Z=6.75
 *   (~2.4 m away in X) and the drill press is at X=-11 / Z=-2.0 — no overlap.
 *   Faces into the hall (-Z) so the loaded shelves read from the aisle.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the
 * no-misused-spread lint rule on class instances.
 * No animation, no Math.random, no Date.now, no browser APIs — Three.js only.
 * No per-frame allocation.
 */

import type { ReactNode } from 'react';
import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

/** World position of the wire rack (bottom-front-centre). */
export const WIRE_RACK_POS: [number, number, number] = [-15.4, 0, 6.5];

/** Rotation (radians). Faces into the hall toward the lathe row (-Z). */
export const WIRE_RACK_ROT: [number, number, number] = [0, Math.PI, 0];

// Unit overall dimensions
const UNIT_W   = 1.20;   // width  (X)
const UNIT_H   = 1.80;   // height (Y)
const UNIT_D   = 0.50;   // depth  (Z)
const POST_R   = 0.014;  // corner post radius
const WIRE_R   = 0.006;  // shelf crossbar / grid wire radius
const SHELF_YS = [0.06, 0.56, 1.06, 1.56] as const;  // shelf surface heights

// Blank dimensions (rough turning stock)
const ROUND_R    = 0.085; // log round radius
const ROUND_H    = 0.18;  // log round height (standing on end)
const HALF_R     = 0.10;  // half-round log radius
const HALF_LEN   = 0.30;  // half-round log length (lying down)

// ─── Module-scope materials ───────────────────────────────────────────────────

// Light steel chrome wire
const _postMat  = new THREE.MeshStandardMaterial({ color: '#b8bcc2', roughness: 0.30, metalness: 0.72 });
const _wireMat  = new THREE.MeshStandardMaterial({ color: '#b8bcc2', roughness: 0.35, metalness: 0.70 });

// Varied bark/wood tones for rough blanks
const _barkMats = [
  new THREE.MeshStandardMaterial({ color: '#6e5234', roughness: 0.90, metalness: 0.0 }),
  new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.88, metalness: 0.0 }),
  new THREE.MeshStandardMaterial({ color: '#5a4326', roughness: 0.92, metalness: 0.0 }),
] as const;
// Darker bark-rim material (sapwood / bark ring on top of a round)
const _barkRimMat = new THREE.MeshStandardMaterial({ color: '#3a2a18', roughness: 0.95, metalness: 0.0 });
// Pale cut end-grain face on a fresh round
const _endGrainMat = new THREE.MeshStandardMaterial({ color: '#c8a868', roughness: 0.85, metalness: 0.0 });

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Four corner posts + the wire shelf levels (a frame + sparse crossbars). */
function Frame() {
  const halfW = UNIT_W / 2 - POST_R;
  const halfD = UNIT_D / 2 - POST_R;
  const postCorners: ReadonlyArray<[number, number]> = [
    [-halfW, -halfD],
    [ halfW, -halfD],
    [-halfW,  halfD],
    [ halfW,  halfD],
  ];

  const posts: ReactNode[] = postCorners.map(([x, z], i) => (
    <mesh key={`post-${String(i)}`} castShadow position={[x, UNIT_H / 2, z]}>
      <cylinderGeometry args={[POST_R, POST_R, UNIT_H, 10]} />
      <primitive object={_postMat} attach="material" />
    </mesh>
  ));

  // Each shelf: a perimeter frame (4 bars) + a few longitudinal grid wires.
  const shelves: ReactNode[] = [];
  SHELF_YS.forEach((y, si) => {
    // Front + back rails (run along X)
    shelves.push(
      <mesh key={`fr-${String(si)}`} castShadow position={[0, y, halfD]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[WIRE_R, WIRE_R, UNIT_W, 8]} />
        <primitive object={_wireMat} attach="material" />
      </mesh>,
      <mesh key={`bk-${String(si)}`} castShadow position={[0, y, -halfD]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[WIRE_R, WIRE_R, UNIT_W, 8]} />
        <primitive object={_wireMat} attach="material" />
      </mesh>,
    );
    // Side rails (run along Z)
    shelves.push(
      <mesh key={`lf-${String(si)}`} castShadow position={[-halfW, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[WIRE_R, WIRE_R, UNIT_D, 8]} />
        <primitive object={_wireMat} attach="material" />
      </mesh>,
      <mesh key={`rt-${String(si)}`} castShadow position={[halfW, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[WIRE_R, WIRE_R, UNIT_D, 8]} />
        <primitive object={_wireMat} attach="material" />
      </mesh>,
    );
    // A few longitudinal grid wires across the shelf (suggest the wire grid).
    const gridXs = [-0.36, -0.12, 0.12, 0.36] as const;
    gridXs.forEach((gx, gi) => {
      shelves.push(
        <mesh key={`gw-${String(si)}-${String(gi)}`} position={[gx, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[WIRE_R * 0.7, WIRE_R * 0.7, UNIT_D, 6]} />
          <primitive object={_wireMat} attach="material" />
        </mesh>,
      );
    });
  });

  return (
    <group name="wire-frame">
      {posts}
      {shelves}
    </group>
  );
}

/** A log round standing on end (cylinder) with a darker bark rim + pale cut face. */
function LogRound({ x, y, z, mat }: { x: number; y: number; z: number; mat: THREE.Material }) {
  return (
    <group position={[x, y, z]}>
      {/* Bark cylinder body */}
      <mesh castShadow receiveShadow position={[0, ROUND_H / 2, 0]}>
        <cylinderGeometry args={[ROUND_R, ROUND_R * 0.97, ROUND_H, 16]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* Pale cut end-grain on top */}
      <mesh position={[0, ROUND_H + 0.001, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[ROUND_R * 0.92, ROUND_R * 0.92, 0.004, 16]} />
        <primitive object={_endGrainMat} attach="material" />
      </mesh>
      {/* Darker bark rim ring at the top edge */}
      <mesh position={[0, ROUND_H - 0.012, 0]}>
        <cylinderGeometry args={[ROUND_R + 0.004, ROUND_R + 0.004, 0.026, 16]} />
        <primitive object={_barkRimMat} attach="material" />
      </mesh>
    </group>
  );
}

/** A split half-round log lying on its flat side (a half-cylinder, axis along X). */
function HalfRound({ x, y, z, rot, mat }: { x: number; y: number; z: number; rot: number; mat: THREE.Material }) {
  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      {/* Rounded log body lying down (full cylinder, flat-down look via low Y). */}
      <mesh castShadow receiveShadow position={[0, HALF_R, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[HALF_R, HALF_R * 0.95, HALF_LEN, 16]} />
        <primitive object={mat} attach="material" />
      </mesh>
      {/* Pale cut end-grain cap on the +X end */}
      <mesh position={[HALF_LEN / 2 + 0.002, HALF_R, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[HALF_R * 0.94, HALF_R * 0.94, 0.004, 16]} />
        <primitive object={_endGrainMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Rough blanks placed across the shelves (deterministic, varied by index). */
function Blanks() {
  const items: ReactNode[] = [];

  // [shelfIndex, kind 'round'|'half', xFrac (-1..1), matIndex, halfRot]
  const layout: ReadonlyArray<[number, 'round' | 'half', number, number, number]> = [
    [0, 'half',  -0.55, 2,  0.10],
    [0, 'round',  0.05, 0,  0.00],
    [0, 'round',  0.45, 1,  0.00],
    [1, 'round', -0.55, 1,  0.00],
    [1, 'half',   0.20, 0, -0.12],
    [2, 'round', -0.40, 2,  0.00],
    [2, 'round',  0.00, 1,  0.00],
    [2, 'round',  0.40, 0,  0.00],
    [3, 'half',  -0.25, 1,  0.08],
    [3, 'round',  0.45, 2,  0.00],
  ];

  const halfSpanX = UNIT_W / 2 - ROUND_R - 0.04;

  layout.forEach(([si, kind, xFrac, matIdx, halfRot], i) => {
    const shelfY = SHELF_YS[si] ?? 0.06;
    const x = xFrac * halfSpanX;
    // small deterministic Z offset to stagger front/back
    const z = ((i % 3) - 1) * 0.08;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const mat = _barkMats[matIdx % _barkMats.length]!;
    if (kind === 'round') {
      items.push(<LogRound key={String(i)} x={x} y={shelfY} z={z} mat={mat} />);
    } else {
      items.push(<HalfRound key={String(i)} x={x} y={shelfY} z={z} rot={halfRot} mat={mat} />);
    }
  });

  return <group name="wire-rack-blanks">{items}</group>;
}

// ─── Public export ────────────────────────────────────────────────────────────

interface WireRackProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * WireRack — chrome wire shelving unit loaded with rough bowl blanks / log
 * chunks. Default WIRE_RACK_POS = [-15.4, 0, 6.5] against the +Z aisle wall
 * at the entrance end. Both constants exported for director tuning.
 *
 * Footprint: ~1.2 m wide × 1.8 m tall × 0.5 m deep.
 */
export function WireRack({
  position = WIRE_RACK_POS,
  rotation = WIRE_RACK_ROT,
}: WireRackProps = {}) {
  return (
    <group name="wire-rack" position={position} rotation={rotation}>
      <Frame />
      <Blanks />
    </group>
  );
}
