# CLAUDE.md — Woodturning Studio (agent entrypoint)

A first-person 3D woodturning simulator. The player walks a warm workshop, assembles a Jet JWL-1642EVS lathe, then turns wood with honest physics. **Before doing any work, read `docs/00_PROJECT_BRIEF.md`** (locked design + constraints). Build **one slice at a time**; for large features, phase into sequenced, individually-green slices.

## Current state (2026-06-12)

**Built and green:** core turning physics, wood blank (LatheGeometry), mouse + MediaPipe input adapters, 4-lesson curriculum with gated progress, lesson select UI, coaching overlay, camera toggle, local IndexedDB persistence.

**In progress (this phase):** migrating from per-lesson Canvas to a **single persistent workshop Canvas** with a scene state machine (MENU → WORKSHOP_WALK → AT_LATHE → TURNING → LESSON_COMPLETE). Adding first-person walk, Jet JWL-1642EVS geometry, assembly interaction (E-to-grab + snap), proximity auto-lock, PBR materials, and a lathe startup cutscene.

Do not rebuild what's already shipped. Turning physics (`src/core/`), curriculum (`src/session/`), and content (`content/`) are stable — build on top of them.

**Shared-file footgun:** `src/client/App.tsx`, `src/workshop/sceneStore.ts`, and `content/lathe/*.json` are high-contention. Never run two builders editing the same file concurrently. Serialize slices that touch the scene state machine or arch-guard config.

## The non-negotiable constraints (mirror brief §7)

1. `src/core/` imports **zero** browser APIs, UI frameworks, or Three.js — enforced by dependency-cruiser.
2. Walk mode → `FPSInput`; Turn mode → `ToolPose`. The scene state machine decides which is active. Core never knows the mode.
3. No `new Vector3()` or heap allocation inside the physics/render tick — pre-allocate, mutate in place.
4. Physics core injects clock; never calls `Date.now()` or `Math.random()` directly.
5. Every IndexedDB schema change ships with a forward migration + golden fixture.
6. Every new system ships tests; curriculum JSON + lathe dimension JSON pass Zod lint; arch-guard stays green.
7. Jet JWL-1642EVS part dimensions live in `content/lathe/*.json` — never hardcode a measurement.

## Tech spine

TypeScript (strict) · Vite · React · React Three Fiber / Three.js · MediaPipe Hands · Zustand · Zod · Vitest · ESLint + dependency-cruiser · IndexedDB (idb)

```
src/core/         — pure physics: turning tick, wood state (NO browser/UI/Three)
src/input/        — FPS controller + MediaPipe + mouse tool adapter
src/workshop/     — scene state machine, proximity detection, assembly logic
src/session/      — curriculum state, lesson gates, IndexedDB
src/client/
  workshop/       — room, furniture, lighting geometry
  lathe/          — Jet JWL-1642EVS part generators (one file per assembly)
  wood/           — WoodBlank (LatheGeometry + grain shader)
  scene/          — ToolMesh, PhysicsLoop
  ui/             — HUD, CoachingOverlay, LessonSelect, InputToggle
  lesson/         — LessonRunner, LessonEvaluator, LessonComplete
content/
  tools/          — tool specs (JSON, Zod)
  curriculum/     — lesson definitions (JSON, Zod)
  lathe/          — Jet JWL-1642EVS dimensions (JSON, Zod) ← new
```

## The gate (what "done" means)

```bash
pnpm typecheck       # tsc --noEmit
pnpm lint            # eslint + dependency-cruiser
pnpm test            # vitest run  (record test COUNT)
pnpm lint:content    # zod-validate content/**/*.json
pnpm build           # vite build
```

All five → exit 0. Never trust a builder's "green" — re-run with real exit codes.

## Environment notes

- **OS:** Windows 11, PowerShell
- **Runtime:** Node — use `pnpm` (never npm or yarn)
- **Dev server:** `pnpm dev` → localhost:5173
- **Browser target:** Chrome / Firefox desktop only
- **Camera:** MediaPipe via npm; requires HTTPS or localhost for `getUserMedia`
- **No external 3D assets** — all geometry is procedural code

## Working agreements

- Targeted `git add <file>` only — never `git add -A`
- Commit per layer, one concern per commit
- Leave deploys and `git push` to the director
- Never paste secrets or API keys
- New npm dependencies: flag for director review first
- Stop and ask before: arch-guard config, IndexedDB schema, destructive git ops
