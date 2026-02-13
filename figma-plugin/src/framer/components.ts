/**
 * Framer component enhancement — boost component detection using Framer boundaries.
 *
 * Framer sites mark component boundaries with `data-framer-component-type`.
 * This module finds those boundaries and adds them to the detected component list,
 * even if they don't meet the standard hash-based threshold (3 instances).
 *
 * Related files:
 * - Detector: figma-plugin/src/components/detector.ts
 * - Types: shared/types.ts (DetectedComponent, BridgeNode)
 */

import type { BridgeNode, DetectedComponent } from '../../../shared/types';

/** Lower threshold for Framer-marked components. */
const FRAMER_COMPONENT_THRESHOLD = 2;

/**
 * Enhance detected components using Framer boundary metadata.
 *
 * 1. Walk tree for nodes with `data-framer-component-type`
 * 2. Group by component type name
 * 3. If a group has 2+ instances, create a DetectedComponent
 * 4. Merge with hash-detected components (Framer names take precedence)
 */
export function enhanceFramerComponents(
  detected: DetectedComponent[],
  rootNode: BridgeNode,
): DetectedComponent[] {
  // Collect Framer component boundaries
  const framerGroups = new Map<string, BridgeNode[]>();
  collectFramerComponents(rootNode, framerGroups);

  // Build Framer-detected components
  const framerComponents: DetectedComponent[] = [];
  for (const [typeName, instances] of framerGroups) {
    if (instances.length < FRAMER_COMPONENT_THRESHOLD) continue;

    framerComponents.push({
      hash: `framer-${typeName}`,
      name: cleanComponentTypeName(typeName),
      instances,
      representativeNode: instances[0]!,
    });
  }

  // Merge: Framer components first, then hash-detected (skip duplicates)
  return mergeComponents(detected, framerComponents);
}

/**
 * Recursively collect nodes with `data-framer-component-type`.
 */
function collectFramerComponents(node: BridgeNode, groups: Map<string, BridgeNode[]>): void {
  const componentType = node.dataAttributes?.['data-framer-component-type'];

  if (componentType && node.type === 'frame' && node.children.length > 0) {
    const list = groups.get(componentType);
    if (list) {
      list.push(node);
    } else {
      groups.set(componentType, [node]);
    }
  }

  for (const child of node.children) {
    collectFramerComponents(child, groups);
  }
}

/**
 * Merge hash-detected and Framer-detected component lists.
 *
 * Strategy:
 * - If a hash-detected component has the same hash as a Framer instance, use the Framer name
 * - Framer components that don't overlap with hash-detected are added as new entries
 * - Sort by instance count descending
 */
function mergeComponents(
  hashDetected: DetectedComponent[],
  framerDetected: DetectedComponent[],
): DetectedComponent[] {
  // Build a set of hashes covered by Framer-detected nodes
  const framerHashes = new Set<string>();
  for (const fc of framerDetected) {
    for (const inst of fc.instances) {
      if (inst.componentHash) framerHashes.add(inst.componentHash);
    }
  }

  // Keep hash-detected components that don't overlap with Framer
  const merged: DetectedComponent[] = [];

  for (const hc of hashDetected) {
    // Check if any Framer component covers the same instances
    const overlapping = framerDetected.find((fc) =>
      fc.instances.some((fi) => fi.componentHash === hc.hash),
    );

    if (overlapping) {
      // Framer name takes precedence — skip hash-detected, Framer version already added
      continue;
    }

    merged.push(hc);
  }

  // Add all Framer-detected components
  merged.push(...framerDetected);

  return merged.sort((a, b) => b.instances.length - a.instances.length);
}

/**
 * Clean a Framer component type name for Figma.
 */
function cleanComponentTypeName(typeName: string): string {
  return typeName
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase → separate
    .replace(/[-_]+/g, ' ')
    .trim();
}
