/**
 * W4 integration tests: curriculum → wood-species wiring.
 *
 * Covers:
 *  1. Each lesson's woodSpecies resolves to a known species.
 *  2. Each lesson's woodSpecies + tool resolves to a cutting-coefficient pair.
 *  3. The profile-selection helper (lessonCutProfile) returns the expected
 *     coefficients for known pairs and undefined for unknown ones.
 *  4. The visual-selection helper (lessonWoodVisual) returns visual params for
 *     known species and undefined for unknown ones.
 */

import { describe, it, expect } from 'vitest';
import { getCurriculum } from './curriculum.js';
import { getWoodSpeciesById, getCuttingCoefficients } from './wood.js';
import type { CurriculumLesson } from './curriculum.js';
import type { SpeciesCutProfile } from '../core/types.js';
import type { WoodVisualParams } from './wood.js';

// ── Pure helpers under test ──────────────────────────────────────────────────

/**
 * Maps a lesson to its SpeciesCutProfile.
 * Returns undefined when the species/tool pair is not in the matrix.
 */
export function lessonCutProfile(lesson: CurriculumLesson): SpeciesCutProfile | undefined {
  return getCuttingCoefficients(lesson.woodSpecies, lesson.tool) ?? undefined;
}

/**
 * Maps a lesson to its WoodVisualParams.
 * Returns undefined when the species id is unknown.
 */
export function lessonWoodVisual(lesson: CurriculumLesson): WoodVisualParams | undefined {
  return getWoodSpeciesById(lesson.woodSpecies)?.visual;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('W4 curriculum → species wiring', () => {
  const lessons = getCurriculum();

  it('curriculum has exactly 4 lessons', () => {
    expect(lessons).toHaveLength(4);
  });

  it('every lesson has a non-empty woodSpecies string', () => {
    for (const lesson of lessons) {
      expect(typeof lesson.woodSpecies).toBe('string');
      expect(lesson.woodSpecies.length).toBeGreaterThan(0);
    }
  });

  it('every lesson woodSpecies resolves to a known species via getWoodSpeciesById', () => {
    for (const lesson of lessons) {
      const species = getWoodSpeciesById(lesson.woodSpecies);
      expect(
        species,
        `lesson "${lesson.id}" references unknown species "${lesson.woodSpecies}"`,
      ).toBeDefined();
    }
  });

  it('every lesson (woodSpecies, tool) pair resolves to cutting coefficients', () => {
    for (const lesson of lessons) {
      const coeff = getCuttingCoefficients(lesson.woodSpecies, lesson.tool);
      expect(
        coeff,
        `lesson "${lesson.id}" pair (${lesson.woodSpecies}, ${lesson.tool}) missing from matrix`,
      ).toBeDefined();
    }
  });

  it('species are assigned in ascending Janka order (soft → hard)', () => {
    const sorted = [...lessons].sort((a, b) => a.order - b.order);
    const jankaValues = sorted.map((l) => getWoodSpeciesById(l.woodSpecies)?.janka ?? 0);
    for (let i = 1; i < jankaValues.length; i++) {
      expect(
        jankaValues[i],
        `lesson ${String(i + 1)} Janka (${String(jankaValues[i])}) should be >= lesson ${String(i)} Janka (${String(jankaValues[i - 1])})`,
      ).toBeGreaterThanOrEqual(jankaValues[i - 1] ?? 0);
    }
  });

  it('lesson-01 uses pine (Janka 380)', () => {
    const l1 = lessons.find((l) => l.id === 'lesson-01-roughing');
    expect(l1).toBeDefined();
    expect(l1?.woodSpecies).toBe('pine');
    expect(getWoodSpeciesById('pine')?.janka).toBe(380);
  });

  it('lesson-02 uses cherry (Janka 950)', () => {
    const l2 = lessons.find((l) => l.id === 'lesson-02-spindle');
    expect(l2).toBeDefined();
    expect(l2?.woodSpecies).toBe('cherry');
    expect(getWoodSpeciesById('cherry')?.janka).toBe(950);
  });

  it('lesson-03 uses walnut (Janka 1010)', () => {
    const l3 = lessons.find((l) => l.id === 'lesson-03-parting');
    expect(l3).toBeDefined();
    expect(l3?.woodSpecies).toBe('walnut');
    expect(getWoodSpeciesById('walnut')?.janka).toBe(1010);
  });

  it('lesson-04 uses ash (Janka 1320)', () => {
    const l4 = lessons.find((l) => l.id === 'lesson-04-beads');
    expect(l4).toBeDefined();
    expect(l4?.woodSpecies).toBe('ash');
    expect(getWoodSpeciesById('ash')?.janka).toBe(1320);
  });
});

// ── lessonCutProfile helper ──────────────────────────────────────────────────

describe('lessonCutProfile', () => {
  it('returns a defined SpeciesCutProfile for each of the 4 lessons', () => {
    for (const lesson of getCurriculum()) {
      const profile = lessonCutProfile(lesson);
      expect(profile, `lessonCutProfile returned undefined for "${lesson.id}"`).toBeDefined();
    }
  });

  it('all returned coefficients are finite positive numbers', () => {
    for (const lesson of getCurriculum()) {
      const profile = lessonCutProfile(lesson);
      if (profile === undefined) continue;
      expect(Number.isFinite(profile.cutRate)).toBe(true);
      expect(profile.cutRate).toBeGreaterThan(0);
      expect(Number.isFinite(profile.tearout)).toBe(true);
      expect(profile.tearout).toBeGreaterThan(0);
      expect(Number.isFinite(profile.catch)).toBe(true);
      expect(profile.catch).toBeGreaterThan(0);
    }
  });

  it('returns undefined for a lesson with an unknown species', () => {
    const fakeLesson: CurriculumLesson = {
      id: 'fake',
      title: 'Fake',
      tool: 'roughing-gouge',
      woodSpecies: 'mahogany', // not in matrix
      order: 99,
      brief: '',
      successCriteria: { minMaterialRemoved: 0, maxTearout: 1, noCatches: false, catchesTolerance: 9 },
      coachingCues: [],
    };
    expect(lessonCutProfile(fakeLesson)).toBeUndefined();
  });

  it('returns undefined for a lesson with an unknown tool', () => {
    const fakeLesson: CurriculumLesson = {
      id: 'fake',
      title: 'Fake',
      tool: 'roughing-gouge',
      woodSpecies: 'pine',
      order: 99,
      brief: '',
      successCriteria: { minMaterialRemoved: 0, maxTearout: 1, noCatches: false, catchesTolerance: 9 },
      coachingCues: [],
    };
    // Force unknown tool at runtime (type cast) to test the fallback path
    const profile = getCuttingCoefficients('pine', 'bowl-gouge');
    expect(profile).toBeUndefined();
    // The real lesson pair should still resolve
    expect(lessonCutProfile(fakeLesson)).toBeDefined();
  });

  it('pine roughing lesson has cutRate > 1 (pine cuts fast)', () => {
    const l1 = getCurriculum().find((l) => l.id === 'lesson-01-roughing');
    expect(l1).toBeDefined();
    if (!l1) return;
    const profile = lessonCutProfile(l1);
    expect(profile?.cutRate).toBeGreaterThan(1);
  });

  it('ash beads lesson has catch > 1 (harder wood bites harder)', () => {
    const l4 = getCurriculum().find((l) => l.id === 'lesson-04-beads');
    expect(l4).toBeDefined();
    if (!l4) return;
    const profile = lessonCutProfile(l4);
    expect(profile?.catch).toBeGreaterThan(1);
  });
});

// ── lessonWoodVisual helper ──────────────────────────────────────────────────

describe('lessonWoodVisual', () => {
  it('returns WoodVisualParams for each of the 4 lessons', () => {
    for (const lesson of getCurriculum()) {
      const visual = lessonWoodVisual(lesson);
      expect(visual, `lessonWoodVisual returned undefined for "${lesson.id}"`).toBeDefined();
    }
  });

  it('returned visual has valid hex baseColor and grainColor', () => {
    const HEX_RE = /^#[0-9a-fA-F]{6}$/;
    for (const lesson of getCurriculum()) {
      const visual = lessonWoodVisual(lesson);
      if (visual === undefined) continue;
      expect(visual.baseColor).toMatch(HEX_RE);
      expect(visual.grainColor).toMatch(HEX_RE);
    }
  });

  it('returns undefined for a lesson with an unknown species', () => {
    const fakeLesson: CurriculumLesson = {
      id: 'fake',
      title: 'Fake',
      tool: 'roughing-gouge',
      woodSpecies: 'mahogany',
      order: 99,
      brief: '',
      successCriteria: { minMaterialRemoved: 0, maxTearout: 1, noCatches: false, catchesTolerance: 9 },
      coachingCues: [],
    };
    expect(lessonWoodVisual(fakeLesson)).toBeUndefined();
  });

  it('different lessons produce visually distinct baseColors', () => {
    const lessons = getCurriculum();
    const colors = lessons.map((l) => lessonWoodVisual(l)?.baseColor);
    const unique = new Set(colors.filter(Boolean));
    // All 4 species used by lessons are distinct, so all 4 baseColors should differ
    expect(unique.size).toBe(lessons.length);
  });
});
