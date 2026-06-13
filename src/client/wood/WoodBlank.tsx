import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WoodState } from '../../core/types.js';

interface WoodBlankProps {
  woodState: WoodState;
  length: number;
  radius: number;
}

const LATHE_SEGMENTS = 40;
const BASE_WOOD_COLOR = new THREE.Color('#8B5E3C');
const TEAROUT_COLOR = new THREE.Color('#5C3A1E');

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

export function WoodBlank({ woodState, length }: WoodBlankProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const geometryRef = useRef<THREE.LatheGeometry | null>(null);
  const prevProfileRef = useRef<Float32Array | null>(null);

  // Build initial geometry
  const initialGeometry = useMemo(() => {
    const points = buildLathePoints(woodState.profile, length);
    const geo = new THREE.LatheGeometry(points, LATHE_SEGMENTS);
    geo.computeVertexNormals();
    geometryRef.current = geo;
    prevProfileRef.current = new Float32Array(woodState.profile);
    return geo;
  }, []); // profile is read each frame; geometry rebuilt on change via useFrame

  // Determine if tearout is significant anywhere to tint the material
  const hasTearout = useMemo(() => {
    for (let i = 0; i < woodState.tearout.length; i++) {
      if ((woodState.tearout[i] ?? 0) > 0.1) return true;
    }
    return false;
  }, [woodState.tearout]);

  const materialColor = hasTearout ? TEAROUT_COLOR : BASE_WOOD_COLOR;

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // Spin around Z axis (the lathe axis)
    mesh.rotation.z += 0.05;

    // Rebuild geometry if profile has changed
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

      // Replace geometry on the mesh
      if (geometryRef.current) {
        geometryRef.current.dispose();
      }
      geometryRef.current = newGeo;
      mesh.geometry = newGeo;

      prevProfileRef.current = new Float32Array(cur);
    }
  });

  return (
    <mesh ref={meshRef} geometry={initialGeometry}>
      <meshStandardMaterial
        color={materialColor}
        roughness={0.85}
        metalness={0.0}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
