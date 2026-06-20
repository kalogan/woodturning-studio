/**
 * RoomPropertiesPanel.tsx — RIGHT-side knobs rail for the Room Editor's active prop.
 *
 * HARNESS-ONLY. Reuses the gallery PropertiesPanel's `.panel` look, but writes
 * DELTA placements into roomLayoutStore (not editStore) and has no tint control
 * (the room shows real materials). Each control live-updates the prop's delta
 * group so it MOVES in the room immediately. Exports a room-layout JSON.
 *
 * Dual-consumer: every control carries a stable data-testid.
 */
import { useCallback } from 'react';
import {
  isIdentityPlacement,
  useRoomLayoutStore,
  type RoomPlacement,
} from './roomLayoutStore.js';

interface Props {
  /** The currently-selected room prop name. */
  readonly activeName: string;
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

export function RoomPropertiesPanel({ activeName }: Props): React.JSX.Element {
  // Subscribe to this prop's placement so the panel re-renders on every change.
  // Raw entry (may be undefined) — never a fresh object in the selector.
  const placement = useRoomLayoutStore((s) => s.layout[activeName]) ?? null;
  const getPlacement = useRoomLayoutStore((s) => s.getPlacement);
  const setPlacement = useRoomLayoutStore((s) => s.setPlacement);
  const reset = useRoomLayoutStore((s) => s.reset);
  const diff = useRoomLayoutStore((s) => s.diff);

  const current: RoomPlacement = placement ?? getPlacement(activeName);

  const setAxis = useCallback(
    (key: keyof RoomPlacement, axis: 0 | 1 | 2, value: number) => {
      const next: [number, number, number] = [...getPlacement(activeName)[key]];
      next[axis] = value;
      setPlacement(activeName, { [key]: next });
    },
    [activeName, getPlacement, setPlacement],
  );

  const setUniformScale = useCallback(
    (value: number) => {
      setPlacement(activeName, { scale: [value, value, value] });
    },
    [activeName, setPlacement],
  );

  const copyJson = useCallback(() => {
    const text = singlePropJson(activeName, getPlacement(activeName));
    void navigator.clipboard.writeText(text);
  }, [activeName, getPlacement]);

  const downloadLayout = useCallback(() => {
    downloadJson('wts-room-layout.json', JSON.stringify(diff(), null, 2));
  }, [diff]);

  const uniform = current.scale[0];

  return (
    <aside className="panel" data-testid="room-properties-panel" data-room-prop={activeName}>
      <div className="panel__title">Room placement</div>
      <div className="panel__subtitle">{activeName}</div>

      {/* ── Position offset ───────────────────────────────────── */}
      <section className="panel__section">
        <div className="panel__label">Position offset (m)</div>
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
          disabled={isIdentityPlacement(current)}
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
