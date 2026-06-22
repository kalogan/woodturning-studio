/**
 * FirstFrameSignal — an in-Canvas component that renders null and fires an
 * `onReady` callback on its FIRST rendered frame, then never again.
 *
 * Used to hide the LoadingOverlay once the heavy scene has actually produced
 * a frame (not merely mounted). Allocation-free in the frame loop: a single
 * ref guard, no object creation per tick.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';

export function FirstFrameSignal({ onReady }: { onReady: () => void }): null {
  const firedRef = useRef(false);

  useFrame(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    onReady();
  });

  return null;
}
