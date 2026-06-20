/**
 * RoomEditor.tsx — the "Room" tab of the preview harness.
 *
 * HARNESS-ONLY inspection scaffolding. Renders the FULL assembled room (mirrors
 * Shop.tsx, using the REAL product components + the REAL <Lighting>) and lets the
 * director reposition / rotate / scale any top-level prop IN CONTEXT, then export
 * a room-layout JSON. Each prop is wrapped in an editor-controlled <group> that
 * applies a DELTA transform from roomLayoutStore — default identity, so the room
 * initially looks EXACTLY like the deployed scene (every prop self-positions).
 *
 * This NEVER forks product source. It only adds a wrapping transform <group> per
 * prop + an orbit camera. The Props gallery (PreviewApp) is untouched.
 *
 * KNOWN TRAP (see roomLayoutStore): selectors return STABLE refs only. The active
 * placement is selected as the raw stored entry with a frozen IDENTITY_PLACEMENT
 * fallback — never a fresh object inside the selector.
 */
import { useCallback, useRef, type ComponentRef, type ComponentType } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
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
  { name: 'Lathe', Component: Lathe },
];

const DEG2RAD = Math.PI / 180;

/** Initial orbit framing — centre of the hall, camera pulled back to see most of it. */
const INITIAL_TARGET: [number, number, number] = [-7, 1, 2.4];
const INITIAL_CAM: [number, number, number] = [3, 9, 16];

/**
 * One manifest prop wrapped in its DELTA transform group. Subscribes to ONLY this
 * prop's placement (stable raw entry + frozen identity fallback — never a fresh
 * object in the selector) so each prop re-renders independently when nudged.
 */
function PlacedProp({ name, Component }: ManifestEntry): React.JSX.Element {
  const placement: RoomPlacement =
    useRoomLayoutStore((s) => s.layout[name]) ?? IDENTITY_PLACEMENT;

  return (
    <group
      name={`room-prop-${name}`}
      position={placement.position}
      rotation={[
        placement.rotationDeg[0] * DEG2RAD,
        placement.rotationDeg[1] * DEG2RAD,
        placement.rotationDeg[2] * DEG2RAD,
      ]}
      scale={placement.scale}
    >
      <Component />
    </group>
  );
}

interface Props {
  readonly activeName: string;
  readonly onSelect: (name: string) => void;
}

export function RoomEditor({ activeName, onSelect }: Props): React.JSX.Element {
  const controlsRef = useRef<OrbitControlsRef | null>(null);

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

  return (
    <div className="harness" data-active-room-prop={activeName}>
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
          <button type="button" className="harness__btn" onClick={resetView}>
            Reset view
          </button>
        </div>

        <Canvas shadows camera={{ position: INITIAL_CAM, fov: 50 }}>
          <color attach="background" args={['#1a1a1a']} />

          {ROOM_MANIFEST.map((p) => (
            <PlacedProp key={p.name} name={p.name} Component={p.Component} />
          ))}

          <OrbitControls
            ref={controlsRef}
            makeDefault
            enablePan
            enableZoom
            target={INITIAL_TARGET}
          />
        </Canvas>

        <RoomPropertiesPanel activeName={activeName} />
      </main>
    </div>
  );
}
