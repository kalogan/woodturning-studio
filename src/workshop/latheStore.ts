import { create } from 'zustand';

// TODO (T2b wire-up): source maxRpm from content/lathe Jet high-range JSON
// instead of the hardcoded default below.
const DEFAULT_MAX_RPM = 3200; // Jet JWL-1642EVS high-range spindle speed (rpm)

// Motor acceleration / deceleration rate.
// 1200 rpm/s means the spindle takes ~2.7 s to reach full 3200 rpm from rest,
// which matches the feel of a variable-speed DC motor under moderate load.
const DEFAULT_RAMP_RATE = 1200; // rpm per second

export interface LatheConfig {
  maxRpm?: number;
  rampRate?: number;
}

interface LatheStore {
  // --- state ---
  power: boolean;
  currentRpm: number; // actual spindle speed
  targetRpm: number;  // what the speed dial is set to
  maxRpm: number;     // config: cap (source from content/lathe at T2b wire-up)
  rampRate: number;   // config: rpm/s the motor eases at

  // --- actions ---
  /** Press the power/START button. Turning off forces targetRpm → 0 (spin-down). */
  setPower: (on: boolean) => void;
  /**
   * Twist the speed dial.
   * Clamped to [0, maxRpm].
   * No-op (stays 0) when power is off — the player must power on first.
   */
  setTargetRpm: (rpm: number) => void;
  /**
   * Advance motor simulation by dt seconds.
   * Eases currentRpm toward targetRpm at rampRate rpm/s.
   * Deterministic: no Date.now(), no Math.random().
   * Called each frame by the render loop (wired up in T2b/T4).
   */
  tick: (dt: number) => void;
  /** Return to power-off, zero-rpm defaults (leave lathe / lesson reset). */
  reset: () => void;
  /** Inject alternative config values — useful in tests and for T2b wire-up. */
  configure: (config: LatheConfig) => void;
}

export const useLatheStore = create<LatheStore>((set, get) => ({
  // --- defaults ---
  power: false,
  currentRpm: 0,
  targetRpm: 0,
  maxRpm: DEFAULT_MAX_RPM,
  rampRate: DEFAULT_RAMP_RATE,

  // --- actions ---
  setPower: (on) => {
    if (on) {
      // Power on: spindle starts at rest; player dials speed up manually.
      set({ power: true });
    } else {
      // Power off: target goes to 0 so the motor eases down to a stop.
      set({ power: false, targetRpm: 0 });
    }
  },

  setTargetRpm: (rpm) => {
    const { power, maxRpm } = get();
    if (!power) {
      // Guard: dial has no effect while unpowered.
      return;
    }
    const clamped = Math.max(0, Math.min(rpm, maxRpm));
    set({ targetRpm: clamped });
  },

  tick: (dt) => {
    const { currentRpm, targetRpm, rampRate } = get();
    if (currentRpm === targetRpm) return; // nothing to do

    const delta = rampRate * dt;
    let next: number;

    if (currentRpm < targetRpm) {
      // Spinning up — clamp so we never overshoot the target.
      next = Math.min(currentRpm + delta, targetRpm);
    } else {
      // Spinning down — clamp so we never undershoot the target.
      next = Math.max(currentRpm - delta, targetRpm);
    }

    set({ currentRpm: next });
  },

  reset: () => {
    set({ power: false, currentRpm: 0, targetRpm: 0 });
  },

  configure: ({ maxRpm, rampRate }) => {
    const patch: Partial<LatheStore> = {};
    if (maxRpm !== undefined) patch.maxRpm = maxRpm;
    if (rampRate !== undefined) patch.rampRate = rampRate;
    set(patch);
  },
}));
