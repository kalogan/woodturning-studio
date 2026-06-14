import { create } from 'zustand';
import {
  getLatheSetup,
  mountPointLabel,
  type MountPoint,
} from '../session/setup.js';

/** Outcome of attempting to mount the carried accessory at a point. */
export type MountResult =
  | { kind: 'mounted'; stepId: string }
  | { kind: 'wrong-accessory'; message: string }
  | { kind: 'wrong-spot'; message: string }
  | { kind: 'already-mounted' }
  | { kind: 'nothing-carried' };

interface SetupStore {
  /** Accessory id currently in hand, or null. */
  carrying: string | null;
  /** Step ids whose accessory has been correctly seated. */
  completedStepIds: string[];
  /** Transient coaching nudge (wrong accessory / wrong spot). */
  hint: string | null;

  /** Pick up an accessory from the toolbox (swaps whatever was carried). */
  grab: (accessoryId: string) => void;
  /** Put the carried accessory back. */
  dropCarried: () => void;
  /**
   * Try to mount the carried accessory at `point`.
   * Right one required: only the accessory that belongs at `point` seats;
   * anything else sets a coaching hint and does NOT mount.
   */
  tryMount: (point: MountPoint) => MountResult;
  /** Set / clear the transient coaching hint. */
  setHint: (hint: string | null) => void;
  /** True once every setup step is complete. */
  isComplete: () => boolean;
  /** Reset to a fresh, un-set-up lathe. */
  reset: () => void;
}

export const useSetupStore = create<SetupStore>((set, get) => ({
  carrying: null,
  completedStepIds: [],
  hint: null,

  grab: (accessoryId) => {
    set({ carrying: accessoryId, hint: null });
  },

  dropCarried: () => {
    set({ carrying: null });
  },

  tryMount: (point) => {
    const { carrying, completedStepIds } = get();
    if (carrying === null) {
      return { kind: 'nothing-carried' };
    }

    const setup = getLatheSetup();
    const stepHere = setup.steps.find((s) => s.mountPoint === point);

    // Nothing mounts at this point at all.
    if (stepHere === undefined) {
      const hint = "Nothing mounts there.";
      set({ hint });
      return { kind: 'wrong-spot', message: hint };
    }

    if (completedStepIds.includes(stepHere.id)) {
      return { kind: 'already-mounted' };
    }

    // Correct accessory for this point → seat it.
    if (carrying === stepHere.accessoryId) {
      set({
        completedStepIds: [...completedStepIds, stepHere.id],
        carrying: null,
        hint: null,
      });
      return { kind: 'mounted', stepId: stepHere.id };
    }

    // Carrying a CORRECT accessory but at the wrong point → wrong spot.
    const carriedStep = setup.steps.find((s) => s.accessoryId === carrying);
    if (carriedStep !== undefined) {
      const hint = `The ${carriedStep.accessoryName} mounts on the ${mountPointLabel(
        carriedStep.mountPoint,
      )}, not the ${mountPointLabel(point)}.`;
      set({ hint });
      return { kind: 'wrong-spot', message: hint };
    }

    // Carrying a decoy → wrong accessory (explain why it doesn't belong).
    const decoy = setup.decoys.find((d) => d.accessoryId === carrying);
    const hint = decoy?.wrongReason ?? "That doesn't belong on the lathe for this job.";
    set({ hint });
    return { kind: 'wrong-accessory', message: hint };
  },

  setHint: (hint) => {
    set({ hint });
  },

  isComplete: () => {
    const { completedStepIds } = get();
    const setup = getLatheSetup();
    return setup.steps.every((s) => completedStepIds.includes(s.id));
  },

  reset: () => {
    set({ carrying: null, completedStepIds: [], hint: null });
  },
}));
