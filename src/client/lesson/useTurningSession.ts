import { useRef, useState, useEffect } from 'react';
import { createWoodState } from '../../core/physics.js';
import { MouseAdapter } from '../../input/mouseAdapter.js';
import { CameraAdapter } from '../../input/cameraAdapter.js';
import type { InputAdapter, InputSource } from '../../input/types.js';
import type { WoodState, ToolPose } from '../../core/types.js';
import type { LessonRunState } from './LessonEvaluator.js';
import type { RefObject } from 'react';
import { useSettingsStore } from '../ui/settingsStore.js';

export interface PoseContainer {
  pose: ToolPose;
}

const DEFAULT_POSE: ToolPose = {
  position: { x: 0, y: 0, z: 0 },
  angleX: 0.3,
  angleY: 0,
  pressure: 0,
};

// ── Turning blank dimensions (shared by the physics woodState + the visual rig) ──
//
// The blank is mounted BETWEEN CENTERS, so it must span from the headstock drive-
// center tip to ~30 mm short of the tailstock body — exactly like the AT_LATHE blank
// in Lathe.tsx — instead of floating as a short stub. Derived from
// content/lathe/jet-jwl-1642.json so the ends meet the rendered centers:
//   bedLeftX             = -bed.length/2                              = -0.725
//   headstockSpindleFaceX= bedLeftX + headstock.width(0.30) + noseLen(0.06) = -0.365
//   driveCenterTipX      = + driveCenter.length(0.055) + centerPointLength(0.009) = -0.301
//   liveCenterTipX       = driveCenterTipX + betweenCenters(1.0668)   =  0.7658
//   tailstockLeftFaceX   = liveCenterTipX - liveCenter.length(0.055)  =  0.7108
//   blankRightEndX       = tailstockLeftFaceX - 0.03 (clear of body)  =  0.6808
//   BLANK_LENGTH         = blankRightEndX - driveCenterTipX           =  0.9818
//   BLANK_CENTRE_X       = (driveCenterTipX + blankRightEndX) / 2     =  0.1899
// Keep these in sync if the lathe JSON changes (same formula as Lathe.tsx defaultBlank).
export const BLANK_LENGTH = 0.9818;  // m — tip-of-drive-center to ~30 mm short of tailstock
export const BLANK_RADIUS = 0.05;    // m — 0.1 m (≈4") diameter stock
export const BLANK_CENTRE_X = 0.1899; // m — world X midpoint of the span (rig centre)

export interface TurningSessionResult {
  adapter: InputAdapter | null;
  adapterReady: boolean;
  poseContainer: RefObject<PoseContainer>;
  woodState: RefObject<WoodState>;
  runStateRef: RefObject<LessonRunState>;
  /**
   * Current input source — read from settingsStore.input.mode (single source
   * of truth). Exposed here so SceneCtx / TurningOverlay / InputToggle can
   * consume it without knowing about the store directly.
   */
  inputSource: InputSource;
  /**
   * Switch the turning-tool input source.
   * Writes to settingsStore.input.mode — the store is the single source of
   * truth, so the Settings > Input tab and the HUD InputToggle always agree.
   */
  setInputSource: (src: InputSource) => void;
  cameraAvailable: boolean;
}

export function useTurningSession(): TurningSessionResult {
  const woodState = useRef<WoodState>(createWoodState(BLANK_LENGTH, BLANK_RADIUS));
  const adapterRef = useRef<InputAdapter | null>(null);
  const poseContainer = useRef<PoseContainer>({ pose: DEFAULT_POSE });
  const runStateRef = useRef<LessonRunState>({
    totalMaterialRemoved: 0,
    catchCount: 0,
    maxTearout: 0,
    elapsed: 0,
  });

  // inputSource reads from the store — settingsStore.input.mode is the single
  // source of truth.  The old local useState('mouse') is gone.
  const inputSource = useSettingsStore((s) => s.input.mode);
  const setInputSource = useSettingsStore((s) => s.setInputMode);

  const [cameraAvailable] = useState<boolean>(
    typeof navigator !== 'undefined' &&
      'mediaDevices' in navigator &&
      'getUserMedia' in navigator.mediaDevices,
  );
  const [adapterReady, setAdapterReady] = useState(false);

  useEffect(() => {
    setAdapterReady(false);
    const adapter: InputAdapter =
      inputSource === 'camera' ? new CameraAdapter() : new MouseAdapter();
    adapterRef.current = adapter;

    adapter.start().then(() => {
      setAdapterReady(true);
    }).catch(() => {
      // Camera permission denied or unavailable — fall back to mouse
      adapter.stop();
      const fallback = new MouseAdapter();
      adapterRef.current = fallback;
      fallback.start().catch(() => { /* no-op */ });
      // Fall back in the store so everything stays in sync
      useSettingsStore.getState().setInputMode('mouse');
      setAdapterReady(true);
    });

    return () => {
      adapter.stop();
    };
  }, [inputSource]);

  return {
    adapter: adapterRef.current,
    adapterReady,
    poseContainer,
    woodState,
    runStateRef,
    inputSource,
    setInputSource,
    cameraAvailable,
  };
}
