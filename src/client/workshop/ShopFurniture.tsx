/**
 * ShopFurniture.tsx — shop-floor furniture that makes the turning classroom
 * feel inhabited.
 *
 * Composes:
 *   • One rolling steel utility/tool cart (2 shelves, 4 casters, push handle)
 *     parked beside the prop lathe at X ≈ -5, on the aisle side (Z ≈ +0.9),
 *     loaded with a couple of turning tools, a caliper, a coffee-can of pencils,
 *     and a small stack of coloured sandpaper squares.
 *   • Three round-seat steel shop stools in a loose arc in front of the demo
 *     bench (X ≈ -8.5 … -10.0, Z ≈ +1.4) where students sit to watch demos.
 *
 * COORDINATE CONVENTION — same as Hall.tsx (origin at the player lathe):
 *   Hall X ∈ [-16, +2], Z ∈ [-2.5, +4], ceiling 3.6 m, floor Y=0.
 *   -Z wall (≈ -2.5) = lathe row (prop lathes at X -2.5…-12.5, Z ≈ 0).
 *   Centre walk lane ≈ Z 0.8…2.0; large props are kept off it.
 *   1.4 m radius around the origin (player lathe) is kept clear.
 *
 * Distinct name from the existing Furniture.tsx (back-wall cabinets) — this is
 * loose floor furniture.
 *
 * Materials are pre-allocated at module scope and attached via
 * <primitive object={mat} attach="material" /> to avoid the no-misused-spread
 * lint rule on class instances. All geometry is static — no per-frame
 * allocation, no animation, no Math.random, no browser APIs (Three.js only).
 */

import * as THREE from 'three';

// ─── Director tuning knobs ────────────────────────────────────────────────────

// Rolling utility cart — was parked at [-5, 0, 2.9], in the central +Z walkway.
// Moved over to the demo side (Z≈4.0, -X of the demo cluster) so it's out of the
// through-path while staying handy to the demo station.
const CART_POS: [number, number, number] = [-10.5, 0, 4.0];
const CART_ROT: [number, number, number] = [0, 0, 0];

const CART_W   = 0.60;   // width  (X)
const CART_D   = 0.40;   // depth  (Z)
const CART_H   = 0.84;   // top-shelf height
const SHELF_T  = 0.022;  // shelf slab thickness
const SHELF_MID_Y = 0.42; // mid shelf height
const SHELF_BOT_Y = 0.10; // bottom shelf height
const POST_T   = 0.022;  // corner-post square cross-section
const CASTER_R = 0.035;  // caster wheel radius
const CASTER_H = 0.022;  // caster wheel thickness
const HANDLE_H = 0.16;   // push-handle height above top shelf

// Shop stools — loose arc in front of the demo bench (DEMO_BENCH_POS ≈ [-7,0,2.5]).
// Placed at the aisle edge, X -8.5 … -10.0, Z ≈ 1.35…1.5, NOT blocking the
// centre lane and clear of the demo bench footprint (W 1.3 around X=-7).
// [x, z, rotY] per stool — varied so they read as casually placed.
const STOOLS: [number, number, number][] = [
  [-8.5, 3.35, 0.5],
  [-9.3, 3.5, -0.7],
  [-10.1, 3.4, 0.2],
];

const SEAT_R    = 0.20;   // round seat radius (≈ 0.40 m dia)
const SEAT_T    = 0.035;  // seat thickness
const SEAT_Y    = 0.60;   // seat height
const COL_R     = 0.022;  // central column radius
const RING_R    = 0.16;   // foot-ring radius (path centre)
const RING_T    = 0.012;  // foot-ring tube thickness
const RING_Y    = 0.22;   // foot-ring height
const STOOL_LEG_LEN = 0.42; // splayed leg length
const STOOL_LEGS = 4;       // number of splayed legs

// ─── Module-scope materials ───────────────────────────────────────────────────

const _cartSteelMat = new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: 0.45, metalness: 0.62 });
const _cartShelfMat = new THREE.MeshStandardMaterial({ color: '#6a6d72', roughness: 0.40, metalness: 0.58 });
const _casterMat    = new THREE.MeshStandardMaterial({ color: '#2a2a2e', roughness: 0.70, metalness: 0.25 });
const _casterHubMat = new THREE.MeshStandardMaterial({ color: '#5a5a60', roughness: 0.45, metalness: 0.60 });

const _stoolSteelMat = new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: 0.45, metalness: 0.62 });
const _seatMat       = new THREE.MeshStandardMaterial({ color: '#6a6d72', roughness: 0.42, metalness: 0.55 });

// Cart-top items
const _toolSteelMat  = new THREE.MeshStandardMaterial({ color: '#b8bcc2', roughness: 0.30, metalness: 0.85 }); // tool blades / caliper
const _toolHandleMat = new THREE.MeshStandardMaterial({ color: '#5a3a22', roughness: 0.70, metalness: 0.05 }); // wood handles
const _canMat        = new THREE.MeshStandardMaterial({ color: '#9a6a3a', roughness: 0.55, metalness: 0.30 }); // coffee can
const _pencilMat     = new THREE.MeshStandardMaterial({ color: '#c8a850', roughness: 0.65, metalness: 0.05 }); // pencils

// Sandpaper square tones (muted tans / greys), indexed.
const _sandpaperMats = [
  new THREE.MeshStandardMaterial({ color: '#b8a888', roughness: 0.95, metalness: 0.0 }),
  new THREE.MeshStandardMaterial({ color: '#9a8e7a', roughness: 0.95, metalness: 0.0 }),
  new THREE.MeshStandardMaterial({ color: '#cabfa0', roughness: 0.95, metalness: 0.0 }),
  new THREE.MeshStandardMaterial({ color: '#857d70', roughness: 0.95, metalness: 0.0 }),
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

/** A single caster wheel + hub, oriented to roll along X. */
function Caster({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Wheel disc (axle along X) */}
      <mesh castShadow position={[0, CASTER_R, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[CASTER_R, CASTER_R, CASTER_H, 14]} />
        <primitive object={_casterMat} attach="material" />
      </mesh>
      {/* Swivel bracket / hub above the wheel */}
      <mesh castShadow position={[0, CASTER_R * 2 + 0.012, 0]}>
        <boxGeometry args={[0.04, 0.03, 0.04]} />
        <primitive object={_casterHubMat} attach="material" />
      </mesh>
    </group>
  );
}

/** Turning tools, caliper, pencil-can, and sandpaper stack on the cart top. */
function CartItems() {
  const topY = CART_H + SHELF_T / 2;
  return (
    <group name="cart-items">
      {/* Two turning tools lying along X, slightly splayed */}
      <group position={[-0.05, topY + 0.012, -0.07]} rotation={[0, 0.18, 0]}>
        {/* steel blade */}
        <mesh castShadow position={[0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.009, 0.009, 0.26, 10]} />
          <primitive object={_toolSteelMat} attach="material" />
        </mesh>
        {/* wood handle */}
        <mesh castShadow position={[-0.14, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.014, 0.16, 10]} />
          <primitive object={_toolHandleMat} attach="material" />
        </mesh>
      </group>
      <group position={[-0.08, topY + 0.012, 0.02]} rotation={[0, -0.12, 0]}>
        <mesh castShadow position={[0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.008, 0.008, 0.24, 10]} />
          <primitive object={_toolSteelMat} attach="material" />
        </mesh>
        <mesh castShadow position={[-0.13, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.017, 0.013, 0.15, 10]} />
          <primitive object={_toolHandleMat} attach="material" />
        </mesh>
      </group>

      {/* Small caliper — two flat steel bars, lying flat */}
      <group position={[0.05, topY + 0.008, -0.10]} rotation={[0, 0.6, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.18, 0.006, 0.022]} />
          <primitive object={_toolSteelMat} attach="material" />
        </mesh>
        <mesh castShadow position={[0.0, 0.008, 0.0]} rotation={[0, 0.25, 0]}>
          <boxGeometry args={[0.16, 0.006, 0.018]} />
          <primitive object={_toolSteelMat} attach="material" />
        </mesh>
      </group>

      {/* Coffee-can of pencils */}
      <group position={[0.18, topY, 0.10]}>
        <mesh castShadow position={[0, 0.055, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.11, 16]} />
          <primitive object={_canMat} attach="material" />
        </mesh>
        {/* a few pencils poking up at varied angles */}
        {([[-0.012, 0.10, 0.0], [0.014, 0.10, -0.05], [0.0, 0.13, 0.18]] as const).map(
          ([tilt, len, rotY], i) => (
            <mesh key={i} castShadow
                  position={[Math.sin(rotY) * 0.012, 0.11 + len / 2, Math.cos(rotY) * 0.012]}
                  rotation={[tilt, rotY, 0.05]}>
              <cylinderGeometry args={[0.004, 0.004, len, 6]} />
              <primitive object={_pencilMat} attach="material" />
            </mesh>
          ),
        )}
      </group>

      {/* Sandpaper square stack — thin coloured squares slightly offset */}
      <group position={[0.16, 0, -0.08]}>
        {_sandpaperMats.map((mat, i) => (
          <mesh key={i} castShadow
                position={[i * 0.004, topY + 0.003 + i * 0.0025, i * 0.005]}
                rotation={[0, 0.1 * i, 0]}>
            <boxGeometry args={[0.11, 0.002, 0.11]} />
            <primitive object={mat} attach="material" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Rolling steel utility cart — two shelves, corner posts, casters, push handle. */
function UtilityCart() {
  const halfW = CART_W / 2 - POST_T / 2;
  const halfD = CART_D / 2 - POST_T / 2;
  const postPositions: [number, number][] = [
    [-halfW, -halfD],
    [ halfW, -halfD],
    [-halfW,  halfD],
    [ halfW,  halfD],
  ];
  const casterPositions: [number, number][] = [
    [-halfW, -halfD],
    [ halfW, -halfD],
    [-halfW,  halfD],
    [ halfW,  halfD],
  ];
  const shelfYs = [CART_H, SHELF_MID_Y, SHELF_BOT_Y] as const;

  return (
    <group name="utility-cart" position={CART_POS} rotation={CART_ROT}>
      {/* Casters */}
      {casterPositions.map(([cx, cz], i) => (
        <Caster key={`c${String(i)}`} position={[cx, 0, cz]} />
      ))}

      {/* Corner posts (rise from caster tops to top shelf) */}
      {postPositions.map(([px, pz], i) => (
        <mesh key={`p${String(i)}`} castShadow
              position={[px, CASTER_R * 2 + CART_H / 2, pz]}>
          <boxGeometry args={[POST_T, CART_H, POST_T]} />
          <primitive object={_cartSteelMat} attach="material" />
        </mesh>
      ))}

      {/* Shelves */}
      {shelfYs.map((y, i) => (
        <mesh key={`s${String(i)}`} castShadow receiveShadow
              position={[0, CASTER_R * 2 + y, 0]}>
          <boxGeometry args={[CART_W, SHELF_T, CART_D]} />
          <primitive object={_cartShelfMat} attach="material" />
        </mesh>
      ))}

      {/* Push handle — a U-bar rising above the top shelf at the +Z end */}
      <group position={[0, CASTER_R * 2 + CART_H, CART_D / 2 - POST_T / 2]}>
        {/* two uprights */}
        {([-halfW, halfW] as const).map((hx, i) => (
          <mesh key={`hu${String(i)}`} castShadow position={[hx, HANDLE_H / 2, 0]}>
            <boxGeometry args={[POST_T, HANDLE_H, POST_T]} />
            <primitive object={_cartSteelMat} attach="material" />
          </mesh>
        ))}
        {/* cross-bar grip */}
        <mesh castShadow position={[0, HANDLE_H, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, CART_W, 12]} />
          <primitive object={_cartSteelMat} attach="material" />
        </mesh>
      </group>

      <CartItems />
    </group>
  );
}

/** A single round-seat steel shop stool — seat, column, splayed legs, foot ring. */
function ShopStool({ position, rotationY }: {
  position: [number, number, number];
  rotationY: number;
}) {
  const ringSegments = 8;

  return (
    <group name="shop-stool" position={position} rotation={[0, rotationY, 0]}>
      {/* Round seat */}
      <mesh castShadow receiveShadow position={[0, SEAT_Y, 0]}>
        <cylinderGeometry args={[SEAT_R, SEAT_R, SEAT_T, 24]} />
        <primitive object={_seatMat} attach="material" />
      </mesh>

      {/* Central column */}
      <mesh castShadow position={[0, SEAT_Y / 2 + RING_Y / 2, 0]}>
        <cylinderGeometry args={[COL_R, COL_R, SEAT_Y - SEAT_T / 2 - RING_Y / 2, 12]} />
        <primitive object={_stoolSteelMat} attach="material" />
      </mesh>

      {/* Splayed legs from a low hub down to the floor */}
      {Array.from({ length: STOOL_LEGS }, (_, i) => {
        const a = (i / STOOL_LEGS) * Math.PI * 2 + Math.PI / 4;
        const splay = 0.42; // outward tilt (radians)
        return (
          <mesh
            key={i}
            castShadow
            position={[
              Math.sin(a) * (STOOL_LEG_LEN * 0.5 * Math.sin(splay)),
              STOOL_LEG_LEN * 0.5 * Math.cos(splay),
              Math.cos(a) * (STOOL_LEG_LEN * 0.5 * Math.sin(splay)),
            ]}
            rotation={[splay * Math.cos(a), -a, -splay * Math.sin(a)]}
          >
            <boxGeometry args={[0.022, STOOL_LEG_LEN, 0.022]} />
            <primitive object={_stoolSteelMat} attach="material" />
          </mesh>
        );
      })}

      {/* Foot ring — approximated by short tube segments forming a polygon */}
      {Array.from({ length: ringSegments }, (_, i) => {
        const a = (i / ringSegments) * Math.PI * 2;
        const segLen = (2 * Math.PI * RING_R) / ringSegments;
        return (
          <mesh
            key={`r${String(i)}`}
            position={[Math.sin(a) * RING_R, RING_Y, Math.cos(a) * RING_R]}
            rotation={[0, -a + Math.PI / 2, 0]}
          >
            <boxGeometry args={[segLen, RING_T, RING_T]} />
            <primitive object={_stoolSteelMat} attach="material" />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

/**
 * ShopFurniture — loose shop-floor furniture: one rolling utility/tool cart
 * beside a prop-lathe station, and three round-seat stools arced in front of
 * the demo bench. All placements are fixed literal coordinates tuned to avoid
 * the lathes, demo bench, shavings bin, dust collector, and the centre walk lane.
 */
export function ShopFurniture() {
  return (
    <group name="shop-furniture">
      <UtilityCart />
      {STOOLS.map(([x, z, rotY], i) => (
        <ShopStool key={i} position={[x, 0, z]} rotationY={rotY} />
      ))}
    </group>
  );
}
