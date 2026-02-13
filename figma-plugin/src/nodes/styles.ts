/**
 * Style utilities — shared helpers for parsing colors, applying fills, borders, shadows.
 *
 * Used by frame.ts, text.ts, image.ts.
 */

/** Parse a CSS color string (rgb, rgba, hex) to Figma RGB (0–1 range). */
export function parseCssColor(value: string): { r: number; g: number; b: number; a: number } | null {
  // rgba(R, G, B, A) or rgb(R, G, B)
  const rgbaMatch = value.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1]!, 10) / 255,
      g: parseInt(rgbaMatch[2]!, 10) / 255,
      b: parseInt(rgbaMatch[3]!, 10) / 255,
      a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
    };
  }

  // #RRGGBB or #RGB
  const hexMatch = value.match(/^#([0-9a-f]{3,8})$/i);
  if (hexMatch) {
    const hex = hexMatch[1]!;
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0]! + hex[0]!, 16) / 255,
        g: parseInt(hex[1]! + hex[1]!, 16) / 255,
        b: parseInt(hex[2]! + hex[2]!, 16) / 255,
        a: 1,
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16) / 255,
        g: parseInt(hex.slice(2, 4), 16) / 255,
        b: parseInt(hex.slice(4, 6), 16) / 255,
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
  }

  return null;
}

/** Check if a CSS color is transparent / invisible. */
export function isTransparent(value: string | undefined): boolean {
  if (!value) return true;
  if (value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return true;
  const parsed = parseCssColor(value);
  return parsed !== null && parsed.a === 0;
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

/** Parse a CSS border-radius value to a single number (px). */
export function parseRadius(value: string | undefined): number {
  if (!value) return 0;
  return parseFloat(value) || 0;
}

/** Parse individual corner radii from CSS. */
export function parseCornerRadii(styles: {
  borderTopLeftRadius?: string;
  borderTopRightRadius?: string;
  borderBottomRightRadius?: string;
  borderBottomLeftRadius?: string;
}): [number, number, number, number] | null {
  const tl = parseFloat(styles.borderTopLeftRadius ?? '0') || 0;
  const tr = parseFloat(styles.borderTopRightRadius ?? '0') || 0;
  const br = parseFloat(styles.borderBottomRightRadius ?? '0') || 0;
  const bl = parseFloat(styles.borderBottomLeftRadius ?? '0') || 0;

  if (tl === 0 && tr === 0 && br === 0 && bl === 0) return null;
  return [tl, tr, br, bl];
}

/** Parse a CSS box-shadow to a Figma shadow Effect (DROP_SHADOW or INNER_SHADOW). */
export function parseBoxShadow(value: string | undefined): Effect | null {
  if (!value || value === 'none') return null;

  const isInset = value.includes('inset');
  const cleanValue = value.replace(/inset/g, '').trim();

  // Simple parser: offsetX offsetY blurRadius spreadRadius? color
  const match = cleanValue.match(
    /(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(\d+(?:\.\d+)?)px(?:\s+(-?\d+(?:\.\d+)?)px)?\s+(.*)/
  );
  if (!match) return null;

  const color = parseCssColor(match[5]!.trim());
  if (!color) return null;

  return {
    type: isInset ? 'INNER_SHADOW' : 'DROP_SHADOW',
    visible: true,
    blendMode: 'NORMAL',
    color: { r: color.r, g: color.g, b: color.b, a: color.a },
    offset: { x: parseFloat(match[1]!), y: parseFloat(match[2]!) },
    radius: parseFloat(match[3]!),
    spread: match[4] ? parseFloat(match[4]) : 0,
  } as Effect;
}
