#!/usr/bin/env tsx
/**
 * Zod-validates all content JSON files against their schemas.
 * Exit 0 = all valid. Exit 1 = at least one failure.
 */
import { z } from 'zod';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const ToolSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  bevelAngleDeg: z.number().min(0).max(90),
  shankDiameterMm: z.number().positive(),
  handleLengthMm: z.number().positive(),
  v1: z.boolean(),
});

const LessonSchema = z.object({
  id: z.string(),
  schemaVersion: z.literal(1),
  title: z.string(),
  tool: z.enum(['roughing-gouge', 'spindle-gouge', 'parting-tool']),
  order: z.number().int().positive(),
  brief: z.string(),
  successCriteria: z.object({
    minMaterialRemoved: z.number().min(0).max(1),
    maxTearout: z.number().min(0).max(1),
    noCatches: z.boolean(),
    catchesTolerance: z.number().int().min(0),
  }),
  coachingCues: z.array(z.object({
    trigger: z.string(),
    message: z.string(),
  })),
});

const LatheSpecSchema = z.object({
  id: z.string(),
  name: z.string(),
  schemaVersion: z.literal(1),
  units: z.literal('meters'),
  swingRadius: z.number().positive(),
  betweenCenters: z.number().positive(),
  spindleCenterToFloor: z.number().positive(),
  bed: z.object({
    length: z.number().positive(),
    wayCount: z.number().int().positive(),
    wayWidth: z.number().positive(),
    wayGap: z.number().positive(),
    wayHeight: z.number().positive(),
    thickness: z.number().positive(),
    color: z.string(),
    logoPlate: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
      color: z.string(),
    }),
  }),
  headstock: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    depth: z.number().positive(),
    spindleHeight: z.number().positive(),
    spindleDiameter: z.number().positive(),
    spindleNoseDiameter: z.number().positive(),
    spindleNoseLength: z.number().positive(),
    motorHousing: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
      depth: z.number().positive(),
    }),
    controlPanel: z.object({
      width: z.number().positive(),
      height: z.number().positive(),
      depth: z.number().positive(),
      readoutWidth: z.number().positive(),
      readoutHeight: z.number().positive(),
      readoutColor: z.string(),
      estopDiameter: z.number().positive(),
      estopColor: z.string(),
    }),
    color: z.string(),
  }),
  tailstock: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    depth: z.number().positive(),
    quillDiameter: z.number().positive(),
    quillTravel: z.number().positive(),
    quillLength: z.number().positive(),
    handwheelDiameter: z.number().positive(),
    handwheelThickness: z.number().positive(),
    lockKnobDiameter: z.number().positive(),
    lockKnobLength: z.number().positive(),
    color: z.string(),
  }),
  banjo: z.object({
    width: z.number().positive(),
    depth: z.number().positive(),
    height: z.number().positive(),
    postHoleDiameter: z.number().positive(),
    clampBoltDiameter: z.number().positive(),
    color: z.string(),
  }),
  toolRest: z.object({
    postDiameter: z.number().positive(),
    postHeight: z.number().positive(),
    barLength: z.number().positive(),
    barDiameter: z.number().positive(),
    color: z.string(),
  }),
  driveCenter: z.object({
    diameter: z.number().positive(),
    length: z.number().positive(),
    taper: z.string(),
    spurCount: z.number().int().positive(),
    spurDepth: z.number().positive(),
    centerPointLength: z.number().positive(),
    spurLength: z.number().positive(),
    shaftRatio: z.number().positive(),
    color: z.string(),
  }),
  liveCenter: z.object({
    diameter: z.number().positive(),
    length: z.number().positive(),
    taper: z.string(),
    pointAngleDeg: z.number().positive(),
    bodyDiameter: z.number().positive(),
    shaftRatio: z.number().positive(),
    color: z.string(),
  }),
  faceplate: z.object({
    diameter: z.number().positive(),
    thickness: z.number().positive(),
    boltCircleDiameter: z.number().positive(),
    boltCount: z.number().int().positive(),
    color: z.string(),
  }),
  knockoutBar: z.object({
    diameter: z.number().positive(),
    length: z.number().positive(),
    color: z.string(),
  }),
  stand: z.object({
    legHeight: z.number().positive(),
    topPlateThickness: z.number().positive(),
    legThickness: z.number().positive(),
    footWidth: z.number().positive(),
    topWidth: z.number().positive(),
    archInsetRatio: z.number().positive(),
    footPadLength: z.number().positive(),
    footPadHeight: z.number().positive(),
    adjustableFootDiameter: z.number().positive(),
    adjustableFootHeight: z.number().positive(),
    color: z.string(),
    footColor: z.string(),
    accentStripe: z.object({
      primaryColor: z.string(),
      secondaryColor: z.string(),
      height: z.number().positive(),
      fromFloor: z.number().positive(),
    }),
    toolBasket: z.object({
      width: z.number().positive(),
      depth: z.number().positive(),
      height: z.number().positive(),
      wireDiameter: z.number().positive(),
      color: z.string(),
    }),
  }),
});

let failures = 0;

function validateDir(dir: string, schema: z.ZodTypeAny, label: string) {
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(dir, file), 'utf-8')) as unknown;
    const result = schema.safeParse(raw);
    if (!result.success) {
      console.error(`[FAIL] ${label}/${file}:`, result.error.flatten());
      failures++;
    } else {
      console.log(`[OK]   ${label}/${file}`);
    }
  }
}

validateDir('content/tools', ToolSpecSchema, 'tools');
validateDir('content/curriculum', LessonSchema, 'curriculum');
validateDir('content/lathe', LatheSpecSchema, 'lathe');

if (failures > 0) {
  console.error(`\n${failures} file(s) failed validation.`);
  process.exit(1);
} else {
  console.log('\nAll content valid.');
}
