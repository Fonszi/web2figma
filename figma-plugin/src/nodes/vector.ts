/**
 * Vector/SVG node creator — creates Figma nodes from SVG data in BridgeNode.
 *
 * Uses `figma.createNodeFromSvg()` when available (Figma API).
 * Falls back to creating a placeholder rectangle if SVG parsing fails.
 */

import type { BridgeNode } from '../../../shared/types';

export async function createVectorNode(node: BridgeNode): Promise<SceneNode> {
  if (!node.svgData) {
    return createSvgPlaceholder(node);
  }

  try {
    // figma.createNodeFromSvg() parses SVG and creates VectorNode(s)
    const svgNode = figma.createNodeFromSvg(node.svgData);
    svgNode.name = node.tag === 'svg' ? 'SVG' : node.tag;

    // Resize to match the original bounds
    if (node.bounds.width > 0 && node.bounds.height > 0) {
      svgNode.resize(
        Math.round(node.bounds.width),
        Math.round(node.bounds.height),
      );
    }

    return svgNode;
  } catch {
    // SVG parsing failed — create placeholder
    return createSvgPlaceholder(node);
  }
}

function createSvgPlaceholder(node: BridgeNode): RectangleNode {
  const rect = figma.createRectangle();
  rect.name = 'SVG (placeholder)';
  rect.resize(
    Math.max(1, Math.round(node.bounds.width || 24)),
    Math.max(1, Math.round(node.bounds.height || 24)),
  );
  rect.fills = [
    {
      type: 'SOLID',
      color: { r: 0.85, g: 0.85, b: 0.95 },
      opacity: 1,
    },
  ];
  rect.strokes = [
    {
      type: 'SOLID',
      color: { r: 0.6, g: 0.6, b: 0.8 },
      opacity: 1,
    },
  ];
  rect.strokeWeight = 1;
  rect.dashPattern = [3, 3];
  return rect;
}
