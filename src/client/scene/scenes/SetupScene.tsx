/**
 * SetupScene — Lesson 0 "Set Up Your Lathe".
 *
 * Scene3D: a fixed view of the workshop + lathe (the bench toolbox lives here too,
 *   geometrically; v1 mounts via the overlay, a 3D grab/mount pass comes later).
 * Overlay: the playable setup — grab an accessory, mount it at a point. Right one
 *   required (wrong accessory / wrong spot → coaching nudge). Driven by setupStore.
 */

import { useEffect } from 'react';
import { useRef } from 'react';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { Lighting, Room, Furniture } from '../../workshop/index.js';
import { Lathe } from '../../lathe/index.js';
import { useSetupStore } from '../../../workshop/setupStore.js';
import { getLatheSetup, mountPointLabel, type MountPoint } from '../../../session/setup.js';
import type { SceneCtx } from '../sceneCtx.js';

interface Props { ctx: SceneCtx }

// Fixed 3/4 view of the lathe + bench behind it.
const SETUP_CAM_POS: [number, number, number] = [1.4, 1.9, 2.0];
const SETUP_CAM_TARGET: [number, number, number] = [0.0, 1.0, 0.0];
const _setupTarget = new THREE.Vector3(...SETUP_CAM_TARGET);

export function SetupScene3D(_props: Props) {
  const camRef = useRef<THREE.PerspectiveCamera | null>(null);
  useEffect(() => {
    const cam = camRef.current;
    if (cam === null) return;
    cam.lookAt(_setupTarget);
  }, []);

  return (
    <>
      <PerspectiveCamera ref={camRef} makeDefault position={SETUP_CAM_POS} fov={60} />
      <Lighting />
      <Room />
      <Furniture />
      <Lathe position={[0, 0, 0]} />
    </>
  );
}

const MOUNT_POINTS: { point: MountPoint; label: string }[] = [
  { point: 'headstock-spindle', label: 'Headstock spindle' },
  { point: 'tailstock-quill', label: 'Tailstock' },
  { point: 'bed', label: 'Bed (tool rest)' },
  { point: 'wall-outlet', label: 'Wall outlet' },
];

export function SetupOverlay({ ctx }: Props) {
  const setup = getLatheSetup();
  const carrying = useSetupStore((s) => s.carrying);
  const completedStepIds = useSetupStore((s) => s.completedStepIds);
  const hint = useSetupStore((s) => s.hint);
  const isComplete = useSetupStore((s) => s.isComplete());

  // Fresh start each time the lesson is entered.
  useEffect(() => {
    useSetupStore.getState().reset();
  }, []);

  // Combined toolbox: correct accessories + decoys.
  const accessories = [
    ...setup.steps.map((s) => ({ id: s.accessoryId, name: s.accessoryName })),
    ...setup.decoys.map((d) => ({ id: d.accessoryId, name: d.accessoryName })),
  ];

  const carriedName =
    accessories.find((a) => a.id === carrying)?.name ?? null;

  const panel: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 360,
    maxWidth: '92vw',
    background: 'rgba(20,18,16,0.92)',
    color: '#e8e2d0',
    padding: '20px 18px',
    overflowY: 'auto',
    font: "14px/1.5 system-ui, sans-serif",
    boxShadow: '-8px 0 24px rgba(0,0,0,0.4)',
    zIndex: 20,
  };
  const h1: React.CSSProperties = { color: '#c8873a', fontSize: '1.3rem', fontWeight: 700, margin: '0 0 4px' };
  const section: React.CSSProperties = { margin: '18px 0 6px', color: '#c8873a', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em' };

  const chipBase: React.CSSProperties = {
    display: 'inline-block', margin: '4px 6px 0 0', padding: '7px 11px', borderRadius: 7,
    border: '1px solid #4a443a', cursor: 'pointer', background: '#2a2620', color: '#e8e2d0', fontSize: '0.85rem',
  };

  return (
    <div style={panel}>
      <h1 style={h1}>{setup.title}</h1>
      <p style={{ color: '#aaa', margin: 0 }}>{setup.intro}</p>

      {/* Checklist */}
      <div style={section}>Checklist</div>
      {setup.steps.map((step) => {
        const done = completedStepIds.includes(step.id);
        return (
          <div key={step.id} style={{ display: 'flex', gap: 8, padding: '3px 0', color: done ? '#7dcea0' : '#cfc8b8' }}>
            <span>{done ? '✓' : '○'}</span>
            <span>{step.accessoryName} → {mountPointLabel(step.mountPoint)}</span>
          </div>
        );
      })}

      {/* In hand */}
      <div style={section}>In hand</div>
      <div style={{ color: carriedName ? '#e8e2d0' : '#888' }}>
        {carriedName ?? 'nothing — grab an accessory below'}
        {carriedName && (
          <button style={{ ...chipBase, marginLeft: 8, padding: '2px 8px' }} onClick={() => { useSetupStore.getState().dropCarried(); }}>put back</button>
        )}
      </div>

      {/* Toolbox */}
      <div style={section}>Toolbox</div>
      <div>
        {accessories.map((a) => {
          const held = a.id === carrying;
          return (
            <button
              key={a.id}
              style={{ ...chipBase, ...(held ? { borderColor: '#c8873a', background: '#3a2f1c' } : {}) }}
              onClick={() => { useSetupStore.getState().grab(a.id); }}
            >
              {a.name}
            </button>
          );
        })}
      </div>

      {/* Mount points */}
      <div style={section}>Mount where?</div>
      <div>
        {MOUNT_POINTS.map((m) => (
          <button
            key={m.point}
            style={{ ...chipBase, opacity: carrying ? 1 : 0.55 }}
            onClick={() => { useSetupStore.getState().tryMount(m.point); }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Hint / nudge */}
      {hint !== null && (
        <div style={{ marginTop: 14, padding: '8px 10px', borderRadius: 7, background: 'rgba(150,60,30,0.25)', color: '#f0c0a0', fontStyle: 'italic' }}>
          {hint}
        </div>
      )}

      {/* Completion */}
      {isComplete && (
        <div style={{ marginTop: 18 }}>
          <div style={{ color: '#7dcea0', fontWeight: 600, marginBottom: 8 }}>Lathe is set up and ready to turn.</div>
          <button
            style={{ ...chipBase, background: '#c8873a', color: '#1a1a1a', fontWeight: 700, border: 'none' }}
            onClick={() => { ctx.finishSetup(); }}
          >
            Back to lessons →
          </button>
        </div>
      )}
    </div>
  );
}
