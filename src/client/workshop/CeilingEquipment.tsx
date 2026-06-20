/**
 * CeilingEquipment.tsx — Ceiling-suspended shop equipment.
 *
 * Fills the empty ceiling volume of Hamester Hall with authentic industrial
 * character, using CEILING space only (does not touch the crowded walls):
 *   • Two hanging AIR FILTRATION units (the iconic ceiling air cleaner every
 *     wood shop runs) — grey/charcoal boxes with a recessed slatted intake
 *     grille, an outlet on the far end, an indicator LED, suspended by four
 *     thin steel hanger rods up to the ceiling. Static — no spinning fan.
 *   • One suspended gas UNIT HEATER (Reznor-style) in the +Z/entrance corner —
 *     a boxy painted-steel housing with a louvered discharge face pointing
 *     down the hall, a round flue pipe rising into the ceiling, hung from the
 *     ceiling by angle-iron brackets.
 *
 * COORDINATE CONVENTION: same as Hall.tsx — origin at the player lathe.
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +4], ceiling HALL_H = 3.6 m, floor Y=0.
 *   -Z wall (Z≈-2.5) = lathe wall. Two light rows at Z≈-1.5 and Z≈+1.5.
 *
 * HEIGHT / CLEARANCE (verified against Lighting.tsx, Hall.tsx, DustCollection.tsx):
 *   • Light fixtures: panel Y≈3.54, light Y≈3.45, in rows at Z≈-1.5 / Z≈+1.5,
 *     at X = -15,-12,-9,-6,-3,+0.5.
 *   • Ceiling ducts (Hall.tsx): spine over aisle centre Z≈0.75 (Z 0.525–0.975),
 *     Y 3.4–3.6; cross-branch at X≈-7 wall-to-wall.
 *   • Dust trunk (DustCollection.tsx): Y≈2.95, Z≈-2.15 (lathe-wall side).
 *   Air filters hang over the CLEAR centre band at Z≈+0.3 (box Z 0.09–0.51,
 *   clear of the duct spine at Z≥0.525), at X≈-4.5 and X≈-10.5 — between the
 *   light X-positions (so hanger rods miss fixtures) and clear of the X=-7
 *   duct branch. Box body Y 2.95–3.40, tops below the Y=3.54 fixtures.
 *   Unit heater hangs at X≈-14.5, Z≈+3.0 (high entrance corner): box Y 3.0–3.4,
 *   far from any light/duct/trunk — purely empty ceiling corner.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the
 * no-misused-spread lint rule on class instances.
 * No animation, no Math.random, no Date.now, no browser APIs — Three.js only.
 * No per-frame allocation.
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

const CEILING_Y = 3.6;   // HALL_H — rods/flue terminate here

// ── Air filtration units (×2) ────────────────────────────────────────────────
/** X positions of the two hanging air cleaners (between light X-positions). */
const FILTER_XS: readonly number[] = [-4.5, -10.5];
const FILTER_Z = 0.3;    // clear centre band, just shy of the duct spine (Z≥0.525)

const FILT_L = 0.85;     // length along X
const FILT_H = 0.45;     // body height
const FILT_D = 0.42;     // depth along Z
const FILT_TOP_Y = 3.40; // top of the housing (below Y=3.54 fixtures)
const FILT_CY = FILT_TOP_Y - FILT_H / 2;  // body centre Y ≈ 3.175 (body 2.95–3.40)

const GRILLE_INSET = 0.04;   // recess depth of the intake grille face
const GRILLE_SLATS = 5;      // horizontal slats on the intake face
const LED_SIZE = 0.035;      // indicator LED block edge

// Hanger rods — thin dark steel, body corners up to the ceiling
const ROD_R = 0.010;
const ROD_INSET = 0.10;      // how far in from the box corners the rods attach

// ── Unit heater (×1) ─────────────────────────────────────────────────────────
/** World position of the unit-heater housing centre. */
const HEATER_POS: [number, number, number] = [-14.5, 3.18, 3.0];

const HEAT_W = 0.70;     // along X (discharge points -X, down the hall)
const HEAT_H = 0.55;
const HEAT_D = 0.50;     // along Z

const LOUVER_COUNT = 5;  // angled discharge slats on the -X face
const LOUVER_TILT = 0.45; // slat tilt (radians)

const FLUE_R = 0.055;    // round flue pipe radius
const BRACKET_T = 0.018; // angle-iron bracket thickness

// ─── Module-scope materials ───────────────────────────────────────────────────

const _filterMat = new THREE.MeshStandardMaterial({
  color: '#3a3d42', roughness: 0.55, metalness: 0.45,   // grey/charcoal housing
});
const _grilleMat = new THREE.MeshStandardMaterial({
  color: '#202225', roughness: 0.70, metalness: 0.30,   // dark recessed intake
});
const _slatMat = new THREE.MeshStandardMaterial({
  color: '#34373c', roughness: 0.55, metalness: 0.40,   // grille slats
});
const _outletMat = new THREE.MeshStandardMaterial({
  color: '#2a2c30', roughness: 0.60, metalness: 0.35,   // far-end outlet panel
});
const _ledMat = new THREE.MeshStandardMaterial({
  color: '#3aff6a', roughness: 0.20, metalness: 0.0,
  emissive: new THREE.Color('#1faa44'), emissiveIntensity: 0.9,  // green status LED
});
const _rodMat = new THREE.MeshStandardMaterial({
  color: '#2a2a2e', roughness: 0.45, metalness: 0.70,   // thin dark steel rod
});
const _heaterMat = new THREE.MeshStandardMaterial({
  color: '#9a4a36', roughness: 0.60, metalness: 0.35,   // industrial tan-red steel
});
const _louverMat = new THREE.MeshStandardMaterial({
  color: '#7a3a2a', roughness: 0.55, metalness: 0.40,   // darker louver slats
});
const _flueMat = new THREE.MeshStandardMaterial({
  color: '#b4b8bc', roughness: 0.45, metalness: 0.60,   // galvanized flue pipe
});
const _bracketMat = new THREE.MeshStandardMaterial({
  color: '#3a3a40', roughness: 0.50, metalness: 0.60,   // angle-iron bracket
});

// ─── Sub-components ───────────────────────────────────────────────────────────

/** One hanging air filtration unit centred at [x, FILT_CY, FILTER_Z]. */
function AirFilter({ x }: { x: number }) {
  // Hanger rod attachment corners (in box-local XZ), inset from the edges.
  const cornerX = FILT_L / 2 - ROD_INSET;
  const cornerZ = FILT_D / 2 - ROD_INSET;
  const corners: readonly [number, number][] = [
    [-cornerX, -cornerZ],
    [ cornerX, -cornerZ],
    [-cornerX,  cornerZ],
    [ cornerX,  cornerZ],
  ];

  // Rods span from the top of the box up to the ceiling.
  const rodLen = CEILING_Y - FILT_TOP_Y;
  const rodCY  = (CEILING_Y + FILT_TOP_Y) / 2;   // world-space rod centre Y

  // Intake grille slats span the room-facing (-Z) face.
  const slatY: number[] = [];
  for (let i = 0; i < GRILLE_SLATS; i++) {
    slatY.push((i / (GRILLE_SLATS - 1) - 0.5) * (FILT_H * 0.7));
  }

  return (
    <group name="air-filter">
      {/* Hanger rods — thin dark steel up to the ceiling */}
      {corners.map(([cx, cz], i) => (
        <mesh key={i} castShadow position={[x + cx, rodCY, FILTER_Z + cz]}>
          <cylinderGeometry args={[ROD_R, ROD_R, rodLen, 8]} />
          <primitive object={_rodMat} attach="material" />
        </mesh>
      ))}

      {/* Main housing */}
      <group position={[x, FILT_CY, FILTER_Z]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[FILT_L, FILT_H, FILT_D]} />
          <primitive object={_filterMat} attach="material" />
        </mesh>

        {/* Recessed intake grille face on the room-facing (-Z) side */}
        <mesh position={[0, 0, -FILT_D / 2 + GRILLE_INSET / 2]}>
          <boxGeometry args={[FILT_L * 0.86, FILT_H * 0.78, GRILLE_INSET]} />
          <primitive object={_grilleMat} attach="material" />
        </mesh>
        {/* Horizontal grille slats across the intake face */}
        {slatY.map((sy, i) => (
          <mesh key={i} position={[0, sy, -FILT_D / 2 + GRILLE_INSET + 0.004]}>
            <boxGeometry args={[FILT_L * 0.82, 0.022, 0.008]} />
            <primitive object={_slatMat} attach="material" />
          </mesh>
        ))}

        {/* Small outlet panel on the far (+Z) end */}
        <mesh position={[0, 0, FILT_D / 2 - 0.004]}>
          <boxGeometry args={[FILT_L * 0.30, FILT_H * 0.45, 0.010]} />
          <primitive object={_outletMat} attach="material" />
        </mesh>

        {/* Indicator LED block — lower corner of the intake face */}
        <mesh position={[FILT_L / 2 - 0.08, -FILT_H / 2 + 0.07, -FILT_D / 2 - 0.002]}>
          <boxGeometry args={[LED_SIZE, LED_SIZE, 0.012]} />
          <primitive object={_ledMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

/** Suspended gas unit heater in the high entrance corner. */
function UnitHeater() {
  const halfW = HEAT_W / 2;
  const topY  = HEATER_POS[1] + HEAT_H / 2;   // top of the housing

  // Louver slats step down the front (-X) discharge face.
  const louverY: number[] = [];
  for (let i = 0; i < LOUVER_COUNT; i++) {
    louverY.push((i / (LOUVER_COUNT - 1) - 0.5) * (HEAT_H * 0.7));
  }

  // Flue pipe rises from the top into the ceiling.
  const flueLen = CEILING_Y - topY;
  const flueCY  = (CEILING_Y + topY) / 2;

  // Angle-iron brackets: two short verticals from the top up to the ceiling.
  const bracketLen = CEILING_Y - topY;
  const bracketCY  = (CEILING_Y + topY) / 2;
  const bracketX: readonly number[] = [-halfW + 0.06, halfW - 0.06];

  return (
    <group name="unit-heater" position={HEATER_POS}>
      {/* Boxy painted-steel housing */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[HEAT_W, HEAT_H, HEAT_D]} />
        <primitive object={_heaterMat} attach="material" />
      </mesh>

      {/* Louvered discharge face on the -X side (points down the hall) */}
      {louverY.map((ly, i) => (
        <mesh key={i} position={[-halfW - 0.012, ly, 0]} rotation={[LOUVER_TILT, 0, 0]}>
          <boxGeometry args={[0.03, 0.05, HEAT_D * 0.82]} />
          <primitive object={_louverMat} attach="material" />
        </mesh>
      ))}

      {/* Flue pipe — round galvanized riser into the ceiling (local space) */}
      <mesh castShadow position={[0.12, flueCY - HEATER_POS[1], -HEAT_D / 2 + 0.1]}>
        <cylinderGeometry args={[FLUE_R, FLUE_R, flueLen, 16]} />
        <primitive object={_flueMat} attach="material" />
      </mesh>

      {/* Angle-iron mounting brackets up to the ceiling (local space) */}
      {bracketX.map((bx, i) => (
        <mesh key={i} castShadow
              position={[bx, bracketCY - HEATER_POS[1], HEAT_D / 2 - 0.04]}>
          <boxGeometry args={[BRACKET_T, bracketLen, BRACKET_T]} />
          <primitive object={_bracketMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * CeilingEquipment — two hanging air filtration units over the centre aisle
 * plus one suspended gas unit heater in the high entrance corner. Static
 * industrial ceiling dressing; no animation.
 */
export function CeilingEquipment() {
  return (
    <group name="ceiling-equipment">
      {FILTER_XS.map((x, i) => (
        <AirFilter key={i} x={x} />
      ))}
      <UnitHeater />
    </group>
  );
}
