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
 * FOCAL-POINT FRAMING: each selected prop is centred at the origin by EditedProp
 * (its measured AABB is offset onto the grid). EditedProp reports that same
 * measurement up via `onMeasured`, and we aim OrbitControls at the prop's vertical
 * centre and pull the camera back proportional to the prop's max dimension — so a
 * tiny clock and the whole Shop both fill a comfortable portion of the view.
 * "Reset view" re-applies this framing for the current prop (not a fixed camera).
 *
 * Dual-consumer (§5): the picker items carry stable data-testid selectors and the
 * root carries data-active-prop, so an agent can drive the harness, while the
 * director uses the same UI by hand.
 */
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { PROP_REGISTRY } from './propRegistry.js';
import { PropErrorBoundary } from './PropErrorBoundary.js';
import { PropertiesPanel } from './PropertiesPanel.js';
import { EditedProp } from './EditedProp.js';
import { useEditStore, IDENTITY_EDIT } from './editStore.js';
import { RoomEditor } from './RoomEditor.js';
import './preview.css';

/** Which top-level harness view is active. Persisted in localStorage. */
type HarnessTab = 'props' | 'room';

const TAB_STORAGE_KEY = 'wts-preview-tab';

/** First room manifest entry name — the Room tab's default selection. */
const ROOM_DEFAULT = 'Lighting';

function loadTab(): HarnessTab {
  if (typeof localStorage === 'undefined') return 'props';
  return localStorage.getItem(TAB_STORAGE_KEY) === 'room' ? 'room' : 'props';
}

function persistTab(tab: HarnessTab): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  } catch {
    /* quota / private mode — ignore */
  }
}

type OrbitControlsRef = ComponentRef<typeof OrbitControls>;

/** Smallest framing distance, so a tiny prop (a clock) isn't jammed into the lens. */
const MIN_DIST = 1.2;
/** How far back the camera sits, as a multiple of the prop's max dimension. */
const DIST_FACTOR = 1.8;

function InspectionLights() {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 4]} intensity={1.4} castShadow />
      <directionalLight position={[-6, 4, -3]} intensity={0.5} />
    </>
  );
}

/**
 * Aim OrbitControls + the camera at the (already-recentred) prop using its
 * measured size. The prop spans x/z around 0 and y in [0, size.y]; we target its
 * vertical centre and back off proportional to its largest dimension.
 */
function frameProp(
  controls: OrbitControlsRef | null,
  camera: THREE.Camera,
  size: THREE.Vector3,
): void {
  if (controls === null) return;
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const dist = Math.max(maxDim * DIST_FACTOR, MIN_DIST);

  // OrbitControls' target is its `.target` Vector3.
  const target = (controls as unknown as { target: THREE.Vector3 }).target;
  target.set(0, size.y / 2, 0);

  // A pleasant 3/4 view: equal +X/+Z, lifted above the prop's mid-height.
  // (Only position/target change here — no projection params — so no
  // updateProjectionMatrix is needed; controls.update() applies the look-at.)
  camera.position.set(dist * 0.7, size.y * 0.6 + dist * 0.4, dist * 0.7);

  (controls as unknown as { update: () => void }).update();
}

/**
 * Bridge component (lives inside the Canvas) that re-frames the camera whenever
 * the active prop's measured size changes, and exposes a frame() to the reset
 * button via a ref callback. Pure scaffolding — renders nothing.
 */
function CameraFramer({
  controlsRef,
  size,
  registerFrame,
}: {
  readonly controlsRef: React.RefObject<OrbitControlsRef | null>;
  readonly size: THREE.Vector3 | null;
  readonly registerFrame: (fn: () => void) => void;
}): null {
  const camera = useThree((s) => s.camera);

  // Re-frame when the measured size changes (i.e. on prop switch).
  useEffect(() => {
    if (size === null) return;
    frameProp(controlsRef.current, camera, size);
  }, [controlsRef, camera, size]);

  // Expose a stable frame() so "Reset view" re-applies framing for THIS prop.
  useEffect(() => {
    registerFrame(() => {
      if (size !== null) frameProp(controlsRef.current, camera, size);
    });
  }, [registerFrame, controlsRef, camera, size]);

  return null;
}

/**
 * PropsGallery — the original single-prop inspection view (UNCHANGED behaviour).
 * Lives under the "Props" tab. All centring, editing, framing, and JSON export
 * are exactly as before — only the function name changed (was PreviewApp).
 */
function PropsGallery() {
  const [activeName, setActiveName] = useState<string>(PROP_REGISTRY[0]?.name ?? '');
  const [error, setError] = useState<string | null>(null);
  const controlsRef = useRef<OrbitControlsRef | null>(null);

  // The measured size of the active prop, lifted out of EditedProp so the camera
  // framing shares the SAME measurement (no double measure).
  const [measuredSize, setMeasuredSize] = useState<THREE.Vector3 | null>(null);

  // Latest frame() implementation, kept current by CameraFramer.
  const frameRef = useRef<() => void>(() => {});

  const active = PROP_REGISTRY.find((p) => p.name === activeName) ?? PROP_REGISTRY[0];

  // Subscribe to this prop's edit so the Canvas re-renders the transform/tint live.
  // Select the STABLE raw entry (may be undefined) and fall back to the frozen
  // IDENTITY_EDIT constant — calling getEdit()/identityEdit() inside the selector
  // returns a fresh object each render, which trips useSyncExternalStore's
  // "getSnapshot should be cached" infinite-loop guard and blanks the harness.
  const activeEdit = useEditStore((s) => s.edits[activeName]) ?? IDENTITY_EDIT;

  const select = useCallback((name: string) => {
    setError(null);
    setMeasuredSize(null); // clear stale size so framing waits for the new measure
    setActiveName(name);
  }, []);

  const resetView = useCallback(() => {
    frameRef.current();
  }, []);

  const registerFrame = useCallback((fn: () => void) => {
    frameRef.current = fn;
  }, []);

  const onMeasured = useCallback((size: THREE.Vector3) => {
    setMeasuredSize(size);
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
              <EditedProp
                key={activeName}
                activeName={activeName}
                edit={activeEdit}
                onMeasured={onMeasured}
              >
                <ActiveComponent />
              </EditedProp>
            </PropErrorBoundary>
          )}

          <OrbitControls ref={controlsRef} makeDefault />
          <CameraFramer
            controlsRef={controlsRef}
            size={measuredSize}
            registerFrame={registerFrame}
          />
        </Canvas>

        {activeName !== '' && <PropertiesPanel activeName={activeName} />}
      </main>
    </div>
  );
}

/**
 * PreviewApp — the harness shell. Hosts a top-left tab switcher that selects
 * between the existing Props gallery (default) and the new Room Editor, under the
 * SAME preview page. The active tab is persisted to localStorage. Each tab keeps
 * its OWN store (editStore vs roomLayoutStore) and its own selected-prop state.
 */
export function PreviewApp(): React.JSX.Element {
  const [tab, setTab] = useState<HarnessTab>(loadTab);
  const [roomActive, setRoomActive] = useState<string>(ROOM_DEFAULT);

  const selectTab = useCallback((next: HarnessTab) => {
    setTab(next);
    persistTab(next);
  }, []);

  return (
    <>
      <div className="harness__tabs" data-testid="harness-tabs" data-active-tab={tab}>
        <button
          type="button"
          className={'harness__tab' + (tab === 'props' ? ' harness__tab--active' : '')}
          data-testid="tab-props"
          aria-selected={tab === 'props'}
          onClick={() => { selectTab('props'); }}
        >
          Props
        </button>
        <button
          type="button"
          className={'harness__tab' + (tab === 'room' ? ' harness__tab--active' : '')}
          data-testid="tab-room"
          aria-selected={tab === 'room'}
          onClick={() => { selectTab('room'); }}
        >
          Room
        </button>
      </div>

      {tab === 'props' ? (
        <PropsGallery />
      ) : (
        <RoomEditor activeName={roomActive} onSelect={setRoomActive} />
      )}
    </>
  );
}
