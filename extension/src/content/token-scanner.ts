/**
 * Token Scanner — extracts design tokens (colors, typography, effects, CSS variables) from the page.
 *
 * Scans:
 * - document.styleSheets for CSS custom properties
 * - Computed styles across the DOM for unique colors and typography combos
 *
 * Related files:
 * - Types: shared/types.ts (DesignTokens, ColorToken, TypographyToken, EffectToken, VariableToken)
 * - Consumer: extension/src/content/extractor.ts
 */

import type { DesignTokens, ColorToken, TypographyToken, EffectToken, VariableToken } from '../../../shared/types';

/**
 * Scan the document for design tokens.
 */
export function scanTokens(doc: Document): DesignTokens {
  const colors = scanColors(doc);
  const typography = scanTypography(doc);
  const effects = scanEffects(doc);
  const variables = scanCssVariables(doc);

  return { colors, typography, effects, variables };
}

// ============================================================
// Color scanning
// ============================================================

function scanColors(doc: Document): ColorToken[] {
  const colorMap = new Map<string, { count: number; cssVar?: string }>();

  // Walk all visible elements and collect unique colors
  const elements = doc.querySelectorAll('*');
  for (const el of elements) {
    const cs = window.getComputedStyle(el);
    trackColor(colorMap, cs.color);
    trackColor(colorMap, cs.backgroundColor);
    trackColor(colorMap, cs.borderColor);
  }

  // Convert to tokens, sorted by usage count
  const tokens: ColorToken[] = [];
  for (const [value, data] of colorMap) {
    if (isTransparent(value)) continue;
    tokens.push({
      name: generateColorName(value),
      value,
      usageCount: data.count,
      cssVariable: data.cssVar,
    });
  }

  return tokens.sort((a, b) => b.usageCount - a.usageCount);
}

function trackColor(map: Map<string, { count: number; cssVar?: string }>, value: string): void {
  if (!value || isTransparent(value)) return;
  const normalized = value.trim().toLowerCase();
  const existing = map.get(normalized);
  if (existing) {
    existing.count++;
  } else {
    map.set(normalized, { count: 1 });
  }
}

function isTransparent(color: string): boolean {
  return !color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)' || color === 'initial' || color === 'inherit';
}

function generateColorName(value: string): string {
  // Try to generate a readable name from the color value
  const hex = rgbToHex(value);
  return hex ? `color/${hex.replace('#', '')}` : `color/${value.replace(/[^a-z0-9]/gi, '-')}`;
}

function rgbToHex(rgb: string): string | null {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// ============================================================
// Typography scanning
// ============================================================

function scanTypography(doc: Document): TypographyToken[] {
  const typoMap = new Map<string, { count: number; token: TypographyToken }>();

  const elements = doc.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, li, td, th, label, button');
  for (const el of elements) {
    const cs = window.getComputedStyle(el);
    const key = `${cs.fontFamily}|${cs.fontSize}|${cs.fontWeight}|${cs.lineHeight}|${cs.letterSpacing}`;
    const existing = typoMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      typoMap.set(key, {
        count: 1,
        token: {
          name: generateTypoName(cs),
          fontFamily: cs.fontFamily.split(',')[0].trim().replace(/['"]/g, ''),
          fontSize: parseFloat(cs.fontSize) || 16,
          fontWeight: parseInt(cs.fontWeight, 10) || 400,
          lineHeight: parseFloat(cs.lineHeight) || 0,
          letterSpacing: parseFloat(cs.letterSpacing) || 0,
          usageCount: 0,
        },
      });
    }
  }

  return Array.from(typoMap.values())
    .map(({ count, token }) => ({ ...token, usageCount: count }))
    .sort((a, b) => b.usageCount - a.usageCount);
}

function generateTypoName(cs: CSSStyleDeclaration): string {
  const size = Math.round(parseFloat(cs.fontSize) || 16);
  const weight = parseInt(cs.fontWeight, 10) || 400;
  const weightName = weight >= 700 ? 'bold' : weight >= 500 ? 'medium' : 'regular';
  return `text/${size}-${weightName}`;
}

// ============================================================
// Effect scanning
// ============================================================

function scanEffects(doc: Document): EffectToken[] {
  const effectMap = new Map<string, { count: number; type: EffectToken['type'] }>();

  const elements = doc.querySelectorAll('*');
  for (const el of elements) {
    const cs = window.getComputedStyle(el);
    if (cs.boxShadow && cs.boxShadow !== 'none') {
      const key = cs.boxShadow.trim();
      const existing = effectMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        const isInset = key.includes('inset');
        effectMap.set(key, { count: 1, type: isInset ? 'inner-shadow' : 'drop-shadow' });
      }
    }
  }

  return Array.from(effectMap.entries())
    .map(([value, data]) => ({
      name: `effect/${data.type}-${effectMap.size}`,
      type: data.type,
      value,
      usageCount: data.count,
    }))
    .sort((a, b) => b.usageCount - a.usageCount);
}

// ============================================================
// CSS Variable scanning
// ============================================================

function scanCssVariables(doc: Document): VariableToken[] {
  const variables: VariableToken[] = [];

  try {
    for (const sheet of doc.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSStyleRule) {
            for (let i = 0; i < rule.style.length; i++) {
              const prop = rule.style[i];
              if (prop.startsWith('--')) {
                const value = rule.style.getPropertyValue(prop).trim();
                if (value && !variables.some(v => v.name === prop)) {
                  variables.push({
                    name: prop,
                    cssProperty: prop,
                    resolvedValue: value,
                    type: inferVariableType(value),
                  });
                }
              }
            }
          }
        }
      } catch {
        // Cross-origin stylesheet — skip
      }
    }
  } catch {
    // No access to styleSheets — skip
  }

  return variables;
}

function inferVariableType(value: string): VariableToken['type'] {
  // Color patterns
  if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')) return 'color';
  // Number patterns (px, rem, em, %, numbers)
  if (/^-?\d+(\.\d+)?(px|rem|em|%|vh|vw)?$/.test(value)) return 'number';
  return 'string';
}
