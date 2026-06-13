import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WoodState } from '../../core/types.js';
import type { WoodVisualParams } from '../../session/wood.js';
import { visualToUniforms } from './woodVisual.js';
// vite-plugin-glsl imports the file as a string at build time
import grainGlsl from './grain.glsl';

interface WoodBlankProps {
  woodState: WoodState;
  length: number;
  radius: number;
  /** Per-species visual params. Falls back to cherry-ish defaults if omitted. */
  visual?: WoodVisualParams;
}

const LATHE_SEGMENTS = 40;

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

// ── Geometry helpers ──────────────────────────────────────────────────────────

function buildLathePoints(
  profile: Float32Array,
  length: number,
): THREE.Vector2[] {
  const stations = profile.length;
  const points: THREE.Vector2[] = [];
  for (let i = 0; i < stations; i++) {
    const r = profile[i] ?? 0;
    const z = (i / (stations - 1)) * length - length / 2;
    points.push(new THREE.Vector2(r, z));
  }
  return points;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WoodBlank({ woodState, length, visual }: WoodBlankProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometryRef = useRef<THREE.LatheGeometry | null>(null);
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

  // ── Initial geometry ──────────────────────────────────────────────────────
  const initialGeometry = useMemo(() => {
    const points = buildLathePoints(woodState.profile, length);
    const geo = new THREE.LatheGeometry(points, LATHE_SEGMENTS);
    geo.computeVertexNormals();
    geometryRef.current = geo;
    prevProfileRef.current = new Float32Array(woodState.profile);
    return geo;
  }, []); // Geometry rebuilt each frame when profile changes (see useFrame)

  // ── Per-frame: spin + geometry rebuild on profile change ─────────────────
  // Pre-allocate nothing here; buildLathePoints creates Vector2 only when profile
  // changes (which is acceptable — it's not a hot every-frame alloc).
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Spin in place about the blank's own length/symmetry axis. LatheGeometry
    // revolves the profile around Y, so Y IS the long axis — spinning about Y is
    // "spin in place" (spinning about Z tumbled it end-over-end). The turning rig
    // lays this Y axis onto the lathe's horizontal spindle axis (see TurningScene),
    // so this reads as the wood spinning on the lathe.
    // TODO(T2b-interaction): drive this rate from useLatheStore.currentRpm once the
    // power/speed-dial interaction exists; constant default until then.
    mesh.rotation.y += 0.05;

    // Detect profile change
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
      const points = buildLathePoints(cur, length);
      const newGeo = new THREE.LatheGeometry(points, LATHE_SEGMENTS);
      newGeo.computeVertexNormals();

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
