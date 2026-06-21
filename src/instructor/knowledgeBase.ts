import toolsData from '../../content/instructor/tools.json';
import sharpeningData from '../../content/instructor/sharpening.json';
import techniqueData from '../../content/instructor/technique.json';
import woodData from '../../content/instructor/wood.json';
import speedData from '../../content/instructor/speed.json';
import safetyData from '../../content/instructor/safety.json';
import workholdingData from '../../content/instructor/workholding.json';
import finishingData from '../../content/instructor/finishing.json';
import troubleshootingData from '../../content/instructor/troubleshooting.json';
import type { KbEntry } from './schema.js';

// Mirrors the wood/curriculum loaders: JSON imported and asserted to the typed
// shape. The shape is validated for real by `pnpm lint:content` (Zod) and by
// the unit tests, so a malformed file fails the gate before it ever ships.
const ALL_ENTRIES: KbEntry[] = [
  ...(toolsData as KbEntry[]),
  ...(sharpeningData as KbEntry[]),
  ...(techniqueData as KbEntry[]),
  ...(woodData as KbEntry[]),
  ...(speedData as KbEntry[]),
  ...(safetyData as KbEntry[]),
  ...(workholdingData as KbEntry[]),
  ...(finishingData as KbEntry[]),
  ...(troubleshootingData as KbEntry[]),
];

/** Returns every knowledge-base entry, in definition order. */
export function getKnowledgeBase(): KbEntry[] {
  return [...ALL_ENTRIES];
}

/** Returns a knowledge-base entry by id, or undefined if not found. */
export function getKbEntryById(id: string): KbEntry | undefined {
  return ALL_ENTRIES.find((e) => e.id === id);
}
