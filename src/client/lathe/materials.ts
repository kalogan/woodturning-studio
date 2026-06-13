/**
 * PBR material prop helpers for Jet JWL-1642EVS lathe parts and workshop surfaces.
 * Returns plain prop objects suitable for spreading onto <meshStandardMaterial>.
 *
 * Design palette — "warm workshop":
 *   • Jet signature off-white painted steel/cast-iron  (#E8E4D8 — warm ivory)
 *   • Dark cast iron / banjo                           (#252523 — warm near-black)
 *   • Brushed/bare steel — ways, centers, tool rest    (#6a6a6a — cool mid-grey)
 *   • Black rubber — knobs, feet                       (#1a1a1a)
 *   • Wood — benchtop, carcasses                       (#9B6B3F — warm mid-brown)
 *   • Concrete floor                                   (#8a8880 — desaturated warm grey)
 *   • Painted drywall walls/ceiling                    (#D8D2C4 — warm off-white)
 *
 * Physical rules:
 *   • Metals:   metalness 0.60–0.95, roughness 0.25–0.55
 *   • Painted:  metalness 0.05–0.15, roughness 0.50–0.65
 *   • Wood:     metalness 0.0,       roughness 0.75–0.85
 *   • Concrete: metalness 0.0,       roughness ~0.95
 *   • Rubber:   metalness 0.0,       roughness 0.90
 *
 * Every helper is a pure function — call it at module scope or inside render; it
 * allocates one small object and is never called inside the tick loop.
 */

export interface MaterialProps {
  color: string;
  roughness: number;
  metalness: number;
}

// ── Lathe ─────────────────────────────────────────────────────────────────────

/**
 * Jet off-white painted steel — bed, stand, headstock / tailstock body.
 * Jet's signature ivory-white, slightly warm, painted over cast iron.
 * Low metalness (painted), moderate roughness (slight paint sheen).
 */
export function jetWhiteSteel(color = '#E8E4D8'): MaterialProps {
  return { color, roughness: 0.52, metalness: 0.08 };
}

/** Cream/white painted cast iron — headstock, tailstock body (alias kept for compat) */
export function paintedCastIron(color = '#E8E4D8'): MaterialProps {
  return jetWhiteSteel(color);
}

/**
 * Dark cast iron — banjo, and the raw bed casting colour under paint chips.
 * Very dark warm near-black, slight metalness suggests iron (not matte plastic).
 */
export function darkCastIron(color = '#252523'): MaterialProps {
  return { color, roughness: 0.58, metalness: 0.18 };
}

/**
 * Brushed / bare steel — ways, live/drive centers, tool rest post and bar.
 * Mid-grey, high metalness, moderate roughness for a machined surface.
 */
export function bareSteel(color = '#6a6a6a'): MaterialProps {
  return { color, roughness: 0.32, metalness: 0.88 };
}

/**
 * Black rubber — knobs, lever grips, adjustable feet pads.
 * Flat black, zero metalness, high roughness.
 */
export function blackRubber(): MaterialProps {
  return { color: '#1a1a1a', roughness: 0.90, metalness: 0.0 };
}

// ── Workshop surfaces ─────────────────────────────────────────────────────────

/**
 * Workshop wood — workbench butcher-block top, cabinet carcasses, shelves.
 * Warm mid-brown, zero metalness, moderately high roughness (planed but not finished).
 */
export function workshopWood(color = '#9B6B3F'): MaterialProps {
  return { color, roughness: 0.78, metalness: 0.0 };
}

/**
 * Concrete floor — desaturated warm grey, very high roughness, zero metalness.
 */
export function concreteFloor(color = '#8a8880'): MaterialProps {
  return { color, roughness: 0.95, metalness: 0.0 };
}

/**
 * Painted drywall — warm off-white for walls and ceiling.
 * High roughness (flat paint), zero metalness.
 */
export function paintedDrywall(color = '#D8D2C4'): MaterialProps {
  return { color, roughness: 0.88, metalness: 0.0 };
}

/**
 * Painted drywall ceiling — slightly brighter/cooler than walls to pick up
 * fluorescent bounce, otherwise same as walls.
 */
export function paintedDrywallCeiling(color = '#E4E0D8'): MaterialProps {
  return { color, roughness: 0.85, metalness: 0.0 };
}

/**
 * Cabinet painted MDF — the shop cabinets use a white-ish painted finish,
 * slightly cooler than the drywall to read as manufactured furniture.
 */
export function cabinetPaint(color = '#E8E6E0'): MaterialProps {
  return { color, roughness: 0.72, metalness: 0.0 };
}

/**
 * Laminate countertop — grey laminate work surface over base cabinets.
 * Slightly smoother than wood (laminated finish).
 */
export function laminateCounter(color = '#8a8070'): MaterialProps {
  return { color, roughness: 0.55, metalness: 0.04 };
}

/**
 * Painted steel cabinet — tool cabinet body (Jet-red / dark red).
 * High metalness (steel under paint), moderate roughness.
 */
export function paintedSteelCabinet(color = '#7a3030'): MaterialProps {
  return { color, roughness: 0.55, metalness: 0.42 };
}

/**
 * Brushed steel handle — cabinet/drawer pulls.
 * Warm silver, high metalness, lower roughness.
 */
export function brushedSteelHandle(color = '#c0b090'): MaterialProps {
  return { color, roughness: 0.38, metalness: 0.72 };
}
