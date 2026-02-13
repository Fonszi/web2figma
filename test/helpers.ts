/**
 * Test helpers — factory functions for building BridgeNode trees.
 */

import type { BridgeNode, LayoutInfo, ComputedStyles, BoundingBox } from '../shared/types';

const DEFAULT_STYLES: ComputedStyles = {};

const DEFAULT_LAYOUT: LayoutInfo = {
  isAutoLayout: false,
  direction: 'none',
  wrap: false,
  gap: 0,
  padding: { top: 0, right: 0, bottom: 0, left: 0 },
  sizing: { width: 'fixed', height: 'fixed' },
  mainAxisAlignment: 'start',
  crossAxisAlignment: 'start',
};

const DEFAULT_BOUNDS: BoundingBox = { x: 0, y: 0, width: 100, height: 50 };

/** Create a frame BridgeNode with sensible defaults. */
export function makeFrame(overrides: Partial<BridgeNode> = {}): BridgeNode {
  return {
    tag: 'div',
    type: 'frame',
    children: [],
    styles: { ...DEFAULT_STYLES },
    layout: { ...DEFAULT_LAYOUT },
    bounds: { ...DEFAULT_BOUNDS },
    visible: true,
    ...overrides,
  };
}

/** Create a text BridgeNode. */
export function makeText(text: string, overrides: Partial<BridgeNode> = {}): BridgeNode {
  return {
    tag: 'span',
    type: 'text',
    children: [],
    text,
    styles: { ...DEFAULT_STYLES, fontFamily: 'Inter', fontSize: '16', fontWeight: '400' },
    layout: { ...DEFAULT_LAYOUT },
    bounds: { ...DEFAULT_BOUNDS, width: 80, height: 20 },
    visible: true,
    ...overrides,
  };
}

/** Create an image BridgeNode. */
export function makeImage(overrides: Partial<BridgeNode> = {}): BridgeNode {
  return {
    tag: 'img',
    type: 'image',
    children: [],
    styles: { ...DEFAULT_STYLES },
    layout: { ...DEFAULT_LAYOUT },
    bounds: { ...DEFAULT_BOUNDS, width: 200, height: 150 },
    visible: true,
    ...overrides,
  };
}

/** Create an SVG BridgeNode. */
export function makeSvg(svgData: string = '<svg></svg>', overrides: Partial<BridgeNode> = {}): BridgeNode {
  return {
    tag: 'svg',
    type: 'svg',
    children: [],
    svgData,
    styles: { ...DEFAULT_STYLES },
    layout: { ...DEFAULT_LAYOUT },
    bounds: { ...DEFAULT_BOUNDS, width: 24, height: 24 },
    visible: true,
    ...overrides,
  };
}
