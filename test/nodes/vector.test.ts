import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupFigmaMock, teardownFigmaMock, mockStore } from '../figma-mock';
import { createVectorNode } from '../../figma-plugin/src/nodes/vector';
import { makeSvg, makeFrame } from '../helpers';

describe('createVectorNode', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  it('creates SVG node from valid svgData', async () => {
    const node = makeSvg('<svg><circle r="10"/></svg>', {
      bounds: { x: 0, y: 0, width: 24, height: 24 },
    });
    const result = await createVectorNode(node);
    expect(result.name).toBe('SVG');
  });

  it('resizes SVG node to match bounds', async () => {
    const node = makeSvg('<svg><rect/></svg>', {
      bounds: { x: 0, y: 0, width: 48, height: 48 },
    });
    const result = await createVectorNode(node);
    // The mock's createNodeFromSvg creates a frame, resize sets width/height
    expect(result.width).toBe(48);
    expect(result.height).toBe(48);
  });

  it('does not resize when bounds are zero', async () => {
    const node = makeSvg('<svg></svg>', {
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    });
    const result = await createVectorNode(node);
    // Should not crash; width/height stay at mock default (0)
    expect(result.name).toBe('SVG');
  });

  it('creates placeholder when no svgData', async () => {
    const node = makeFrame({ type: 'svg' as any, svgData: undefined });
    const result = await createVectorNode(node);

    expect(result.name).toBe('SVG (placeholder)');
    expect(result.type).toBe('RECTANGLE');
  });

  it('placeholder has light blue fill', async () => {
    const node = makeFrame({ type: 'svg' as any });
    const result = await createVectorNode(node);

    const fills = (result as any).fills;
    expect(fills).toHaveLength(1);
    expect(fills[0].color.r).toBeCloseTo(0.85);
    expect(fills[0].color.b).toBeCloseTo(0.95);
  });

  it('placeholder has dashed stroke', async () => {
    const node = makeFrame({ type: 'svg' as any });
    const result = await createVectorNode(node);

    expect((result as any).strokes).toHaveLength(1);
    expect((result as any).dashPattern).toEqual([3, 3]);
  });

  it('creates placeholder when SVG parsing fails', async () => {
    // Override createNodeFromSvg to throw
    (globalThis as any).figma.createNodeFromSvg = vi.fn(() => {
      throw new Error('Invalid SVG');
    });

    const node = makeSvg('<svg>invalid</svg>');
    const result = await createVectorNode(node);

    expect(result.name).toBe('SVG (placeholder)');
    expect(result.type).toBe('RECTANGLE');
  });

  it('uses tag name for non-svg elements', async () => {
    const node = makeSvg('<svg></svg>', { tag: 'icon' });
    const result = await createVectorNode(node);
    expect(result.name).toBe('icon');
  });

  it('placeholder defaults to 24x24 when bounds are zero', async () => {
    const node = makeFrame({
      type: 'svg' as any,
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    });
    const result = await createVectorNode(node);

    expect(result.width).toBe(24);
    expect(result.height).toBe(24);
  });
});
