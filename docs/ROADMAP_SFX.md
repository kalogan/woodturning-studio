# Roadmap — Sound Effects (Phase S)

> **Status:** PLANNED, not started. Added 2026-06-12 at director request.
> **Brief impact:** `docs/00_PROJECT_BRIEF.md` §5 currently lists *"Audio (ambient
> shop sounds, tool sounds)"* under **Out (v1)**. Adding this phase **reverses that
> deferral** — when Phase S is scheduled, update §5 to move audio from Out → In.

A first-person shop should *sound* like one. Audio is the cheapest, highest-impact
layer of immersion we haven't built, and the cutting sound in particular is real
**technique feedback** (the ear learns a clean cut vs a catch before the eye does).

---

## The one fork to settle before S1 — synthesis vs samples

This decides the whole asset/engineering shape of the phase. **Director call.**

| Approach | What it is | Pros | Cons |
|---|---|---|---|
| **Procedural (synthesized)** | All SFX generated in code via the Web Audio API (oscillators, noise, filters, envelopes). No audio files. | Matches the project's **"no external assets, all procedural"** ethos (brief §1 pillar 5); zero asset pipeline; cutting sound can be driven *directly* by the physics tick (removal rate → pitch/gain) for tight, parametric feedback; tiny bundle. | Harder to make "realistic"; motor hum / footsteps take DSP effort; a house style to design. |
| **Sampled (audio files)** | Recorded/sourced `.ogg/.mp3` clips played back. | Realistic instantly; less DSP work. | Introduces the **first external-asset pipeline** in the project (contradicts the procedural pillar); licensing/sourcing; larger bundle; cutting sound is canned, not parametric. |
| **Hybrid** | Procedural for the physics-coupled, parametric sounds (cutting, motor, catch); a few small samples for one-shots that are painful to synth (e.g. a metallic clamp click). | Best of both; keeps the important parametric sounds procedural. | Still needs a (small) asset pipeline + a director review for any sample. |

**Architect recommendation:** **Procedural-first (with Hybrid as the escape hatch).**
It honors the procedural pillar, needs no new asset/licensing pipeline (and thus no
director-review-of-new-deps friction), and—critically—lets the *cutting* sound be a
live function of the physics tick rather than a canned loop. Fall back to a small
sample only for a specific one-shot if synthesis proves not worth it, flagged for
review.

---

## Constraints (inherit the project's spine)

- **Deterministic core stays pure.** `src/core/` must NOT gain audio. SFX is a
  *client* concern that *reads* physics/scene events; it never feeds back into the
  tick. (Mirrors the FPSInput/ToolPose boundary — audio is an output adapter.)
- **No per-frame heap allocation** in any audio update that runs on the tick
  (cutting-sound param updates included) — pre-allocate nodes, mutate params.
- **New deps flagged for director review.** If we choose a library (Howler, Tone.js)
  over raw Web Audio, that's a dep decision for the director, not a builder.
- **Settings + mute are first-class.** Ship the volume/mute control *with* S1, never
  after — autoplay policies require a user gesture to start audio anyway.
- **Every new system ships tests** (event→sound mapping is unit-testable even if the
  actual audio output isn't); arch-guard + the 5-gate stay green.

---

## Phasing (sequenced; each individually green)

### S1 — Audio foundation
A small `src/client/audio/` module: an audio bus/context (lazy-started on first user
gesture per browser autoplay rules), a master gain + mute, a typed **SFX registry**
(`SfxId → factory`), and a settings hook wired into the existing UI. A pure
**event→sound mapping** layer so game code emits semantic events
(`emit('tool.grab')`) and the audio module owns the realization. Foundational,
self-contained, no core touch.

### S2 — Interaction SFX (the director's list)
The hand-feel one-shots, mapped to the assembly/walk interactions:

| Event | Sound | Trigger source |
|---|---|---|
| Walking | footstep loop on the shop floor (cadence ∝ move speed) | FPSCamera movement (already emits XZ each frame) |
| Pick up an item | tool/part grab (cloth/wood scuff) | E-to-grab (Lesson 0 CARRYING) |
| Put it on the lathe | part **snap/seat** thunk | assembly snap-point placement |
| Tighten the tool rest / banjo | clamp **ratchet/cinch** | banjo/tool-rest lock interaction |
| Take out a tool (x/y/z) | tool **select** from the cabinet | tool pickup at the rack |

Depends on **Phase L0 (assembly)** existing for grab/snap/clamp events — so S2 lands
*after* L0, or stubs the events L0 will emit.

### S3 — Lathe + cutting SFX (highest feedback value)
The physics-coupled sounds — the reason to prefer procedural:

- **Motor**: spin-up ramp + steady hum while turning (ties to the lathe-startup beat).
- **Cutting**: tool-on-wood, **parametric** — pitch/gain/timbre driven by the tick's
  material-removal rate and the wood species' hardness (a pine whisper vs an ash
  bite). This is the audio half of the coaching loop.
- **Catch**: a sharp bang/grab on a catch event.
- **Tearout**: a rasp/roughness layer as tearout accumulates.

Reads `PhysicsResult` + `WoodState` each tick (output-only). Pairs with the wood
species phase ([[wood-species-phase]]).

### S4 — Ambience + UI polish
Low room tone / fluorescent hum bed; lesson-complete chime; subtle UI clicks for
menu/HUD. Pure polish; last.

---

## Dependency order

```
S1 (foundation)  →  S2 (interaction, needs L0 events)
              \→  S3 (lathe + cutting, needs turning + wood physics)  →  S4 (ambience/UI)
```

S1 is the gate for everything. S3's cutting sound is the marquee feature — prioritize
it once S1 lands if we want the biggest immersion/feedback win first.
