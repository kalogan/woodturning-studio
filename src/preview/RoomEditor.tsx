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
 *
 * NESTED CHILD SELECTION. Each manifest prop renders a single named root group
 * whose named children are the meaningful sub-assemblies (DemoBench → demo-lathe,
 * maple-workbench, tv-stand, camera-tripod). After a prop mounts, PlacedProp
 * traverses group C's subtree (once, in a useLayoutEffect — never useFrame) and
 * collects those topmost named descendants, reporting them up so the sidebar can
 * offer each prop as an EXPANDABLE row. Selecting a child uses the composite key
 * "<PropName>/<childName>" (see roomLayoutStore.childKey).
 *
 * Children are authored at their own non-origin local transforms, so — UNLIKE the
 * top-level A/B/C delta trick — the gizmo attaches DIRECTLY to the child node and
 * already renders ON it. A child's stored placement is its FULL LOCAL transform
 * OVERRIDE (position / rotationDeg / scale captured on mouse-up), NOT a delta. On
 * (re)mount we snapshot each child's AUTHORED local transform; a useLayoutEffect
 * keyed on the stored overrides then RE-APPLIES the override (or restores the
 * authored transform when the override is undone/removed) so undo/redo + reload
 * stay correct.
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
  SupportColumn,
  TaskLamps,
  CeilingFan,
  LogPallets,
  Buckets,
  OfficeChairs,
  CeilingPipes,
  Instructor,
} from '../client/workshop/index.js';
import { Hall } from '../client/workshop/Hall.js';
import { Lathe } from '../client/lathe/index.js';
import {
  IDENTITY_PLACEMENT,
  childKey,
  useRoomLayoutStore,
  type ChildBaseline,
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
  { name: 'SupportColumn', Component: SupportColumn },
  { name: 'TaskLamps', Component: TaskLamps },
  { name: 'CeilingFan', Component: CeilingFan },
  { name: 'LogPallets', Component: LogPallets },
  { name: 'Buckets', Component: Buckets },
  { name: 'OfficeChairs', Component: OfficeChairs },
  { name: 'CeilingPipes', Component: CeilingPipes },
  { name: 'Instructor', Component: Instructor },
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

/** Pre-allocated scratch Euler — reused when re-applying a child's stored rotation. */
const SCRATCH_EULER = new THREE.Euler();

/**
 * A child's AUTHORED local transform, snapshotted on mount so we can restore it
 * when a stored override is undone/removed. Plain numbers — no THREE refs held
 * (the live node is kept alongside, in childMap).
 */
interface AuthoredTransform {
  readonly node: THREE.Object3D;
  readonly position: readonly [number, number, number];
  /** Authored rotation in DEGREES (matches the panel/override units). */
  readonly rotationDeg: readonly [number, number, number];
  readonly scale: readonly [number, number, number];
}

/**
 * Collect a mounted prop's editable named child sub-groups. Each prop renders a
 * single named root wrapper (e.g. `demo-bench`); the meaningful pieces are that
 * wrapper's named children (`demo-lathe`, `tv-stand`, …). We gather the TOPMOST
 * named descendants of `inner`, then — if that's just the single root wrapper and
 * it has its own named descendants — unwrap one level so the director edits the
 * sub-assemblies rather than the whole prop.
 *
 * Runs once per prop in a useLayoutEffect; the only allocations are the result
 * arrays (not per-frame). Returns nodes in deterministic (scene-graph) order.
 */
function collectNamedChildren(inner: THREE.Object3D): THREE.Object3D[] {
  const topmost = topmostNamed(inner);
  if (topmost.length === 1) {
    const sole = topmost[0] as THREE.Object3D;
    const deeper = topmostNamed(sole);
    if (deeper.length > 0) return dedupeByName(deeper);
  }
  return dedupeByName(topmost);
}

/** Topmost named Object3Ds under `root` (stop descending once a name is found). */
function topmostNamed(root: THREE.Object3D): THREE.Object3D[] {
  const out: THREE.Object3D[] = [];
  const walk = (node: THREE.Object3D): void => {
    for (const child of node.children) {
      if (child.name !== '') out.push(child);
      else walk(child);
    }
  };
  walk(root);
  return out;
}

/** Keep the FIRST node per distinct name (names are the selection key). */
function dedupeByName(nodes: THREE.Object3D[]): THREE.Object3D[] {
  const seen = new Set<string>();
  const out: THREE.Object3D[] = [];
  for (const n of nodes) {
    if (seen.has(n.name)) continue;
    seen.add(n.name);
    out.push(n);
  }
  return out;
}

/** Shallow same-elements check for two name lists (order-sensitive). */
function sameNames(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

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
  /**
   * The child name currently selected WITHIN this prop (the part after the `/` in
   * the composite key), or null when this prop's own delta group is selected / the
   * prop is inactive. When set, the gizmo binds to that named child node instead.
   */
  readonly activeChild: string | null;
  /** Report this prop's editable named children up to the sidebar (measured once). */
  readonly onChildrenMeasured: (
    propName: string,
    childNames: readonly string[],
    baselines: Record<string, ChildBaseline>,
  ) => void;
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
  activeChild,
  onChildrenMeasured,
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

  // ── Collect this prop's editable named children (once per prop) ────────────
  // Snapshot each child's AUTHORED local transform too, so we can restore it when
  // a stored override is undone/removed. Map: childName → node + authored xform.
  const [childMap, setChildMap] = useState<Map<string, AuthoredTransform>>(
    () => new Map(),
  );

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (inner === null) return;
    const nodes = collectNamedChildren(inner);
    const map = new Map<string, AuthoredTransform>();
    const baselines: Record<string, ChildBaseline> = {};
    for (const node of nodes) {
      const p = node.position;
      const e = node.rotation;
      const s = node.scale;
      const authored: AuthoredTransform = {
        node,
        position: [p.x, p.y, p.z],
        rotationDeg: [
          round(e.x * RAD2DEG, 1),
          round(e.y * RAD2DEG, 1),
          round(e.z * RAD2DEG, 1),
        ],
        scale: [s.x, s.y, s.z],
      };
      map.set(node.name, authored);
      baselines[node.name] = {
        position: authored.position,
        rotationDeg: authored.rotationDeg,
        scale: authored.scale,
      };
    }
    setChildMap(map);
    onChildrenMeasured(name, nodes.map((n) => n.name), baselines);
    // `name` is stable per mounted prop; onChildrenMeasured is a stable callback.
  }, [name, onChildrenMeasured]);

  // ── Re-apply stored child OVERRIDES (full local transforms) ────────────────
  // Subscribe to the whole layout so this re-runs when ANY override for one of
  // this prop's children changes (set / undo / redo / reload). For each known
  // child: if an override is stored, write it as the child's LOCAL transform;
  // otherwise restore the child's authored transform. We DON'T touch a child
  // while its gizmo is mid-drag-commit — the commit reads the node AFTER the
  // gizmo wrote it, so re-applying the same numbers is a harmless no-op.
  const layout = useRoomLayoutStore((s) => s.layout);
  useLayoutEffect(() => {
    for (const [cName, authored] of childMap) {
      const node = authored.node;
      const override = layout[childKey(name, cName)];
      if (override !== undefined) {
        node.position.set(override.position[0], override.position[1], override.position[2]);
        SCRATCH_EULER.set(
          override.rotationDeg[0] * DEG2RAD,
          override.rotationDeg[1] * DEG2RAD,
          override.rotationDeg[2] * DEG2RAD,
        );
        node.rotation.copy(SCRATCH_EULER);
        node.scale.set(override.scale[0], override.scale[1], override.scale[2]);
      } else {
        node.position.set(authored.position[0], authored.position[1], authored.position[2]);
        SCRATCH_EULER.set(
          authored.rotationDeg[0] * DEG2RAD,
          authored.rotationDeg[1] * DEG2RAD,
          authored.rotationDeg[2] * DEG2RAD,
        );
        node.rotation.copy(SCRATCH_EULER);
        node.scale.set(authored.scale[0], authored.scale[1], authored.scale[2]);
      }
    }
  }, [name, layout, childMap]);

  // ── Commit a CHILD gizmo's full local transform to the store on drag release ─
  const activeChildNode =
    activeChild !== null ? (childMap.get(activeChild)?.node ?? null) : null;

  const commitChild = useCallback(() => {
    if (activeChild === null) return;
    const node = activeChildNode;
    if (node === null) return;
    const e = node.rotation;
    setPlacement(
      childKey(name, activeChild),
      {
        position: [
          round(node.position.x, 3),
          round(node.position.y, 3),
          round(node.position.z, 3),
        ],
        rotationDeg: [
          round(e.x * RAD2DEG, 1),
          round(e.y * RAD2DEG, 1),
          round(e.z * RAD2DEG, 1),
        ],
        scale: [round(node.scale.x, 3), round(node.scale.y, 3), round(node.scale.z, 3)],
      },
      performance.now(),
    );
  }, [name, activeChild, activeChildNode, setPlacement]);

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
              positioned at the intrinsic centre (which group C maps to origin).
              Only for a TOP-LEVEL prop selection — hidden when a child is active
              so it doesn't smother the child's own gizmo. */}
          {selected && activeChild === null && (
            <mesh position={ZERO_CENTER} raycast={() => null}>
              <boxGeometry args={intrinsicSize} />
              <meshBasicMaterial color="#c98a3a" wireframe transparent opacity={0.55} />
            </mesh>
          )}
        </group>
      </group>

      {/* Top-level prop gizmo — binds to the delta group (group B). */}
      {selected && activeChild === null && editNode !== null && (
        <TransformControls object={editNode} mode={mode} onMouseUp={commit} />
      )}

      {/* Child gizmo — binds DIRECTLY to the named child node (already on the
          child; no A/B/C trick needed). Commits a FULL LOCAL transform override. */}
      {selected && activeChild !== null && activeChildNode !== null && (
        <TransformControls object={activeChildNode} mode={mode} onMouseUp={commitChild} />
      )}
    </>
  );
}

interface Props {
  readonly activeName: string;
  readonly onSelect: (name: string | null) => void;
}

/** How many manifest props to mount per animation frame during the ramp. */
const PROPS_PER_FRAME = 2;

export function RoomEditor({ activeName, onSelect }: Props): React.JSX.Element {
  const controlsRef = useRef<OrbitControlsRef | null>(null);
  const [mode, setMode] = useState<GizmoMode>('translate');

  // ── Active selection: a bare prop name OR a "<Prop>/<child>" composite key ──
  const sepIndex = activeName.indexOf('/');
  const activePropName = sepIndex === -1 ? activeName : activeName.slice(0, sepIndex);
  const activeChildName = sepIndex === -1 ? null : activeName.slice(sepIndex + 1);

  // ── Per-prop collected child names (reported up by each mounted PlacedProp) ──
  // Stored as a Record so the sidebar can render disclosure rows. Updated only
  // when a prop's measured child set actually changes (stable identity otherwise).
  const [childrenByProp, setChildrenByProp] = useState<Record<string, readonly string[]>>(
    {},
  );
  // Authored baselines keyed by composite "<Prop>/<child>" key, so the properties
  // panel can show a child's real local transform when no override is stored yet.
  const [childBaselines, setChildBaselines] = useState<Record<string, ChildBaseline>>({});
  const onChildrenMeasured = useCallback(
    (
      propName: string,
      childNames: readonly string[],
      baselines: Record<string, ChildBaseline>,
    ) => {
      setChildrenByProp((prev) => {
        const existing = prev[propName];
        if (existing !== undefined && sameNames(existing, childNames)) return prev;
        return { ...prev, [propName]: childNames };
      });
      setChildBaselines((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const cName of childNames) {
          const key = childKey(propName, cName);
          if (next[key] === undefined) {
            next[key] = baselines[cName] as ChildBaseline;
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    },
    [],
  );

  const activeChildBaseline =
    activeChildName !== null ? (childBaselines[activeName] ?? null) : null;

  // ── Sidebar disclosure: which prop rows are expanded to show their children ──
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpanded = useCallback((propName: string) => {
    setExpanded((prev) => ({ ...prev, [propName]: !prev[propName] }));
  }, []);

  const selectChild = useCallback(
    (propName: string, childName: string) => {
      onSelect(childKey(propName, childName));
    },
    [onSelect],
  );

  // ── Progressive mount + real progress ──────────────────────────────────────
  // Mounting all ~23 manifest props in one pass freezes the main thread for ~3 s.
  // Instead we ramp `loadedCount` up a few props per frame so the thread breathes
  // and the progress bar reflects reality. The effect starts on mount and cancels
  // on unmount; because PreviewApp UNMOUNTS RoomEditor when switching to the Props
  // tab, this effect re-runs (and the loader re-shows) on every Room-tab entry.
  const total = ROOM_MANIFEST.length;
  const [loadedCount, setLoadedCount] = useState(0);

  useEffect(() => {
    // setTimeout (not requestAnimationFrame) to ramp: rAF is fully PAUSED while the
    // page is hidden (backgrounded tab / offscreen), which would wedge the loader at
    // 0/total and leave the room empty behind a permanent overlay. setTimeout still
    // fires when hidden (throttled to ~1 s), so the room always finishes loading.
    // When visible it's clamped to a few ms — effectively per-frame, and it yields to
    // the event loop between batches so the progress bar paints + the thread breathes.
    let timer = 0;
    let count = 0;
    const step = (): void => {
      count = Math.min(count + PROPS_PER_FRAME, total);
      setLoadedCount(count);
      if (count < total) {
        timer = window.setTimeout(step, 16);
      }
    };
    timer = window.setTimeout(step, 16);
    return () => { window.clearTimeout(timer); };
  }, [total]);

  const loading = loadedCount < total;

  const undo = useRoomLayoutStore((s) => s.undo);
  const redo = useRoomLayoutStore((s) => s.redo);
  const canUndo = useRoomLayoutStore((s) => s.canUndo);
  const canRedo = useRoomLayoutStore((s) => s.canRedo);

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

  // ── Ctrl/Cmd+Z undo · Ctrl/Cmd+Shift+Z + Ctrl+Y redo ──────────────────────
  // Window-level. Skip when typing in a field so the browser's NATIVE field-undo
  // works; otherwise preventDefault + run the room-layout undo/redo.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent): void => {
      const target = ev.target as HTMLElement | null;
      if (target !== null) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      if (!ev.ctrlKey && !ev.metaKey) return;
      const k = ev.key.toLowerCase();
      if (k === 'z') {
        ev.preventDefault();
        if (ev.shiftKey) useRoomLayoutStore.getState().redo();
        else useRoomLayoutStore.getState().undo();
      } else if (k === 'y') {
        // Windows redo. (Ctrl+Y; meta variant harmless.)
        ev.preventDefault();
        useRoomLayoutStore.getState().redo();
      }
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
          {ROOM_MANIFEST.map((p) => {
            const children = childrenByProp[p.name] ?? [];
            const hasChildren = children.length > 0;
            const isOpen = expanded[p.name] === true;
            const propSelected = p.name === activePropName;
            // The bare prop row is "active" only when the bare prop is selected
            // (not when one of its children is the active selection).
            const rowActive = activeName === p.name;
            return (
              <li key={p.name}>
                <div className="harness__row">
                  {hasChildren ? (
                    <button
                      type="button"
                      className="harness__expander"
                      data-testid={`room-expander-${p.name}`}
                      aria-expanded={isOpen}
                      aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${p.name}`}
                      onClick={() => { toggleExpanded(p.name); }}
                    >
                      {isOpen ? '▾' : '▸'}
                    </button>
                  ) : (
                    <span className="harness__expander harness__expander--leaf" aria-hidden="true" />
                  )}
                  <button
                    type="button"
                    className={
                      'harness__item harness__item--prop' +
                      (rowActive ? ' harness__item--active' : '') +
                      (propSelected && !rowActive ? ' harness__item--ancestor' : '')
                    }
                    data-testid={`room-item-${p.name}`}
                    data-room-prop-name={p.name}
                    aria-selected={rowActive}
                    onClick={() => { onSelect(p.name); }}
                  >
                    {p.name}
                  </button>
                </div>
                {isOpen && hasChildren && (
                  <ul className="harness__children" role="group" aria-label={`${p.name} parts`}>
                    {children.map((cName) => {
                      const key = childKey(p.name, cName);
                      const childActive = activeName === key;
                      return (
                        <li key={cName}>
                          <button
                            type="button"
                            className={
                              'harness__item harness__item--child' +
                              (childActive ? ' harness__item--active' : '')
                            }
                            data-testid={`room-child-${p.name}-${cName}`}
                            data-room-child-name={cName}
                            aria-selected={childActive}
                            onClick={() => { selectChild(p.name, cName); }}
                          >
                            {cName}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
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
          <div className="harness__history" role="group" aria-label="Undo / redo">
            <button
              type="button"
              className="harness__btn"
              data-testid="room-undo"
              onClick={() => { undo(); }}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              Undo
            </button>
            <button
              type="button"
              className="harness__btn"
              data-testid="room-redo"
              onClick={() => { redo(); }}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z / Ctrl+Y)"
            >
              Redo
            </button>
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

          {ROOM_MANIFEST.slice(0, loadedCount).map((p) => (
            <PlacedProp
              key={p.name}
              name={p.name}
              Component={p.Component}
              selected={p.name === activePropName}
              mode={mode}
              onSelect={onSelect}
              activeChild={p.name === activePropName ? activeChildName : null}
              onChildrenMeasured={onChildrenMeasured}
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

        {loading && (
          <div
            className="harness__loading"
            data-testid="room-loading"
            role="status"
            aria-live="polite"
          >
            <div className="harness__loading-box">
              <div className="harness__spinner" aria-hidden="true" />
              <div className="harness__loading-text">
                Building room… {loadedCount}/{total}
              </div>
              <div className="harness__progress" aria-hidden="true">
                <div
                  className="harness__progress-bar"
                  style={{ width: `${((loadedCount / total) * 100).toFixed(1)}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {activeName !== '' && (
          <RoomPropertiesPanel activeName={activeName} childBaseline={activeChildBaseline} />
        )}
      </main>
    </div>
  );
}
