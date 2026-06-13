# 00 · Project Brief — Woodturning Studio (READ FIRST, ALWAYS)

> The pipeline says *how* to build; THIS says *what* you're building and the rules that never bend.

---

## 1. The product in one paragraph

A browser 3D woodturning simulator set inside a first-person workshop. The player walks through a real-feeling shop, assembles an actual Jet JWL-1642EVS lathe from its parts, mounts a blank, and then turns it — with honest tool-to-wood physics, real bevel-contact mechanics, and gentle coaching. The signature interaction: the player's webcam tracks a physical pencil as the turning tool (mouse fallback always available). When within arm's reach of the tool rest, the game auto-locks into turning mode; step back and you're walking the shop again. The goal is that a beginner builds real muscle-memory and judgment — setup, safety, and technique — before touching a live lathe.

---

## 2. Pillars (ranked)

1. **Honest physics teaches judgment** — tool angle, bevel contact, grain direction, catch risk, and collision with lathe parts are all modeled. Wrong technique produces catches, tearout, or accidental nudges. The sim explains; it doesn't punish.
2. **A real shop you inhabit** — first-person walk, a warm fluorescent workshop, a Jet lathe you assembled yourself. Immersion makes the muscle-memory stick.
3. **Physical metaphor over abstraction** — webcam pencil tracking is the primary turning input. The body learns alongside the eyes.
4. **Learn by doing, not reading** — curriculum is structured and gated, but every lesson is hands-on. Lesson 1 is literally: build the lathe.
5. **Procedurally built, no external assets** — all geometry (workshop, Jet JWL-1642EVS parts, tools, wood) is generated from real dimensions in code.

---

## 3. The core loop

```
Enter workshop (first-person) →
  Lesson 1: Walk to tool cabinet → pick up lathe parts (E to grab) →
            carry to lathe station → snap into place → learn tailstock travel →
            mount drive + live centers → safety gear on →
            [cutscene: lathe spins up, camera pushes into turning position]
  Lesson 2+: Approach tool rest (proximity auto-lock) →
             pick up turning tool → work the blank (physics tick) →
             coaching overlay (angle, catch, tearout) →
             lesson complete beat → step back → walk to next lesson
```

---

## 4. Current state (updated 2026-06-12)

**Built and gated green:**
- Core physics: bevel contact, catches, tearout (deterministic, tested)
- Spinning LatheGeometry wood blank from profile array
- Mouse adapter + MediaPipe hand tracking → ToolPose
- Curriculum state machine, 4 lessons, IndexedDB persistence
- Lesson select screen (card grid, lock gates)
- LessonRunner: Canvas + physics loop + eval + completion beat
- Coaching overlay: angle indicator (green/amber/red), catch/tearout cue pills
- Camera toggle (mouse ↔ MediaPipe)

**Not yet built (this phase):**
- First-person walk controller
- Full 3D workshop scene (room, furniture, lighting)
- Jet JWL-1642EVS procedural geometry (all parts)
- Assembly interaction system (E-to-grab, snap placement)
- Proximity auto-lock switching walk ↔ turning mode
- Lathe startup cutscene
- PBR materials (cast iron, painted steel, rubber, wood grain)
- CSG-style collision feedback (tool bumping lathe parts = coaching cue)

---

## 5. Scope — IN vs OUT

**In (v1):**
- Three turning tools: roughing gouge, spindle gouge, parting tool
- Webcam pencil tracking (primary) + mouse fallback
- First-person workshop navigation (WASD + mouse look)
- Proximity auto-lock at tool rest → turning mode
- Jet JWL-1642EVS lathe geometry (procedural from real dimensions)
- Assembly lesson: tailstock travel, tool rest + banjo, drive center, live center
- Workshop: lathe station, tool cabinet, workbench, blank rack, safety gear station
- Warm fluorescent lighting + tungsten task spot over lathe
- Stylized-realistic PBR materials
- Lathe startup cutscene (lesson 1 completion)
- 4 structured lessons, gated, local save (IndexedDB)
- Desktop Chrome/Firefox only

**Out (v1, explicitly deferred):**
- Bowl gouge, skew chisel, sandpaper
- Full CSG boolean mesh cutting (profile array model is the proxy)
- Account system / cloud save / gallery
- Mobile / tablet support
- Audio (ambient shop sounds, tool sounds)
- Multiple workshop layouts or rooms
- VR mode

---

## 6. Tech spine (locked)

```
src/core/        — pure physics: turning tick, wood state, tool geometry math
                   NO browser/UI/Three imports (arch-guard enforced)
src/input/       — FPS controller, MediaPipe camera, mouse tool adapter → unified pose
src/workshop/    — workshop scene state machine, proximity detection, assembly system
src/session/     — curriculum state, lesson gates, IndexedDB
src/client/      — React + R3F: persistent workshop Canvas, all renderers
  workshop/      — room, furniture, lighting procedural geometry
  lathe/         — Jet JWL-1642EVS part generators (one file per major assembly)
  wood/          — WoodBlank (LatheGeometry + grain shader)
  scene/         — ToolMesh, PhysicsLoop
  ui/            — LessonSelect, CoachingOverlay, InputToggle, HUD
  lesson/        — LessonRunner, LessonEvaluator, LessonComplete
content/
  tools/         — tool dimension specs (JSON, Zod-validated)
  curriculum/    — lesson definitions (JSON, Zod-validated)
  lathe/         — Jet JWL-1642EVS part dimensions (JSON, reference source of truth)
```

**One persistent Canvas** — the entire app lives in one R3F Canvas. Scene state machine controls what's active (MENU / WORKSHOP_WALK / AT_LATHE / TURNING / LESSON_COMPLETE). The old per-lesson Canvas approach is superseded.

**Stack:** TypeScript (strict) · Vite · React · React Three Fiber / Three.js · MediaPipe Hands · Zustand · Zod · Vitest · ESLint + dependency-cruiser · IndexedDB (idb)

---

## 7. The non-negotiable constraints

1. **Architecture boundary** — `src/core/` imports zero browser APIs, zero UI frameworks, zero Three.js. Enforced by dependency-cruiser.
2. **Unified input contract** — FPS walk mode and turning mode both normalize to typed interfaces before touching core. Walk: `FPSInput { forward, strafe, yaw, pitch }`. Turn: `ToolPose { position, angleX, angleY, pressure }`. The scene state machine decides which is active.
3. **No per-frame heap allocation** — pre-allocate, mutate in place. Applies to physics tick AND FPS movement.
4. **Deterministic core** — physics core injects clock, never calls `Date.now()` / `Math.random()` directly.
5. **Versioned persistence** — every IndexedDB schema change ships with a forward migration + golden fixture.
6. **Every new system ships tests; curriculum JSON passes Zod lint; arch-guard stays green.**
7. **Jet JWL-1642EVS dimensions are data** — part dimensions live in `content/lathe/*.json`, Zod-validated, imported by the geometry generators. Never hardcode a measurement.

---

## 8. The hard gate

```bash
pnpm typecheck       # tsc --noEmit
pnpm lint            # eslint + dependency-cruiser
pnpm test            # vitest run (record test COUNT)
pnpm lint:content    # zod-validate content/**/*.json
pnpm build           # vite build
```

---

## 9. Safety boundaries

- `git push --force` or any destructive git op
- Deploying to any hosting environment
- Touching `src/core/` physics in the same slice as curriculum changes
- Any IndexedDB schema change without paired migration + golden fixture
- New dependency without director review

---

## 10. Scene state machine (the routing spine)

```
MENU
  → (Start) → WORKSHOP_WALK

WORKSHOP_WALK
  → (approach tool rest, distance < 0.8m) → AT_LATHE
  → (approach part, E pressed) → CARRYING [part in hand]
  → (at snap point, E pressed) → part snaps → WORKSHOP_WALK

AT_LATHE
  → (step back, distance > 1.2m) → WORKSHOP_WALK
  → (pick up turning tool) → TURNING

TURNING
  → (set tool down) → AT_LATHE
  → (lesson eval passes) → LESSON_COMPLETE

LESSON_COMPLETE
  → (cutscene) → WORKSHOP_WALK  (or MENU if all lessons done)
```

---

## 11. Glossary

| Term | Definition |
|------|-----------|
| **ToolPose** | Normalized turning input: `{ position: Vec3, angleX, angleY, pressure }` |
| **FPSInput** | Normalized walk input: `{ forward, strafe, yaw, pitch, interact }` |
| **Wood state** | Mutable radial profile array — physics core updates each tick |
| **Bevel contact** | Tool bevel riding the wood — correct turning technique |
| **Catch** | Sudden dig-in from wrong tool angle |
| **Banjo** | The cast-iron mounting block that holds the tool rest |
| **Live center** | Rotating tailstock center — supports the blank's right end |
| **Drive center** | Spur center in the headstock — grips and drives the blank |
| **Snap point** | A 3D position + orientation where a lathe part locks into place during assembly |
| **Proximity auto-lock** | Within 0.8m of tool rest → camera locks → turning mode activates |
