/**
 * Frame node creator — creates Figma FrameNode from BridgeNode.
 *
 * Handles:
 * - Size, position, background color
 * - Border (color, width, radius)
 * - Opacity
 * - Auto Layout (direction, gap, padding, alignment, sizing modes)
 * - Nested Auto Layout
 * - Clips content (overflow: hidden)
 */

import type { BridgeNode } from '../../../shared/types';
import type { StyleMap } from '../tokens';
import { parseCssColor, isTransparent, solidPaint, parseCornerRadii, parseBoxShadow, gradientPaint } from './styles';

export function createFrameNode(node: BridgeNode, styleMap?: StyleMap, framerName?: string | null): FrameNode {
  const frame = figma.createFrame();
  frame.name = framerName || node.tag;

  // Size
  frame.resize(
    Math.max(1, Math.round(node.bounds.width)),
    Math.max(1, Math.round(node.bounds.height)),
  );

  // Background — gradient, solid, or empty
  const bgImage = node.styles.backgroundImage;
  if (bgImage && bgImage.includes('gradient(')) {
    const gradient = gradientPaint(bgImage);
    if (gradient) {
      frame.fills = [gradient];
    } else {
      frame.fills = [];
    }
  } else if (node.styles.backgroundColor && !isTransparent(node.styles.backgroundColor)) {
    const normalized = node.styles.backgroundColor.trim().toLowerCase();
    const colorStyleId = styleMap?.colors.byValue.get(normalized);
    if (colorStyleId) {
      frame.fillStyleId = colorStyleId;
    } else {
      const paint = solidPaint(node.styles.backgroundColor);
      if (paint) frame.fills = [paint];
    }
  } else {
    frame.fills = [];
  }

  // Opacity
  if (node.styles.opacity) {
    const opacity = parseFloat(node.styles.opacity);
    if (!isNaN(opacity) && opacity < 1) {
      frame.opacity = opacity;
    }
  }

  // Border
  applyBorder(frame, node);

  // Corner radius
  const radii = parseCornerRadii(node.styles);
  if (radii) {
    frame.topLeftRadius = radii[0];
    frame.topRightRadius = radii[1];
    frame.bottomRightRadius = radii[2];
    frame.bottomLeftRadius = radii[3];
  }

  // Box shadow — link to EffectStyle if available, else raw effect
  if (node.styles.boxShadow) {
    const normalizedShadow = node.styles.boxShadow.trim();
    const effectStyleId = styleMap?.effects.byValue.get(normalizedShadow);
    if (effectStyleId) {
      frame.effectStyleId = effectStyleId;
    } else {
      const shadow = parseBoxShadow(node.styles.boxShadow);
      if (shadow) frame.effects = [shadow];
    }
  }

  // CSS Transform → rotation
  if (node.styles.transform && node.styles.transform !== 'none') {
    applyTransform(frame, node.styles.transform);
  }

  // Clips content
  if (node.styles.overflow === 'hidden') {
    frame.clipsContent = true;
  }

  // Auto Layout
  if (node.layout.isAutoLayout) {
    applyAutoLayout(frame, node);
  }

  return frame;
}

function applyBorder(frame: FrameNode, node: BridgeNode): void {
  const borderWidth = parseFloat(node.styles.borderWidth ?? '0');
  if (borderWidth <= 0) return;

  const borderColor = node.styles.borderColor;
  if (!borderColor || isTransparent(borderColor)) return;

  const paint = solidPaint(borderColor);
  if (paint) {
    frame.strokes = [paint];
    frame.strokeWeight = borderWidth;
  }
}

function applyAutoLayout(frame: FrameNode, node: BridgeNode): void {
  const direction = node.layout.direction;

  frame.layoutMode = direction === 'vertical' ? 'VERTICAL' : 'HORIZONTAL';
  frame.itemSpacing = node.layout.gap;

  // Padding
  frame.paddingTop = node.layout.padding.top;
  frame.paddingRight = node.layout.padding.right;
  frame.paddingBottom = node.layout.padding.bottom;
  frame.paddingLeft = node.layout.padding.left;

  // Primary axis alignment (justify-content)
  switch (node.layout.mainAxisAlignment) {
    case 'center': frame.primaryAxisAlignItems = 'CENTER'; break;
    case 'end': frame.primaryAxisAlignItems = 'MAX'; break;
    case 'space-between': frame.primaryAxisAlignItems = 'SPACE_BETWEEN'; break;
    default: frame.primaryAxisAlignItems = 'MIN'; break;
  }

  // Cross axis alignment (align-items)
  switch (node.layout.crossAxisAlignment) {
    case 'center': frame.counterAxisAlignItems = 'CENTER'; break;
    case 'end': frame.counterAxisAlignItems = 'MAX'; break;
    default: frame.counterAxisAlignItems = 'MIN'; break;
  }

  // Sizing modes
  applySizing(frame, node);

  // Wrap
  if (node.layout.wrap) {
    frame.layoutWrap = 'WRAP';
  }
}

/** Parse CSS transform matrix/rotate and apply rotation to the frame. */
function applyTransform(frame: FrameNode, transform: string): void {
  // Try rotate() first: e.g. "rotate(45deg)"
  const rotateMatch = transform.match(/rotate\(\s*(-?[\d.]+)deg\s*\)/);
  if (rotateMatch) {
    frame.rotation = -parseFloat(rotateMatch[1]); // Figma uses counter-clockwise
    return;
  }

  // Try matrix(): extract rotation from 2D matrix(a, b, c, d, tx, ty)
  const matrixMatch = transform.match(/matrix\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/);
  if (matrixMatch) {
    const a = parseFloat(matrixMatch[1]);
    const b = parseFloat(matrixMatch[2]);
    const angleDeg = Math.atan2(b, a) * (180 / Math.PI);
    if (Math.abs(angleDeg) > 0.01) {
      frame.rotation = -angleDeg; // Figma uses counter-clockwise
    }
  }
}

function applySizing(frame: FrameNode, node: BridgeNode): void {
  const { width: wMode, height: hMode } = node.layout.sizing;

  // Primary axis sizing (along the layout direction)
  if (frame.layoutMode === 'HORIZONTAL') {
    frame.primaryAxisSizingMode = wMode === 'hug' ? 'AUTO' : 'FIXED';
    frame.counterAxisSizingMode = hMode === 'hug' ? 'AUTO' : 'FIXED';
  } else {
    frame.primaryAxisSizingMode = hMode === 'hug' ? 'AUTO' : 'FIXED';
    frame.counterAxisSizingMode = wMode === 'hug' ? 'AUTO' : 'FIXED';
  }
}
