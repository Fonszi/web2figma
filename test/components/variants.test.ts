import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupFigmaMock, teardownFigmaMock, mockStore } from '../figma-mock';
import { makeFrame, makeText } from '../helpers';
import type { MultiViewportResult, ExtractionResult } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';

function makeExtractionResult(width: number, height: number): ExtractionResult {
  return {
    url: 'https://example.com',
    viewport: { width, height },
    timestamp: Date.now(),
    framework: 'unknown',
    rootNode: makeFrame({
      children: [
        makeText('Hello'),
        makeFrame({ bounds: { x: 0, y: 0, width: 200, height: 100 } }),
      ],
    }),
    tokens: { colors: [], typography: [], effects: [], variables: [] },
    components: [],
    fonts: [],
    metadata: { title: 'Test Page', isFramerSite: false },
  };
}

function makeMultiViewportResult(): MultiViewportResult {
  return {
    type: 'multi-viewport',
    url: 'https://example.com',
    timestamp: Date.now(),
    extractions: [
      {
        viewportKey: 'desktop',
        label: 'Desktop',
        width: 1440,
        height: 900,
        result: makeExtractionResult(1440, 900),
      },
      {
        viewportKey: 'mobile',
        label: 'Mobile',
        width: 375,
        height: 812,
        result: makeExtractionResult(375, 812),
      },
    ],
  };
}

describe('createViewportVariants', () => {
  let createViewportVariants: typeof import('../../figma-plugin/src/components/variants').createViewportVariants;

  beforeEach(async () => {
    setupFigmaMock();
    vi.resetModules();
    const mod = await import('../../figma-plugin/src/components/variants');
    createViewportVariants = mod.createViewportVariants;
  });

  afterEach(() => {
    teardownFigmaMock();
    vi.restoreAllMocks();
  });

  it('creates a ComponentSet from multiple viewports', async () => {
    const multi = makeMultiViewportResult();
    const onProgress = vi.fn();

    await createViewportVariants(multi, DEFAULT_SETTINGS, onProgress);

    expect(mockStore.componentSets.length).toBe(1);
  });

  it('creates one ComponentNode per viewport', async () => {
    const multi = makeMultiViewportResult();
    const onProgress = vi.fn();

    await createViewportVariants(multi, DEFAULT_SETTINGS, onProgress);

    // At least 2 components created (one per viewport)
    const variantComponents = mockStore.components.filter((c) =>
      c.name.startsWith('Viewport='),
    );
    expect(variantComponents.length).toBe(2);
  });

  it('sets variant names as Viewport=Label', async () => {
    const multi = makeMultiViewportResult();
    const onProgress = vi.fn();

    await createViewportVariants(multi, DEFAULT_SETTINGS, onProgress);

    const names = mockStore.components
      .filter((c) => c.name.startsWith('Viewport='))
      .map((c) => c.name);
    expect(names).toContain('Viewport=Desktop');
    expect(names).toContain('Viewport=Mobile');
  });

  it('calls combineAsVariants', async () => {
    const multi = makeMultiViewportResult();
    const onProgress = vi.fn();

    await createViewportVariants(multi, DEFAULT_SETTINGS, onProgress);

    expect(figma.combineAsVariants).toHaveBeenCalledTimes(1);
  });

  it('returns correct variant count', async () => {
    const multi = makeMultiViewportResult();
    const onProgress = vi.fn();

    const result = await createViewportVariants(multi, DEFAULT_SETTINGS, onProgress);

    expect(result.variantCount).toBe(2);
  });

  it('returns aggregated node counts', async () => {
    const multi = makeMultiViewportResult();
    const onProgress = vi.fn();

    const result = await createViewportVariants(multi, DEFAULT_SETTINGS, onProgress);

    expect(result.totalNodeCount).toBeGreaterThan(0);
  });

  it('calls progress callback for each viewport', async () => {
    const multi = makeMultiViewportResult();
    const onProgress = vi.fn();

    await createViewportVariants(multi, DEFAULT_SETTINGS, onProgress);

    // Should have progress calls for creating-variants phase
    const variantCalls = onProgress.mock.calls.filter(
      (call) => call[0] === 'creating-variants',
    );
    expect(variantCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('names ComponentSet after page title', async () => {
    const multi = makeMultiViewportResult();
    const onProgress = vi.fn();

    await createViewportVariants(multi, DEFAULT_SETTINGS, onProgress);

    expect(mockStore.componentSets[0].name).toBe('Test Page');
  });

  it('handles single viewport in multi-result', async () => {
    const multi: MultiViewportResult = {
      type: 'multi-viewport',
      url: 'https://example.com',
      timestamp: Date.now(),
      extractions: [
        {
          viewportKey: 'desktop',
          label: 'Desktop',
          width: 1440,
          height: 900,
          result: makeExtractionResult(1440, 900),
        },
      ],
    };
    const onProgress = vi.fn();

    const result = await createViewportVariants(multi, DEFAULT_SETTINGS, onProgress);

    expect(result.variantCount).toBe(1);
    expect(mockStore.componentSets.length).toBe(1);
  });

  it('sorts extractions by width descending (widest first)', async () => {
    const multi: MultiViewportResult = {
      type: 'multi-viewport',
      url: 'https://example.com',
      timestamp: Date.now(),
      extractions: [
        {
          viewportKey: 'mobile',
          label: 'Mobile',
          width: 375,
          height: 812,
          result: makeExtractionResult(375, 812),
        },
        {
          viewportKey: 'desktop',
          label: 'Desktop',
          width: 1440,
          height: 900,
          result: makeExtractionResult(1440, 900),
        },
      ],
    };
    const onProgress = vi.fn();

    await createViewportVariants(multi, DEFAULT_SETTINGS, onProgress);

    // Desktop should be created first (widest), so first variant progress message
    const variantMessages = onProgress.mock.calls
      .filter((call) => call[0] === 'creating-variants')
      .map((call) => call[2] as string);
    const firstMessage = variantMessages[0];
    expect(firstMessage).toContain('Desktop');
  });
});
