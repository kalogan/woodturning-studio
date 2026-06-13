/**
 * PBR material prop helpers for Jet JWL-1221VS lathe parts.
 * Returns plain prop objects suitable for spreading onto <meshStandardMaterial>.
 */

export interface MaterialProps {
  color: string;
  roughness: number;
  metalness: number;
}

/** Cream/white painted cast iron — headstock, tailstock body */
export function paintedCastIron(color = '#EAE6DC'): MaterialProps {
  return { color, roughness: 0.5, metalness: 0.1 };
}

/** Dark painted cast iron — banjo, bed */
export function darkCastIron(color = '#2a2a2a'): MaterialProps {
  return { color, roughness: 0.55, metalness: 0.15 };
}

/** Bare / dark steel — tool rest, centers */
export function bareSteel(color = '#5a5a5a'): MaterialProps {
  return { color, roughness: 0.35, metalness: 0.85 };
}

/** Black rubber — knobs */
export function blackRubber(): MaterialProps {
  return { color: '#1a1a1a', roughness: 0.9, metalness: 0.0 };
}
