/**
 * Effect style creator — converts EffectToken[] into Figma EffectStyles.
 *
 * Handles: drop-shadow, inner-shadow. Returns a map of CSS box-shadow value → EffectStyle ID.
 */

import type { EffectToken } from '../../../shared/types';
import { parseBoxShadow } from '../nodes/styles';
import { effectToStyleName } from './naming';

export interface EffectStyleMap {
  /** Map from CSS box-shadow value (trimmed) to Figma EffectStyle ID. */
  byValue: Map<string, string>;
  /** Number of styles created. */
  count: number;
}

const MAX_EFFECT_STYLES = 200;

export async function createEffectStyles(
  tokens: EffectToken[],
  onProgress?: (created: number, total: number) => void,
): Promise<EffectStyleMap> {
  const byValue = new Map<string, string>();
  const capped = tokens.slice(0, MAX_EFFECT_STYLES);

  for (let i = 0; i < capped.length; i++) {
    const token = capped[i]!;
    const normalized = token.value.trim();

    if (byValue.has(normalized)) continue;

    const effect = parseBoxShadow(token.value);
    if (!effect) continue;

    const style = figma.createEffectStyle();
    style.name = effectToStyleName(token.type, i);
    style.effects = [effect];

    byValue.set(normalized, style.id);
    onProgress?.(i + 1, capped.length);
  }

  return { byValue, count: byValue.size };
}
