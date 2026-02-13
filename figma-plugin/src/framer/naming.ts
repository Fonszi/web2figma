/**
 * Framer naming — extract layer names and detect sections from Framer metadata.
 *
 * Used by the converter to replace generic tag names ("div", "span") with
 * Framer's own section/component names ("Hero Section", "Navigation", "Card").
 *
 * Related files:
 * - Metadata source: extension/src/content/framer-detector.ts
 * - Consumer: figma-plugin/src/converter.ts
 */

import type { BridgeNode } from '../../../shared/types';

/**
 * Extract the best Framer name for a BridgeNode.
 * Returns null if no Framer metadata is available.
 *
 * Priority:
 * 1. data-framer-name (explicit section/component name)
 * 2. data-framer-component-type (component type like "Stack", "Card")
 */
export function getFramerName(node: BridgeNode): string | null {
  if (!node.dataAttributes) return null;

  // 1. Explicit Framer name
  const framerName = node.dataAttributes['data-framer-name'];
  if (framerName) return cleanFramerName(framerName);

  // 2. Component type
  const componentType = node.dataAttributes['data-framer-component-type'];
  if (componentType) return cleanFramerName(componentType);

  return null;
}

/**
 * Detect whether a BridgeNode represents a top-level Framer section.
 *
 * Sections are named containers at the top level of the page (Hero, Features, CTA, Footer).
 * They should be wrapped in Figma Section nodes for better organization.
 */
export function isFramerSection(node: BridgeNode): boolean {
  if (node.children.length === 0) return false;
  if (!node.dataAttributes) return false;

  // Has an explicit Framer name → section candidate
  if (node.dataAttributes['data-framer-name']) return true;

  // Component type contains "Section" or "Page"
  const componentType = node.dataAttributes['data-framer-component-type'];
  if (componentType) {
    const lower = componentType.toLowerCase();
    return lower.includes('section') || lower.includes('page');
  }

  return false;
}

/**
 * Clean a raw Framer name for use as a Figma layer name.
 *
 * Framer names may include:
 * - Hash suffixes: "Hero Section__3k2j" → "Hero Section"
 * - Variant indicators: "Button/Primary" → keep as-is (Figma-compatible path)
 * - Framer internal IDs: "framer-abc123" → "abc123" (strip "framer-" prefix)
 */
export function cleanFramerName(raw: string): string {
  let name = raw.trim();

  // Strip hash suffixes: "Name__abc123" or "Name_abc123"
  name = name.replace(/__[a-z0-9]{3,}$/i, '');
  name = name.replace(/_[a-z0-9]{6,}$/i, '');

  // Strip "framer-" prefix from IDs
  if (/^framer-[a-z0-9]+$/i.test(name)) {
    name = name.replace(/^framer-/i, '');
  }

  // Collapse multiple spaces
  name = name.replace(/\s+/g, ' ').trim();

  return name || raw.trim();
}
