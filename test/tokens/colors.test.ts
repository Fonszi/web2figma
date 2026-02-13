import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupFigmaMock, teardownFigmaMock, mockStore } from '../figma-mock';
import { createColorStyles } from '../../figma-plugin/src/tokens/colors';
import { resetNameTracker } from '../../figma-plugin/src/tokens/naming';
import type { ColorToken } from '../../shared/types';

describe('createColorStyles', () => {
  beforeEach(() => {
    setupFigmaMock();
    resetNameTracker();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  it('creates PaintStyles from color tokens', async () => {
    const tokens: ColorToken[] = [
      { name: 'color/ff0000', value: 'rgb(255, 0, 0)', usageCount: 5 },
      { name: 'color/00ff00', value: 'rgb(0, 255, 0)', usageCount: 3 },
    ];

    const result = await createColorStyles(tokens);

    expect(result.count).toBe(2);
    expect(result.byValue.size).toBe(2);
    expect(mockStore.paintStyles).toHaveLength(2);
  });

  it('sets correct paints on style', async () => {
    const tokens: ColorToken[] = [
      { name: 'color/ff0000', value: 'rgb(255, 0, 0)', usageCount: 1 },
    ];

    await createColorStyles(tokens);

    const style = mockStore.paintStyles[0]!;
    expect(style.paints).toEqual([
      { type: 'SOLID', color: { r: 1, g: 0, b: 0 }, opacity: 1 },
    ]);
  });

  it('deduplicates same color values', async () => {
    const tokens: ColorToken[] = [
      { name: 'a', value: 'rgb(255, 0, 0)', usageCount: 5 },
      { name: 'b', value: 'rgb(255, 0, 0)', usageCount: 3 },
      { name: 'c', value: 'RGB(255, 0, 0)', usageCount: 1 },
    ];

    const result = await createColorStyles(tokens);

    expect(result.count).toBe(1);
    expect(mockStore.paintStyles).toHaveLength(1);
  });

  it('skips unparseable colors', async () => {
    const tokens: ColorToken[] = [
      { name: 'a', value: 'hsl(120, 100%, 50%)', usageCount: 5 },
      { name: 'b', value: 'rgb(0, 0, 255)', usageCount: 3 },
    ];

    const result = await createColorStyles(tokens);

    expect(result.count).toBe(1);
    expect(mockStore.paintStyles).toHaveLength(1);
  });

  it('returns empty map for empty tokens', async () => {
    const result = await createColorStyles([]);

    expect(result.count).toBe(0);
    expect(result.byValue.size).toBe(0);
  });

  it('caps at 200 styles', async () => {
    const tokens: ColorToken[] = Array.from({ length: 250 }, (_, i) => ({
      name: `color-${i}`,
      value: `rgb(${i % 256}, ${(i * 2) % 256}, ${(i * 3) % 256})`,
      usageCount: 1,
    }));

    const result = await createColorStyles(tokens);

    // Some colors may collide after normalization, so count <= 200
    expect(result.count).toBeLessThanOrEqual(200);
  });

  it('uses CSS variable name when available', async () => {
    const tokens: ColorToken[] = [
      { name: 'color/ff0000', value: 'rgb(255, 0, 0)', usageCount: 5, cssVariable: '--brand-red' },
    ];

    await createColorStyles(tokens);

    expect(mockStore.paintStyles[0]!.name).toBe('brand/red');
  });

  it('calls progress callback', async () => {
    const tokens: ColorToken[] = [
      { name: 'a', value: 'rgb(255, 0, 0)', usageCount: 1 },
      { name: 'b', value: 'rgb(0, 255, 0)', usageCount: 1 },
    ];

    const progress = vi.fn();
    await createColorStyles(tokens, progress);

    expect(progress).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenCalledWith(1, 2);
    expect(progress).toHaveBeenCalledWith(2, 2);
  });

  it('maps normalized value to style ID', async () => {
    const tokens: ColorToken[] = [
      { name: 'a', value: 'rgb(100, 200, 50)', usageCount: 1 },
    ];

    const result = await createColorStyles(tokens);
    const styleId = result.byValue.get('rgb(100, 200, 50)');

    expect(styleId).toBeDefined();
    expect(styleId).toBe(mockStore.paintStyles[0]!.id);
  });
});
