/**
 * Color style creator — converts ColorToken[] into Figma PaintStyles.
 *
 * Creates one PaintStyle per unique color. Returns a map of CSS color value → PaintStyle ID
 * so that node creators can apply fillStyleId instead of raw fills.
 */

import type { ColorToken } from '../../../shared/types';
import { parseCssColor } from '../nodes/styles';
import { colorValueToStyleName } from './naming';

export interface ColorStyleMap {
  /** Map from normalized CSS color value to Figma PaintStyle ID. */
  byValue: Map<string, string>;
  /** Number of styles created. */
  count: number;
}

const MAX_COLOR_STYLES = 200;

export async function createColorStyles(
  tokens: ColorToken[],
  onProgress?: (created: number, total: number) => void,
): Promise<ColorStyleMap> {
  const byValue = new Map<string, string>();
  const capped = tokens.slice(0, MAX_COLOR_STYLES);

  for (let i = 0; i < capped.length; i++) {
    const token = capped[i]!;
    const normalized = token.value.trim().toLowerCase();

    // Skip if already mapped (dedup)
    if (byValue.has(normalized)) continue;

    const parsed = parseCssColor(token.value);
    if (!parsed) continue;

    const style = figma.createPaintStyle();
    style.name = colorValueToStyleName(token.value, token.cssVariable);
    style.paints = [
      {
        type: 'SOLID',
        color: { r: parsed.r, g: parsed.g, b: parsed.b },
        opacity: parsed.a,
      },
    ];

    byValue.set(normalized, style.id);
    onProgress?.(i + 1, capped.length);
  }

  return { byValue, count: byValue.size };
}
