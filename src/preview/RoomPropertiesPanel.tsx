/**
 * RoomPropertiesPanel.tsx — RIGHT-side knobs rail for the Room Editor's active
 * selection (a top-level prop OR a named child sub-group).
 *
 * HARNESS-ONLY. Reuses the gallery PropertiesPanel's `.panel` look, but writes
 * into roomLayoutStore (not editStore) and has no tint control (the room shows
 * real materials). Each control live-updates the selected node so it MOVES in the
 * room immediately. Exports a room-layout JSON.
 *
 * TWO SELECTION KINDS (keyed by activeName):
 *   • a bare prop name → a DELTA placement (offset on top of the prop's model).
 *   • a "<Prop>/<child>" composite key (see roomLayoutStore.childKey) → a FULL
 *     LOCAL transform OVERRIDE for that named child. When no override is stored
 *     yet, the fields show the child's AUTHORED baseline (passed in by RoomEditor),
 *     and editing a field seeds a full override from that baseline.
 *
 * Dual-consumer: every control carries a stable data-testid.
 */
import { useCallback } from 'react';
import {
  isChildKey,
  isIdentityPlacement,
  useRoomLayoutStore,
  type ChildBaseline,
  type RoomPlacement,
} from './roomLayoutStore.js';

interface Props {
  /** The currently-selected room prop name OR "<Prop>/<child>" composite key. */
  readonly activeName: string;
  /**
   * For a child selection with NO stored override yet: the child's authored local
   * transform, used as the field baseline + the seed for the first edit. Null /
   * omitted for top-level props (whose baseline is identity) or before the child
   * is measured.
   */
  readonly childBaseline?: ChildBaseline | null;
}

/** Pretty-printed single-prop object: { "<Name>": {...} }. */
function singlePropJson(name: string, placement: RoomPlacement): string {
  return JSON.stringify({ [name]: placement }, null, 2);
}

/** Trigger a browser download of `text` as a .json file. */
function downloadJson(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function RoomPropertiesPanel({
  activeName,
  childBaseline,
}: Props): React.JSX.Element {
  // Subscribe to this prop's placement so the panel re-renders on every change.
  // Raw entry (may be undefined) — never a fresh object in the selector.
  const placement = useRoomLayoutStore((s) => s.layout[activeName]) ?? null;
  const setPlacement = useRoomLayoutStore((s) => s.setPlacement);
  const reset = useRoomLayoutStore((s) => s.reset);
  const diff = useRoomLayoutStore((s) => s.diff);

  const isChild = isChildKey(activeName);

  // The effective transform shown in the fields. Precedence:
  //   stored override (or delta) → child authored baseline → identity.
  // For a child with no override, this is the AUTHORED local transform so the
  // numbers match what's on screen, and the first edit seeds a full override.
  const baseFromChild: RoomPlacement | null =
    childBaseline === null || childBaseline === undefined
      ? null
      : {
          position: [...childBaseline.position],
          rotationDeg: [...childBaseline.rotationDeg],
          scale: [...childBaseline.scale],
        };
  const current: RoomPlacement = placement ?? baseFromChild ?? {
    position: [0, 0, 0],
    rotationDeg: [0, 0, 0],
    scale: [1, 1, 1],
  };

  // Commit a FULL placement. For children this is the local-transform override;
  // for props it's the delta. We always write all three triples so a child's
  // untouched axes keep their authored baseline instead of collapsing to 0/1.
  const commitFull = useCallback(
    (next: RoomPlacement) => {
      setPlacement(
        activeName,
        { position: next.position, rotationDeg: next.rotationDeg, scale: next.scale },
        performance.now(),
      );
    },
    [activeName, setPlacement],
  );

  const setAxis = useCallback(
    (key: keyof RoomPlacement, axis: 0 | 1 | 2, value: number) => {
      const next: RoomPlacement = {
        position: [...current.position],
        rotationDeg: [...current.rotationDeg],
        scale: [...current.scale],
      };
      next[key][axis] = value;
      // Pass a monotonic timestamp so rapid edits to the same selection (e.g.
      // holding a number-input's spinner) coalesce into a single undo entry.
      commitFull(next);
    },
    [current, commitFull],
  );

  const setUniformScale = useCallback(
    (value: number) => {
      // Dragging the scale slider fires many commits — coalesce into one undo.
      const next: RoomPlacement = {
        position: [...current.position],
        rotationDeg: [...current.rotationDeg],
        scale: [value, value, value],
      };
      commitFull(next);
    },
    [current, commitFull],
  );

  const copyJson = useCallback(() => {
    void navigator.clipboard.writeText(singlePropJson(activeName, current));
  }, [activeName, current]);

  const downloadLayout = useCallback(() => {
    downloadJson('wts-room-layout.json', JSON.stringify(diff(), null, 2));
  }, [diff]);

  const uniform = current.scale[0];

  return (
    <aside className="panel" data-testid="room-properties-panel" data-room-prop={activeName}>
      <div className="panel__title">{isChild ? 'Child local transform' : 'Room placement'}</div>
      <div className="panel__subtitle">{activeName}</div>

      {/* ── Position ──────────────────────────────────────────── */}
      <section className="panel__section">
        <div className="panel__label">{isChild ? 'Position (m)' : 'Position offset (m)'}</div>
        <div className="panel__triple">
          {(['x', 'y', 'z'] as const).map((axis, i) => (
            <label key={axis} className="panel__field">
              <span>{axis}</span>
              <input
                type="number"
                min={-16}
                max={16}
                step={0.1}
                value={current.position[i]}
                data-testid={`room-position-${axis}`}
                onChange={(e) => { setAxis('position', i as 0 | 1 | 2, Number(e.target.value)); }}
              />
            </label>
          ))}
        </div>
      </section>

      {/* ── Rotation ──────────────────────────────────────────── */}
      <section className="panel__section">
        <div className="panel__label">Rotation (deg)</div>
        <div className="panel__triple">
          {(['x', 'y', 'z'] as const).map((axis, i) => (
            <label key={axis} className="panel__field">
              <span>{axis}</span>
              <input
                type="number"
                step={5}
                value={current.rotationDeg[i]}
                data-testid={`room-rotation-${axis}`}
                onChange={(e) => { setAxis('rotationDeg', i as 0 | 1 | 2, Number(e.target.value)); }}
              />
            </label>
          ))}
        </div>
      </section>

      {/* ── Scale ─────────────────────────────────────────────── */}
      <section className="panel__section">
        <div className="panel__label">Scale</div>
        <div className="panel__row">
          <input
            type="range"
            min={0.2}
            max={3}
            step={0.05}
            value={uniform}
            data-testid="room-scale-uniform"
            onChange={(e) => { setUniformScale(Number(e.target.value)); }}
            className="panel__slider"
            aria-label="Uniform scale"
          />
          <span className="panel__readout" data-testid="room-scale-uniform-readout">
            {uniform.toFixed(2)}
          </span>
        </div>
        <div className="panel__triple">
          {(['x', 'y', 'z'] as const).map((axis, i) => (
            <label key={axis} className="panel__field">
              <span>{axis}</span>
              <input
                type="number"
                step={0.05}
                value={current.scale[i]}
                data-testid={`room-scale-${axis}`}
                onChange={(e) => { setAxis('scale', i as 0 | 1 | 2, Number(e.target.value)); }}
              />
            </label>
          ))}
        </div>
      </section>

      {/* ── Actions ───────────────────────────────────────────── */}
      <section className="panel__section panel__actions">
        <button
          type="button"
          className="panel__btn"
          data-testid="room-reset-placement"
          // For a child: enabled iff an override is actually stored (reset removes
          // it → authored transform restored). For a prop: enabled iff non-identity.
          disabled={isChild ? placement === null : isIdentityPlacement(current)}
          onClick={() => { reset(activeName); }}
        >
          Reset
        </button>
        <button
          type="button"
          className="panel__btn"
          data-testid="room-copy-json"
          onClick={copyJson}
        >
          Copy JSON
        </button>
        <button
          type="button"
          className="panel__btn"
          data-testid="room-download-layout"
          onClick={downloadLayout}
        >
          Download room layout
        </button>
      </section>
    </aside>
  );
}
