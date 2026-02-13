/**
 * Component detector — walks BridgeNode tree and groups nodes by componentHash.
 *
 * A group with 3+ instances (COMPONENT_THRESHOLD) becomes a DetectedComponent.
 * The representative node is the first instance encountered (usually the topmost in DOM order).
 *
 * Naming heuristic (in priority order):
 * 1. Framer component name from data attributes
 * 2. ARIA role (e.g., "navigation", "button", "dialog")
 * 3. Most common class name across instances
 * 4. Tag name (e.g., "Card", "ListItem")
 *
 * Related files:
 * - Hash source: extension/src/content/component-hasher.ts
 * - Types: shared/types.ts (DetectedComponent, BridgeNode)
 * - Constants: shared/constants.ts (COMPONENT_THRESHOLD)
 */

import type { BridgeNode, DetectedComponent } from '../../../shared/types';
import { COMPONENT_THRESHOLD } from '../../../shared/constants';

/**
 * Detect repeated component patterns from a BridgeNode tree.
 * Returns components sorted by instance count (most common first).
 */
export function detectComponents(rootNode: BridgeNode): DetectedComponent[] {
  // Collect all nodes grouped by componentHash
  const groups = new Map<string, BridgeNode[]>();
  collectHashes(rootNode, groups);

  // Filter to groups meeting the threshold
  const components: DetectedComponent[] = [];

  for (const [hash, instances] of groups) {
    if (instances.length < COMPONENT_THRESHOLD) continue;

    const representative = instances[0]!;
    const name = generateComponentName(instances);

    components.push({
      hash,
      name,
      instances,
      representativeNode: representative,
    });
  }

  return components.sort((a, b) => b.instances.length - a.instances.length);
}

/**
 * Recursively collect all nodes with a componentHash, grouped by hash.
 * Only collects frame-type nodes (not text, image, svg leaves).
 */
function collectHashes(node: BridgeNode, groups: Map<string, BridgeNode[]>): void {
  if (node.componentHash && node.type === 'frame' && node.children.length > 0) {
    const list = groups.get(node.componentHash);
    if (list) {
      list.push(node);
    } else {
      groups.set(node.componentHash, [node]);
    }
  }

  for (const child of node.children) {
    collectHashes(child, groups);
  }
}

/**
 * Generate a human-readable component name from a group of instances.
 */
function generateComponentName(instances: BridgeNode[]): string {
  const representative = instances[0]!;

  // 1. Framer component name
  const framerName = representative.dataAttributes?.['data-framer-name'];
  if (framerName) return cleanName(framerName);

  // 2. ARIA role
  if (representative.ariaRole && representative.ariaRole !== 'generic') {
    return cleanName(representative.ariaRole);
  }

  // 3. Most common class name across instances
  const className = findBestClassName(instances);
  if (className) return cleanName(className);

  // 4. Tag name with child count hint
  const tag = representative.tag;
  const childCount = representative.children.length;
  const tagName = TAG_NAMES[tag] ?? capitalize(tag);
  return childCount > 0 ? `${tagName} Group` : tagName;
}

/**
 * Find the most semantically useful class name shared across instances.
 * Filters out utility classes (single-character, numeric-heavy, BEM modifiers).
 */
function findBestClassName(instances: BridgeNode[]): string | null {
  const classCounts = new Map<string, number>();

  for (const node of instances) {
    if (!node.classNames) continue;
    for (const cls of node.classNames) {
      if (isUtilityClass(cls)) continue;
      classCounts.set(cls, (classCounts.get(cls) ?? 0) + 1);
    }
  }

  if (classCounts.size === 0) return null;

  // Pick the class that appears on the most instances
  let best: string | null = null;
  let bestCount = 0;
  for (const [cls, count] of classCounts) {
    if (count > bestCount) {
      bestCount = count;
      best = cls;
    }
  }

  return best;
}

/** Filter out utility/generated class names. */
function isUtilityClass(cls: string): boolean {
  // Too short
  if (cls.length <= 2) return true;
  // Generated hashes (contain mix of letters + numbers like "css-1a2b3c")
  if (/^[a-z]{1,4}-[a-z0-9]{4,}$/i.test(cls)) return true;
  // Tailwind-like single-property classes
  if (/^(p|m|w|h|bg|text|flex|grid|gap|rounded|border|shadow|opacity|z)-/.test(cls)) return true;
  return false;
}

/** Convert a class name or role to a clean component name. */
function cleanName(raw: string): string {
  return raw
    .replace(/^(css|styles?|component)-/i, '') // Strip common prefixes
    .replace(/[-_]+/g, ' ')                    // Replace separators with spaces
    .replace(/([a-z])([A-Z])/g, '$1 $2')      // camelCase → separate words
    .split(' ')
    .filter(Boolean)
    .map(capitalize)
    .join(' ');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Semantic tag name mapping. */
const TAG_NAMES: Record<string, string> = {
  nav: 'Navigation',
  header: 'Header',
  footer: 'Footer',
  main: 'Main',
  section: 'Section',
  article: 'Article',
  aside: 'Sidebar',
  ul: 'List',
  ol: 'Ordered List',
  li: 'List Item',
  button: 'Button',
  a: 'Link',
  form: 'Form',
  input: 'Input',
  select: 'Select',
  table: 'Table',
  tr: 'Table Row',
  td: 'Table Cell',
  div: 'Container',
  span: 'Span',
};
