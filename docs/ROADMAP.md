# Roadmap — Woodturning Studio

> Living backlog + resume point. Pairs with `docs/00_PROJECT_BRIEF.md` (the locked
> design) and `docs/ARCHITECT_BUILDER_PIPELINE.md` (how we build). Last updated
> end of the 2026-06-12 → 06-13 session.

## Current state (verified green on `main`)

- **Gate:** typecheck · lint · test · lint:content · build all exit 0.
- **Tests:** **291** across 15 files.
- **`main`** is at `a218781`, **42 commits ahead of `origin/main` (UNPUSHED)** — the
  director pushes on their own schedule.
- Worktree-isolated parallel builders are working; real fan-out waves ran all session.

### Built this session (all merged + independently gated)
W2 (core cut-feel physics) · scene-registry refactor (App.tsx → `sceneRegistry`) ·
W4 (per-lesson wood species wiring) · A/D strafe-flip fix · T1 (EVS control-panel
geometry: green START button + speed-dial indicator) · T3 (RPM→cut honest physics:
surface-speed model) · T2-state (lathe RPM store) · first-person hands foundation
(procedural bare hands + relaxed pose) · T2b-display (live RPM readout + blank spins
at currentRpm) · T4 (first-person turning view — killed the abstract OrbitControls
"void") · blank-orientation fix (horizontal, spins in place). Plus the SFX roadmap;
the obsolete lathe-startup cutscene was retired (superseded by the hands-on
power/dial mechanic).

### ⚠️ Verification caveat (operational)
Preview **screenshots timed out ~100% of the time on any animated 3D scene** this
session (machine load) — only static DOM (MENU) captured. So several visual slices
(T1 button, hands look, T4 framing, the blank-orientation fix) are **gate-green +
console-clean but NOT pixel-verified by the architect.** The director verifies on
their own `localhost:5173` (same working tree). Re-check whether capture works next
session before trusting "looks right".

---

## Phase T — first-person turning + EVS lathe controls (IN PROGRESS)

The signature loop: stand first-person at your lathe → **press the power button →
manually twist the speed dial up** → the blank spins → pick up the tool → move it
into the spinning wood (both hands visible). Camera locks while turning; mouse drives
the tool. RPM honestly affects the cut (too slow for the diameter → catches; near
ideal → clean).

**Done:** T1 geometry · T3 physics · T2-state store · hands foundation · T2b-display ·
T4 first-person view · blank-orientation fix.

**Remaining (ordered):**

1. **T4 framing tune** *(pending director eyeball on 5173)* — confirm the blank now
   reads horizontal + spinning in place; tune `OPERATOR_CAM_POS/TARGET/FOV`
   (`TurningEntry.tsx`) and `RIG_WORLD_POSITION` (`TurningScene.tsx`). If the blank
   lies along the wrong axis, flip the sign on the `[0,0,-Math.PI/2]` wrapper in
   `TurningScene.tsx`.
2. **Tool-to-wood tracking** — make the tool visually cut where the physics removes
   material. Root issue: physics station axis = `toolPose.position.z`, but the blank
   geometry length axis = local **Y**, and `grain.glsl` assumes the lathe axis is Y.
   Aligning them touches the **grain shader** → MUST boot-verify (see
   `shader-runtime-verification` memory; the gate can't catch GLSL errors). Do this
   when screenshots work again.
3. **Spin from RPM** — drive `WoodBlank`'s spin (currently a constant `rotation.y +=
   0.05`) from `useLatheStore.currentRpm` instead of a fixed default.
4. **Full blank-size unify** — the turning blank is still a 0.3 m draft; size it to
   the real 1.07 m between-centers span so it seats between the centers (the old "A2"
   unify of the lathe-mounted blank with the physics blank).
5. **Hands-on-tool grip** — wire the merged `FirstPersonHands` to grip the tool (add a
   grip `HandPose`); director wants **both hands visible** while turning.
6. **T2b control interaction** *(pending director's interaction-feel sign-off)* —
   director chose **cursor click + drag**: at the lathe the cursor releases, you click
   the green START button (power) and click-drag the speed dial to set RPM, with a hand
   reaching the control. Then close the loop: power → dial → cutting **gated on RPM>0**
   and shaped by T3's surface-speed model (`tickPhysics` already takes the `rpm` arg).

---

## Phase L0 — assembly "Lesson 0" (QUEUED, serial)

Teaches part ID + correct placement by trial-and-error. The scene-registry refactor
(done) was its prerequisite. Design is LOCKED (see `assembly-lesson0-phase` memory):
hybrid guided→free; wrong placement = allow-then-flag (snaps red + explanation,
remove & retry); 5 core mountables (tailstock, banjo, tool rest, drive + live
centers); look/approach info-panel descriptions as data in `content/lathe`. This
phase **splits `sceneStore` into per-domain slices** and adds a CARRYING state, so it
runs serially (it dissolves the store hub). Slices: L0a data → L0b grab/carry/place →
L0c validation+UI → L0d curriculum `lesson-00` + gating.

## Phase S — sound effects (PLANNED)

See `docs/ROADMAP_SFX.md`. **Reverses brief §5's audio deferral.** Open fork for the
director: **procedural-synth vs sampled audio vs hybrid** (architect rec: procedural-
first). Phases S1 foundation → S2 interaction one-shots (needs L0 events) → S3 lathe +
**cutting** SFX (physics-driven, the marquee feedback) → S4 ambience/UI.

## Phase F — collision coaching (BACKLOG)

Tool bumping lathe parts → a coaching cue (brief §4 "CSG-style collision feedback").

---

## Open decisions parked for the director (non-blocking)

- **Turning framing** — eyeball T4 on 5173, confirm/tune the camera + blank-spin.
- **Control interaction feel** — sign off on cursor click+drag before T2b interaction.
- **SFX synthesis vs samples** — before Phase S starts.
- **Wood species per lesson** — currently provisional (pine→cherry→walnut→ash by Janka);
  retune the lesson JSONs anytime.
- **`.claude/worktrees/` in `.gitignore`** — small housekeeping so a stray add can't
  sweep a worktree (deferred to avoid touching ignore config mid-wave).

## Constraints that never bend
See brief §7 + CLAUDE.md: `src/core` stays engine-agnostic (dep-cruiser enforced);
deterministic core (inject clock/RNG); no per-frame heap allocation; versioned
IndexedDB + golden fixtures; Jet dimensions live in `content/lathe/*.json`; every new
system ships tests; the 5-gate stays green.
