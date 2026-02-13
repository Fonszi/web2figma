/**
 * Typography style creator — converts TypographyToken[] into Figma TextStyles.
 *
 * Requires font loading before setting TextStyle properties.
 * Returns a map of typography key → TextStyle ID.
 */

import type { TypographyToken } from '../../../shared/types';
import { resolveFigmaFont } from '../nodes/text';
import { typographyToStyleName } from './naming';

export interface TypographyStyleMap {
  /** Map from typography key (fontFamily|fontSize|fontWeight|lineHeight|letterSpacing) to TextStyle ID. */
  byKey: Map<string, string>;
  /** Number of styles created. */
  count: number;
}

/** Build the lookup key matching token-scanner.ts format. */
export function typographyKey(token: TypographyToken): string {
  return `${token.fontFamily}|${token.fontSize}|${token.fontWeight}|${token.lineHeight}|${token.letterSpacing}`;
}

const MAX_TYPOGRAPHY_STYLES = 200;

export async function createTypographyStyles(
  tokens: TypographyToken[],
  onProgress?: (created: number, total: number) => void,
): Promise<TypographyStyleMap> {
  const byKey = new Map<string, string>();
  const capped = tokens.slice(0, MAX_TYPOGRAPHY_STYLES);

  for (let i = 0; i < capped.length; i++) {
    const token = capped[i]!;
    const key = typographyKey(token);

    if (byKey.has(key)) continue;

    try {
      const fontName = await resolveFigmaFont(token.fontFamily, token.fontWeight);
      await figma.loadFontAsync(fontName);

      const style = figma.createTextStyle();
      style.name = typographyToStyleName(token.fontSize, token.fontWeight);
      style.fontName = fontName;
      style.fontSize = token.fontSize;

      if (token.lineHeight > 0) {
        style.lineHeight = { value: token.lineHeight, unit: 'PIXELS' };
      }

      if (token.letterSpacing !== 0) {
        style.letterSpacing = { value: token.letterSpacing, unit: 'PIXELS' };
      }

      byKey.set(key, style.id);
    } catch {
      // Font loading failed — skip this style, node creator will handle fallback
    }

    onProgress?.(i + 1, capped.length);
  }

  return { byKey, count: byKey.size };
}
