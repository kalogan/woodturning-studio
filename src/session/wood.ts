import pineData from '../../content/wood/pine.json';
import mapleData from '../../content/wood/maple.json';
import cherryData from '../../content/wood/cherry.json';
import walnutData from '../../content/wood/walnut.json';
import oakData from '../../content/wood/oak.json';
import ashData from '../../content/wood/ash.json';
import matrixData from '../../content/wood/cutting-matrix.json';

// ── Types ────────────────────────────────────────────────────────────────────

export interface WoodFigure {
  type: 'none' | 'fleck' | 'streak';
  intensity: number; // 0..1
}

export interface WoodVisualParams {
  baseColor: string;   // hex
  grainColor: string;  // hex
  ringFrequency: number;  // relative ring spacing
  ringContrast: number;   // 0..1
  figure: WoodFigure;
}

export interface WoodSpecies {
  id: string;
  displayName: string;
  janka: number;    // Janka hardness, lbf
  density: number;  // kg/m³
  visual: WoodVisualParams;
}

export interface CuttingCoefficients {
  cutRate: number;  // multiplier on material removed per pass
  tearout: number;  // tearout propensity multiplier
  catch: number;    // catch severity/propensity multiplier
}

// ── Internal data ────────────────────────────────────────────────────────────

const ALL_SPECIES: WoodSpecies[] = [
  pineData as WoodSpecies,
  mapleData as WoodSpecies,
  cherryData as WoodSpecies,
  walnutData as WoodSpecies,
  oakData as WoodSpecies,
  ashData as WoodSpecies,
];

// Pre-compute min/max janka for normalizedHardness — done once at module load.
const _jankaValues = ALL_SPECIES.map((s) => s.janka);
const _jankaMin = Math.min(..._jankaValues);
const _jankaMax = Math.max(..._jankaValues);

// ── Accessors ────────────────────────────────────────────────────────────────

/** Returns all wood species in definition order. */
export function getWoodSpecies(): WoodSpecies[] {
  return [...ALL_SPECIES];
}

/** Returns a species by id, or undefined if not found. */
export function getWoodSpeciesById(id: string): WoodSpecies | undefined {
  return ALL_SPECIES.find((s) => s.id === id);
}

/**
 * Returns cutting coefficients for a given species + tool pair.
 * Returns undefined when either id is unknown.
 */
export function getCuttingCoefficients(
  speciesId: string,
  toolId: string,
): CuttingCoefficients | undefined {
  const byTool = (matrixData.coefficients as Record<string, Record<string, CuttingCoefficients>>)[toolId];
  if (byTool === undefined) return undefined;
  return byTool[speciesId];
}

/**
 * Maps a species' Janka hardness onto 0..1 using min/max scaling across the
 * full set. Useful for physics multipliers that need a continuous signal.
 */
export function normalizedHardness(species: WoodSpecies): number {
  if (_jankaMax === _jankaMin) return 0.5;
  return (species.janka - _jankaMin) / (_jankaMax - _jankaMin);
}
