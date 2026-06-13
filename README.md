# Woodturning Studio

A first-person 3D woodturning simulator that runs in the browser. Walk a warm
workshop, assemble a real **Jet JWL-1642EVS** lathe from its parts, mount a
blank, and turn it with honest tool-to-wood physics — bevel contact, catches,
and grain tearout are all modeled. The signature input: your webcam tracks a
physical pencil as the turning tool (with a mouse fallback always available), so
a beginner can build real muscle-memory before touching a live lathe.

> **Status:** in active development. The turning physics, 4-lesson curriculum,
> procedural lathe + workshop geometry, and the single-Canvas scene state machine
> are built and green. First-person walking, lathe assembly, and the startup
> cutscene are the next slices — see [Roadmap](#roadmap).

---

## Quick start

**Prerequisites**
- [Node.js](https://nodejs.org/) **20.19+** (developed on v24)
- [pnpm](https://pnpm.io/) **11+** — this project uses pnpm, not npm (there's a
  `pnpm-lock.yaml` and the package manager is pinned). Install with
  `npm install -g pnpm` or `corepack enable`.

**Run it**
```bash
pnpm install      # install dependencies
pnpm dev          # start the Vite dev server
```
Then open **http://localhost:5173** in **Chrome or Firefox** (desktop only).

> The webcam pencil-tracking input needs `getUserMedia`, which browsers only
> grant on `localhost` or HTTPS — `localhost:5173` qualifies, so camera mode
> works out of the box. Mouse mode needs no permissions.

### How to drive it (current build)

1. On the lesson menu, click **Start →** on *Roughing: From Square to Round*.
2. Click **Approach lathe →**, then **Pick up tool →** to enter turning mode.
   *(These buttons are temporary scaffolding — first-person WASD walking with
   proximity auto-lock replaces them in an upcoming slice.)*
3. Move the **mouse** to angle the tool; **click-drag** to cut. The coaching
   overlay shows your tool angle (green = good, amber/red = catch risk).
4. Toggle **Mouse ↔ Camera** input bottom-right. `← Menu` resets anytime.

---

## Tech stack

TypeScript (strict) · Vite · React · React Three Fiber / Three.js ·
MediaPipe Hands · Zustand · Zod · Vitest · ESLint + dependency-cruiser ·
IndexedDB (idb)

All 3D geometry is **procedural** — the workshop, the Jet lathe parts, the tools,
and the wood blank are generated in code from real dimensions. There are no
external 3D assets.

## Project layout

```
src/
  core/        Pure physics: turning tick, wood state (zero browser/UI/Three imports)
  input/       FPS controller + MediaPipe camera + mouse adapter → unified pose
  workshop/    Scene state machine (MENU → WORKSHOP_WALK → AT_LATHE → TURNING → …)
  session/     Curriculum state, lesson gates, IndexedDB persistence
  client/      React + R3F — one persistent Canvas + all renderers
    workshop/  Room, furniture, lighting geometry
    lathe/     Jet JWL-1642EVS part generators
    wood/      WoodBlank (LatheGeometry + grain)
    scene/     ToolMesh, PhysicsLoop
    ui/        LessonSelect, CoachingOverlay, InputToggle
    lesson/    TurningScene, evaluator, completion
content/
  tools/       Tool specs (JSON, Zod-validated)
  curriculum/  Lesson definitions (JSON, Zod-validated)
  lathe/       Jet JWL-1642EVS dimensions (JSON — single source of truth)
```

## Scripts

```bash
pnpm dev            # dev server with HMR
pnpm build          # typecheck + production build
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint + dependency-cruiser architecture guard
pnpm test           # vitest run
pnpm lint:content   # validate content/**/*.json against Zod schemas
pnpm gate           # run all of the above — the full quality gate
```

## Architecture constraints

A few rules are enforced mechanically (by `dependency-cruiser`, the gate, and
tests), not by convention:

- **`src/core/` is pure** — no browser APIs, no UI framework, no Three.js. The
  physics is engine-agnostic and deterministic (the clock is injected; it never
  calls `Date.now()` or `Math.random()`).
- **One persistent Canvas** — the whole app lives in a single R3F Canvas; a scene
  state machine decides what renders and which input model is active.
- **Lathe dimensions are data** — every Jet JWL-1642EVS measurement lives in
  `content/lathe/*.json`, never hardcoded in geometry.
- **Every new system ships tests**, and all content JSON passes Zod lint.

## Roadmap

| Status | Slice |
|--------|-------|
| ✅ | Core turning physics (bevel, catch, tearout) — deterministic, tested |
| ✅ | Procedural Jet JWL-1642EVS lathe + workshop geometry |
| ✅ | 4-lesson gated curriculum + IndexedDB save |
| ✅ | Mouse + MediaPipe pencil-tracking input |
| ✅ | Single persistent Canvas + scene state machine |
| ⏳ | Camera push-in to the lathe-mounted blank |
| ⏳ | First-person walk (WASD + mouse-look) + proximity auto-lock |
| ⏳ | Lathe assembly lesson (E-to-grab + snap placement) |
| ⏳ | PBR materials (cast iron, painted steel, rubber, wood grain) |
| ⏳ | Lathe startup cutscene |

## License

ISC
