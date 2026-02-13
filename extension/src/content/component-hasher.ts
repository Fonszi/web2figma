/**
 * Component Hasher — hashes DOM subtree structure + style signatures for component detection.
 *
 * Creates a structural hash of a DOM element's subtree (tag names, key styles, child count)
 * while ignoring text content and specific values. Elements with the same hash are
 * candidates for Figma component + instance creation.
 *
 * Related files:
 * - Constants: shared/constants.ts (COMPONENT_THRESHOLD)
 * - Types: shared/types.ts (BridgeNode.componentHash)
 * - Consumer: extension/src/content/extractor.ts
 */

/**
 * Generate a structural hash for a DOM element's subtree.
 * Two elements with the same hash have the same structure and similar styles.
 */
export function hashComponent(el: Element, maxDepth = 5): string {
  const signature = buildSignature(el, 0, maxDepth);
  return simpleHash(signature);
}

/**
 * Build a structural signature string for an element.
 * Captures: tag name, key style properties, child count, recursive child signatures.
 * Ignores: text content, specific color values, exact dimensions.
 */
function buildSignature(el: Element, depth: number, maxDepth: number): string {
  const tag = el.tagName.toLowerCase();
  const cs = window.getComputedStyle(el);

  // Key structural style properties (not values that change per instance)
  const styleKey = [
    cs.display,
    cs.flexDirection,
    cs.position,
    cs.fontWeight,
    roundToStep(parseFloat(cs.fontSize), 4), // Group similar font sizes
    cs.textAlign,
    roundToStep(parseFloat(cs.borderRadius), 4),
    cs.overflow,
  ].join('|');

  const childCount = el.children.length;

  let signature = `${tag}[${styleKey}](${childCount})`;

  // Recurse into children (limited depth to avoid expensive deep hashing)
  if (depth < maxDepth) {
    const childSigs: string[] = [];
    for (const child of el.children) {
      childSigs.push(buildSignature(child, depth + 1, maxDepth));
    }
    signature += `{${childSigs.join(',')}}`;
  }

  return signature;
}

/**
 * Round a number to the nearest step (for grouping similar values).
 */
function roundToStep(value: number, step: number): number {
  if (isNaN(value)) return 0;
  return Math.round(value / step) * step;
}

/**
 * Simple string hash (DJB2 algorithm).
 * Fast and produces reasonably distributed hashes for component detection.
 */
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) & 0xffffffff;
  }
  return (hash >>> 0).toString(36);
}
