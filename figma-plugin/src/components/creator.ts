/**
 * Component creator — creates Figma ComponentNode and InstanceNode from detected components.
 *
 * Flow:
 * 1. For each DetectedComponent, create the representative as a Figma ComponentNode
 * 2. Build a ComponentMap (hash → componentId) for the converter to use
 * 3. During node creation, the converter checks the map — if a hash matches,
 *    it creates an InstanceNode instead of building the subtree from scratch
 *
 * Related files:
 * - Detector: figma-plugin/src/components/detector.ts
 * - Converter: figma-plugin/src/converter.ts
 * - Node creators: figma-plugin/src/nodes/
 */

import type { DetectedComponent, BridgeNode, ImportSettings } from '../../../shared/types';
import type { StyleMap } from '../tokens';
import { createFrameNode } from '../nodes/frame';
import { createTextNode } from '../nodes/text';
import { createImageNode } from '../nodes/image';
import { createVectorNode } from '../nodes/vector';

export interface ComponentMap {
  /** Map from componentHash → Figma ComponentNode ID. */
  byHash: Map<string, string>;
  /** The actual ComponentNode objects for creating instances. */
  nodesByHash: Map<string, ComponentNode>;
  /** Number of components created. */
  count: number;
}

/**
 * Create Figma components from detected component patterns.
 * Returns a map the converter uses to instantiate matching nodes.
 */
export async function createComponents(
  components: DetectedComponent[],
  settings: ImportSettings,
  styleMap: StyleMap,
  onProgress?: (created: number, total: number) => void,
): Promise<ComponentMap> {
  const byHash = new Map<string, string>();
  const nodesByHash = new Map<string, ComponentNode>();

  if (!settings.createComponents) {
    return { byHash, nodesByHash, count: 0 };
  }

  for (let i = 0; i < components.length; i++) {
    const comp = components[i]!;

    try {
      const componentNode = await buildComponentNode(comp, settings, styleMap);
      // Move to a components page area (off-screen, above the main import)
      componentNode.x = i * (componentNode.width + 40);
      componentNode.y = -componentNode.height - 100;

      byHash.set(comp.hash, componentNode.id);
      nodesByHash.set(comp.hash, componentNode);
    } catch {
      // Skip failed component creation
    }

    onProgress?.(i + 1, components.length);
  }

  return { byHash, nodesByHash, count: byHash.size };
}

/**
 * Build a Figma ComponentNode from a DetectedComponent's representative node.
 */
async function buildComponentNode(
  comp: DetectedComponent,
  settings: ImportSettings,
  styleMap: StyleMap,
): Promise<ComponentNode> {
  const node = comp.representativeNode;

  // Create the component wrapper
  const component = figma.createComponent();
  component.name = comp.name;
  component.resize(
    Math.max(1, Math.round(node.bounds.width)),
    Math.max(1, Math.round(node.bounds.height)),
  );

  // Build the internal structure from the representative node
  await buildSubtree(node, component, settings, styleMap, 0);

  return component;
}

/**
 * Recursively build a Figma subtree inside a component.
 * Similar to converter's convertNode but without component detection (to avoid recursion).
 */
async function buildSubtree(
  node: BridgeNode,
  parent: FrameNode | ComponentNode,
  settings: ImportSettings,
  styleMap: StyleMap,
  depth: number,
): Promise<void> {
  if (!node.visible && !settings.includeHiddenElements) return;
  if (depth > settings.maxDepth) return;

  let figmaNode: SceneNode;

  switch (node.type) {
    case 'text': {
      figmaNode = await createTextNode(node, styleMap);
      break;
    }
    case 'image': {
      figmaNode = await createImageNode(node, `comp-${depth}`);
      break;
    }
    case 'svg': {
      figmaNode = await createVectorNode(node);
      break;
    }
    default: {
      const frame = createFrameNode(node, styleMap);
      for (const child of node.children) {
        await buildSubtree(child, frame, settings, styleMap, depth + 1);
      }
      figmaNode = frame;
      break;
    }
  }

  parent.appendChild(figmaNode);
}

/**
 * Create an InstanceNode from a component for a matching BridgeNode.
 * The instance is positioned and sized to match the original node.
 */
export function createInstanceNode(
  node: BridgeNode,
  componentNode: ComponentNode,
): InstanceNode {
  const instance = componentNode.createInstance();
  instance.name = node.tag;
  instance.resize(
    Math.max(1, Math.round(node.bounds.width)),
    Math.max(1, Math.round(node.bounds.height)),
  );
  return instance;
}
