import { useFrame } from '@react-three/fiber';
import { tickPhysics } from '../../core/physics.js';
import type { WoodState, ToolPose, ToolKind, PhysicsResult } from '../../core/types.js';

interface PhysicsLoopProps {
  woodState: WoodState;
  toolPose: ToolPose;
  toolKind: ToolKind;
  onResult: (r: PhysicsResult) => void;
}

export function PhysicsLoop({ woodState, toolPose, toolKind, onResult }: PhysicsLoopProps) {
  useFrame((_, delta) => {
    const result = tickPhysics(woodState, toolPose, toolKind, delta * 1000);
    onResult(result);
  });

  return null;
}
