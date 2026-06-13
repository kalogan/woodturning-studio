/**
 * ToolRest — steel post + horizontal rail that the turning tool rides on.
 *
 * Shape: an inverted-L / flag.
 *   • Vertical POST (cylinder) drops down into the banjo bore.
 *   • At the top of the post, a horizontal BAR runs along the lathe axis (X).
 *     The bar's top edge is the rail surface — it sits at roughly spindle-center
 *     height so the tool rests at the correct working height.
 *
 * The component origin is at the BASE of the post (top of banjo block).
 * The caller is responsible for placing it so the bar top reaches spindleY.
 *
 * All dimensions from spec.toolRest.
 */
import spec from '../../../content/lathe/jet-jwl-1642.json';
import { bareSteel } from './materials.js';

interface ToolRestProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  /**
   * Override the exposed post height (above the banjo).
   * Clamped to [postDiameter, postHeight].
   * When omitted the full spec postHeight is used.
   */
  height?: number;
}

const mat = bareSteel(spec.toolRest.color);

export function ToolRest({ position = [0, 0, 0], rotation = [0, 0, 0], height }: ToolRestProps) {
  const { postDiameter, postHeight, barLength, barDiameter } = spec.toolRest;

  const effectivePostHeight = height !== undefined
    ? Math.max(postDiameter, Math.min(postHeight, height))
    : postHeight;

  // Bar centre is at the top of the post + half bar diameter (bar sits on top of post)
  const barCentreY = effectivePostHeight + barDiameter / 2;

  // The bar runs along the lathe axis (X), cantilevered from the top of the post.
  // It is a cylinder whose long axis is X, so we rotate it 90° about Z.
  // The bar is offset slightly toward the operator (+Z) so it sits just in front
  // of the blank — offset by half the post diameter so the inner face is flush
  // with the front of the post.
  const barZOffset = postDiameter / 2;

  return (
    <group position={position} rotation={rotation}>
      {/* ── Vertical post ──────────────────────────────────────────────── */}
      <mesh position={[0, effectivePostHeight / 2, 0]}>
        <cylinderGeometry args={[postDiameter / 2, postDiameter / 2, effectivePostHeight, 12]} />
        <meshStandardMaterial {...mat} />
      </mesh>

      {/* ── Horizontal rest bar — runs along X (lathe axis) ────────────── */}
      {/*
        cylinders default to Y-axis; rotate -90° around Z so the long axis is X.
        The bar is positioned at the top of the post, slightly toward operator.
      */}
      <mesh position={[0, barCentreY, barZOffset]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[barDiameter / 2, barDiameter / 2, barLength, 12]} />
        <meshStandardMaterial {...mat} />
      </mesh>
    </group>
  );
}
