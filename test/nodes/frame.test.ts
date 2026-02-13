import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupFigmaMock, teardownFigmaMock, mockStore } from '../figma-mock';
import { createFrameNode } from '../../figma-plugin/src/nodes/frame';
import { makeFrame } from '../helpers';
import type { StyleMap } from '../../figma-plugin/src/tokens';

function emptyStyleMap(): StyleMap {
  return {
    colors: { byValue: new Map(), byVariable: new Map(), count: 0 },
    typography: { byKey: new Map(), count: 0 },
    effects: { byValue: new Map(), count: 0 },
    variables: { count: 0 },
  };
}

describe('createFrameNode', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  // --- Naming ---

  it('uses tag as name by default', () => {
    const node = makeFrame({ tag: 'section' });
    const frame = createFrameNode(node);
    expect(frame.name).toBe('section');
  });

  it('uses framerName when provided', () => {
    const node = makeFrame({ tag: 'div' });
    const frame = createFrameNode(node, undefined, 'Hero Section');
    expect(frame.name).toBe('Hero Section');
  });

  it('falls back to tag when framerName is null', () => {
    const node = makeFrame({ tag: 'nav' });
    const frame = createFrameNode(node, undefined, null);
    expect(frame.name).toBe('nav');
  });

  // --- Sizing ---

  it('sets size from bounds', () => {
    const node = makeFrame({ bounds: { x: 0, y: 0, width: 300, height: 200 } });
    const frame = createFrameNode(node);
    expect(frame.width).toBe(300);
    expect(frame.height).toBe(200);
  });

  it('clamps size to minimum 1px', () => {
    const node = makeFrame({ bounds: { x: 0, y: 0, width: 0, height: 0 } });
    const frame = createFrameNode(node);
    expect(frame.width).toBe(1);
    expect(frame.height).toBe(1);
  });

  it('rounds fractional sizes', () => {
    const node = makeFrame({ bounds: { x: 0, y: 0, width: 100.7, height: 50.3 } });
    const frame = createFrameNode(node);
    expect(frame.width).toBe(101);
    expect(frame.height).toBe(50);
  });

  // --- Background color ---

  it('sets empty fills when no background', () => {
    const node = makeFrame();
    const frame = createFrameNode(node);
    expect(frame.fills).toEqual([]);
  });

  it('sets empty fills for transparent background', () => {
    const node = makeFrame({ styles: { backgroundColor: 'transparent' } });
    const frame = createFrameNode(node);
    expect(frame.fills).toEqual([]);
  });

  it('links to paint style when available in styleMap', () => {
    const styleMap = emptyStyleMap();
    styleMap.colors.byValue.set('rgb(255, 0, 0)', 'style-id-red');
    const node = makeFrame({ styles: { backgroundColor: 'rgb(255, 0, 0)' } });
    const frame = createFrameNode(node, styleMap);
    expect(frame.fillStyleId).toBe('style-id-red');
  });

  it('creates raw paint when no style match', () => {
    const node = makeFrame({ styles: { backgroundColor: 'rgb(255, 0, 0)' } });
    const frame = createFrameNode(node);
    expect(frame.fills).toHaveLength(1);
    expect((frame.fills as any)[0].type).toBe('SOLID');
  });

  // --- Opacity ---

  it('sets opacity when < 1', () => {
    const node = makeFrame({ styles: { opacity: '0.5' } });
    const frame = createFrameNode(node);
    expect(frame.opacity).toBe(0.5);
  });

  it('keeps default opacity when 1', () => {
    const node = makeFrame({ styles: { opacity: '1' } });
    const frame = createFrameNode(node);
    expect(frame.opacity).toBe(1);
  });

  it('ignores non-numeric opacity', () => {
    const node = makeFrame({ styles: { opacity: 'auto' } });
    const frame = createFrameNode(node);
    expect(frame.opacity).toBe(1);
  });

  // --- Border ---

  it('applies border with valid color and width', () => {
    const node = makeFrame({
      styles: { borderWidth: '2', borderColor: 'rgb(0, 0, 0)' },
    });
    const frame = createFrameNode(node);
    expect(frame.strokes).toHaveLength(1);
    expect(frame.strokeWeight).toBe(2);
  });

  it('skips border when width is 0', () => {
    const node = makeFrame({
      styles: { borderWidth: '0', borderColor: 'rgb(0, 0, 0)' },
    });
    const frame = createFrameNode(node);
    expect(frame.strokes).toEqual([]);
  });

  it('skips border when color is transparent', () => {
    const node = makeFrame({
      styles: { borderWidth: '2', borderColor: 'transparent' },
    });
    const frame = createFrameNode(node);
    expect(frame.strokes).toEqual([]);
  });

  // --- Corner radius ---

  it('sets corner radii from styles', () => {
    const node = makeFrame({
      styles: {
        borderTopLeftRadius: '4px',
        borderTopRightRadius: '8px',
        borderBottomRightRadius: '12px',
        borderBottomLeftRadius: '16px',
      },
    });
    const frame = createFrameNode(node);
    expect(frame.topLeftRadius).toBe(4);
    expect(frame.topRightRadius).toBe(8);
    expect(frame.bottomRightRadius).toBe(12);
    expect(frame.bottomLeftRadius).toBe(16);
  });

  it('keeps zero radii when no border-radius', () => {
    const node = makeFrame();
    const frame = createFrameNode(node);
    expect(frame.topLeftRadius).toBe(0);
  });

  // --- Box shadow ---

  it('links to effect style when available', () => {
    const styleMap = emptyStyleMap();
    styleMap.effects.byValue.set('0px 4px 6px rgba(0, 0, 0, 0.1)', 'effect-id-shadow');
    const node = makeFrame({ styles: { boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)' } });
    const frame = createFrameNode(node, styleMap);
    expect(frame.effectStyleId).toBe('effect-id-shadow');
  });

  it('creates raw effect when no style match', () => {
    const node = makeFrame({ styles: { boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)' } });
    const frame = createFrameNode(node);
    expect(frame.effects).toHaveLength(1);
    expect((frame.effects as any)[0].type).toBe('DROP_SHADOW');
  });

  // --- Overflow / clips ---

  it('clips content when overflow is hidden', () => {
    const node = makeFrame({ styles: { overflow: 'hidden' } });
    const frame = createFrameNode(node);
    expect(frame.clipsContent).toBe(true);
  });

  it('does not clip by default', () => {
    const node = makeFrame();
    const frame = createFrameNode(node);
    expect(frame.clipsContent).toBe(false);
  });

  // --- Auto Layout ---

  it('applies horizontal auto layout', () => {
    const node = makeFrame({
      layout: {
        isAutoLayout: true,
        direction: 'horizontal',
        wrap: false,
        gap: 8,
        padding: { top: 10, right: 20, bottom: 10, left: 20 },
        sizing: { width: 'fixed', height: 'fixed' },
        mainAxisAlignment: 'start',
        crossAxisAlignment: 'start',
      },
    });
    const frame = createFrameNode(node);
    expect(frame.layoutMode).toBe('HORIZONTAL');
    expect(frame.itemSpacing).toBe(8);
    expect(frame.paddingTop).toBe(10);
    expect(frame.paddingRight).toBe(20);
  });

  it('applies vertical auto layout', () => {
    const node = makeFrame({
      layout: {
        isAutoLayout: true,
        direction: 'vertical',
        wrap: false,
        gap: 16,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        sizing: { width: 'fixed', height: 'fixed' },
        mainAxisAlignment: 'start',
        crossAxisAlignment: 'start',
      },
    });
    const frame = createFrameNode(node);
    expect(frame.layoutMode).toBe('VERTICAL');
    expect(frame.itemSpacing).toBe(16);
  });

  it('does not apply auto layout when isAutoLayout is false', () => {
    const node = makeFrame();
    const frame = createFrameNode(node);
    expect(frame.layoutMode).toBe('NONE');
  });

  // --- Alignment mapping ---

  it('maps mainAxisAlignment center → CENTER', () => {
    const node = makeFrame({
      layout: {
        isAutoLayout: true,
        direction: 'horizontal',
        wrap: false,
        gap: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        sizing: { width: 'fixed', height: 'fixed' },
        mainAxisAlignment: 'center',
        crossAxisAlignment: 'start',
      },
    });
    const frame = createFrameNode(node);
    expect(frame.primaryAxisAlignItems).toBe('CENTER');
  });

  it('maps mainAxisAlignment end → MAX', () => {
    const node = makeFrame({
      layout: {
        isAutoLayout: true,
        direction: 'horizontal',
        wrap: false,
        gap: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        sizing: { width: 'fixed', height: 'fixed' },
        mainAxisAlignment: 'end',
        crossAxisAlignment: 'start',
      },
    });
    const frame = createFrameNode(node);
    expect(frame.primaryAxisAlignItems).toBe('MAX');
  });

  it('maps mainAxisAlignment space-between → SPACE_BETWEEN', () => {
    const node = makeFrame({
      layout: {
        isAutoLayout: true,
        direction: 'horizontal',
        wrap: false,
        gap: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        sizing: { width: 'fixed', height: 'fixed' },
        mainAxisAlignment: 'space-between',
        crossAxisAlignment: 'start',
      },
    });
    const frame = createFrameNode(node);
    expect(frame.primaryAxisAlignItems).toBe('SPACE_BETWEEN');
  });

  it('maps crossAxisAlignment center → CENTER', () => {
    const node = makeFrame({
      layout: {
        isAutoLayout: true,
        direction: 'horizontal',
        wrap: false,
        gap: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        sizing: { width: 'fixed', height: 'fixed' },
        mainAxisAlignment: 'start',
        crossAxisAlignment: 'center',
      },
    });
    const frame = createFrameNode(node);
    expect(frame.counterAxisAlignItems).toBe('CENTER');
  });

  it('maps crossAxisAlignment end → MAX', () => {
    const node = makeFrame({
      layout: {
        isAutoLayout: true,
        direction: 'horizontal',
        wrap: false,
        gap: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        sizing: { width: 'fixed', height: 'fixed' },
        mainAxisAlignment: 'start',
        crossAxisAlignment: 'end',
      },
    });
    const frame = createFrameNode(node);
    expect(frame.counterAxisAlignItems).toBe('MAX');
  });

  // --- Sizing modes ---

  it('sets hug sizing to AUTO for horizontal layout', () => {
    const node = makeFrame({
      layout: {
        isAutoLayout: true,
        direction: 'horizontal',
        wrap: false,
        gap: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        sizing: { width: 'hug', height: 'hug' },
        mainAxisAlignment: 'start',
        crossAxisAlignment: 'start',
      },
    });
    const frame = createFrameNode(node);
    expect(frame.primaryAxisSizingMode).toBe('AUTO');
    expect(frame.counterAxisSizingMode).toBe('AUTO');
  });

  it('sets fixed sizing to FIXED', () => {
    const node = makeFrame({
      layout: {
        isAutoLayout: true,
        direction: 'horizontal',
        wrap: false,
        gap: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        sizing: { width: 'fixed', height: 'fixed' },
        mainAxisAlignment: 'start',
        crossAxisAlignment: 'start',
      },
    });
    const frame = createFrameNode(node);
    expect(frame.primaryAxisSizingMode).toBe('FIXED');
    expect(frame.counterAxisSizingMode).toBe('FIXED');
  });

  it('swaps axes for vertical layout sizing', () => {
    const node = makeFrame({
      layout: {
        isAutoLayout: true,
        direction: 'vertical',
        wrap: false,
        gap: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        sizing: { width: 'hug', height: 'fixed' },
        mainAxisAlignment: 'start',
        crossAxisAlignment: 'start',
      },
    });
    const frame = createFrameNode(node);
    // vertical: primary = height, counter = width
    expect(frame.primaryAxisSizingMode).toBe('FIXED');
    expect(frame.counterAxisSizingMode).toBe('AUTO');
  });

  // --- Wrap ---

  it('enables layout wrap', () => {
    const node = makeFrame({
      layout: {
        isAutoLayout: true,
        direction: 'horizontal',
        wrap: true,
        gap: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        sizing: { width: 'fixed', height: 'fixed' },
        mainAxisAlignment: 'start',
        crossAxisAlignment: 'start',
      },
    });
    const frame = createFrameNode(node);
    expect(frame.layoutWrap).toBe('WRAP');
  });

  it('does not wrap by default', () => {
    const node = makeFrame({
      layout: {
        isAutoLayout: true,
        direction: 'horizontal',
        wrap: false,
        gap: 0,
        padding: { top: 0, right: 0, bottom: 0, left: 0 },
        sizing: { width: 'fixed', height: 'fixed' },
        mainAxisAlignment: 'start',
        crossAxisAlignment: 'start',
      },
    });
    const frame = createFrameNode(node);
    expect(frame.layoutWrap).toBe('NO_WRAP');
  });
});
