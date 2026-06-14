import { describe, it, expect, beforeEach } from 'vitest';
import { useSetupStore } from './setupStore.js';
import { getLatheSetup } from '../session/setup.js';

const setup = getLatheSetup();
const step = (mountPoint: string) => {
  const s = setup.steps.find((x) => x.mountPoint === mountPoint);
  if (s === undefined) throw new Error(`no step for ${mountPoint}`);
  return s;
};

const spur = step('headstock-spindle');     // spur-drive-center
const live = step('tailstock-quill');        // live-center
const rest = step('bed');                    // tool-rest
const plug = step('wall-outlet');            // power-plug

describe('setupStore', () => {
  beforeEach(() => {
    useSetupStore.getState().reset();
  });

  it('grab puts an accessory in hand and clears any hint', () => {
    const s = useSetupStore.getState();
    s.setHint('stale');
    s.grab(spur.accessoryId);
    expect(useSetupStore.getState().carrying).toBe(spur.accessoryId);
    expect(useSetupStore.getState().hint).toBeNull();
  });

  it('mounting the correct accessory at its point seats it and clears the hand', () => {
    const s = useSetupStore.getState();
    s.grab(spur.accessoryId);
    const result = s.tryMount('headstock-spindle');
    expect(result.kind).toBe('mounted');
    const after = useSetupStore.getState();
    expect(after.completedStepIds).toContain(spur.id);
    expect(after.carrying).toBeNull();
    expect(after.hint).toBeNull();
  });

  it('right one required: a CORRECT accessory at the WRONG point does not mount', () => {
    const s = useSetupStore.getState();
    s.grab(spur.accessoryId); // spur drive belongs in the headstock
    const result = s.tryMount('tailstock-quill');
    expect(result.kind).toBe('wrong-spot');
    const after = useSetupStore.getState();
    expect(after.completedStepIds).toHaveLength(0); // nothing seated
    expect(after.carrying).toBe(spur.accessoryId);  // still in hand
    expect(after.hint).not.toBeNull();
  });

  it('a DECOY does not mount and surfaces its wrong-reason', () => {
    const decoy = setup.decoys[0];
    if (decoy === undefined) throw new Error('expected a decoy');
    const s = useSetupStore.getState();
    s.grab(decoy.accessoryId);
    const result = s.tryMount('headstock-spindle');
    expect(result.kind).toBe('wrong-accessory');
    if (result.kind === 'wrong-accessory') {
      expect(result.message).toBe(decoy.wrongReason);
    }
    expect(useSetupStore.getState().completedStepIds).toHaveLength(0);
  });

  it('mounting with an empty hand reports nothing-carried', () => {
    const result = useSetupStore.getState().tryMount('bed');
    expect(result.kind).toBe('nothing-carried');
  });

  it('re-mounting a completed point reports already-mounted', () => {
    const s = useSetupStore.getState();
    s.grab(rest.accessoryId);
    s.tryMount('bed');
    s.grab(rest.accessoryId);
    const result = s.tryMount('bed');
    expect(result.kind).toBe('already-mounted');
  });

  it('isComplete flips true only after every step is seated', () => {
    const s = useSetupStore.getState();
    expect(s.isComplete()).toBe(false);
    for (const acc of [spur, live, rest, plug]) {
      useSetupStore.getState().grab(acc.accessoryId);
      useSetupStore.getState().tryMount(acc.mountPoint);
    }
    expect(useSetupStore.getState().isComplete()).toBe(true);
  });

  it('unmount removes a completed step and clears the hint', () => {
    const s = useSetupStore.getState();
    s.grab(spur.accessoryId);
    s.tryMount('headstock-spindle');
    // spur drive is now seated
    expect(useSetupStore.getState().completedStepIds).toContain(spur.id);
    s.setHint('some stale hint');
    // unmount it
    useSetupStore.getState().unmount(spur.id);
    const after = useSetupStore.getState();
    expect(after.completedStepIds).not.toContain(spur.id);
    expect(after.hint).toBeNull();
    // carrying is untouched (was null after mount — stays null)
    expect(after.carrying).toBeNull();
  });

  it('unmount of a non-existent step is a no-op', () => {
    const s = useSetupStore.getState();
    s.grab(spur.accessoryId);
    s.tryMount('headstock-spindle');
    const before = useSetupStore.getState().completedStepIds.length;
    useSetupStore.getState().unmount('does-not-exist');
    expect(useSetupStore.getState().completedStepIds).toHaveLength(before);
  });

  it('reset returns to an un-set-up lathe', () => {
    const s = useSetupStore.getState();
    s.grab(spur.accessoryId);
    s.tryMount('headstock-spindle');
    useSetupStore.getState().reset();
    const after = useSetupStore.getState();
    expect(after.carrying).toBeNull();
    expect(after.completedStepIds).toHaveLength(0);
    expect(after.hint).toBeNull();
    expect(after.isComplete()).toBe(false);
  });
});
