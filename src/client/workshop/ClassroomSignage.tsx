/**
 * ClassroomSignage.tsx — classroom-teaching layer for Hamester Hall.
 *
 * Turns the hall into a recognisable teaching space:
 *   • A freestanding ROLLING WHITEBOARD on a wheeled base, near the instructor
 *     demo bench. A double-post aluminium frame holds a white board panel; a
 *     marker tray with a few coloured marker boxes runs along the bottom, and a
 *     faint hand-drawn TURNING DIAGRAM (bowl cross-section arc + centre line +
 *     dimension lines + a couple of tool-angle strokes) is suggested with thin
 *     dark line meshes (no text glyphs).
 *   • A handful of WALL SAFETY POSTERS — flat iconographic panels suggesting the
 *     classic shop signs (yellow caution triangle, blue eye-protection disc,
 *     green first-aid cross, red-bordered rules placard) using simple colour
 *     blocks — no textures, no text.
 *
 * COORDINATE CONVENTION — same as Hall.tsx (origin at the player lathe):
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +4], ceiling 3.6 m, floor Y=0.
 *   -X end (≈ -15.7) = ENTRANCE wall (gray door at Z≈-0.6).
 *   +X end (≈ +1.975) = sign wall.   -Z wall (≈ -2.5) = lathe row.
 *   +Z wall (≈ +4) = aisle / side wall.
 *   Demo bench centre is at [-7.0, 0, 2.5]; the whiteboard sits down-aisle of it
 *   at X≈-5.4, clear of the bench footprint and the centre walking aisle.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the no-misused-spread
 * lint rule on class instances. All geometry is static — no per-frame
 * allocation, no animation, no Math.random, no Date.now, no browser APIs
 * (Three.js only).
 */

import type { ReactNode } from 'react';
import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

// Rolling whiteboard: freestanding, down-aisle (+X side ends nearer player) of
// the demo bench [-7.0, 0, 2.5] (footprint X∈[-7.65,-6.35], Z∈[2.14,2.86]).
// Placed at X≈-5.4, pulled ~1 m into the room from the +Z wall, angled to face
// back toward the lathes / aisle so the class can read the diagram.
const BOARD_POS: [number, number, number] = [-5.4, 0, 3.05];
const BOARD_ROT: [number, number, number] = [0, -Math.PI * 0.78, 0];

// Board panel geometry
const BOARD_W   = 1.5;    // board face width (X, local)
const BOARD_H   = 0.9;    // board face height (Y)
const BOARD_T   = 0.03;   // board panel thickness (local Z)
const BOARD_LO  = 1.0;    // bottom edge height of the board face
const BOARD_CY  = BOARD_LO + BOARD_H / 2;  // board face centre height

// Frame posts + base
const POST_W    = 0.05;   // upright post cross-section
const POST_X    = BOARD_W / 2 + 0.04;  // post offset from board centre
const POST_TOP  = BOARD_LO + BOARD_H + 0.06;   // posts rise just above the board
const FOOT_W    = 0.06;   // wheeled base foot beam cross-section
const FOOT_LEN  = 0.62;   // each base foot length (along local Z)
const CASTER_R  = 0.035;  // caster wheel radius
const CASTER_H  = 0.03;   // caster wheel thickness

// Marker tray (along the bottom edge of the board)
const TRAY_LEN  = BOARD_W * 0.8;
const TRAY_D    = 0.05;   // tray depth out from board (local +Z)
const TRAY_H    = 0.022;  // tray lip height
const TRAY_Y    = BOARD_LO + 0.02;  // sits just below the board face

// Marker boxes resting in the tray — [offsetX, colorIndex]
const MARKERS: [number, number][] = [
  [-0.34, 0],  // red
  [-0.18, 1],  // blue
  [-0.02, 2],  // black
];

// ─── Wall safety posters ───────────────────────────────────────────────────────
// kind: 0 caution-triangle, 1 eye-protection disc, 2 first-aid cross, 3 rules.
// Each: { pos, rot, kind, w, h }. Walls faced flush with a tiny standoff.
type Poster = {
  pos: [number, number, number];
  rot: [number, number, number];
  kind: 0 | 1 | 2 | 3;
  w: number;
  h: number;
};
const POSTERS: Poster[] = [
  // Entrance wall (-X, X≈-15.85), flanking the door at Z≈-0.6. Faces +X.
  { pos: [-15.85, 1.75, 1.4],  rot: [0, Math.PI / 2, 0], kind: 0, w: 0.46, h: 0.46 }, // caution, aisle side
  { pos: [-15.85, 1.75, -1.8], rot: [0, Math.PI / 2, 0], kind: 3, w: 0.42, h: 0.56 }, // rules placard, lathe side
  // Lathe wall (-Z, Z≈-2.46), high in the gaps between prop lathes. Faces +Z.
  { pos: [-3.75, 2.05, -2.46], rot: [0, 0, 0],           kind: 1, w: 0.46, h: 0.46 }, // eye protection
  { pos: [-6.25, 2.05, -2.46], rot: [0, 0, 0],           kind: 2, w: 0.42, h: 0.50 }, // first aid
];

// ─── Module-scope materials ───────────────────────────────────────────────────

const _boardFaceMat = new THREE.MeshStandardMaterial({ color: '#f4f5f3', roughness: 0.22, metalness: 0.05 });
const _frameMat     = new THREE.MeshStandardMaterial({ color: '#c8ccd0', roughness: 0.40, metalness: 0.70 });
const _trayMat      = new THREE.MeshStandardMaterial({ color: '#aeb2b6', roughness: 0.45, metalness: 0.65 });
const _casterMat    = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.60, metalness: 0.30 });
const _lineMat      = new THREE.MeshStandardMaterial({ color: '#3a4250', roughness: 0.70, metalness: 0.05 }); // faint marker ink

const _markerMats = [
  new THREE.MeshStandardMaterial({ color: '#c43838', roughness: 0.45, metalness: 0.10 }), // red
  new THREE.MeshStandardMaterial({ color: '#2f5fb0', roughness: 0.45, metalness: 0.10 }), // blue
  new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.45, metalness: 0.10 }), // black
] as const;

// Poster sign materials
const _signWhiteMat  = new THREE.MeshStandardMaterial({ color: '#ecebe6', roughness: 0.78, metalness: 0.02 });
const _signYellowMat = new THREE.MeshStandardMaterial({ color: '#e8c021', roughness: 0.70, metalness: 0.03 });
const _signBlueMat   = new THREE.MeshStandardMaterial({ color: '#1f5fb0', roughness: 0.65, metalness: 0.05 });
const _signGreenMat  = new THREE.MeshStandardMaterial({ color: '#2a8f4a', roughness: 0.65, metalness: 0.04 });
const _signDarkMat   = new THREE.MeshStandardMaterial({ color: '#1c1c20', roughness: 0.72, metalness: 0.05 });
const _signRedMat    = new THREE.MeshStandardMaterial({ color: '#bf2a2a', roughness: 0.68, metalness: 0.04 });
const _signGreyMat   = new THREE.MeshStandardMaterial({ color: '#9aa0a6', roughness: 0.80, metalness: 0.02 });
const _gogglePaleMat = new THREE.MeshStandardMaterial({ color: '#bcd6ef', roughness: 0.45, metalness: 0.05 });

// ─── Sub-components ─────────────────────────────────────────────────────────

/** The board panel + the faint hand-drawn turning diagram on its face. */
function BoardFace() {
  // Thin line meshes live just proud of the board face (local +Z).
  const faceZ = BOARD_T / 2 + 0.002;

  // Bowl cross-section: a shallow arc of short tilted segments, on the LEFT.
  const arcCx = -0.42;
  const arcCy = BOARD_CY + 0.02;
  const arcR  = 0.20;
  const arcSegs = 9;
  const arc: ReactNode[] = [];
  for (let i = 0; i < arcSegs; i++) {
    // Sweep a bowl-section arc across the bottom half (open bowl shape).
    const t0 = Math.PI * (0.62 + (i / arcSegs) * 0.76);
    const t1 = Math.PI * (0.62 + ((i + 1) / arcSegs) * 0.76);
    const x0 = arcCx + Math.cos(t0) * arcR;
    const y0 = arcCy + Math.sin(t0) * arcR;
    const x1 = arcCx + Math.cos(t1) * arcR;
    const y1 = arcCy + Math.sin(t1) * arcR;
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const len = Math.hypot(x1 - x0, y1 - y0) + 0.004;
    const ang = Math.atan2(y1 - y0, x1 - x0);
    arc.push(
      <mesh key={`arc${String(i)}`} position={[mx, my, faceZ]} rotation={[0, 0, ang]}>
        <boxGeometry args={[len, 0.006, 0.002]} />
        <primitive object={_lineMat} attach="material" />
      </mesh>,
    );
  }

  return (
    <group name="board-face">
      {/* White board slab */}
      <mesh castShadow receiveShadow position={[0, BOARD_CY, 0]}>
        <boxGeometry args={[BOARD_W, BOARD_H, BOARD_T]} />
        <primitive object={_boardFaceMat} attach="material" />
      </mesh>

      {/* ── Faint turning diagram (thin dark line meshes, no text) ── */}

      {/* Bowl cross-section arc */}
      {arc}

      {/* Centre vertical axis line through the bowl */}
      <mesh position={[arcCx, arcCy + 0.04, faceZ]}>
        <boxGeometry args={[0.004, 0.34, 0.002]} />
        <primitive object={_lineMat} attach="material" />
      </mesh>

      {/* Horizontal rim / dimension line across the bowl mouth */}
      <mesh position={[arcCx, arcCy + 0.155, faceZ]}>
        <boxGeometry args={[arcR * 2, 0.004, 0.002]} />
        <primitive object={_lineMat} attach="material" />
      </mesh>

      {/* Lower dimension line (wall thickness call-out) */}
      <mesh position={[arcCx, arcCy - 0.16, faceZ]}>
        <boxGeometry args={[arcR * 1.4, 0.004, 0.002]} />
        <primitive object={_lineMat} attach="material" />
      </mesh>

      {/* ── Tool-angle strokes, on the RIGHT — a few crossing lines ── */}
      <mesh position={[0.36, BOARD_CY + 0.08, faceZ]} rotation={[0, 0, 0.55]}>
        <boxGeometry args={[0.40, 0.006, 0.002]} />
        <primitive object={_lineMat} attach="material" />
      </mesh>
      <mesh position={[0.36, BOARD_CY + 0.02, faceZ]} rotation={[0, 0, -0.35]}>
        <boxGeometry args={[0.40, 0.006, 0.002]} />
        <primitive object={_lineMat} attach="material" />
      </mesh>
      <mesh position={[0.30, BOARD_CY - 0.14, faceZ]}>
        <boxGeometry args={[0.34, 0.004, 0.002]} />
        <primitive object={_lineMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Aluminium double-post frame + wheeled base with 4 casters. */
function BoardFrame() {
  const postPositions = [-1, 1] as const;

  return (
    <group name="board-frame">
      {/* Two upright posts flanking the board */}
      {postPositions.map((sx, i) => (
        <mesh key={`post${String(i)}`} castShadow position={[sx * POST_X, POST_TOP / 2, 0]}>
          <boxGeometry args={[POST_W, POST_TOP, POST_W]} />
          <primitive object={_frameMat} attach="material" />
        </mesh>
      ))}

      {/* Top cross rail tying the posts together */}
      <mesh castShadow position={[0, POST_TOP - POST_W / 2, 0]}>
        <boxGeometry args={[POST_X * 2 + POST_W, POST_W, POST_W]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>

      {/* Bottom cross rail under the board */}
      <mesh castShadow position={[0, BOARD_LO - 0.04, 0]}>
        <boxGeometry args={[POST_X * 2 + POST_W, POST_W, POST_W]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>

      {/* Wheeled base — two foot beams (one under each post) running in Z */}
      {postPositions.map((sx, i) => (
        <mesh key={`foot${String(i)}`} castShadow position={[sx * POST_X, FOOT_W / 2 + CASTER_R, 0]}>
          <boxGeometry args={[FOOT_W, FOOT_W, FOOT_LEN]} />
          <primitive object={_frameMat} attach="material" />
        </mesh>
      ))}

      {/* Four casters — one at each foot end */}
      {postPositions.map((sx, i) =>
        ([-1, 1] as const).map((sz, j) => (
          <mesh
            key={`caster${String(i)}${String(j)}`}
            castShadow
            position={[sx * POST_X, CASTER_R, sz * (FOOT_LEN / 2 - 0.04)]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[CASTER_R, CASTER_R, CASTER_H, 12]} />
            <primitive object={_casterMat} attach="material" />
          </mesh>
        )),
      )}
    </group>
  );
}

/** Marker tray with a few coloured marker boxes. */
function MarkerTray() {
  const faceZ = BOARD_T / 2;
  return (
    <group name="marker-tray" position={[0, TRAY_Y, faceZ]}>
      {/* Tray base shelf, jutting out from the board */}
      <mesh castShadow position={[0, 0, TRAY_D / 2]}>
        <boxGeometry args={[TRAY_LEN, 0.012, TRAY_D]} />
        <primitive object={_trayMat} attach="material" />
      </mesh>
      {/* Front lip */}
      <mesh position={[0, TRAY_H / 2, TRAY_D]}>
        <boxGeometry args={[TRAY_LEN, TRAY_H, 0.008]} />
        <primitive object={_trayMat} attach="material" />
      </mesh>

      {/* Marker boxes lying in the tray (long axis along X) */}
      {MARKERS.map(([ox, ci], i) => (
        <mesh
          key={i}
          castShadow
          position={[ox, 0.016, TRAY_D * 0.55]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.011, 0.011, 0.12, 10]} />
          <primitive object={_markerMats[ci] ?? _markerMats[0]} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/** Freestanding rolling whiteboard with frame, base, tray, and diagram. */
function RollingWhiteboard() {
  return (
    <group name="rolling-whiteboard" position={BOARD_POS} rotation={BOARD_ROT}>
      <BoardFrame />
      <BoardFace />
      <MarkerTray />
    </group>
  );
}

// ─── Safety-sign icon builders (flat primitives, no text/textures) ────────────

/** Yellow caution triangle with a dark border and an exclamation bar + dot. */
function CautionSign({ w, h }: { w: number; h: number }) {
  const tri = Math.min(w, h) * 0.78;  // triangle nominal size
  return (
    <group name="sign-caution">
      {/* White backing plate */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[w, h, 0.012]} />
        <primitive object={_signWhiteMat} attach="material" />
      </mesh>
      {/* Dark triangle border (slightly larger, behind) */}
      <mesh position={[0, -0.02, 0.006]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[tri * 0.62, tri * 0.62, 0.004, 3]} />
        <primitive object={_signDarkMat} attach="material" />
      </mesh>
      {/* Yellow triangle field (smaller, in front) */}
      <mesh position={[0, -0.02, 0.009]}>
        <cylinderGeometry args={[tri * 0.52, tri * 0.52, 0.004, 3]} />
        <primitive object={_signYellowMat} attach="material" />
      </mesh>
      {/* Exclamation bar */}
      <mesh position={[0, 0.02, 0.012]}>
        <boxGeometry args={[0.028, 0.13, 0.003]} />
        <primitive object={_signDarkMat} attach="material" />
      </mesh>
      {/* Exclamation dot */}
      <mesh position={[0, -0.10, 0.012]}>
        <boxGeometry args={[0.028, 0.028, 0.003]} />
        <primitive object={_signDarkMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Blue round "eye protection required" disc with a pale goggle shape. */
function EyeProtectionSign({ w, h }: { w: number; h: number }) {
  const r = Math.min(w, h) * 0.46;
  return (
    <group name="sign-eye">
      {/* White backing plate */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[w, h, 0.012]} />
        <primitive object={_signWhiteMat} attach="material" />
      </mesh>
      {/* Blue disc */}
      <mesh position={[0, 0, 0.006]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r, r, 0.005, 28]} />
        <primitive object={_signBlueMat} attach="material" />
      </mesh>
      {/* Goggle band (pale horizontal lens block) */}
      <mesh position={[0, 0.01, 0.011]}>
        <boxGeometry args={[r * 1.25, r * 0.42, 0.003]} />
        <primitive object={_gogglePaleMat} attach="material" />
      </mesh>
      {/* Two lens cut suggestions (dark dots) */}
      <mesh position={[-r * 0.34, 0.01, 0.014]}>
        <boxGeometry args={[r * 0.32, r * 0.30, 0.003]} />
        <primitive object={_signBlueMat} attach="material" />
      </mesh>
      <mesh position={[r * 0.34, 0.01, 0.014]}>
        <boxGeometry args={[r * 0.32, r * 0.30, 0.003]} />
        <primitive object={_signBlueMat} attach="material" />
      </mesh>
      {/* Head suggestion below goggles */}
      <mesh position={[0, -r * 0.45, 0.011]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[r * 0.34, r * 0.34, 0.003, 20]} />
        <primitive object={_gogglePaleMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Green "first aid" sign — green field with a white cross. */
function FirstAidSign({ w, h }: { w: number; h: number }) {
  const arm = Math.min(w, h) * 0.5;
  return (
    <group name="sign-firstaid">
      {/* Green field */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[w, h, 0.012]} />
        <primitive object={_signGreenMat} attach="material" />
      </mesh>
      {/* White cross — vertical + horizontal bars */}
      <mesh position={[0, 0, 0.008]}>
        <boxGeometry args={[arm * 0.32, arm, 0.004]} />
        <primitive object={_signWhiteMat} attach="material" />
      </mesh>
      <mesh position={[0, 0, 0.008]}>
        <boxGeometry args={[arm, arm * 0.32, 0.004]} />
        <primitive object={_signWhiteMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Red-bordered white rules placard with a few faint gray "text" lines. */
function RulesSign({ w, h }: { w: number; h: number }) {
  const lineYs = [0.16, 0.08, 0.0, -0.08, -0.16] as const;
  const border = 0.025;
  return (
    <group name="sign-rules">
      {/* Red border plate (full size) */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[w, h, 0.012]} />
        <primitive object={_signRedMat} attach="material" />
      </mesh>
      {/* White inner field (inset) */}
      <mesh position={[0, 0, 0.007]}>
        <boxGeometry args={[w - border * 2, h - border * 2, 0.004]} />
        <primitive object={_signWhiteMat} attach="material" />
      </mesh>
      {/* Red title bar near the top */}
      <mesh position={[0, h / 2 - border - 0.05, 0.011]}>
        <boxGeometry args={[w - border * 4, 0.05, 0.003]} />
        <primitive object={_signRedMat} attach="material" />
      </mesh>
      {/* Faint gray "text" lines suggesting rules */}
      {lineYs.map((ly, i) => (
        <mesh key={i} position={[0, ly - 0.04, 0.011]}>
          <boxGeometry args={[(w - border * 4) * (i % 2 === 0 ? 0.9 : 0.7), 0.014, 0.003]} />
          <primitive object={_signGreyMat} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

/** Dispatch a poster to its icon builder by kind. */
function PosterSign({ poster }: { poster: Poster }) {
  const { pos, rot, kind, w, h } = poster;
  return (
    <group name={`poster-${String(kind)}`} position={pos} rotation={rot}>
      {kind === 0 && <CautionSign w={w} h={h} />}
      {kind === 1 && <EyeProtectionSign w={w} h={h} />}
      {kind === 2 && <FirstAidSign w={w} h={h} />}
      {kind === 3 && <RulesSign w={w} h={h} />}
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * ClassroomSignage — rolling whiteboard near the demo bench + wall safety
 * posters. A single static group; all placements are fixed literal coordinates
 * tuned to avoid the demo bench, prop lathes, grinder, door, and wall fixtures.
 */
export function ClassroomSignage() {
  return (
    <group name="classroom-signage">
      <RollingWhiteboard />
      {POSTERS.map((p, i) => (
        <PosterSign key={i} poster={p} />
      ))}
    </group>
  );
}
