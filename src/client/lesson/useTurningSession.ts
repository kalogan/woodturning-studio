import { useRef, useState, useEffect } from 'react';
import { createWoodState } from '../../core/physics.js';
import { MouseAdapter } from '../../input/mouseAdapter.js';
import { CameraAdapter } from '../../input/cameraAdapter.js';
import type { InputAdapter, InputSource } from '../../input/types.js';
import type { WoodState, ToolPose } from '../../core/types.js';
import type { LessonRunState } from './LessonEvaluator.js';
import type { RefObject } from 'react';

export interface PoseContainer {
  pose: ToolPose;
}

const DEFAULT_POSE: ToolPose = {
  position: { x: 0, y: 0, z: 0 },
  angleX: 0.3,
  angleY: 0,
  pressure: 0,
};

export interface TurningSessionResult {
  adapter: InputAdapter | null;
  adapterReady: boolean;
  poseContainer: RefObject<PoseContainer>;
  woodState: RefObject<WoodState>;
  runStateRef: RefObject<LessonRunState>;
  inputSource: InputSource;
  setInputSource: (src: InputSource) => void;
  cameraAvailable: boolean;
}

export function useTurningSession(): TurningSessionResult {
  const woodState = useRef<WoodState>(createWoodState(0.3, 0.05));
  const adapterRef = useRef<InputAdapter | null>(null);
  const poseContainer = useRef<PoseContainer>({ pose: DEFAULT_POSE });
  const runStateRef = useRef<LessonRunState>({
    totalMaterialRemoved: 0,
    catchCount: 0,
    maxTearout: 0,
    elapsed: 0,
  });

  const [inputSource, setInputSource] = useState<InputSource>('mouse');
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
      setInputSource('mouse');
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
