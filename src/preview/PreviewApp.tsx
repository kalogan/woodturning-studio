/**
 * PreviewApp — the prop preview harness shell (PREVIEW_HARNESS.md §A).
 *
 * REUSE, NEVER FORK. This shell renders the REAL product components enumerated in
 * propRegistry.ts inside one inspection Canvas. It adds ONLY inspection
 * scaffolding — neutral lights, a ground grid + axes for scale, an orbit camera,
 * a reset button, and a prop picker. It never reimplements product behavior.
 *
 * The lights here are deliberately the harness's OWN neutral rig (ambient + key +
 * fill), NOT the product's <Lighting> — isolated props read better under neutral
 * light. <Lighting> itself is still previewable as a list entry.
 *
 * Dual-consumer (§5): the picker items carry stable data-testid selectors and the
 * root carries data-active-prop, so an agent can drive the harness, while the
 * director uses the same UI by hand.
 */
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { PROP_REGISTRY } from './propRegistry.js';
import { PropErrorBoundary } from './PropErrorBoundary.js';
import { PropertiesPanel } from './PropertiesPanel.js';
import { EditedProp } from './EditedProp.js';
import { useEditStore, IDENTITY_EDIT } from './editStore.js';
import './preview.css';

function InspectionLights() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 4]} intensity={1.4} castShadow />
      <directionalLight position={[-6, 4, -3]} intensity={0.5} />
    </>
  );
}

export function PreviewApp() {
  const [activeName, setActiveName] = useState<string>(PROP_REGISTRY[0]?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const controlsRef = useRef<ComponentRef<typeof OrbitControls> | null>(null);

  const active = PROP_REGISTRY.find((p) => p.name === activeName) ?? PROP_REGISTRY[0];

  // Subscribe to this prop's edit so the Canvas re-renders the transform/tint live.
  // Select the STABLE raw entry (may be undefined) and fall back to the frozen
  // IDENTITY_EDIT constant — calling getEdit()/identityEdit() inside the selector
  // returns a fresh object each render, which trips useSyncExternalStore's
  // "getSnapshot should be cached" infinite-loop guard and blanks the harness.
  const activeEdit = useEditStore((s) => s.edits[activeName]) ?? IDENTITY_EDIT;

  const select = useCallback((name: string) => {
    setError(null);
    setActiveName(name);
  }, []);

  const resetView = useCallback(() => {
    controlsRef.current?.reset();
  }, []);

  const ActiveComponent = active?.Component;

  return (
    <div className="harness" data-active-prop={activeName}>
      <aside className="harness__sidebar">
        <div className="harness__title">
          Workshop Props <span className="harness__count">({PROP_REGISTRY.length})</span>
        </div>
        <ul className="harness__list" role="listbox" aria-label="Workshop props">
          {PROP_REGISTRY.map((p) => (
            <li key={p.name}>
              <button
                type="button"
                className={
                  'harness__item' + (p.name === activeName ? ' harness__item--active' : '')
                }
                data-testid={`prop-item-${p.name}`}
                data-prop-name={p.name}
                aria-selected={p.name === activeName}
                onClick={() => { select(p.name); }}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="harness__main">
        <div className="harness__topbar">
          <span className="harness__active-name" data-testid="active-prop-name">
            {activeName}
          </span>
          <button type="button" className="harness__btn" onClick={resetView}>
            Reset view
          </button>
        </div>

        {error !== null && (
          <div className="harness__error" data-testid="prop-error" role="alert">
            <div className="harness__error-title">{activeName} failed to render</div>
            <div className="harness__error-msg">{error}</div>
          </div>
        )}

        <Canvas shadows camera={{ position: [3, 2.5, 3.5], fov: 50 }}>
          <color attach="background" args={['#1a1a1a']} />
          <InspectionLights />

          {/* Scale references — harness scaffolding, not product geometry. */}
          <Grid
            args={[20, 20]}
            cellSize={0.5}
            cellColor="#444"
            sectionSize={2}
            sectionColor="#666"
            infiniteGrid
            fadeDistance={30}
          />
          <axesHelper args={[1]} />

          {ActiveComponent && (
            <PropErrorBoundary key={activeName} name={activeName} onError={setError}>
              <EditedProp key={activeName} activeName={activeName} edit={activeEdit}>
                <ActiveComponent />
              </EditedProp>
            </PropErrorBoundary>
          )}

          <OrbitControls ref={controlsRef} makeDefault />
        </Canvas>

        {activeName !== '' && <PropertiesPanel activeName={activeName} />}
      </main>
    </div>
  );
}
