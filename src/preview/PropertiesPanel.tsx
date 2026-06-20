/**
 * PropertiesPanel.tsx — the RIGHT-side knobs rail for the active prop (knobs + bake).
 *
 * HARNESS-ONLY inspection scaffolding. Lets the director scale / move / rotate /
 * tint the active prop and EXPORT the values as JSON to bake back into the real
 * component later. It edits ONLY the harness-level edit record (editStore) — it
 * never touches product source. The render-side transform + tint clone live in
 * PreviewApp.
 *
 * Dual-consumer (§5): every control carries a stable data-testid so an agent can
 * drive it, while the director uses the same controls by hand.
 */
import { useCallback } from 'react';
import { isIdentity, useEditStore, type PropEdit } from './editStore.js';

interface Props {
  /** The currently-selected prop name. */
  readonly activeName: string;
}

const DEFAULT_TINT = '#a87f4d';

/** Pretty-printed single-prop object: { "<Name>": {...} }. */
function singlePropJson(name: string, edit: PropEdit): string {
  return JSON.stringify({ [name]: edit }, null, 2);
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

export function PropertiesPanel({ activeName }: Props): React.JSX.Element {
  // Subscribe to this prop's edit so the panel re-renders on every change.
  const edit = useEditStore((s) => s.edits[activeName]) ?? null;
  const getEdit = useEditStore((s) => s.getEdit);
  const setEdit = useEditStore((s) => s.setEdit);
  const reset = useEditStore((s) => s.reset);
  const diff = useEditStore((s) => s.diff);

  const current: PropEdit = edit ?? getEdit(activeName);

  const setAxis = useCallback(
    (key: 'scale' | 'position' | 'rotationDeg', axis: 0 | 1 | 2, value: number) => {
      const next: [number, number, number] = [...getEdit(activeName)[key]];
      next[axis] = value;
      setEdit(activeName, { [key]: next });
    },
    [activeName, getEdit, setEdit],
  );

  const setUniformScale = useCallback(
    (value: number) => {
      setEdit(activeName, { scale: [value, value, value] });
    },
    [activeName, setEdit],
  );

  const setTintEnabled = useCallback(
    (enabled: boolean) => {
      setEdit(activeName, { tint: enabled ? (getEdit(activeName).tint ?? DEFAULT_TINT) : null });
    },
    [activeName, getEdit, setEdit],
  );

  const setTintColor = useCallback(
    (hex: string) => {
      setEdit(activeName, { tint: hex });
    },
    [activeName, setEdit],
  );

  const copyJson = useCallback(() => {
    const text = singlePropJson(activeName, getEdit(activeName));
    void navigator.clipboard.writeText(text);
  }, [activeName, getEdit]);

  const downloadAll = useCallback(() => {
    downloadJson('wts-preview-edits.json', JSON.stringify(diff(), null, 2));
  }, [diff]);

  // The uniform slider tracks the X axis (the common case is uniform scaling).
  const uniform = current.scale[0];

  return (
    <aside className="panel" data-testid="properties-panel" data-prop={activeName}>
      <div className="panel__title">Properties</div>
      <div className="panel__subtitle">{activeName}</div>

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
            data-testid="edit-scale-uniform"
            onChange={(e) => { setUniformScale(Number(e.target.value)); }}
            className="panel__slider"
            aria-label="Uniform scale"
          />
          <span className="panel__readout" data-testid="edit-scale-uniform-readout">
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
                data-testid={`edit-scale-${axis}`}
                onChange={(e) => { setAxis('scale', i as 0 | 1 | 2, Number(e.target.value)); }}
              />
            </label>
          ))}
        </div>
      </section>

      {/* ── Position offset ───────────────────────────────────── */}
      <section className="panel__section">
        <div className="panel__label">Position offset (m)</div>
        <div className="panel__triple">
          {(['x', 'y', 'z'] as const).map((axis, i) => (
            <label key={axis} className="panel__field">
              <span>{axis}</span>
              <input
                type="number"
                min={-5}
                max={5}
                step={0.05}
                value={current.position[i]}
                data-testid={`edit-position-${axis}`}
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
                data-testid={`edit-rotation-${axis}`}
                onChange={(e) => { setAxis('rotationDeg', i as 0 | 1 | 2, Number(e.target.value)); }}
              />
            </label>
          ))}
        </div>
      </section>

      {/* ── Tint ──────────────────────────────────────────────── */}
      <section className="panel__section">
        <div className="panel__label">Tint</div>
        <label className="panel__check">
          <input
            type="checkbox"
            checked={current.tint !== null}
            data-testid="edit-tint-enabled"
            onChange={(e) => { setTintEnabled(e.target.checked); }}
          />
          <span>Override colour</span>
        </label>
        <input
          type="color"
          value={current.tint ?? DEFAULT_TINT}
          disabled={current.tint === null}
          data-testid="edit-tint-color"
          onChange={(e) => { setTintColor(e.target.value); }}
          className="panel__color"
          aria-label="Tint colour"
        />
      </section>

      {/* ── Actions ───────────────────────────────────────────── */}
      <section className="panel__section panel__actions">
        <button
          type="button"
          className="panel__btn"
          data-testid="reset-edit"
          disabled={isIdentity(current)}
          onClick={() => { reset(activeName); }}
        >
          Reset
        </button>
        <button
          type="button"
          className="panel__btn"
          data-testid="copy-json"
          onClick={copyJson}
        >
          Copy JSON
        </button>
        <button
          type="button"
          className="panel__btn"
          data-testid="download-edits"
          onClick={downloadAll}
        >
          Download all edits
        </button>
      </section>
    </aside>
  );
}
