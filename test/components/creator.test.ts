import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupFigmaMock, teardownFigmaMock, mockStore } from '../figma-mock';
import { createComponents, createInstanceNode } from '../../figma-plugin/src/components/creator';
import type { ComponentMap } from '../../figma-plugin/src/components/creator';
import type { DetectedComponent, ImportSettings } from '../../shared/types';
import type { StyleMap } from '../../figma-plugin/src/tokens';
import { makeFrame, makeText } from '../helpers';

const DEFAULT_SETTINGS: ImportSettings = {
  createStyles: true,
  createComponents: true,
  createVariables: true,
  framerAwareMode: true,
  includeHiddenElements: false,
  maxDepth: 50,
  imageQuality: 'high',
};

const EMPTY_STYLE_MAP: StyleMap = {
  colors: { byValue: new Map(), count: 0 },
  typography: { byKey: new Map(), count: 0 },
  effects: { byValue: new Map(), count: 0 },
  variables: { byName: new Map(), count: 0 },
};

function makeComponent(hash: string, name: string): DetectedComponent {
  const representative = makeFrame({
    tag: 'div',
    componentHash: hash,
    children: [makeText('Hello')],
    bounds: { x: 0, y: 0, width: 200, height: 100 },
  });

  return {
    hash,
    name,
    instances: [representative, makeFrame({ componentHash: hash, children: [makeText('Hello')] })],
    representativeNode: representative,
  };
}

describe('createComponents', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  it('creates ComponentNodes from detected components', async () => {
    const components = [makeComponent('h1', 'Card')];

    const result = await createComponents(components, DEFAULT_SETTINGS, EMPTY_STYLE_MAP);

    expect(result.count).toBe(1);
    expect(result.byHash.has('h1')).toBe(true);
    expect(result.nodesByHash.has('h1')).toBe(true);
    expect(mockStore.components).toHaveLength(1);
  });

  it('creates multiple components', async () => {
    const components = [
      makeComponent('h1', 'Card'),
      makeComponent('h2', 'Button'),
      makeComponent('h3', 'Badge'),
    ];

    const result = await createComponents(components, DEFAULT_SETTINGS, EMPTY_STYLE_MAP);

    expect(result.count).toBe(3);
    expect(mockStore.components).toHaveLength(3);
  });

  it('names the Figma component correctly', async () => {
    const components = [makeComponent('h1', 'Navigation')];

    await createComponents(components, DEFAULT_SETTINGS, EMPTY_STYLE_MAP);

    expect(mockStore.components[0]!.name).toBe('Navigation');
  });

  it('sizes component from representative bounds', async () => {
    const components = [makeComponent('h1', 'Card')];

    await createComponents(components, DEFAULT_SETTINGS, EMPTY_STYLE_MAP);

    const comp = mockStore.components[0]!;
    expect(comp.resize).toHaveBeenCalledWith(200, 100);
  });

  it('positions components off-screen', async () => {
    const components = [
      makeComponent('h1', 'Card'),
      makeComponent('h2', 'Button'),
    ];

    await createComponents(components, DEFAULT_SETTINGS, EMPTY_STYLE_MAP);

    const comp0 = mockStore.components[0]!;
    const comp1 = mockStore.components[1]!;
    expect(comp0.y).toBeLessThan(0);
    expect(comp1.y).toBeLessThan(0);
  });

  it('returns empty map when createComponents setting is false', async () => {
    const settings = { ...DEFAULT_SETTINGS, createComponents: false };
    const components = [makeComponent('h1', 'Card')];

    const result = await createComponents(components, settings, EMPTY_STYLE_MAP);

    expect(result.count).toBe(0);
    expect(result.byHash.size).toBe(0);
    expect(mockStore.components).toHaveLength(0);
  });

  it('returns empty map for empty component list', async () => {
    const result = await createComponents([], DEFAULT_SETTINGS, EMPTY_STYLE_MAP);

    expect(result.count).toBe(0);
    expect(result.byHash.size).toBe(0);
  });

  it('builds internal subtree from representative node', async () => {
    const components = [makeComponent('h1', 'Card')];

    await createComponents(components, DEFAULT_SETTINGS, EMPTY_STYLE_MAP);

    // The representative has a text child, so buildSubtree should call appendChild
    const comp = mockStore.components[0]!;
    expect(comp.appendChild).toHaveBeenCalled();
  });

  it('calls progress callback', async () => {
    const components = [
      makeComponent('h1', 'Card'),
      makeComponent('h2', 'Button'),
    ];
    const progress = vi.fn();

    await createComponents(components, DEFAULT_SETTINGS, EMPTY_STYLE_MAP, progress);

    expect(progress).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenCalledWith(1, 2);
    expect(progress).toHaveBeenCalledWith(2, 2);
  });

  it('skips failed component creation gracefully', async () => {
    // Override createComponent to throw on second call
    let callCount = 0;
    (figma as any).createComponent = vi.fn(() => {
      callCount++;
      if (callCount === 2) throw new Error('fail');
      const comp = {
        id: `comp-${callCount}`,
        name: '',
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        resize: vi.fn(),
        appendChild: vi.fn(),
        createInstance: vi.fn(),
        children: [],
      };
      mockStore.components.push(comp as any);
      return comp;
    });

    const components = [
      makeComponent('h1', 'Card'),
      makeComponent('h2', 'Broken'),
      makeComponent('h3', 'Badge'),
    ];

    const result = await createComponents(components, DEFAULT_SETTINGS, EMPTY_STYLE_MAP);

    // 2 of 3 should succeed
    expect(result.count).toBe(2);
    expect(result.byHash.has('h1')).toBe(true);
    expect(result.byHash.has('h2')).toBe(false);
    expect(result.byHash.has('h3')).toBe(true);
  });
});

describe('createInstanceNode', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  it('creates an instance from a component', () => {
    const componentNode = mockStore.components.length > 0
      ? mockStore.components[0]!
      : (() => { const c = (figma as any).createComponent(); return c; })();

    const node = makeFrame({
      tag: 'div',
      bounds: { x: 10, y: 20, width: 300, height: 150 },
    });

    const instance = createInstanceNode(node, componentNode as any);

    expect(instance).toBeDefined();
    expect(instance.name).toBe('div');
    expect(instance.resize).toHaveBeenCalledWith(300, 150);
  });

  it('uses node tag as instance name', () => {
    const componentNode = (figma as any).createComponent();
    const node = makeFrame({ tag: 'button' });

    const instance = createInstanceNode(node, componentNode as any);

    expect(instance.name).toBe('button');
  });

  it('handles minimum size', () => {
    const componentNode = (figma as any).createComponent();
    const node = makeFrame({
      bounds: { x: 0, y: 0, width: 0, height: 0 },
    });

    const instance = createInstanceNode(node, componentNode as any);

    expect(instance.resize).toHaveBeenCalledWith(1, 1);
  });
});
