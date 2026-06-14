import { useFrame } from '@react-three/fiber';
import { tickPhysics } from '../../core/physics.js';
import type { WoodState, ToolPose, ToolKind, PhysicsResult, SpeciesCutProfile } from '../../core/types.js';
import { setCutIntensity, cutIntensityFromRemoval } from '../audio/cutting.js';
import { emit } from '../audio/events.js';

interface PhysicsLoopProps {
  woodState: WoodState;
  toolPose: ToolPose;
  toolKind: ToolKind;
  /** Per-(species,tool) cut-feel multipliers. Pass undefined to use the neutral identity profile. */
  cutProfile: SpeciesCutProfile | undefined;
  onResult: (r: PhysicsResult) => void;
}

export function PhysicsLoop({ woodState, toolPose, toolKind, cutProfile, onResult }: PhysicsLoopProps) {
  useFrame((_, delta) => {
    const result = tickPhysics(woodState, toolPose, toolKind, delta * 1000, cutProfile);
    onResult(result);

    // Drive cutting sound — safe no-op when no AudioContext (jsdom / before unlock).
    setCutIntensity(cutIntensityFromRemoval(result.materialRemoved));

    // Fire catch one-shot on a tool catch event.
    if (result.catch) {
      emit('catch');
    }
  });

  return null;
}
