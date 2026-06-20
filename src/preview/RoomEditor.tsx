/**
 * RoomEditor.tsx — the "Room" tab of the preview harness.
 *
 * HARNESS-ONLY inspection scaffolding. Renders the FULL assembled room (mirrors
 * Shop.tsx, using the REAL product components + the REAL <Lighting>) and lets the
 * director reposition / rotate / scale any top-level prop IN CONTEXT — by editing
 * numbers in the side panel OR by direct 3D interaction (click a prop to select
 * it, drag a transform gizmo to move / rotate / scale it) — then export a
 * room-layout JSON. Both paths write the SAME roomLayoutStore DELTA placement.
 *
 * GIZMO-ON-THE-PROP (bbox-center placement). Each manifest prop SELF-POSITIONS
 * internally, so its delta group naturally sits at WORLD ORIGIN; a gizmo attached
 * there would float far from the prop. Same measure trick as EditedProp: per prop
 * we measure its intrinsic bbox CENTRE once (module-scope scratch Box3, in a
 * useLayoutEffect — never in useFrame) and structure each prop as three groups:
 *
 *   <group position={intrinsicCenter}>            // A — at the prop's real location
 *     <group ref={editRef} position={delta.pos} ...delta...>   // B — the EXPORTED delta; gizmo attaches HERE
 *       <group position={-intrinsicCenter}>       // C — cancel the prop's internal self-position
 *         <Prop />
 *       </group>
 *     </group>
 *   </group>
 *
 * Net world transform = intrinsicCenter + delta (delta defaults to identity → the
 * prop sits EXACTLY where it really is). The gizmo, bound to group B, renders at
 * intrinsicCenter — i.e. ON the prop. Dragging B mutates the delta directly, so
 * the export stays a clean delta with no intrinsic offset leaking in. Degenerate /
 * empty bboxes (lights-only props) → intrinsicCenter = [0,0,0].
 *
 * KNOWN TRAP (see roomLayoutStore): selectors return STABLE refs only. The active
 * placement is selected as the raw stored entry with a frozen IDENTITY_PLACEMENT
 * fallback — never a fresh object inside the selector.
 *
 * ORBIT vs GIZMO: <OrbitControls makeDefault /> + drei <TransformControls> is the
 * supported coexistence pattern — TransformControls listens to its own
 * dragging-changed and disables the default (orbit) controls while a handle is
 * dragged, then re-enables them on release.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentRef,
  type ComponentType,
} from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  Lighting,
  Furniture,
  HallLathes,
  DemoBench,
  StockCubbies,
  GrinderStation,
  ShopClutter,
  Doorways,
  TurnedDisplay,
  ToolWall,
  DustCollection,
  ClassroomSignage,
  CeilingEquipment,
  ShopFurniture,
  ShopMachines,
  WallConduit,
  SpeakerDisplay,
  WireRack,
  FlatFileCabinets,
  ShopVac,
  LeaningLumber,
} from '../client/workshop/index.js';
import { Hall } from '../client/workshop/Hall.js';
import { Lathe } from '../client/lathe/index.js';
import {
  IDENTITY_PLACEMENT,
  useRoomLayoutStore,
  type RoomPlacement,
} from './roomLayoutStore.js';
import { RoomPropertiesPanel } from './RoomPropertiesPanel.js';

type OrbitControlsRef = ComponentRef<typeof OrbitControls>;

/** The three gizmo transform modes (standard DCC W/E/R). */
type GizmoMode = 'translate' | 'rotate' | 'scale';

interface ManifestEntry {
  readonly name: string;
  readonly Component: ComponentType<Record<string, never>>;
}

/**
 * The room manifest — the top-level props the real Shop renders, in order.
 * MIRROR Shop.tsx — add new top-level props here (a new prop is a one-line add).
 * The player <Lathe> (not in Shop.tsx — each scene adds its own) is appended at
 * the origin, matching the deployed scene's player lathe.
 */
const ROOM_MANIFEST: readonly ManifestEntry[] = [
  { name: 'Lighting', Component: Lighting },
  { name: 'Hall', Component: Hall },
  { name: 'Furniture', Component: Furniture },
  { name: 'HallLathes', Component: HallLathes },
  { name: 'DemoBench', Component: DemoBench },
  { name: 'StockCubbies', Component: StockCubbies },
  { name: 'GrinderStation', Component: GrinderStation },
  { name: 'ShopClutter', Component: ShopClutter },
  { name: 'Doorways', Component: Doorways },
  { name: 'TurnedDisplay', Component: TurnedDisplay },
  { name: 'ToolWall', Component: ToolWall },
  { name: 'DustCollection', Component: DustCollection },
  { name: 'ClassroomSignage', Component: ClassroomSignage },
  { name: 'CeilingEquipment', Component: CeilingEquipment },
  { name: 'ShopFurniture', Component: ShopFurniture },
  { name: 'ShopMachines', Component: ShopMachines },
  { name: 'WallConduit', Component: WallConduit },
  { name: 'SpeakerDisplay', Component: SpeakerDisplay },
  { name: 'WireRack', Component: WireRack },
  { name: 'FlatFileCabinets', Component: FlatFileCabinets },
  { name: 'ShopVac', Component: ShopVac },
  { name: 'LeaningLumber', Component: LeaningLumber },
  { name: 'Lathe', Component: Lathe },
];

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** Initial orbit framing — centre of the hall, camera pulled back to see most of it. */
const INITIAL_TARGET: [number, number, number] = [-7, 1, 2.4];
const INITIAL_CAM: [number, number, number] = [3, 9, 16];

// Pre-allocated scratch — reused across intrinsic-centre measurements, NEVER a
// per-frame alloc. The measure runs once per prop in a useLayoutEffect.
const SCRATCH_BOX = new THREE.Box3();
const SCRATCH_CENTER = new THREE.Vector3();
const SCRATCH_SIZE = new THREE.Vector3();

const ZERO_CENTER: readonly [number, number, number] = [0, 0, 0];
const UNIT_SIZE: readonly [number, number, number] = [1, 1, 1];

/** Round to N decimal places (avoid -0). */
function round(value: number, places: number): number {
  const f = 10 ** places;
  const r = Math.round(value * f) / f;
  return r === 0 ? 0 : r;
}

interface PlacedPropProps extends ManifestEntry {
  readonly selected: boolean;
  readonly mode: GizmoMode;
  readonly onSelect: (name: string) => void;
}

/**
 * One manifest prop wrapped in its bbox-centred DELTA transform group (see file
 * header). Subscribes to ONLY this prop's placement (stable raw entry + frozen
 * identity fallback — never a fresh object in the selector). When selected, hosts
 * the transform gizmo bound to its own delta group (group B) and a wireframe
 * selection cue sized to its intrinsic bbox.
 */
function PlacedProp({
  name,
  Component,
  selected,
  mode,
  onSelect,
}: PlacedPropProps): React.JSX.Element {
  const placement: RoomPlacement =
    useRoomLayoutStore((s) => s.layout[name]) ?? IDENTITY_PLACEMENT;
  const setPlacement = useRoomLayoutStore((s) => s.setPlacement);

  // group B — the EXPORTED delta. The gizmo attaches here. Held in BOTH a ref
  // (stable, for the commit read on drag-end) and state (non-null Object3D for
  // TransformControls' `object` prop, which rejects a nullable ref).
  const editRef = useRef<THREE.Group | null>(null);
  const [editNode, setEditNode] = useState<THREE.Group | null>(null);
  const setEditGroup = useCallback((g: THREE.Group | null) => {
    editRef.current = g;
    setEditNode(g);
  }, []);
  // group C — cancels the prop's internal self-position. Measured on mount.
  const innerRef = useRef<THREE.Group>(null);

  // Intrinsic bbox centre (world-space, before any delta) + size (for the cue).
  const [intrinsicCenter, setIntrinsicCenter] =
    useState<readonly [number, number, number]>(ZERO_CENTER);
  const [intrinsicSize, setIntrinsicSize] =
    useState<readonly [number, number, number]>(UNIT_SIZE);

  // ── Measure intrinsic bbox centre (once per prop) ──────────────────────────
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (inner === null) return;

    // Measure the prop in its OWN coordinates: temporarily neutralise group C's
    // offset and group B's delta so the AABB reflects the prop's real position.
    inner.position.set(0, 0, 0);
    inner.updateWorldMatrix(true, true);
    SCRATCH_BOX.setFromObject(inner);

    const min = SCRATCH_BOX.min;
    const max = SCRATCH_BOX.max;
    const finite =
      Number.isFinite(min.x) && Number.isFinite(min.y) && Number.isFinite(min.z) &&
      Number.isFinite(max.x) && Number.isFinite(max.y) && Number.isFinite(max.z);

    if (SCRATCH_BOX.isEmpty() || !finite) {
      // Degenerate / empty (lights-only props) — keep the gizmo at the origin.
      setIntrinsicCenter(ZERO_CENTER);
      setIntrinsicSize(UNIT_SIZE);
      return;
    }

    SCRATCH_BOX.getCenter(SCRATCH_CENTER);
    SCRATCH_BOX.getSize(SCRATCH_SIZE);
    setIntrinsicCenter([SCRATCH_CENTER.x, SCRATCH_CENTER.y, SCRATCH_CENTER.z]);
    setIntrinsicSize([
      Math.max(SCRATCH_SIZE.x, 0.05),
      Math.max(SCRATCH_SIZE.y, 0.05),
      Math.max(SCRATCH_SIZE.z, 0.05),
    ]);
  }, [name]);

  // ── Commit the gizmo's result to the store on drag release ─────────────────
  // During drag, TransformControls OWNS group B (we don't re-bind from the store
  // each frame). On mouse-up we read B's local transform and write the delta.
  const commit = useCallback(() => {
    const b = editRef.current;
    if (b === null) return;
    const e = b.rotation;
    setPlacement(name, {
      position: [round(b.position.x, 3), round(b.position.y, 3), round(b.position.z, 3)],
      rotationDeg: [
        round(e.x * RAD2DEG, 1),
        round(e.y * RAD2DEG, 1),
        round(e.z * RAD2DEG, 1),
      ],
      scale: [round(b.scale.x, 3), round(b.scale.y, 3), round(b.scale.z, 3)],
    });
  }, [name, setPlacement]);

  const negCenter: [number, number, number] = [
    -intrinsicCenter[0],
    -intrinsicCenter[1],
    -intrinsicCenter[2],
  ];

  return (
    <>
      {/* A — at the prop's real (intrinsic) location. */}
      <group position={intrinsicCenter}>
        {/* B — the EXPORTED delta; gizmo + selection cue attach here. */}
        <group
          ref={setEditGroup}
          name={`room-prop-${name}`}
          position={placement.position}
          rotation={[
            placement.rotationDeg[0] * DEG2RAD,
            placement.rotationDeg[1] * DEG2RAD,
            placement.rotationDeg[2] * DEG2RAD,
          ]}
          scale={placement.scale}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(name);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = 'auto';
          }}
        >
          {/* C — cancel the prop's internal self-position so net = A + delta. */}
          <group ref={innerRef} position={negCenter}>
            <Component />
          </group>

          {/* Selection cue: a cheap wireframe box around the prop's bbox,
              positioned at the intrinsic centre (which group C maps to origin). */}
          {selected && (
            <mesh position={ZERO_CENTER} raycast={() => null}>
              <boxGeometry args={intrinsicSize} />
              <meshBasicMaterial color="#c98a3a" wireframe transparent opacity={0.55} />
            </mesh>
          )}
        </group>
      </group>

      {selected && editNode !== null && (
        <TransformControls object={editNode} mode={mode} onMouseUp={commit} />
      )}
    </>
  );
}

interface Props {
  readonly activeName: string;
  readonly onSelect: (name: string | null) => void;
}

export function RoomEditor({ activeName, onSelect }: Props): React.JSX.Element {
  const controlsRef = useRef<OrbitControlsRef | null>(null);
  const [mode, setMode] = useState<GizmoMode>('translate');

  const resetView = useCallback(() => {
    const controls = controlsRef.current;
    if (controls === null) return;
    const c = controls as unknown as {
      target: { set: (x: number, y: number, z: number) => void };
      object: { position: { set: (x: number, y: number, z: number) => void } };
      update: () => void;
    };
    c.target.set(...INITIAL_TARGET);
    c.object.position.set(...INITIAL_CAM);
    c.update();
  }, []);

  // ── W / E / R hotkeys (translate / rotate / scale) ─────────────────────────
  // Ignore when the user is typing in the numeric panel inputs.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      const target = ev.target as HTMLElement | null;
      if (target !== null) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      const k = ev.key.toLowerCase();
      if (k === 'w') setMode('translate');
      else if (k === 'e') setMode('rotate');
      else if (k === 'r') setMode('scale');
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, []);

  const modeButton = (m: GizmoMode, label: string) => (
    <button
      type="button"
      className={'harness__btn' + (mode === m ? ' harness__btn--active' : '')}
      data-testid={`gizmo-mode-${m}`}
      aria-pressed={mode === m}
      onClick={() => { setMode(m); }}
    >
      {label}
    </button>
  );

  return (
    <div className="harness" data-active-room-prop={activeName} data-gizmo-mode={mode}>
      <aside className="harness__sidebar">
        <div className="harness__title">
          Room Props <span className="harness__count">({ROOM_MANIFEST.length})</span>
        </div>
        <ul className="harness__list" role="listbox" aria-label="Room props">
          {ROOM_MANIFEST.map((p) => (
            <li key={p.name}>
              <button
                type="button"
                className={
                  'harness__item' + (p.name === activeName ? ' harness__item--active' : '')
                }
                data-testid={`room-item-${p.name}`}
                data-room-prop-name={p.name}
                aria-selected={p.name === activeName}
                onClick={() => { onSelect(p.name); }}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <main className="harness__main">
        <div className="harness__topbar">
          <span className="harness__active-name" data-testid="active-room-prop-name">
            {activeName}
          </span>
          <div className="harness__gizmo-modes" role="group" aria-label="Gizmo mode">
            {modeButton('translate', 'Move (W)')}
            {modeButton('rotate', 'Rotate (E)')}
            {modeButton('scale', 'Scale (R)')}
          </div>
          <button type="button" className="harness__btn" onClick={resetView}>
            Reset view
          </button>
        </div>

        <Canvas
          shadows
          camera={{ position: INITIAL_CAM, fov: 50 }}
          onPointerMissed={() => { onSelect(null); }}
        >
          <color attach="background" args={['#1a1a1a']} />

          {ROOM_MANIFEST.map((p) => (
            <PlacedProp
              key={p.name}
              name={p.name}
              Component={p.Component}
              selected={p.name === activeName}
              mode={mode}
              onSelect={onSelect}
            />
          ))}

          <OrbitControls
            ref={controlsRef}
            makeDefault
            enablePan
            enableZoom
            target={INITIAL_TARGET}
          />
        </Canvas>

        {activeName !== '' && <RoomPropertiesPanel activeName={activeName} />}
      </main>
    </div>
  );
}
