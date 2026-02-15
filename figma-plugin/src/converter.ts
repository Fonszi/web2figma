/**
 * Core converter — recursive BridgeNode → Figma node pipeline.
 *
 * Entry point: `convertToFigma(result, settings, onProgress)`
 *
 * Walks the BridgeNode tree and creates corresponding Figma nodes:
 * - frame → FrameNode (with Auto Layout)
 * - text → TextNode (with font loading)
 * - image → RectangleNode (with image fill)
 * - svg → VectorNode (via createNodeFromSvg)
 * - input → FrameNode (placeholder)
 * - video → FrameNode (placeholder)
 *
 * Related files:
 * - Node creators: figma-plugin/src/nodes/
 * - Token creators: figma-plugin/src/tokens/
 * - Component creators: figma-plugin/src/components/
 * - Types: shared/types.ts (BridgeNode, ExtractionResult, ImportSettings)
 * - Messages: shared/messages.ts (ImportPhase)
 */

import type { ExtractionResult, ImportSettings, BridgeNode } from '../../shared/types';
import type { ImportPhase } from '../../shared/messages';
import { computeFingerprint } from '../../shared/diffing';
import { createFrameNode } from './nodes/frame';
import { createTextNode } from './nodes/text';
import { createImageNode } from './nodes/image';
import { createVectorNode } from './nodes/vector';
import { createInputNode } from './nodes/input';
import { createAllStyles, type StyleMap } from './tokens';
import { detectComponents, createComponents, createInstanceNode, type ComponentMap } from './components';
import { enhanceFramerTokens, enhanceFramerComponents, getFramerName, organizeFramerSections } from './framer';

export interface ConvertResult {
  nodeCount: number;
  tokenCount: number;
  componentCount: number;
  styleCount: number;
  sectionCount: number;
}

type ProgressCallback = (phase: ImportPhase, progress: number, message: string) => void;

/**
 * Convert an ExtractionResult into Figma nodes on the current page.
 */
export async function convertToFigma(
  result: ExtractionResult,
  settings: ImportSettings,
  onProgress: ProgressCallback,
): Promise<ConvertResult> {
  onProgress('parsing', 0, 'Preparing import...');

  const isFramer = result.metadata.isFramerSite && settings.framerAwareMode;

  // --- Phase: Enhance tokens for Framer (before style creation) ---
  const tokens = isFramer ? enhanceFramerTokens(result.tokens) : result.tokens;

  // --- Phase: Create design tokens / styles ---
  onProgress('creating-styles', 0, 'Creating design tokens...');
  const styleMap = await createAllStyles(
    tokens,
    settings,
    (message, progress) => onProgress('creating-styles', progress, message),
  );

  // --- Phase: Detect and create components ---
  let componentMap: ComponentMap;
  if (settings.createComponents) {
    onProgress('creating-components', 0, 'Detecting components...');
    let detected = detectComponents(result.rootNode);

    // Enhance with Framer component boundaries
    if (isFramer) {
      detected = enhanceFramerComponents(detected, result.rootNode);
    }

    onProgress('creating-components', 0.3, `Found ${detected.length} component patterns...`);

    componentMap = await createComponents(
      detected,
      settings,
      styleMap,
      (created, total) => {
        const progress = 0.3 + (created / total) * 0.7;
        onProgress('creating-components', progress, `Creating component ${created}/${total}...`);
      },
    );
  } else {
    componentMap = { nodesByHash: new Map(), count: 0 };
  }

  // Count total nodes for progress tracking
  const totalNodes = countNodes(result.rootNode);
  let processedNodes = 0;

  // Create a top-level frame for the imported page
  const pageFrame = figma.createFrame();
  pageFrame.name = result.metadata.title || `Import from ${new URL(result.url).hostname}`;
  pageFrame.resize(
    Math.max(1, result.viewport.width),
    Math.max(1, result.viewport.height),
  );
  pageFrame.fills = [];

  // Store import metadata for re-import diffing
  pageFrame.setPluginData('forgeImport', 'true');
  pageFrame.setPluginData('forgeUrl', result.url);
  pageFrame.setPluginData('forgeTimestamp', String(result.timestamp));

  onProgress('creating-nodes', 0, `Creating ${totalNodes} nodes...`);

  // Recursively convert the BridgeNode tree
  await convertNode(
    result.rootNode,
    pageFrame,
    settings,
    0,
    'root',
    (count) => {
      processedNodes += count;
      const progress = Math.min(0.95, processedNodes / totalNodes);
      onProgress('creating-nodes', progress, `Created ${processedNodes}/${totalNodes} nodes`);
    },
    styleMap,
    componentMap,
    isFramer,
  );

  // --- Phase: Create Framer sections ---
  let sectionCount = 0;
  if (isFramer) {
    onProgress('creating-sections', 0, 'Organizing Framer sections...');
    sectionCount = organizeFramerSections(pageFrame, result.rootNode);
    onProgress('creating-sections', 1, `Created ${sectionCount} sections`);
  }

  // Position the frame at the center of the viewport
  const viewport = figma.viewport.center;
  pageFrame.x = Math.round(viewport.x - pageFrame.width / 2);
  pageFrame.y = Math.round(viewport.y - pageFrame.height / 2);

  // Select the created frame
  figma.currentPage.selection = [pageFrame];
  figma.viewport.scrollAndZoomIntoView([pageFrame]);

  onProgress('finalizing', 1, 'Done!');

  const styleCount = styleMap.colors.count + styleMap.typography.count
    + styleMap.effects.count + styleMap.variables.count;

  return {
    nodeCount: processedNodes,
    tokenCount: tokens.colors.length + tokens.typography.length + tokens.effects.length,
    componentCount: componentMap.count,
    styleCount,
    sectionCount,
  };
}

/**
 * Recursively convert a BridgeNode and append to parent.
 */
async function convertNode(
  node: BridgeNode,
  parent: FrameNode,
  settings: ImportSettings,
  depth: number,
  nodeId: string,
  onNodeCreated: (count: number) => void,
  styleMap: StyleMap,
  componentMap: ComponentMap,
  isFramer: boolean = false,
): Promise<void> {
  // Skip invisible nodes unless settings say otherwise
  if (!node.visible && !settings.includeHiddenElements) return;

  // Respect max depth
  if (depth > settings.maxDepth) return;

  // --- Component instance shortcut ---
  // If this node's hash matches a known component, create an instance instead
  // of building the entire subtree from scratch. Skip the root node (depth 0).
  if (depth > 0 && node.componentHash) {
    const componentNode = componentMap.nodesByHash.get(node.componentHash);
    if (componentNode) {
      const instance = createInstanceNode(node, componentNode);
      parent.appendChild(instance);
      // Count the entire subtree as processed (skip children)
      onNodeCreated(countNodes(node));
      return;
    }
  }

  // Framer-aware layer naming
  const framerName = isFramer ? getFramerName(node) : null;

  let figmaNode: SceneNode;

  switch (node.type) {
    case 'text': {
      figmaNode = await createTextNode(node, styleMap, framerName);
      break;
    }

    case 'image': {
      figmaNode = await createImageNode(node, nodeId);
      if (framerName) figmaNode.name = framerName;
      break;
    }

    case 'svg': {
      figmaNode = await createVectorNode(node);
      if (framerName) figmaNode.name = framerName;
      break;
    }

    case 'input': {
      figmaNode = await createInputNode(node, styleMap, framerName);
      break;
    }

    case 'frame':
    case 'video':
    case 'unknown':
    default: {
      const frame = createFrameNode(node, styleMap, framerName);

      // Recursively convert children
      let childIndex = 0;
      for (const child of node.children) {
        await convertNode(
          child,
          frame,
          settings,
          depth + 1,
          `${nodeId}-${childIndex}`,
          onNodeCreated,
          styleMap,
          componentMap,
          isFramer,
        );
        childIndex++;
      }

      figmaNode = frame;
      break;
    }
  }

  // Store diffing metadata
  figmaNode.setPluginData('bridgePath', nodeId);
  figmaNode.setPluginData('bridgeFingerprint', computeFingerprint(node));

  // Append to parent
  parent.appendChild(figmaNode);
  onNodeCreated(1);

  // Yield to Figma UI thread periodically (every 50 nodes) to keep the plugin responsive
  if (Math.random() < 0.02) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export function countNodes(node: BridgeNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}

/**
 * Convert an ExtractionResult into a Figma ComponentNode (for multi-viewport variants).
 * Same pipeline as convertToFigma but returns a ComponentNode instead of placing on page.
 * Accepts an optional pre-built StyleMap to avoid duplicate token creation across viewports.
 */
export async function convertToFigmaAsComponent(
  result: ExtractionResult,
  variantLabel: string,
  settings: ImportSettings,
  onProgress: ProgressCallback,
  existingStyleMap?: StyleMap,
): Promise<{ component: ComponentNode; counts: ConvertResult }> {
  onProgress('parsing', 0, 'Preparing import...');

  const isFramer = result.metadata.isFramerSite && settings.framerAwareMode;
  const tokens = isFramer ? enhanceFramerTokens(result.tokens) : result.tokens;

  // Use existing style map or create new one
  let styleMap: StyleMap;
  if (existingStyleMap) {
    styleMap = existingStyleMap;
  } else {
    onProgress('creating-styles', 0, 'Creating design tokens...');
    styleMap = await createAllStyles(
      tokens,
      settings,
      (message, progress) => onProgress('creating-styles', progress, message),
    );
  }

  // Detect and create components
  let componentMap: ComponentMap;
  if (settings.createComponents) {
    onProgress('creating-components', 0, 'Detecting components...');
    let detected = detectComponents(result.rootNode);
    if (isFramer) {
      detected = enhanceFramerComponents(detected, result.rootNode);
    }

    componentMap = await createComponents(
      detected,
      settings,
      styleMap,
      (created, total) => {
        const progress = 0.3 + (created / total) * 0.7;
        onProgress('creating-components', progress, `Creating component ${created}/${total}...`);
      },
    );
  } else {
    componentMap = { nodesByHash: new Map(), count: 0 };
  }

  const totalNodes = countNodes(result.rootNode);
  let processedNodes = 0;

  // Create a ComponentNode as the top-level wrapper
  const component = figma.createComponent();
  component.name = variantLabel;
  component.resize(
    Math.max(1, result.viewport.width),
    Math.max(1, result.viewport.height),
  );
  component.fills = [];

  // Store import metadata for re-import diffing
  component.setPluginData('forgeImport', 'true');
  component.setPluginData('forgeUrl', result.url);
  component.setPluginData('forgeTimestamp', String(result.timestamp));

  onProgress('creating-nodes', 0, `Creating ${totalNodes} nodes...`);

  await convertNode(
    result.rootNode,
    component,
    settings,
    0,
    'root',
    (count) => {
      processedNodes += count;
      const progress = Math.min(0.95, processedNodes / totalNodes);
      onProgress('creating-nodes', progress, `Created ${processedNodes}/${totalNodes} nodes`);
    },
    styleMap,
    componentMap,
    isFramer,
  );

  let sectionCount = 0;
  if (isFramer) {
    onProgress('creating-sections', 0, 'Organizing Framer sections...');
    sectionCount = organizeFramerSections(component as unknown as FrameNode, result.rootNode);
    onProgress('creating-sections', 1, `Created ${sectionCount} sections`);
  }

  const styleCount = styleMap.colors.count + styleMap.typography.count
    + styleMap.effects.count + styleMap.variables.count;

  return {
    component,
    counts: {
      nodeCount: processedNodes,
      tokenCount: tokens.colors.length + tokens.typography.length + tokens.effects.length,
      componentCount: componentMap.count,
      styleCount,
      sectionCount,
    },
  };
}
