/**
 * Token naming — convert CSS variable names and raw values to Figma style name paths.
 *
 * Figma uses '/' as a group separator in style names. E.g., 'color/primary/500'
 * shows as a nested group in the Styles panel.
 *
 * Conventions:
 * - CSS variable: --color-primary-500 → color/primary/500
 * - Raw hex: #3b82f6 → color/3b82f6
 * - Typography: Inter 16px Bold → text/16-bold
 * - Effect: drop-shadow #1 → effect/drop-shadow-1
 */

/** Track used names to avoid Figma duplicate-name errors. */
const usedNames = new Set<string>();

/** Reset the used name tracker (call between imports). */
export function resetNameTracker(): void {
  usedNames.clear();
}

/** Ensure a style name is unique by appending -2, -3 etc. */
function uniqueName(name: string): string {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }
  let i = 2;
  while (usedNames.has(`${name}-${i}`)) i++;
  const unique = `${name}-${i}`;
  usedNames.add(unique);
  return unique;
}

/**
 * Convert a CSS custom property name to a Figma style path.
 * --color-primary-500 → color/primary/500
 */
export function cssVarToStyleName(cssVarName: string): string {
  // Strip leading --
  let name = cssVarName.replace(/^-+/, '');
  // Split on hyphens
  const segments = name.split('-').filter(Boolean);
  return uniqueName(segments.join('/'));
}

/**
 * Generate a Figma PaintStyle name from a color value.
 * Prefers CSS variable name if available; otherwise uses hex.
 */
export function colorValueToStyleName(value: string, cssVariable?: string): string {
  if (cssVariable) return cssVarToStyleName(cssVariable);

  const hex = rgbToHex(value);
  const suffix = hex ? hex.replace('#', '') : value.replace(/[^a-z0-9]/gi, '-');
  return uniqueName(`color/${suffix}`);
}

/**
 * Generate a Figma TextStyle name from typography properties.
 */
export function typographyToStyleName(fontSize: number, fontWeight: number): string {
  const size = Math.round(fontSize);
  const weightName = fontWeight >= 700 ? 'bold' : fontWeight >= 500 ? 'medium' : 'regular';
  return uniqueName(`text/${size}-${weightName}`);
}

/**
 * Generate a Figma EffectStyle name.
 */
export function effectToStyleName(type: string, index: number): string {
  return uniqueName(`effect/${type}-${index + 1}`);
}

function rgbToHex(rgb: string): string | null {
  const match = rgb.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  const r = parseInt(match[1]!, 10);
  const g = parseInt(match[2]!, 10);
  const b = parseInt(match[3]!, 10);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}
