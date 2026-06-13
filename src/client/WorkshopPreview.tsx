/**
 * TEMPORARY preview scene — drops the workshop + assembled Jet lathe into one
 * Canvas with orbit controls so we can eyeball the geometry/lighting before
 * the scene state machine (Slice E+) is built. Throwaway; remove after Slice G.
 */
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Room, Furniture, Lighting } from './workshop/index.js';
import { Lathe } from './lathe/index.js';

export default function WorkshopPreview() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#000' }}>
      <Canvas shadows camera={{ position: [2.0, 1.6, 2.2], fov: 55 }}>
        <Lighting />
        <Room />
        <Furniture />
        {/* Lathe is now floor-standing (its own stand provides working height) */}
        <Lathe position={[0, 0, 0]} defaultBlankVisible />
        <OrbitControls target={[0, 1.05, 0]} />
      </Canvas>
    </div>
  );
}
