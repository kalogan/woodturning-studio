/**
 * Ambient declaration so TypeScript accepts the harness's side-effect CSS import
 * (`import './preview.css'`). Vite handles the actual bundling. Scoped to the
 * preview dir; the product bundle imports no CSS.
 */
declare module '*.css';
