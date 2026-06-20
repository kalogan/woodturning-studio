/**
 * FlatFileCabinets.tsx — Stacked metal flat-file (map-drawer) cabinets.
 *
 * Two wide, low boxy steel cabinets stacked vertically — the classic
 * artist/architect flat-file with many thin horizontal drawer faces, each
 * with a small recessed pull handle. Muted green steel body with slightly
 * lighter drawer faces. A thin plinth at the floor and a top cap.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at the player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +7.25], ceiling 3.6 m, floor Y=0.
 *   +X wall (X≈+2) = sign wall (no lathes); +Z wall = aisle/windows.
 *
 * PLACEMENT (verified clear): against the +X sign wall, toward the aisle side.
 *   FLAT_FILE_POS = [1.35, 0, 4.6]. The SpeakerDisplay is at X=-2.5 / Z=7.05
 *   (~3.9 m away) and the +X sign-wall doorway is around Z≈2.8 — this cabinet
 *   sits north of it. Faces into the hall (-X) so the drawer faces read.
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

/** World position of the cabinet stack (bottom-front-centre). */
export const FLAT_FILE_POS: [number, number, number] = [1.35, 0, 4.6];

/** Rotation (radians). Faces into the hall (-X), back against the +X wall. */
export const FLAT_FILE_ROT: [number, number, number] = [0, -Math.PI / 2, 0];

// Single cabinet dimensions
const CAB_W = 1.00;   // width  (X local — drawer face span)
const CAB_H = 0.90;   // height (Y)
const CAB_D = 0.70;   // depth  (Z)
const PLINTH_H = 0.08; // floor plinth height
const TOP_T   = 0.03;  // top cap thickness

const DRAWERS_PER_CAB = 6;   // thin horizontal drawers per cabinet
const STACK_COUNT     = 2;   // two cabinets stacked

const HANDLE_W = 0.14;  // recessed pull width
const HANDLE_H = 0.022; // recessed pull height

// ─── Module-scope materials ───────────────────────────────────────────────────

const _bodyMat   = new THREE.MeshStandardMaterial({ color: '#5a6b58', roughness: 0.55, metalness: 0.45 }); // muted green steel
const _drawerMat = new THREE.MeshStandardMaterial({ color: '#647a62', roughness: 0.50, metalness: 0.42 }); // slightly lighter drawer face
const _gapMat    = new THREE.MeshStandardMaterial({ color: '#2c352b', roughness: 0.70, metalness: 0.30 }); // dark drawer gap line
const _handleMat = new THREE.MeshStandardMaterial({ color: '#3a3d40', roughness: 0.45, metalness: 0.60 }); // dark recessed pull
const _topMat    = new THREE.MeshStandardMaterial({ color: '#52624f', roughness: 0.55, metalness: 0.45 }); // top cap

// ─── Sub-components ───────────────────────────────────────────────────────────

/** One flat-file carcass with N drawer faces, recessed pulls + gap lines.
 *  baseY = world Y of this cabinet's bottom. */
function Cabinet({ baseY }: { baseY: number }) {
  const drawerArea = CAB_H - PLINTH_H - TOP_T;
  const drawerH = drawerArea / DRAWERS_PER_CAB;

  const drawers: ReactNode[] = [];
  for (let d = 0; d < DRAWERS_PER_CAB; d++) {
    const cy = baseY + PLINTH_H + drawerH * (d + 0.5);
    // Drawer face (slightly proud of carcass front, local +Z = -X world after rot)
    drawers.push(
      <mesh key={`d-${String(d)}`} castShadow position={[0, cy, CAB_D / 2 + 0.004]}>
        <boxGeometry args={[CAB_W - 0.04, drawerH - 0.012, 0.012]} />
        <primitive object={_drawerMat} attach="material" />
      </mesh>,
    );
    // Dark gap line above each drawer face
    drawers.push(
      <mesh key={`g-${String(d)}`} position={[0, cy + drawerH / 2 - 0.004, CAB_D / 2 + 0.006]}>
        <boxGeometry args={[CAB_W - 0.03, 0.006, 0.004]} />
        <primitive object={_gapMat} attach="material" />
      </mesh>,
    );
    // Two small recessed pull handles per drawer
    [-0.22, 0.22].forEach((hx, hi) => {
      drawers.push(
        <mesh key={`h-${String(d)}-${String(hi)}`} position={[hx, cy, CAB_D / 2 + 0.012]}>
          <boxGeometry args={[HANDLE_W, HANDLE_H, 0.014]} />
          <primitive object={_handleMat} attach="material" />
        </mesh>,
      );
    });
  }

  return (
    <group name="flat-file-cabinet">
      {/* Carcass body */}
      <mesh castShadow receiveShadow position={[0, baseY + CAB_H / 2, 0]}>
        <boxGeometry args={[CAB_W, CAB_H, CAB_D]} />
        <primitive object={_bodyMat} attach="material" />
      </mesh>
      {/* Top cap */}
      <mesh castShadow position={[0, baseY + CAB_H - TOP_T / 2, 0]}>
        <boxGeometry args={[CAB_W + 0.04, TOP_T, CAB_D + 0.04]} />
        <primitive object={_topMat} attach="material" />
      </mesh>
      {drawers}
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

interface FlatFileCabinetsProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * FlatFileCabinets — two stacked muted-green flat-file (map-drawer) cabinets
 * with many thin horizontal drawers + recessed pulls. Default FLAT_FILE_POS =
 * [1.35, 0, 4.6] against the +X sign wall. Both constants exported for tuning.
 *
 * Footprint per cabinet: ~1.0 m wide × 0.9 m tall × 0.7 m deep (×2 stacked).
 */
export function FlatFileCabinets({
  position = FLAT_FILE_POS,
  rotation = FLAT_FILE_ROT,
}: FlatFileCabinetsProps = {}) {
  const cabinets: ReactNode[] = [];
  for (let s = 0; s < STACK_COUNT; s++) {
    cabinets.push(<Cabinet key={String(s)} baseY={s * CAB_H} />);
  }

  return (
    <group name="flat-file-cabinets" position={position} rotation={rotation}>
      {cabinets}
    </group>
  );
}
