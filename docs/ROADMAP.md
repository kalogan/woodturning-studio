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

## Phase T — first-person turning + EVS lathe controls (CORE LOOP DONE; hands + control-feel deferred)

The signature loop: stand first-person at your lathe → **press the power button →
manually twist the speed dial up** → the blank spins → pick up the tool → move it
into the spinning wood. Camera locks while turning; mouse drives the tool. RPM honestly
affects the cut (too slow for the diameter → catches; near ideal → clean). Visible
hands (to show technique) are the goal but DEFERRED — see remaining item 1.

**Done — the core loop works end-to-end:** T1 EVS control geometry · T3 RPM→cut
physics · T2-state RPM store · T2b-display (live readout + blank spins) · T4
first-person turning view · blank horizontal + spins in place · tool presentation
(held + presented to the wood) · spin-from-RPM (blank tracks the dialed speed) ·
**AT-lathe controls** (auto-cursor stance: click START, drag the speed dial) ·
step-back-to-walk button. Walk → lathe (camera locks, cursor) → START + dial → E →
first-person turning → ← step back. Hands FOUNDATION exists (model + poses) but is
**unmounted** (see below).

**Remaining (ordered):**

1. **Visible hands — DEFERRED to a deliberate, eyeball-tuned pass.** Blind placement
   looked awful (a single disembodied hand at the controls; "worse than none"). Both
   mounts (reaching + grip) were removed; the hands model + `GrippingHands`/`ReachingHand`
   components remain in `src/client/hands`, unmounted. Do this WITH the director
   screenshotting: controls-hand should come from the lower frame edge (the operator's
   arm) or appear only on interaction; the turning grip needs correct two-hand poses on
   the tool. Architect preview screenshots have been broken — needs the director's eyes.
2. **Tool-cut precision / turning control-feel — a DESIGN DECISION (see
   `docs/research/competitive-analysis.html`).** The loop works, but the tool doesn't
   cut *exactly* where it visually touches (mouseAdapter ties cut-station `pose.z` and
   sideways motion together → slight diagonal). A proper fix means reorienting the tool
   control frame (re-tunes tool presentation) AND ideally adopting the richer control
   model the report recommends: **SHIFT precision mode, mouse XY = traverse + depth,
   one-cursor-two-constraints two-hand control, audio-first cut gradient, ghost
   tool-path.** Pick the control model with the director, then implement (NOT a blind
   patch — it re-tunes recent visual work).
3. **Optional polish:** full blank-size unify (blank is a 0.3 m draft vs the 1.07 m
   between-centers span — note this ripples into LessonEvaluator thresholds, so it's a
   coupled change, not pure visual); framing/feel tuning of the camera + drag
   sensitivity (all named constants).

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

## Design backlog — from the competitive analysis (2026-06-13)

Distilled from `docs/research/competitive-analysis.html`. Ranked roughly by
bang-for-buck; each ties to an existing phase or stands as a new prototype. The
through-line wedge: **honest physics + an audio-first correct/incorrect gradient +
fading assistance + diegetic, machine-faithful controls** — a combination no shipping
woodturning game attempts.

**Turning feel & controls** *(Phase T+ control redesign — pick a model with the director first; this is the deferred "tool-cut/control-feel" item):*
- **Mouse XY = traverse + depth** — left/right traverses the blank, in/out is cut depth; the cut is implicit on bevel contact (no click). Replaces today's diagonal `pose.z` mapping — this *is* the cut-alignment fix. (Cooking Sim contextual cut.)
- **SHIFT precision mode** — hold to scale mouse delta ~4× down for finishing/detail passes. (Cooking Sim.)
- **One cursor, two constraints** — mouse = front hand (tip), RMB/scroll = back hand (bevel angle). Learnable two-axis skill, no second pointer.
- **Ghost tool-path overlay** — chase a translucent ideal bevel line in real time; teaches the MOTION, not just the silhouette (beats every existing woodturning game).

**Feedback / juice** *(ties to Phase S SFX + wood visuals):*
- **Audio-first cut gradient** — steady hiss = clean shear → rising harsh tone = nearing a catch → thunk + chip-spray = catch. (Skyrim lockpicking.) Highest-value feedback; the SFX foundation (S1) is already built.
- **Chips + surface-state transformation** — pooled chip particles sized by cut aggressiveness; the wood surface goes torn → cut → polished sheen. (House Flipper reveal.) Honor the no-heap-alloc tick.
- **Catch = teachable moment** — don't end the lesson; pause, replay the last second highlighting the bad angle, resume. (Surgeon Sim's low-shame failure, made instructive.)

**Teaching & onboarding** *(ties to curriculum + Phase L0):*
- **Step-gated craft chain** — mount → true → rough → finish → sand, each an independently green-able lesson slice. (Blacksmith Master + our slice model.)
- **Fading assistance curve** — early lessons snap the bevel + widen catch tolerance; advanced lessons strip it, shown as a progress signal. (Alyx auto-land.)
- **Zero-stakes scratch-pad blank** — motor-off, no objective; onboard the mouse (and the webcam-pencil) before any graded lesson. Mouse stays an always-available fallback for the exotic input.

**Immersion / diegetic UI:**
- **Lesson objective on a paper spec card** clipped to the bench, not a floating panel.
- **Click-drag rotary EVS knob with motor-pitch feedback + detents** — extends the built dial; the diegetic RPM readout is already in.

**Assembly & setup** *(ties to Phase L0):*
- **Snap-to-slot + confirming sound** for the JWL-1642EVS parts. (PC Building Sim install satisfaction.)
- **Tailstock travel to fit the blank** — the player slides the tailstock in (loosen → move → lock) so the live center meets the blank's end; mounting a SHORT blank should prompt "move the tailstock closer." Today the blank is just sized to fit between the centers; real setup is positioning the tailstock to the stock length. (Director-flagged 2026-06-13.)
- **Square-stock → round in the turning model** — the starting blank is square un-roughed stock (now shown at the lathe), but the physics WoodState is a RADIAL profile (always round per station), so it can't represent a square cross-section being trued round. Real square→round roughing needs a non-radial blank model (brief notes the profile array is a proxy). Backlog.

**Hands** *(the current pass):* canned, correct two-hand poses per tool; a controls-hand must come from the lower frame edge or appear only on interaction — never a floating mid-scene hand ("worse than none").

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
