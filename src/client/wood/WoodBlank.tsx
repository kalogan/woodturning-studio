import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WoodState } from '../../core/types.js';
import type { WoodVisualParams } from '../../session/wood.js';
import { visualToUniforms } from './woodVisual.js';
import { useLatheStore } from '../../workshop/index.js';
import { visualSpinRevPerSec } from '../lathe/spinRate.js';
// vite-plugin-glsl imports the file as a string at build time
import grainGlsl from './grain.glsl';
import { buildBlankBuffers, RING_SEGMENTS } from './blankGeometry.js';

// Pre-compute to avoid per-frame recomputation (no allocation — just a const).
const TWO_PI = 2 * Math.PI;

interface WoodBlankProps {
  woodState: WoodState;
  length: number;
  radius: number;
  /** Per-species visual params. Falls back to cherry-ish defaults if omitted. */
  visual?: WoodVisualParams;
}

// ── Fallback visual (used when no species is specified) ───────────────────────
const DEFAULT_VISUAL: WoodVisualParams = {
  baseColor: '#c07850',
  grainColor: '#8a4828',
  ringFrequency: 8,
  ringContrast: 0.28,
  figure: { type: 'fleck', intensity: 0.15 },
};

// ── Vertex shader snippet ─────────────────────────────────────────────────────
// Passes local model-space position to the fragment so the grain shader can
// use the lathe axis (Y) for rings + figure without world-space distortion.
const VERT_PARS_SNIPPET = /* glsl */ `
varying vec3 v_localPos;
`;

const VERT_BEGIN_SNIPPET = /* glsl */ `
v_localPos = position;
`;

// ── Fragment shader injection ─────────────────────────────────────────────────
// We declare the varying, insert the grain GLSL, then override diffuseColor
// inside the standard #include <color_fragment> chunk.
const FRAG_PARS_SNIPPET =
  'varying vec3 v_localPos;\n' + grainGlsl;

// Replace the color_fragment include so grain runs there and PBR lighting
// (normal maps, roughness, metalness, env-maps) still applies afterward.
// NOTE: diffuseColor is already declared earlier in the standard fragment main
// (`vec4 diffuseColor = vec4( diffuse, opacity )`), so we ASSIGN, not redeclare
// (redeclaring causes a GLSL "redefinition" compile error at runtime).
const FRAG_COLOR_REPLACEMENT = /* glsl */ `
diffuseColor = vec4(computeWoodColor(v_localPos), opacity);
`;

// ── Geometry builder ──────────────────────────────────────────────────────────

/**
 * Creates a THREE.BufferGeometry whose cross-section morphs SQUARE → ROUND
 * per station, driven by how much material has been removed from each station.
 *
 * At a fresh blank (no cuts): profile == originalProfile → removed=0 → t=0
 * → every station is a pure square cross-section.
 *
 * As the player roughs a section: radius drops, t rises toward 1, cross-section
 * interpolates toward a circle of radius currentR.
 */
function buildBlankGeometry(
  originalProfile: Float32Array,
  currentProfile: Float32Array,
  length: number,
): THREE.BufferGeometry {
  const { positions, indices } = buildBlankBuffers(
    originalProfile,
    currentProfile,
    length,
    RING_SEGMENTS,
  );

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  geo.computeVertexNormals();
  return geo;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WoodBlank({ woodState, length, visual }: WoodBlankProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const prevProfileRef = useRef<Float32Array | null>(null);

  // ── Build the custom material once (never re-created unless disposed) ──────
  // Pre-allocate uniform objects to satisfy constraint #3 (no per-frame alloc).
  const { material, uniforms } = useMemo(() => {
    const params = visualToUniforms(visual ?? DEFAULT_VISUAL);

    const u = {
      u_baseColor: { value: new THREE.Color(...params.baseColor) },
      u_grainColor: { value: new THREE.Color(...params.grainColor) },
      u_ringFrequency: { value: params.ringFrequency },
      u_ringContrast: { value: params.ringContrast },
      u_figureType: { value: params.figureType },
      u_figureIntensity: { value: params.figureIntensity },
      u_tearout: { value: 0.0 },
    };

    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.85,
      metalness: 0.0,
      side: THREE.DoubleSide,
    });

    mat.onBeforeCompile = (shader) => {
      // Merge our custom uniforms into the shader
      Object.assign(shader.uniforms, u);

      // ── Vertex shader: inject varying declaration + assignment ──────────
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          '#include <common>\n' + VERT_PARS_SNIPPET,
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n' + VERT_BEGIN_SNIPPET,
        );

      // ── Fragment shader: inject grain function + varying declaration ────
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          '#include <common>\n' + FRAG_PARS_SNIPPET,
        )
        // Replace the color_fragment chunk with our grain computation
        .replace(
          '#include <color_fragment>',
          FRAG_COLOR_REPLACEMENT,
        );
    };

    // Mark for shader recompile when onBeforeCompile changes (version flag)
    mat.customProgramCacheKey = () => 'wood-grain-v1';

    return { material: mat, uniforms: u };
  }, []); // Material is built once; uniforms are mutated in the effects below

  // ── Update color/grain uniforms when species changes ──────────────────────
  // No new THREE.Color() objects per frame — we reuse the pre-allocated ones.
  useEffect(() => {
    const params = visualToUniforms(visual ?? DEFAULT_VISUAL);
    uniforms.u_baseColor.value.setRGB(...params.baseColor);
    uniforms.u_grainColor.value.setRGB(...params.grainColor);
    uniforms.u_ringFrequency.value = params.ringFrequency;
    uniforms.u_ringContrast.value = params.ringContrast;
    uniforms.u_figureType.value = params.figureType;
    uniforms.u_figureIntensity.value = params.figureIntensity;
    material.needsUpdate = false; // uniform values update without full recompile
  }, [visual, material, uniforms]);

  // ── Compute a coarse tearout factor (0..1) from tearout array ────────────
  // Update the tearout uniform when woodState.tearout changes; this is
  // done outside useFrame so it only runs when data actually changes.
  useEffect(() => {
    let maxT = 0;
    for (let i = 0; i < woodState.tearout.length; i++) {
      const t = woodState.tearout[i] ?? 0;
      if (t > maxT) maxT = t;
    }
    uniforms.u_tearout.value = Math.min(maxT, 1.0);
  }, [woodState.tearout, uniforms]);

  // ── Initial geometry (square stock — no cuts yet) ─────────────────────────
  // Uses the custom square→round BufferGeometry. At a fresh blank,
  // profile == originalProfile → removed=0 → t=0 → pure square cross-section.
  const initialGeometry = useMemo(() => {
    const geo = buildBlankGeometry(woodState.originalProfile, woodState.profile, length);
    geometryRef.current = geo;
    prevProfileRef.current = new Float32Array(woodState.profile);
    return geo;
  }, []); // Geometry rebuilt in useFrame when profile changes; initial build only

  // ── Per-frame: spin + geometry rebuild on profile change ─────────────────
  // The geometry rebuild allocates (acceptable — only on profile change, not
  // every frame). The spin path has zero per-frame allocation.
  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Spin in place about the blank's own length/symmetry axis. The custom
    // geometry lays the length along Y (same axis convention as old LatheGeometry),
    // so spinning about Y reads as the wood spinning on the lathe.
    // Read rpm imperatively (no hook subscription → no per-frame React re-render).
    // Use the COMPRESSED visual spin rate (not literal rpm/60) so the spin doesn't
    // alias/wagon-wheel at 60fps and stays monotonic with rpm — see lathe/spinRate.ts.
    const store = useLatheStore.getState();
    mesh.rotation.y += visualSpinRevPerSec(store.currentRpm, store.maxRpm) * TWO_PI * dt;

    // Detect profile change (same logic as before)
    const prev = prevProfileRef.current;
    const cur = woodState.profile;
    let changed = false;
    if (prev === null || prev.length !== cur.length) {
      changed = true;
    } else {
      for (let i = 0; i < cur.length; i++) {
        if (prev[i] !== cur[i]) {
          changed = true;
          break;
        }
      }
    }

    if (changed) {
      // Rebuild the square→round geometry with the updated profile.
      // Dispose old geometry to free GPU memory before swapping.
      const newGeo = buildBlankGeometry(woodState.originalProfile, cur, length);

      if (geometryRef.current) {
        geometryRef.current.dispose();
      }
      geometryRef.current = newGeo;
      mesh.geometry = newGeo;
      prevProfileRef.current = new Float32Array(cur);
    }
  });

  return (
    <mesh ref={meshRef} geometry={initialGeometry} material={material} />
  );
}
