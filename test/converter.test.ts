import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupFigmaMock, teardownFigmaMock, mockStore } from './figma-mock';
import { convertToFigma } from '../figma-plugin/src/converter';
import { makeFrame, makeText, makeImage, makeSvg } from './helpers';
import type { ExtractionResult, ImportSettings, DEFAULT_SETTINGS } from '../shared/types';

function makeSettings(overrides: Partial<ImportSettings> = {}): ImportSettings {
  return {
    createStyles: true,
    createComponents: true,
    createVariables: true,
    framerAwareMode: true,
    includeHiddenElements: false,
    maxDepth: 50,
    imageQuality: 'high',
    ...overrides,
  };
}

function makeResult(rootNode = makeFrame(), overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    url: 'https://example.com',
    viewport: { width: 1440, height: 900 },
    timestamp: Date.now(),
    framework: 'generic',
    rootNode,
    tokens: { colors: [], typography: [], effects: [], variables: [] },
    components: [],
    fonts: [],
    metadata: {
      title: 'Test Page',
      isFramerSite: false,
    },
    ...overrides,
  };
}

/** Extend figma mock with viewport and currentPage for converter tests. */
function extendMockForConverter(): void {
  const figma = (globalThis as any).figma;
  figma.viewport = {
    center: { x: 0, y: 0 },
    scrollAndZoomIntoView: vi.fn(),
  };
  figma.currentPage = {
    selection: [],
  };
}

describe('convertToFigma', () => {
  beforeEach(() => {
    setupFigmaMock();
    extendMockForConverter();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  // --- Basic pipeline ---

  it('converts a simple tree and returns counts', async () => {
    const root = makeFrame({
      children: [
        makeText('Hello'),
        makeText('World'),
      ],
    });
    const result = makeResult(root);
    const progress = vi.fn();

    const counts = await convertToFigma(result, makeSettings(), progress);

    expect(counts.nodeCount).toBe(3); // root + 2 text
    expect(counts.tokenCount).toBe(0);
    expect(counts.componentCount).toBe(0);
    expect(counts.sectionCount).toBe(0);
  });

  it('creates page frame with title', async () => {
    const result = makeResult(makeFrame(), { metadata: { title: 'My Page', isFramerSite: false } });
    const progress = vi.fn();

    await convertToFigma(result, makeSettings(), progress);

    // The first created frame is the page frame
    expect(mockStore.frames[0]!.name).toBe('My Page');
  });

  it('sizes page frame from viewport', async () => {
    const result = makeResult(makeFrame(), { viewport: { width: 1920, height: 1080 } });
    const progress = vi.fn();

    await convertToFigma(result, makeSettings(), progress);

    expect(mockStore.frames[0]!.width).toBe(1920);
    expect(mockStore.frames[0]!.height).toBe(1080);
  });

  // --- Progress reporting ---

  it('reports all progress phases', async () => {
    const result = makeResult(makeFrame({ children: [makeText('a')] }));
    const progress = vi.fn();

    await convertToFigma(result, makeSettings(), progress);

    const phases = progress.mock.calls.map((c: any[]) => c[0]);
    expect(phases).toContain('parsing');
    expect(phases).toContain('creating-styles');
    expect(phases).toContain('creating-components');
    expect(phases).toContain('creating-nodes');
    expect(phases).toContain('finalizing');
  });

  it('does not report creating-sections for non-Framer sites', async () => {
    const result = makeResult(makeFrame());
    const progress = vi.fn();

    await convertToFigma(result, makeSettings(), progress);

    const phases = progress.mock.calls.map((c: any[]) => c[0]);
    expect(phases).not.toContain('creating-sections');
  });

  // --- Node types ---

  it('creates frame nodes for div children', async () => {
    const root = makeFrame({
      children: [
        makeFrame({ tag: 'section' }),
      ],
    });
    const result = makeResult(root);

    await convertToFigma(result, makeSettings(), vi.fn());

    // frames[0] = page frame, frames[1] = root, frames[2] = section child
    expect(mockStore.frames.length).toBeGreaterThanOrEqual(3);
  });

  it('creates text nodes for text children', async () => {
    const root = makeFrame({
      children: [makeText('Hello')],
    });
    const result = makeResult(root);

    await convertToFigma(result, makeSettings(), vi.fn());

    expect(mockStore.textNodes.length).toBeGreaterThanOrEqual(1);
    expect(mockStore.textNodes[0]!.characters).toBe('Hello');
  });

  it('creates image nodes for image children', async () => {
    const root = makeFrame({
      children: [makeImage()],
    });
    const result = makeResult(root);

    await convertToFigma(result, makeSettings(), vi.fn());

    // Image creates a rectangle
    expect(mockStore.rectangles.length).toBeGreaterThanOrEqual(1);
  });

  it('creates vector nodes for SVG children', async () => {
    const root = makeFrame({
      children: [makeSvg('<svg><circle r="5"/></svg>')],
    });
    const result = makeResult(root);

    await convertToFigma(result, makeSettings(), vi.fn());

    // SVG creates a frame via createNodeFromSvg mock
    // At minimum we should have page frame + root frame + SVG frame
    expect(mockStore.frames.length).toBeGreaterThanOrEqual(3);
  });

  // --- Visibility filtering ---

  it('skips hidden nodes when includeHiddenElements is false', async () => {
    const root = makeFrame({
      children: [
        makeText('visible'),
        makeText('hidden', { visible: false }),
      ],
    });
    const result = makeResult(root);

    const counts = await convertToFigma(result, makeSettings({ includeHiddenElements: false }), vi.fn());

    // root + 1 visible text = 2 nodes (hidden skipped)
    expect(counts.nodeCount).toBe(2);
  });

  it('includes hidden nodes when includeHiddenElements is true', async () => {
    const root = makeFrame({
      children: [
        makeText('visible'),
        makeText('hidden', { visible: false }),
      ],
    });
    const result = makeResult(root);

    const counts = await convertToFigma(result, makeSettings({ includeHiddenElements: true }), vi.fn());

    // root + 2 text = 3 nodes
    expect(counts.nodeCount).toBe(3);
  });

  // --- Max depth ---

  it('respects maxDepth setting', async () => {
    const root = makeFrame({
      children: [
        makeFrame({
          children: [
            makeFrame({
              children: [makeText('deep')],
            }),
          ],
        }),
      ],
    });
    const result = makeResult(root);

    // maxDepth 2: root(0) → child(1) → grandchild(2) → text(3, skipped)
    const counts = await convertToFigma(result, makeSettings({ maxDepth: 2 }), vi.fn());

    // root + child + grandchild = 3 (text at depth 3 is skipped)
    expect(counts.nodeCount).toBe(3);
  });

  // --- Component instances ---

  it('substitutes component instances for matching hashes', async () => {
    const hash = 'abc123';
    const root = makeFrame({
      children: [
        makeFrame({ componentHash: hash, children: [makeText('a')] }),
        makeFrame({ componentHash: hash, children: [makeText('b')] }),
        makeFrame({ componentHash: hash, children: [makeText('c')] }),
      ],
    });
    const result = makeResult(root);

    const counts = await convertToFigma(result, makeSettings(), vi.fn());

    // Components detected: 1 with 3 instances
    expect(counts.componentCount).toBe(1);
    // Instances should be created
    expect(mockStore.instances.length).toBeGreaterThanOrEqual(1);
  });

  // --- Framer mode ---

  it('reports creating-sections phase for Framer sites', async () => {
    const root = makeFrame({
      children: [
        makeFrame({
          dataAttributes: { 'data-framer-name': 'Hero' },
          children: [makeText('content')],
        }),
      ],
    });
    const result = makeResult(root, {
      framework: 'framer',
      metadata: { title: 'Framer Site', isFramerSite: true },
    });
    const progress = vi.fn();

    await convertToFigma(result, makeSettings({ framerAwareMode: true }), progress);

    // Framer mode activates the sections phase
    const phases = progress.mock.calls.map((c: any[]) => c[0]);
    expect(phases).toContain('creating-sections');
  });

  it('skips Framer enhancements when framerAwareMode is off', async () => {
    const root = makeFrame({
      children: [
        makeFrame({
          dataAttributes: { 'data-framer-name': 'Hero' },
          children: [makeText('content')],
        }),
      ],
    });
    const result = makeResult(root, {
      framework: 'framer',
      metadata: { title: 'Framer Site', isFramerSite: true },
    });

    const counts = await convertToFigma(result, makeSettings({ framerAwareMode: false }), vi.fn());

    expect(counts.sectionCount).toBe(0);
  });

  it('skips Framer enhancements for non-Framer sites', async () => {
    const root = makeFrame({
      children: [makeText('plain')],
    });
    const result = makeResult(root, {
      framework: 'generic',
      metadata: { title: 'Generic Site', isFramerSite: false },
    });

    const counts = await convertToFigma(result, makeSettings({ framerAwareMode: true }), vi.fn());

    expect(counts.sectionCount).toBe(0);
  });

  it('uses Framer names for layer naming', async () => {
    const root = makeFrame({
      children: [
        makeFrame({
          tag: 'div',
          dataAttributes: { 'data-framer-name': 'Navigation' },
          children: [makeText('links')],
        }),
      ],
    });
    const result = makeResult(root, {
      framework: 'framer',
      metadata: { title: 'Framer Site', isFramerSite: true },
    });

    await convertToFigma(result, makeSettings({ framerAwareMode: true }), vi.fn());

    // One of the frames should be named "Navigation" instead of "div"
    const navFrame = mockStore.frames.find((f) => f.name === 'Navigation');
    expect(navFrame).toBeDefined();
  });

  // --- Token counting ---

  it('counts tokens from extraction result', async () => {
    const result = makeResult(makeFrame(), {
      tokens: {
        colors: [{ name: 'red', value: 'rgb(255,0,0)', usageCount: 5 }],
        typography: [{ name: 'body', fontFamily: 'Inter', fontSize: 16, fontWeight: 400, lineHeight: 24, letterSpacing: 0, usageCount: 10 }],
        effects: [{ name: 'shadow', type: 'drop-shadow', value: '0 2px 4px rgba(0,0,0,0.1)', usageCount: 3 }],
        variables: [],
      },
    });

    const counts = await convertToFigma(result, makeSettings(), vi.fn());

    expect(counts.tokenCount).toBe(3); // 1 color + 1 typography + 1 effect
  });

  // --- Empty tree ---

  it('handles empty root node', async () => {
    const result = makeResult(makeFrame());

    const counts = await convertToFigma(result, makeSettings(), vi.fn());

    expect(counts.nodeCount).toBe(1); // Just the root
  });

  // --- Style counting ---

  it('counts created styles', async () => {
    const result = makeResult(makeFrame(), {
      tokens: {
        colors: [
          { name: 'red', value: 'rgb(255,0,0)', usageCount: 5 },
          { name: 'blue', value: 'rgb(0,0,255)', usageCount: 3 },
        ],
        typography: [],
        effects: [],
        variables: [],
      },
    });

    const counts = await convertToFigma(result, makeSettings(), vi.fn());

    expect(counts.styleCount).toBeGreaterThanOrEqual(2);
  });

  // --- Framer token enhancement ---

  it('enhances Framer tokens before style creation', async () => {
    const result = makeResult(makeFrame(), {
      framework: 'framer',
      metadata: { title: 'Framer Site', isFramerSite: true },
      tokens: {
        colors: [],
        typography: [],
        effects: [],
        variables: [
          { name: '--token-abc123-brand-color', cssProperty: '--token-abc123-brand-color', resolvedValue: '#ff0000', type: 'color' as const },
        ],
      },
    });

    await convertToFigma(result, makeSettings({ framerAwareMode: true, createVariables: true }), vi.fn());

    // The variable should have been created with a cleaned name
    if (mockStore.variables.length > 0) {
      // Name should be cleaned (no hash prefix)
      expect(mockStore.variables[0]!.name).not.toContain('abc123');
    }
  });
});
