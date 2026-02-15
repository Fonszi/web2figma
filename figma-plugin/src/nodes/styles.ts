/**
 * Style utilities — re-exports from figma-conversion-core + Figma-specific helpers.
 *
 * Used by frame.ts, text.ts, image.ts.
 */

// Re-export shared conversion functions
export { parseCssColor, isTransparent } from '../../../src/shared/figma-conversion-core/src/colors';
export { parseCornerRadii } from '../../../src/shared/figma-conversion-core/src/layout';

import { parseCssColor } from '../../../src/shared/figma-conversion-core/src/colors';
import { parseBoxShadow as parseBoxShadowCore } from '../../../src/shared/figma-conversion-core/src/effects';

/** Parse a CSS border-radius value to a single number (px). */
export function parseRadius(value: string | undefined): number {
  if (!value) return 0;
  return parseFloat(value) || 0;
}

/** Create a Figma SolidPaint from a CSS color string. */
export function solidPaint(cssColor: string): SolidPaint | null {
  const c = parseCssColor(cssColor);
  if (!c) return null;
  return {
    type: 'SOLID',
    color: { r: c.r, g: c.g, b: c.b },
    opacity: c.a,
  };
}

/** Parse a CSS box-shadow to a Figma Effect (adapts FigmaEffect → Figma API Effect). */
export function parseBoxShadow(value: string | undefined): Effect | null {
  const effect = parseBoxShadowCore(value);
  if (!effect) return null;
  return {
    type: effect.type as 'DROP_SHADOW' | 'INNER_SHADOW',
    visible: true,
    blendMode: 'NORMAL',
    color: { r: effect.color!.r, g: effect.color!.g, b: effect.color!.b, a: effect.opacity ?? 1 },
    offset: effect.offset ?? { x: 0, y: 0 },
    radius: effect.radius ?? 0,
    spread: effect.spread ?? 0,
  } as Effect;
}
