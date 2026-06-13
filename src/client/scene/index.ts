export { ToolMesh } from './ToolMesh.js';
export { PhysicsLoop } from './PhysicsLoop.js';
export { FPSCamera } from './FPSCamera.js';
// NOTE: sceneRegistry and SceneCtx are intentionally NOT re-exported here.
// They import from src/client/lesson/ which imports back from this barrel,
// so exporting them here would create a circular dependency.
// App.tsx imports them directly: import { sceneRegistry } from './scene/sceneRegistry.js'
