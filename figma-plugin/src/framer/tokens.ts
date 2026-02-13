/**
 * Framer token enhancement — clean and rename Framer-specific CSS variables.
 *
 * Framer sites use CSS variables with a project hash prefix:
 *   --token-abc123-color-primary → color/primary
 *   --framer-font-family → font/family
 *
 * This module strips the hash and creates clean, semantic names that
 * produce better Figma Variable collections.
 *
 * Related files:
 * - Token scanner: extension/src/content/token-scanner.ts
 * - Variable creator: figma-plugin/src/tokens/variables.ts
 */

import type { DesignTokens, VariableToken, ColorToken } from '../../../shared/types';

/** Framer token hash pattern: --token-{4-8 char hash}-{semantic-name} */
const TOKEN_HASH_PATTERN = /^--token-[a-z0-9]{3,8}-(.+)$/i;

/** Framer prefixed variables: --framer-{name} */
const FRAMER_PREFIX_PATTERN = /^--framer-(.+)$/i;

/**
 * Enhance design tokens for a Framer site.
 * Returns a new DesignTokens object with cleaned variable names and grouped colors.
 * Does NOT mutate the input.
 */
export function enhanceFramerTokens(tokens: DesignTokens): DesignTokens {
  return {
    colors: enhanceColorTokens(tokens.colors),
    typography: tokens.typography, // Typography tokens are already well-named
    effects: tokens.effects,       // Effect tokens don't have Framer-specific naming
    variables: enhanceVariableTokens(tokens.variables),
  };
}

/**
 * Enhance color tokens — promote colors with Framer variable origins.
 */
function enhanceColorTokens(colors: ColorToken[]): ColorToken[] {
  return colors.map((color) => {
    if (!color.cssVariable) return color;

    const cleanName = cleanFramerVarName(color.cssVariable);
    if (cleanName === color.cssVariable) return color;

    return {
      ...color,
      name: cleanName,
      cssVariable: color.cssVariable,
    };
  });
}

/**
 * Enhance variable tokens — strip Framer hashes, add collection prefixes.
 */
function enhanceVariableTokens(variables: VariableToken[]): VariableToken[] {
  return variables.map((v) => {
    if (!isFramerVariable(v.name)) return v;

    const cleanName = cleanFramerVarName(v.name);
    const groupedName = addCollectionPrefix(cleanName, v.type);

    return {
      ...v,
      name: groupedName,
      cssProperty: v.cssProperty,
    };
  });
}

/**
 * Check if a CSS variable name is a Framer-specific variable.
 */
export function isFramerVariable(name: string): boolean {
  return TOKEN_HASH_PATTERN.test(name) || FRAMER_PREFIX_PATTERN.test(name);
}

/**
 * Clean a Framer variable name by stripping hashes and prefixes.
 *
 * --token-abc123-color-primary → color-primary
 * --framer-font-family → font-family
 * --regular-var → regular-var (unchanged)
 */
export function cleanFramerVarName(name: string): string {
  // Strip --token-{hash}- prefix
  const tokenMatch = name.match(TOKEN_HASH_PATTERN);
  if (tokenMatch) return tokenMatch[1]!;

  // Strip --framer- prefix
  const framerMatch = name.match(FRAMER_PREFIX_PATTERN);
  if (framerMatch) return framerMatch[1]!;

  // Strip leading dashes for generic vars
  return name.replace(/^-+/, '');
}

/**
 * Add a Figma-friendly collection prefix based on the variable's semantic category.
 */
function addCollectionPrefix(name: string, type: VariableToken['type']): string {
  const lower = name.toLowerCase();

  // Already has a category prefix
  if (lower.startsWith('color') || lower.startsWith('spacing') || lower.startsWith('font')
      || lower.startsWith('border') || lower.startsWith('shadow') || lower.startsWith('radius')) {
    return name;
  }

  // Infer category from type
  switch (type) {
    case 'color': return `color/${name}`;
    case 'number': return `spacing/${name}`;
    default: return name;
  }
}
