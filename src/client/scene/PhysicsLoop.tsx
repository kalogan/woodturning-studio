import { useFrame } from '@react-three/fiber';
import { tickPhysics } from '../../core/physics.js';
import type { WoodState, ToolPose, ToolKind, PhysicsResult, SpeciesCutProfile } from '../../core/types.js';

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
  });

  return null;
}
