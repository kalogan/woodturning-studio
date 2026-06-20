/**
 * ShopClutter.tsx — lived-in character props for Hamester Hall.
 *
 * Procedural clutter that makes the hall read like a real, used woodturning
 * classroom rather than an empty showroom:
 *   • Round analog wall clock (static, frozen at 10:10) high on the +Z wall
 *   • Gray steel entry door set into the -X entrance end wall
 *   • Two toolboxes — a stacked red/black chest + a small portable hand box
 *   • Floor offcut blocks and low shaving mounds scattered near the lathe wall
 *   • A rolling cylindrical shavings bin with an overflowing pale curl mound
 *
 * COORDINATE CONVENTION — same as Hall.tsx (origin at the player lathe):
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +4], ceiling 3.6 m, floor Y=0.
 *   -X end (≈ -15.7) = ENTRANCE wall (door lives here).
 *   +X end (≈ +1.975) = sign wall (no door).
 *   -Z wall (≈ -2.5) = lathe row.   +Z wall (≈ +4) = aisle / side wall.
 *   Grinder station sits at [-14.5, 0, 1.5] — props avoid it.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the no-misused-spread
 * lint rule on class instances. All geometry is static — no per-frame
 * allocation, no animation, no browser APIs (Three.js only).
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

// Wall clock — on the +Z side wall, entrance half of the hall, high up.
const CLOCK_POS: [number, number, number] = [-10.0, 2.3, 3.95];
const CLOCK_R   = 0.16;   // face radius (≈ 0.32 m diameter)
const CLOCK_T   = 0.035;  // case depth

// Entry door — set into the -X entrance end wall, offset off-centre in Z so it
// stays clear of the grinder station at [-14.5, 0, 1.5].
const DOOR_X     = -15.7;  // just proud of the entrance wall (HALL_X_MIN = -16)
const DOOR_Z     = -0.6;   // offset toward the lathe wall, away from the grinder
const DOOR_W     = 0.90;   // leaf width
const DOOR_H     = 2.05;   // leaf height
const DOOR_T     = 0.06;   // leaf thickness
const FRAME_T    = 0.07;   // frame jamb thickness
const FRAME_D    = 0.12;   // frame depth

// Toolbox chest — against the +Z wall, clear of the centre aisle.
const CHEST_POS: [number, number, number] = [-8.0, 0, 3.55];

// Portable hand toolbox — on the floor a little down-hall from the chest.
const HANDBOX_POS: [number, number, number] = [-6.6, 0, 3.62];

// Rolling shavings bin — near the lathe row, in the working zone.
const BIN_POS: [number, number, number] = [-4.2, 0, -1.9];
const BIN_R    = 0.20;   // ≈ 0.40 m diameter
const BIN_H    = 0.70;

// Floor offcut blocks — [x, z, w, h, d, rotY, colorIndex] near the lathe wall.
// Z kept in [-2.0, -0.5] so they sit just in front of the lathe row.
const OFFCUTS: [number, number, number, number, number, number, number][] = [
  [-3.2, -1.6, 0.10, 0.07, 0.16, 0.4, 0],
  [-3.0, -1.4, 0.13, 0.06, 0.09, 1.1, 1],
  [-6.1, -1.7, 0.09, 0.09, 0.09, 0.7, 2],
  [-6.4, -1.5, 0.15, 0.05, 0.11, 2.2, 0],
  [-9.0, -1.6, 0.11, 0.08, 0.14, 1.5, 1],
  [-9.3, -1.45, 0.08, 0.06, 0.08, 0.2, 2],
  [-11.7, -1.7, 0.12, 0.07, 0.10, 2.7, 0],
  [-1.7, -1.5, 0.10, 0.06, 0.12, 0.9, 1],
];

// Shaving mounds — [x, z] low pale curl clusters near the lathe wall.
const SHAVING_MOUNDS: [number, number][] = [
  [-2.6, -1.8],
  [-5.4, -1.85],
  [-8.4, -1.8],
  [-10.8, -1.75],
];

// Within each mound, individual curl slivers — [dx, dz, rotY, len] offsets.
const CURL_SLIVERS: [number, number, number, number][] = [
  [0.00, 0.00, 0.3, 0.10],
  [0.06, -0.04, 1.2, 0.08],
  [-0.05, 0.05, 2.0, 0.09],
  [0.04, 0.06, 2.6, 0.07],
  [-0.07, -0.03, 0.9, 0.08],
];

// ─── Module-scope materials ───────────────────────────────────────────────────

const _clockCaseMat = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.55, metalness: 0.40 });
const _clockFaceMat = new THREE.MeshStandardMaterial({ color: '#e8e6df', roughness: 0.65, metalness: 0.05 });
const _clockHandMat = new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.55, metalness: 0.20 });
const _clockTickMat = new THREE.MeshStandardMaterial({ color: '#3a3a3e', roughness: 0.60, metalness: 0.10 });

const _doorMat      = new THREE.MeshStandardMaterial({ color: '#5a5a60', roughness: 0.55, metalness: 0.55 }); // gray steel
const _frameMat     = new THREE.MeshStandardMaterial({ color: '#4a4a50', roughness: 0.50, metalness: 0.60 });
const _kickMat      = new THREE.MeshStandardMaterial({ color: '#7a7a80', roughness: 0.35, metalness: 0.80 }); // brushed kick plate
const _handleMat    = new THREE.MeshStandardMaterial({ color: '#8a8a90', roughness: 0.25, metalness: 0.90 }); // lever handle

const _chestRedMat   = new THREE.MeshStandardMaterial({ color: '#b02828', roughness: 0.45, metalness: 0.55 });
const _chestBlackMat = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.45, metalness: 0.55 });
const _drawerLineMat = new THREE.MeshStandardMaterial({ color: '#1a1a1c', roughness: 0.50, metalness: 0.40 });
const _pullMat       = new THREE.MeshStandardMaterial({ color: '#c8c8cc', roughness: 0.30, metalness: 0.85 });
const _handboxMat    = new THREE.MeshStandardMaterial({ color: '#3a5a70', roughness: 0.50, metalness: 0.45 }); // blue portable box

const _binMat        = new THREE.MeshStandardMaterial({ color: '#3a3a3e', roughness: 0.70, metalness: 0.35 });
const _binRimMat     = new THREE.MeshStandardMaterial({ color: '#5a5a60', roughness: 0.55, metalness: 0.55 });

const _shavingMat    = new THREE.MeshStandardMaterial({ color: '#d8c49a', roughness: 0.90, metalness: 0.0 });

// Offcut wood tones (varied browns), indexed by OFFCUTS[i][6].
const _offcutMats = [
  new THREE.MeshStandardMaterial({ color: '#8a6a44', roughness: 0.85, metalness: 0.0 }),
  new THREE.MeshStandardMaterial({ color: '#9c7a4e', roughness: 0.85, metalness: 0.0 }),
  new THREE.MeshStandardMaterial({ color: '#6e5234', roughness: 0.85, metalness: 0.0 }),
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Round analog wall clock, frozen at 10:10. Flush on a wall (faces -Z). */
function WallClock() {
  // Hand angles (radians, clockwise from 12 o'clock). 10:10 ≈ classic display.
  const hourAngle = -(10 / 12) * Math.PI * 2 - (10 / 60) * (Math.PI * 2 / 12); // 10h + 10m
  const minAngle  = -(10 / 60) * Math.PI * 2;                                  // 10m
  const tickCount = 12;

  return (
    <group name="wall-clock" position={CLOCK_POS} rotation={[0, Math.PI, 0]}>
      {/* Case rim (faces local +Z = world -Z into the hall) */}
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[CLOCK_R, CLOCK_R, CLOCK_T, 32]} />
        <primitive object={_clockCaseMat} attach="material" />
      </mesh>

      {/* White face, set slightly proud of the rim */}
      <mesh position={[0, 0, -CLOCK_T / 2 - 0.002]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[CLOCK_R * 0.92, CLOCK_R * 0.92, 0.004, 32]} />
        <primitive object={_clockFaceMat} attach="material" />
      </mesh>

      {/* Hour tick marks around the face */}
      {Array.from({ length: tickCount }, (_, i) => {
        const a = (i / tickCount) * Math.PI * 2;
        const r = CLOCK_R * 0.78;
        return (
          <mesh
            key={i}
            position={[Math.sin(a) * r, Math.cos(a) * r, -CLOCK_T / 2 - 0.005]}
            rotation={[0, 0, -a]}
          >
            <boxGeometry args={[0.008, 0.022, 0.004]} />
            <primitive object={_clockTickMat} attach="material" />
          </mesh>
        );
      })}

      {/* Hour hand */}
      <mesh position={[0, 0, -CLOCK_T / 2 - 0.007]} rotation={[0, 0, hourAngle]}>
        <boxGeometry args={[0.012, CLOCK_R * 0.5, 0.004]} />
        <primitive object={_clockHandMat} attach="material" />
      </mesh>
      {/* Minute hand */}
      <mesh position={[0, 0, -CLOCK_T / 2 - 0.009]} rotation={[0, 0, minAngle]}>
        <boxGeometry args={[0.009, CLOCK_R * 0.78, 0.004]} />
        <primitive object={_clockHandMat} attach="material" />
      </mesh>
      {/* Centre hub */}
      <mesh position={[0, 0, -CLOCK_T / 2 - 0.011]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.006, 12]} />
        <primitive object={_clockHandMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Closed gray steel entry door on the -X entrance wall (faces +X into hall). */
function EntryDoor() {
  // Door group sits just inside the -X wall; its face points +X (into the hall).
  // Local +X is "into the room"; offsets in X give depth toward the player.
  return (
    <group name="entry-door" position={[DOOR_X, 0, DOOR_Z]} rotation={[0, Math.PI / 2, 0]}>
      {/* After rot +π/2: local +Z → world +X (into hall). Build facing local +Z. */}

      {/* Frame: top header + two jambs (local X is along-wall, local Z is depth) */}
      <mesh castShadow position={[0, DOOR_H + FRAME_T / 2, 0]}>
        <boxGeometry args={[DOOR_W + FRAME_T * 2, FRAME_T, FRAME_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>
      <mesh castShadow position={[-(DOOR_W / 2 + FRAME_T / 2), DOOR_H / 2, 0]}>
        <boxGeometry args={[FRAME_T, DOOR_H + FRAME_T, FRAME_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>
      <mesh castShadow position={[DOOR_W / 2 + FRAME_T / 2, DOOR_H / 2, 0]}>
        <boxGeometry args={[FRAME_T, DOOR_H + FRAME_T, FRAME_D]} />
        <primitive object={_frameMat} attach="material" />
      </mesh>

      {/* Door leaf — set forward (local +Z) into the opening */}
      <mesh castShadow receiveShadow position={[0, DOOR_H / 2, DOOR_T / 2]}>
        <boxGeometry args={[DOOR_W, DOOR_H, DOOR_T]} />
        <primitive object={_doorMat} attach="material" />
      </mesh>

      {/* Brushed-steel kick plate along the bottom of the leaf */}
      <mesh position={[0, 0.12, DOOR_T + 0.002]}>
        <boxGeometry args={[DOOR_W * 0.92, 0.22, 0.006]} />
        <primitive object={_kickMat} attach="material" />
      </mesh>

      {/* Lever handle on the latch side (toward +X local), at ~1.05 m */}
      <group position={[DOOR_W / 2 - 0.10, 1.05, DOOR_T + 0.02]}>
        {/* Rose / backplate */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 0.012, 16]} />
          <primitive object={_handleMat} attach="material" />
        </mesh>
        {/* Lever arm pointing inward along the leaf */}
        <mesh position={[-0.06, 0, 0.02]}>
          <boxGeometry args={[0.12, 0.018, 0.022]} />
          <primitive object={_handleMat} attach="material" />
        </mesh>
      </group>
    </group>
  );
}

/** Stacked red/black metal toolbox chest with suggested drawers. */
function ToolboxChest() {
  const bodyW = 0.62;
  const bodyD = 0.36;
  const topH  = 0.26;   // top chest section
  const botH  = 0.42;   // bottom rolling cabinet
  const drawerYs = [0.10, 0.20] as const;        // top-chest drawer lines
  const botDrawerYs = [0.10, 0.22, 0.34] as const; // bottom-cabinet drawer lines

  return (
    <group name="toolbox-chest" position={CHEST_POS} rotation={[0, Math.PI, 0]}>
      {/* Bottom rolling cabinet (red body) */}
      <mesh castShadow receiveShadow position={[0, botH / 2, 0]}>
        <boxGeometry args={[bodyW, botH, bodyD]} />
        <primitive object={_chestRedMat} attach="material" />
      </mesh>
      {/* Top chest (black body) */}
      <mesh castShadow position={[0, botH + topH / 2 + 0.01, 0]}>
        <boxGeometry args={[bodyW - 0.02, topH, bodyD - 0.02]} />
        <primitive object={_chestBlackMat} attach="material" />
      </mesh>

      {/* Bottom-cabinet drawer division lines + pulls */}
      {botDrawerYs.map((y, i) => (
        <group key={`bd${String(i)}`}>
          <mesh position={[0, y, bodyD / 2 + 0.002]}>
            <boxGeometry args={[bodyW - 0.04, 0.006, 0.004]} />
            <primitive object={_drawerLineMat} attach="material" />
          </mesh>
          <mesh position={[0, y + 0.05, bodyD / 2 + 0.006]}>
            <boxGeometry args={[bodyW * 0.5, 0.02, 0.012]} />
            <primitive object={_pullMat} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Top-chest drawer division lines + pulls */}
      {drawerYs.map((y, i) => (
        <group key={`td${String(i)}`}>
          <mesh position={[0, botH + 0.01 + y, bodyD / 2 - 0.012]}>
            <boxGeometry args={[bodyW - 0.06, 0.006, 0.004]} />
            <primitive object={_drawerLineMat} attach="material" />
          </mesh>
          <mesh position={[0, botH + 0.01 + y + 0.04, bodyD / 2 - 0.008]}>
            <boxGeometry args={[bodyW * 0.45, 0.018, 0.012]} />
            <primitive object={_pullMat} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Small portable hand toolbox with a top carry handle. */
function HandToolbox() {
  const w = 0.34;
  const h = 0.18;
  const d = 0.18;

  return (
    <group name="hand-toolbox" position={HANDBOX_POS} rotation={[0, Math.PI, 0]}>
      {/* Box body */}
      <mesh castShadow receiveShadow position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <primitive object={_handboxMat} attach="material" />
      </mesh>
      {/* Lid ridge */}
      <mesh position={[0, h - 0.02, 0]}>
        <boxGeometry args={[w * 0.96, 0.03, d * 0.96]} />
        <primitive object={_chestBlackMat} attach="material" />
      </mesh>
      {/* Carry handle arch (two posts + bar) */}
      <mesh position={[-w * 0.18, h + 0.05, 0]}>
        <boxGeometry args={[0.016, 0.10, 0.016]} />
        <primitive object={_chestBlackMat} attach="material" />
      </mesh>
      <mesh position={[w * 0.18, h + 0.05, 0]}>
        <boxGeometry args={[0.016, 0.10, 0.016]} />
        <primitive object={_chestBlackMat} attach="material" />
      </mesh>
      <mesh position={[0, h + 0.10, 0]}>
        <boxGeometry args={[w * 0.42, 0.016, 0.020]} />
        <primitive object={_chestBlackMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Cylindrical rolling shavings bin with an overflowing pale curl mound on top. */
function ShavingsBin() {
  return (
    <group name="shavings-bin" position={BIN_POS}>
      {/* Bin body */}
      <mesh castShadow receiveShadow position={[0, BIN_H / 2, 0]}>
        <cylinderGeometry args={[BIN_R, BIN_R * 0.88, BIN_H, 20]} />
        <primitive object={_binMat} attach="material" />
      </mesh>
      {/* Top rim band */}
      <mesh position={[0, BIN_H - 0.02, 0]}>
        <cylinderGeometry args={[BIN_R + 0.01, BIN_R + 0.01, 0.04, 20]} />
        <primitive object={_binRimMat} attach="material" />
      </mesh>
      {/* Overflowing shavings mound (squashed sphere) */}
      <mesh position={[0, BIN_H + 0.04, 0]} scale={[1, 0.45, 1]}>
        <sphereGeometry args={[BIN_R * 0.95, 14, 10]} />
        <primitive object={_shavingMat} attach="material" />
      </mesh>
      {/* A couple of stray curls spilling over the rim */}
      <mesh position={[BIN_R * 0.7, BIN_H + 0.02, 0.04]} rotation={[0, 0.5, 1.0]}>
        <boxGeometry args={[0.10, 0.006, 0.02]} />
        <primitive object={_shavingMat} attach="material" />
      </mesh>
      <mesh position={[-BIN_R * 0.6, BIN_H + 0.01, -0.05]} rotation={[0, 1.2, 0.8]}>
        <boxGeometry args={[0.09, 0.006, 0.018]} />
        <primitive object={_shavingMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Scattered floor offcut blocks near the lathe row. */
function FloorOffcuts() {
  return (
    <group name="floor-offcuts">
      {OFFCUTS.map((o, i) => {
        const [x, z, w, h, d, rotY, ci] = o;
        return (
          <mesh
            key={i}
            castShadow
            receiveShadow
            position={[x, h / 2, z]}
            rotation={[0, rotY, 0]}
          >
            <boxGeometry args={[w, h, d]} />
            <primitive object={_offcutMats[ci] ?? _offcutMats[0]} attach="material" />
          </mesh>
        );
      })}
    </group>
  );
}

/** Low pale shaving mounds suggested by small tilted slivers on the floor. */
function ShavingPiles() {
  return (
    <group name="shaving-piles">
      {SHAVING_MOUNDS.map((m, mi) => {
        const [mx, mz] = m;
        return (
          <group key={mi} position={[mx, 0, mz]}>
            {CURL_SLIVERS.map((s, si) => {
              const [dx, dz, rotY, len] = s;
              return (
                <mesh
                  key={si}
                  position={[dx, 0.006, dz]}
                  rotation={[0.12, rotY, 0.08]}
                >
                  <boxGeometry args={[len, 0.004, 0.012]} />
                  <primitive object={_shavingMat} attach="material" />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * ShopClutter — lived-in character props for Hamester Hall.
 *
 * A single static group composing a wall clock, entry door, toolboxes, scattered
 * floor offcuts + shaving piles, and a rolling shavings bin. All placements are
 * fixed literal coordinates tuned to avoid the lathes, grinder, and spawn aisle.
 */
export function ShopClutter() {
  return (
    <group name="shop-clutter">
      <WallClock />
      <EntryDoor />
      <ToolboxChest />
      <HandToolbox />
      <ShavingsBin />
      <FloorOffcuts />
      <ShavingPiles />
    </group>
  );
}
