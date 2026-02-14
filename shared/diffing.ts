// ============================================================
// BridgeNode Diffing — Pure functions for tree comparison.
//
// Used by: figma-plugin/src/reimporter.ts
// Fingerprints stored via: node.setPluginData() in converter.ts
//
// No Figma API dependency — safe to use in both extension and plugin.
// ============================================================

import type { BridgeNode } from './types';
import type { DiffChange, DiffSummary } from './messages';

/** FNV-1a 32-bit hash — fast, no crypto dependency. */
export function simpleHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Compute a coarse fingerprint for a BridgeNode. */
export function computeFingerprint(node: BridgeNode): string {
  const parts = [
    node.type,
    node.tag,
    node.text ?? '',
    `${Math.round(node.bounds.width)}x${Math.round(node.bounds.height)}`,
    node.styles.backgroundColor ?? '',
    node.styles.color ?? '',
    node.styles.fontSize ?? '',
    node.componentHash ?? '',
  ];
  return simpleHash(parts.join('|'));
}

export interface FingerprintEntry {
  fingerprint: string;
  node: BridgeNode;
}

/** Build a path-to-fingerprint map for the entire BridgeNode tree. */
export function buildFingerprintMap(
  root: BridgeNode,
  pathPrefix: string = 'root',
): Map<string, FingerprintEntry> {
  const map = new Map<string, FingerprintEntry>();

  function walk(node: BridgeNode, path: string): void {
    map.set(path, {
      fingerprint: computeFingerprint(node),
      node,
    });
    for (let i = 0; i < node.children.length; i++) {
      walk(node.children[i], `${path}-${i}`);
    }
  }

  walk(root, pathPrefix);
  return map;
}

export interface ExistingFingerprintEntry {
  fingerprint: string;
  figmaNodeId: string;
}

/** Compare new fingerprint map against existing (from Figma pluginData). */
export function computeDiff(
  newMap: Map<string, FingerprintEntry>,
  existingMap: Map<string, ExistingFingerprintEntry>,
): { changes: DiffChange[]; summary: DiffSummary } {
  const changes: DiffChange[] = [];
  let modifiedCount = 0;
  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;

  // Check new nodes against existing
  for (const [path, entry] of newMap) {
    const existing = existingMap.get(path);
    if (!existing) {
      addedCount++;
      changes.push({
        id: path,
        type: 'added',
        path,
        nodeType: entry.node.type,
        description: describeNode(entry.node, 'added'),
        selected: true,
      });
    } else if (existing.fingerprint !== entry.fingerprint) {
      modifiedCount++;
      changes.push({
        id: path,
        type: 'modified',
        path,
        nodeType: entry.node.type,
        description: describeNode(entry.node, 'modified'),
        selected: true,
      });
    } else {
      unchangedCount++;
    }
  }

  // Check for removed nodes (in existing but not in new)
  for (const [path] of existingMap) {
    if (!newMap.has(path)) {
      removedCount++;
      changes.push({
        id: path,
        type: 'removed',
        path,
        nodeType: 'unknown',
        description: `Node at ${path} removed`,
        selected: true,
      });
    }
  }

  const totalNodes = newMap.size;
  return {
    changes,
    summary: { totalNodes, modifiedCount, addedCount, removedCount, unchangedCount },
  };
}

function describeNode(node: BridgeNode, changeType: 'added' | 'modified'): string {
  const label = node.text
    ? `"${node.text.slice(0, 30)}${node.text.length > 30 ? '...' : ''}"`
    : `<${node.tag}>`;
  return changeType === 'added'
    ? `New ${node.type} ${label}`
    : `Changed ${node.type} ${label}`;
}
