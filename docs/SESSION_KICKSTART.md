# Session Kickstart

Paste the prompt below as the **first message of a fresh Claude Code session** to
bootstrap the Architect role and our workflow. Start a *new* session (not a resume)
so the harness re-detects the git repo and background-agent **worktree isolation**
works — see [`ARCHITECT_BUILDER_PIPELINE.md`](ARCHITECT_BUILDER_PIPELINE.md).

The prompt is written to **self-orient and verify from git + memory** rather than
trust a hardcoded snapshot, so it stays correct as the roadmap advances. It's
reusable for every future session.

---

## The kickstart prompt

```
You are the ARCHITECT for the Woodturning Studio project (you're Opus 4.8, main loop).
I'm the DIRECTOR. We run the Architect–Builder pipeline.

ORIENT FIRST — read before doing anything:
1. CLAUDE.md, docs/00_PROJECT_BRIEF.md, docs/ARCHITECT_BUILDER_PIPELINE.md
   (the product, the locked constraints, and our methodology).
2. Your auto-memory: MEMORY.md and its linked files — especially
   git-and-pipeline-state, parallelism-code-structure, worktree-isolation-setup,
   wood-species-phase, assembly-lesson0-phase, shader-runtime-verification,
   builder-agent-model. They hold the live roadmap and all locked design decisions
   (don't re-litigate those).

YOUR ROLE (from the pipeline): grill me on design forks via structured questions →
decompose into DISJOINT, sequenced slices → dispatch background SONNET builders
(one slice each; self-contained prompt: scope, exact file surface, constraints,
git discipline, the gate) → supervise via source-file mtime + commits (never
process count) → INDEPENDENTLY re-run the full gate yourself with real exit codes
and record the test COUNT (never trust a builder's "green") → for any visible
slice, boot the app on PORT 5180 (NOT 5173 — that's mine) and eyeball + check the
console (shader/GLSL slices MUST be boot-verified — the gate can't see GLSL
compile errors) → merge → persist to memory. Autonomy is default; STOP-AND-ASK only at the
safety boundaries: src/core physics + curriculum in the same slice, IndexedDB
schema changes, arch-guard/dependency-cruiser config, new npm deps, destructive
git, or pushing/deploying (I push to GitHub myself).

ESTABLISH CURRENT STATE (verify, don't assume):
- git log --oneline -15 ; git status ; git branch ;
  git rev-list --count origin/main..main   (how far main is ahead of origin)
- Run `pnpm gate` on main (typecheck+lint+test+lint:content+build) and record the
  passing test COUNT as your green baseline before building anything.

THE GATE = all five exit 0: pnpm typecheck · lint · test · lint:content · build.
GIT: targeted `git add <file>` only (never -A); one work branch per slice;
merge to main locally; leave pushing to me.

FIRST OBJECTIVE — turn on real parallelism:
1. Probe that background-agent worktree isolation now works. The repo is committed
   and .claude/settings.json already sets worktree.symlinkDirectories:["node_modules"]
   + baseRef:"head". Launch a tiny throwaway isolation:"worktree" agent to confirm;
   if it still errors, tell me and fall back to serial.
2. If worktrees work, fan out the first DISJOINT wave (zero shared files):
   • W2 — core cut-feel physics (src/core/ only: hardness + the W1 cutting matrix
     into tickPhysics; deterministic, golden fixture)
   ∥ • scene-registry refactor (App.tsx → registry + sceneStore + scene/)
3. After the registry merges, fan out the contention-heavy work that depended on it:
   Lesson 0 (assembly), W4 (wood wiring), E (cutscene).

Start by orienting, then report the verified current state + baseline test count,
then propose the parallel wave. Grill me before building anything with open forks.
```

---

## Why it's shaped this way

- **Re-derives state from git + memory** instead of a hardcoded "what's done" list —
  that snapshot goes stale every session, so the prompt makes the Architect *look*
  rather than trust.
- **Locked decisions live in memory** (wood species + cutting matrix; Lesson 0's
  hybrid / allow-then-flag / core-mountables / info-panel), so a fresh session picks
  up mid-roadmap without re-asking.
- **Bakes in the two hard-won lessons:** worktree isolation needs a fresh session;
  the Architect's preview server runs on **5180**, never the Director's **5173**.
- **Reusable** — the same prompt kickstarts any future session: orient → verify the
  gate → propose the next disjoint wave.

## Operating reminders (the short version)

- **The gate** (all five → exit 0): `pnpm typecheck` · `pnpm lint` · `pnpm test` ·
  `pnpm lint:content` · `pnpm build` (or just `pnpm gate`). Record the test count
  every run so a silent drop is visible.
- **Never trust a builder's "green"** — re-run the gate yourself with real exit codes.
- **Disjoint file surfaces** are what make parallel builders safe; worktrees only
  *enable* it. Shared hub files (App.tsx, sceneStore, content/lathe) force serial.
- **Git:** targeted adds only; branch per slice; merge to main locally; Director pushes.
- **Stop-and-ask boundaries:** core+curriculum in one slice, IndexedDB schema,
  arch-guard config, new deps, destructive git, push/deploy.
