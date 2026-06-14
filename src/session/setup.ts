import latheSetup from '../../content/setup/lathe-setup.json';

/** Where an accessory mounts on the machine. */
export type MountPoint =
  | 'headstock-spindle'
  | 'tailstock-quill'
  | 'bed'
  | 'wall-outlet';

export interface SetupStep {
  id: string;
  order: number;
  accessoryId: string;
  accessoryName: string;
  mountPoint: MountPoint;
  instruction: string;
  why: string;
}

export interface SetupDecoy {
  accessoryId: string;
  accessoryName: string;
  wrongReason: string;
}

export interface LatheSetup {
  id: string;
  title: string;
  intro: string;
  steps: SetupStep[];
  decoys: SetupDecoy[];
}

const SETUP = latheSetup as LatheSetup;

/** The Lesson-0 lathe-setup definition (steps + decoys). */
export function getLatheSetup(): LatheSetup {
  return SETUP;
}

/** Every grabbable accessory id — correct steps first, then decoys. */
export function getSetupAccessoryIds(): string[] {
  return [
    ...SETUP.steps.map((s) => s.accessoryId),
    ...SETUP.decoys.map((d) => d.accessoryId),
  ];
}

/** Human label for a mount point (for coaching messages). */
export function mountPointLabel(point: MountPoint): string {
  switch (point) {
    case 'headstock-spindle':
      return 'headstock spindle';
    case 'tailstock-quill':
      return 'tailstock';
    case 'bed':
      return 'bed';
    case 'wall-outlet':
      return 'wall outlet';
  }
}
