/**
 * Re-import pipeline — compares new extraction against existing Figma tree
 * and selectively updates changed nodes.
 *
 * Flow:
 * 1. Find existing import frame (by pluginData)
 * 2. Walk existing Figma tree, collect pluginData fingerprints
 * 3. Walk new BridgeNode tree, compute fingerprints
 * 4. Run diff algorithm
 * 5. Return DiffResult for UI review
 * 6. On user confirmation, apply selected changes
 *
 * Related files:
 * - Diffing logic: shared/diffing.ts
 * - Converter: figma-plugin/src/converter.ts
 * - Messages: shared/messages.ts (DiffChange, DiffSummary)
 */

import type { ExtractionResult, ImportSettings, BridgeNode } from '../../shared/types';
import type { DiffChange, DiffSummary, ImportPhase } from '../../shared/messages';
import { buildFingerprintMap, computeDiff, computeFingerprint, type ExistingFingerprintEntry } from '../../shared/diffing';
import { createFrameNode } from './nodes/frame';
import { createTextNode } from './nodes/text';
import { createImageNode } from './nodes/image';
import { createVectorNode } from './nodes/vector';
import { createAllStyles, type StyleMap } from './tokens';

type ProgressCallback = (phase: ImportPhase, progress: number, message: string) => void;

/** Find an existing import frame on the current page matching the given URL. */
export function findExistingImport(url: string): FrameNode | null {
  const children = figma.currentPage.children;
  let bestMatch: FrameNode | null = null;
  let latestTimestamp = 0;

  for (const child of children) {
    if (child.type !== 'FRAME') continue;
    const isForgeImport = child.getPluginData('forgeImport');
    if (isForgeImport !== 'true') continue;

    const storedUrl = child.getPluginData('forgeUrl');
    const storedTimestamp = parseInt(child.getPluginData('forgeTimestamp') || '0', 10);

    // Prefer exact URL match
    if (storedUrl === url) {
      if (storedTimestamp > latestTimestamp) {
        bestMatch = child;
        latestTimestamp = storedTimestamp;
      }
    }
  }

  // Fallback: if no URL match, return the most recent forge import
  if (!bestMatch) {
    for (const child of children) {
      if (child.type !== 'FRAME') continue;
      if (child.getPluginData('forgeImport') !== 'true') continue;
      const storedTimestamp = parseInt(child.getPluginData('forgeTimestamp') || '0', 10);
      if (storedTimestamp > latestTimestamp) {
        bestMatch = child;
        latestTimestamp = storedTimestamp;
      }
    }
  }

  return bestMatch;
}

/** Build the existing fingerprint map from a Figma tree's pluginData. */
export function collectExistingFingerprints(
  root: BaseNode,
): Map<string, ExistingFingerprintEntry> {
  const map = new Map<string, ExistingFingerprintEntry>();

  function walk(node: BaseNode): void {
    const path = node.getPluginData('bridgePath');
    const fingerprint = node.getPluginData('bridgeFingerprint');
    if (path && fingerprint) {
      map.set(path, { fingerprint, figmaNodeId: node.id });
    }
    if ('children' in node) {
      for (const child of (node as ChildrenMixin).children) {
        walk(child as BaseNode);
      }
    }
  }

  walk(root);
  return map;
}

/** Run the diff and return results for UI display. */
export async function computeReimportDiff(
  newResult: ExtractionResult,
  existingFrame: FrameNode,
  onProgress: ProgressCallback,
): Promise<{ changes: DiffChange[]; summary: DiffSummary }> {
  onProgress('diffing', 0, 'Building new fingerprint map...');
  const newMap = buildFingerprintMap(newResult.rootNode);

  onProgress('diffing', 0.3, 'Collecting existing fingerprints...');
  const existingMap = collectExistingFingerprints(existingFrame);

  onProgress('diffing', 0.6, 'Computing differences...');
  const result = computeDiff(newMap, existingMap);

  onProgress('diffing', 1, `Found ${result.changes.length} changes`);
  return result;
}

/** Apply selected changes: update modified nodes, insert added, mark removed. */
export async function applyDiffChanges(
  changes: DiffChange[],
  newResult: ExtractionResult,
  existingFrame: FrameNode,
  settings: ImportSettings,
  onProgress: ProgressCallback,
): Promise<{ updatedCount: number; addedCount: number; removedCount: number }> {
  const selectedChanges = changes.filter((c) => c.selected);
  let updatedCount = 0;
  let addedCount = 0;
  let removedCount = 0;

  // Build style map for new nodes
  const styleMap = await createAllStyles(
    newResult.tokens,
    settings,
    () => {},
  );

  // Build new BridgeNode map by path
  const newMap = buildFingerprintMap(newResult.rootNode);

  // Build existing Figma node map by path
  const figmaNodeMap = new Map<string, SceneNode>();
  walkFigmaNodes(existingFrame, figmaNodeMap);

  const total = selectedChanges.length;
  let processed = 0;

  for (const change of selectedChanges) {
    processed++;
    onProgress(
      'applying-diff',
      processed / total,
      `Applying change ${processed}/${total}...`,
    );

    switch (change.type) {
      case 'modified': {
        const existingNode = figmaNodeMap.get(change.id);
        const newEntry = newMap.get(change.id);
        if (existingNode && newEntry) {
          await updateNode(existingNode, newEntry.node, styleMap);
          updatedCount++;
        }
        break;
      }
      case 'added': {
        const newEntry = newMap.get(change.id);
        if (newEntry) {
          // Find parent path
          const parentPath = change.path.replace(/-\d+$/, '');
          const parentNode = figmaNodeMap.get(parentPath) ?? existingFrame;
          if ('appendChild' in parentNode) {
            const created = await createNodeFromBridge(newEntry.node, change.id, styleMap);
            if (created) {
              created.setPluginData('bridgePath', change.id);
              created.setPluginData('bridgeFingerprint', computeFingerprint(newEntry.node));
              (parentNode as FrameNode).appendChild(created);
              addedCount++;
            }
          }
        }
        break;
      }
      case 'removed': {
        const existingNode = figmaNodeMap.get(change.id);
        if (existingNode) {
          existingNode.remove();
          removedCount++;
        }
        break;
      }
    }
  }

  // Update the frame's timestamp
  existingFrame.setPluginData('forgeTimestamp', String(Date.now()));

  // Select changed nodes for visibility
  const changedNodes = selectedChanges
    .filter((c) => c.type !== 'removed')
    .map((c) => figmaNodeMap.get(c.id))
    .filter((n): n is SceneNode => n !== undefined);
  if (changedNodes.length > 0) {
    figma.currentPage.selection = changedNodes;
  }

  return { updatedCount, addedCount, removedCount };
}

function walkFigmaNodes(node: BaseNode, map: Map<string, SceneNode>): void {
  const path = node.getPluginData('bridgePath');
  if (path && 'type' in node) {
    map.set(path, node as SceneNode);
  }
  if ('children' in node) {
    for (const child of (node as ChildrenMixin).children) {
      walkFigmaNodes(child as BaseNode, map);
    }
  }
}

async function updateNode(
  existingNode: SceneNode,
  newBridgeNode: BridgeNode,
  styleMap: StyleMap,
): Promise<void> {
  // Update properties based on node type
  if (existingNode.type === 'TEXT' && newBridgeNode.type === 'text') {
    const newText = await createTextNode(newBridgeNode, styleMap, null);
    // Copy properties
    if ('characters' in existingNode) {
      try {
        await figma.loadFontAsync(existingNode.fontName as FontName);
        existingNode.characters = newBridgeNode.text ?? '';
      } catch {
        // Font load failed, skip text update
      }
    }
  } else if (existingNode.type === 'FRAME' && (newBridgeNode.type === 'frame' || newBridgeNode.type === 'unknown')) {
    // Update frame dimensions and styles
    existingNode.resize(
      Math.max(1, newBridgeNode.bounds.width),
      Math.max(1, newBridgeNode.bounds.height),
    );
  }

  // Update fingerprint
  existingNode.setPluginData('bridgeFingerprint', computeFingerprint(newBridgeNode));
}

async function createNodeFromBridge(
  node: BridgeNode,
  nodeId: string,
  styleMap: StyleMap,
): Promise<SceneNode | null> {
  switch (node.type) {
    case 'text':
      return await createTextNode(node, styleMap, null);
    case 'image':
      return await createImageNode(node, nodeId);
    case 'svg':
      return await createVectorNode(node);
    case 'frame':
    default:
      return createFrameNode(node, styleMap, null);
  }
}
