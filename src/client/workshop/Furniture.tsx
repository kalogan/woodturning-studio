/**
 * Furniture.tsx — Workshop furniture pieces, arranged around the room perimeter.
 *
 * Exported pieces: ToolCabinet, Workbench, BlankRack, SafetyGearStation
 * Combined placement: <Furniture />
 *
 * All geometry is procedural (BoxGeometry / CylinderGeometry / TorusGeometry).
 * No per-frame allocations — purely static meshes.
 */

import type { ReactNode } from 'react';
import { Casework } from './Casework.js';
import { DemoStation } from './DemoStation.js';
import {
  paintedSteelCabinet,
  brushedSteelHandle,
} from '../lathe/materials.js';
import { makeBoardMaterial } from '../wood/woodMaterial.js';

// Pre-allocated module-scope material props
const cabinetBodyMat   = paintedSteelCabinet('#7a3030');   // Jet-red tool cabinet
const cabinetTopMat    = paintedSteelCabinet('#5a2020');   // darker cap
const cabinetDivMat    = paintedSteelCabinet('#501818');   // drawer lines
const handleMat        = brushedSteelHandle();
// Board-grain materials: grain along X (bench top + rack boards run left–right)
const benchTopMat      = makeBoardMaterial('#9b6b3f');     // warm butcher-block
const benchLegMat      = makeBoardMaterial('#7a5030', undefined, { grainAxis: 'y' }); // legs, grain up
const rackWoodMat      = makeBoardMaterial('#8a7060');     // aged rack wood

// ─── ToolCabinet ──────────────────────────────────────────────────────────────
// Tall painted-steel cabinet ~0.9m × 0.5m × 1.8m with drawer lines.

export function ToolCabinet() {
  return (
    <group name="tool-cabinet">
      {/* Body */}
      <mesh castShadow receiveShadow position={[0, 0.9, 0]}>
        <boxGeometry args={[0.9, 1.8, 0.5]} />
        <meshStandardMaterial {...cabinetBodyMat} />
      </mesh>

      {/* Drawer lines — three inset strips.
          Cabinet front face is at local Z = 0.25; offset +0.004 to clear z-fighting. */}
      {([0.3, 0.55, 0.8] as const).map((y, i) => (
        <mesh key={i} position={[0, y, 0.254]}>
          <boxGeometry args={[0.84, 0.02, 0.005]} />
          <meshStandardMaterial {...cabinetDivMat} />
        </mesh>
      ))}

      {/* Drawer handles */}
      {([0.42, 0.67, 0.92] as const).map((y, i) => (
        <mesh key={i} position={[0, y, 0.258]}>
          <boxGeometry args={[0.12, 0.025, 0.012]} />
          <meshStandardMaterial {...handleMat} />
        </mesh>
      ))}

      {/* Top cap */}
      <mesh castShadow position={[0, 1.805, 0]}>
        <boxGeometry args={[0.92, 0.012, 0.52]} />
        <meshStandardMaterial {...cabinetTopMat} />
      </mesh>
    </group>
  );
}

// ─── Workbench ────────────────────────────────────────────────────────────────
// Sturdy wooden bench ~1.6m × 0.7m × 0.9m, butcher-block top, four square legs.

export function Workbench() {
  const LEG_H = 0.84;
  const LEG_W = 0.07;
  const TOP_T = 0.06;

  // leg offsets from bench centre
  const legPositions: [number, number][] = [
    [-0.72, -0.28],
    [0.72, -0.28],
    [-0.72, 0.28],
    [0.72, 0.28],
  ];

  return (
    <group name="workbench">
      {/* Top — butcher-block */}
      <mesh castShadow receiveShadow position={[0, LEG_H + TOP_T / 2, 0]}>
        <boxGeometry args={[1.6, TOP_T, 0.7]} />
        <primitive object={benchTopMat} attach="material" />
      </mesh>

      {/* Under-shelf */}
      <mesh receiveShadow position={[0, 0.3, 0]}>
        <boxGeometry args={[1.5, 0.03, 0.6]} />
        <primitive object={benchLegMat} attach="material" />
      </mesh>

      {/* Legs */}
      {legPositions.map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, LEG_H / 2, z]}>
          <boxGeometry args={[LEG_W, LEG_H, LEG_W]} />
          <primitive object={benchLegMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

// ─── BlankRack ────────────────────────────────────────────────────────────────
// Open shelving unit with a handful of wood blanks on it.

const BLANK_SPECS: Array<{
  r: number;
  len: number;
  color: string;
  pos: [number, number, number];
  rot: [number, number, number];
}> = [
  { r: 0.06, len: 0.32, color: '#8B5E3C', pos: [-0.25, 0.98, 0.02], rot: [0, 0, Math.PI / 2] },
  { r: 0.05, len: 0.28, color: '#a0703a', pos: [0.05, 0.98, 0.02], rot: [0, 0, Math.PI / 2] },
  { r: 0.07, len: 0.36, color: '#6b4020', pos: [0.32, 0.98, 0.02], rot: [0, 0, Math.PI / 2] },
  { r: 0.04, len: 0.22, color: '#c0895a', pos: [-0.1, 1.42, 0.02], rot: [0, 0, Math.PI / 2] },
  { r: 0.06, len: 0.30, color: '#7a4e28', pos: [0.2, 1.42, 0.02], rot: [0, 0, Math.PI / 2] },
];

export function BlankRack() {
  return (
    <group name="blank-rack">
      {/* Back panel */}
      <mesh receiveShadow position={[0, 0.9, -0.18]}>
        <boxGeometry args={[0.8, 1.8, 0.03]} />
        <primitive object={rackWoodMat} attach="material" />
      </mesh>

      {/* Side uprights */}
      {([-0.385, 0.385] as const).map((x, i) => (
        <mesh key={i} castShadow position={[x, 0.9, 0]}>
          <boxGeometry args={[0.03, 1.8, 0.38]} />
          <primitive object={rackWoodMat} attach="material" />
        </mesh>
      ))}

      {/* Shelves */}
      {([0.08, 0.52, 0.96, 1.4, 1.72] as const).map((y, i) => (
        <mesh key={i} receiveShadow position={[0, y, 0]}>
          <boxGeometry args={[0.74, 0.03, 0.38]} />
          <primitive object={rackWoodMat} attach="material" />
        </mesh>
      ))}

      {/* Wood blanks — per-blank grained material; grain along Y (box height = blank length) */}
      {BLANK_SPECS.map((spec, i) => (
        <mesh
          key={i}
          castShadow
          position={spec.pos}
          rotation={spec.rot}
        >
          {/* Square stock — not yet roughed round (that's the roughing-gouge lesson) */}
          <boxGeometry args={[spec.r * 2, spec.len, spec.r * 2]} />
          <primitive object={makeBoardMaterial(spec.color, undefined, { grainAxis: 'y' })} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

// ─── SafetyGearStation ────────────────────────────────────────────────────────
// Wall-mounted pegboard with face shield + ear protection.

export function SafetyGearStation() {
  return (
    <group name="safety-gear-station">
      {/* Pegboard backing */}
      <mesh receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.7, 0.6, 0.025]} />
        <meshStandardMaterial color="#d4c8a8" roughness={0.9} metalness={0.0} />
      </mesh>

      {/* Face-shield — clear curved visor (torus-ish arc) */}
      <group position={[-0.15, 0.05, 0.06]}>
        {/* Headband */}
        <mesh>
          <torusGeometry args={[0.11, 0.012, 8, 20, Math.PI]} />
          <meshStandardMaterial color="#222222" roughness={0.6} metalness={0.3} />
        </mesh>
        {/* Visor plate */}
        <mesh position={[0, -0.09, 0.04]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.2, 0.15, 0.004]} />
          <meshStandardMaterial
            color="#c8e8ff"
            roughness={0.1}
            metalness={0.0}
            transparent
            opacity={0.55}
          />
        </mesh>
      </group>

      {/* Ear protection — two cups on a band */}
      <group position={[0.2, 0.05, 0.06]}>
        {/* Band */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.005, 0.005, 0.22, 8]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.2} />
        </mesh>
        {/* Left cup */}
        <mesh position={[-0.11, 0, 0]}>
          <cylinderGeometry args={[0.038, 0.035, 0.045, 12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.65} metalness={0.2} />
        </mesh>
        {/* Right cup */}
        <mesh position={[0.11, 0, 0]}>
          <cylinderGeometry args={[0.038, 0.035, 0.045, 12]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.65} metalness={0.2} />
        </mesh>
      </group>

      {/* Mounting hook */}
      <mesh position={[0, 0.28, 0.03]}>
        <boxGeometry args={[0.04, 0.015, 0.04]} />
        <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.6} />
      </mesh>
    </group>
  );
}

// ─── Furniture (combined placement) ──────────────────────────────────────────
// Arranges all pieces around the room perimeter, centre clear for the lathe.

export function Furniture(): ReactNode {
  return (
    <group name="furniture">
      {/* ── Built-in casework — full back wall run ── */}
      <Casework />

      {/* ── Demo monitor — right wall, angled toward lathe ── */}
      <DemoStation />

      {/* ToolCabinet — pushed back against the -Z wall (behind the lathe row),
          clear of the central +Z walkway it used to block at Z=1.2. */}
      <group position={[-2.92, 0, -1.85]} rotation={[0, Math.PI / 2, 0]}>
        <ToolCabinet />
      </group>

      {/* Workbench — left wall, mid-room */}
      <group position={[-2.5, 0, -0.5]} rotation={[0, Math.PI / 2, 0]}>
        <Workbench />
      </group>

      {/* BlankRack — right wall, forward of demo station */}
      <group position={[2.7, 0, 1.4]} rotation={[0, -Math.PI / 2, 0]}>
        <BlankRack />
      </group>

      {/* SafetyGearStation — left wall, near entrance, eye height */}
      <group position={[-2.95, 1.45, 1.8]} rotation={[0, Math.PI / 2, 0]}>
        <SafetyGearStation />
      </group>
    </group>
  );
}
