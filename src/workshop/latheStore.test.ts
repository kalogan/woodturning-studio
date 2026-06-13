import { describe, it, expect, beforeEach } from 'vitest';
import { useLatheStore } from './latheStore.js';

const DEFAULTS = {
  power: false,
  currentRpm: 0,
  targetRpm: 0,
};

beforeEach(() => {
  useLatheStore.setState({ ...DEFAULTS });
  // Also restore config defaults so tests that call configure() don't pollute others.
  useLatheStore.getState().configure({ maxRpm: 3200, rampRate: 1200 });
  // Clear RPMs after configure in case it got reset weirdly.
  useLatheStore.setState({ ...DEFAULTS });
});

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------
describe('defaults', () => {
  it('power is false, currentRpm and targetRpm are 0', () => {
    const s = useLatheStore.getState();
    expect(s.power).toBe(false);
    expect(s.currentRpm).toBe(0);
    expect(s.targetRpm).toBe(0);
  });

  it('default maxRpm is 3200', () => {
    expect(useLatheStore.getState().maxRpm).toBe(3200);
  });

  it('default rampRate is 1200', () => {
    expect(useLatheStore.getState().rampRate).toBe(1200);
  });
});

// ---------------------------------------------------------------------------
// setPower
// ---------------------------------------------------------------------------
describe('setPower', () => {
  it('setPower(true) turns power on', () => {
    useLatheStore.getState().setPower(true);
    expect(useLatheStore.getState().power).toBe(true);
  });

  it('setPower(true) does NOT change currentRpm or targetRpm', () => {
    useLatheStore.getState().setPower(true);
    const s = useLatheStore.getState();
    expect(s.currentRpm).toBe(0);
    expect(s.targetRpm).toBe(0);
  });

  it('setPower(false) sets power to false and forces targetRpm to 0', () => {
    // Arrange: powered on with a dialled target.
    useLatheStore.setState({ power: true, targetRpm: 1600, currentRpm: 800 });
    useLatheStore.getState().setPower(false);
    const s = useLatheStore.getState();
    expect(s.power).toBe(false);
    expect(s.targetRpm).toBe(0);
    // currentRpm is still 800 — the motor hasn't had a tick yet.
    expect(s.currentRpm).toBe(800);
  });

  it('setPower(false) idempotent when already off', () => {
    useLatheStore.getState().setPower(false);
    const s = useLatheStore.getState();
    expect(s.power).toBe(false);
    expect(s.targetRpm).toBe(0);
    expect(s.currentRpm).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// setTargetRpm
// ---------------------------------------------------------------------------
describe('setTargetRpm', () => {
  it('ignored when power is off — target stays 0', () => {
    useLatheStore.getState().setTargetRpm(1000);
    expect(useLatheStore.getState().targetRpm).toBe(0);
  });

  it('accepts value in range when power is on', () => {
    useLatheStore.setState({ power: true });
    useLatheStore.getState().setTargetRpm(1600);
    expect(useLatheStore.getState().targetRpm).toBe(1600);
  });

  it('clamps to 0 when given a negative value', () => {
    useLatheStore.setState({ power: true });
    useLatheStore.getState().setTargetRpm(-500);
    expect(useLatheStore.getState().targetRpm).toBe(0);
  });

  it('clamps to maxRpm when given a value above maxRpm', () => {
    useLatheStore.setState({ power: true });
    useLatheStore.getState().setTargetRpm(9999);
    expect(useLatheStore.getState().targetRpm).toBe(3200);
  });

  it('clamps exactly to maxRpm at the boundary', () => {
    useLatheStore.setState({ power: true });
    useLatheStore.getState().setTargetRpm(3200);
    expect(useLatheStore.getState().targetRpm).toBe(3200);
  });

  it('does not change currentRpm — that is the tick\'s job', () => {
    useLatheStore.setState({ power: true });
    useLatheStore.getState().setTargetRpm(2400);
    expect(useLatheStore.getState().currentRpm).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// tick — spin-up
// ---------------------------------------------------------------------------
describe('tick: spinning up', () => {
  it('eases currentRpm UP toward target without overshoot', () => {
    // rampRate=1200 rpm/s, dt=0.5 s → delta=600 rpm
    useLatheStore.setState({ power: true, currentRpm: 0, targetRpm: 1200 });
    useLatheStore.getState().tick(0.5);
    expect(useLatheStore.getState().currentRpm).toBe(600);
  });

  it('clamps to target exactly on a large dt (no overshoot)', () => {
    useLatheStore.setState({ power: true, currentRpm: 0, targetRpm: 500 });
    // dt=10 s would give delta=12000 rpm — should clamp to 500.
    useLatheStore.getState().tick(10);
    expect(useLatheStore.getState().currentRpm).toBe(500);
  });

  it('multiple ticks converge currentRpm to targetRpm', () => {
    useLatheStore.setState({ power: true, currentRpm: 0, targetRpm: 1200 });
    // 1200 rpm / 1200 rpm/s = 1.0 s at dt=0.25 → 4 ticks
    for (let i = 0; i < 4; i++) {
      useLatheStore.getState().tick(0.25);
    }
    expect(useLatheStore.getState().currentRpm).toBe(1200);
  });

  it('stays at target once reached (no oscillation)', () => {
    useLatheStore.setState({ power: true, currentRpm: 1200, targetRpm: 1200 });
    useLatheStore.getState().tick(1);
    expect(useLatheStore.getState().currentRpm).toBe(1200);
  });

  it('does nothing when target is already 0 and currentRpm is 0', () => {
    useLatheStore.getState().tick(1);
    expect(useLatheStore.getState().currentRpm).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// tick — spin-down after power off
// ---------------------------------------------------------------------------
describe('tick: spinning down after power off', () => {
  it('eases currentRpm DOWN toward 0 after power off', () => {
    // rampRate=1200 rpm/s, dt=0.5 s → delta=600 rpm
    useLatheStore.setState({ power: false, currentRpm: 1200, targetRpm: 0 });
    useLatheStore.getState().tick(0.5);
    expect(useLatheStore.getState().currentRpm).toBe(600);
  });

  it('clamps to 0 exactly on a large dt (no undershoot below 0)', () => {
    useLatheStore.setState({ power: false, currentRpm: 300, targetRpm: 0 });
    useLatheStore.getState().tick(10);
    expect(useLatheStore.getState().currentRpm).toBe(0);
  });

  it('multiple ticks converge currentRpm to 0', () => {
    useLatheStore.setState({ power: false, currentRpm: 1200, targetRpm: 0 });
    for (let i = 0; i < 4; i++) {
      useLatheStore.getState().tick(0.25);
    }
    expect(useLatheStore.getState().currentRpm).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Determinism
// ---------------------------------------------------------------------------
describe('determinism', () => {
  it('same (state, dt) sequence produces the same currentRpm', () => {
    const runSequence = () => {
      useLatheStore.setState({ power: true, currentRpm: 0, targetRpm: 2400 });
      useLatheStore.getState().tick(0.1);
      useLatheStore.getState().tick(0.2);
      useLatheStore.getState().tick(0.15);
      return useLatheStore.getState().currentRpm;
    };

    const first = runSequence();
    const second = runSequence();
    expect(first).toBe(second);
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------
describe('reset', () => {
  it('returns power, currentRpm, targetRpm to defaults', () => {
    useLatheStore.setState({ power: true, currentRpm: 2400, targetRpm: 3200 });
    useLatheStore.getState().reset();
    const s = useLatheStore.getState();
    expect(s.power).toBe(false);
    expect(s.currentRpm).toBe(0);
    expect(s.targetRpm).toBe(0);
  });

  it('does not change maxRpm or rampRate (config is preserved)', () => {
    useLatheStore.getState().configure({ maxRpm: 2800, rampRate: 800 });
    useLatheStore.getState().reset();
    const s = useLatheStore.getState();
    expect(s.maxRpm).toBe(2800);
    expect(s.rampRate).toBe(800);
  });
});

// ---------------------------------------------------------------------------
// configure
// ---------------------------------------------------------------------------
describe('configure', () => {
  it('overrides maxRpm', () => {
    useLatheStore.getState().configure({ maxRpm: 2000 });
    expect(useLatheStore.getState().maxRpm).toBe(2000);
  });

  it('overrides rampRate', () => {
    useLatheStore.getState().configure({ rampRate: 500 });
    expect(useLatheStore.getState().rampRate).toBe(500);
  });

  it('setTargetRpm respects new maxRpm after configure', () => {
    useLatheStore.setState({ power: true });
    useLatheStore.getState().configure({ maxRpm: 1000 });
    useLatheStore.getState().setTargetRpm(2000); // above new max
    expect(useLatheStore.getState().targetRpm).toBe(1000);
  });

  it('tick respects new rampRate after configure', () => {
    useLatheStore.setState({ power: true, currentRpm: 0, targetRpm: 1200 });
    useLatheStore.getState().configure({ rampRate: 600 }); // half default
    useLatheStore.getState().tick(0.5); // delta = 600 * 0.5 = 300
    expect(useLatheStore.getState().currentRpm).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// Interaction: power-off mid-spin + tick integration
// ---------------------------------------------------------------------------
describe('interaction: power-off mid-spin', () => {
  it('setPower(false) then tick brings currentRpm to 0', () => {
    useLatheStore.setState({ power: true, currentRpm: 1200, targetRpm: 1200 });
    useLatheStore.getState().setPower(false); // targetRpm → 0
    expect(useLatheStore.getState().targetRpm).toBe(0);

    // Now tick until the spindle stops.
    for (let i = 0; i < 5; i++) {
      useLatheStore.getState().tick(0.25);
    }
    // 5 * 0.25 * 1200 = 1500 rpm of deceleration > 1200 → clamps to 0.
    expect(useLatheStore.getState().currentRpm).toBe(0);
  });

  it('setTargetRpm while powered off does not affect currentRpm via tick', () => {
    useLatheStore.setState({ power: false, currentRpm: 0, targetRpm: 0 });
    useLatheStore.getState().setTargetRpm(3200); // must be no-op
    useLatheStore.getState().tick(1);
    expect(useLatheStore.getState().currentRpm).toBe(0);
  });
});
