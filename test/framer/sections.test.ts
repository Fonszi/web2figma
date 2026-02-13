import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupFigmaMock, teardownFigmaMock, mockStore } from '../figma-mock';
import { organizeFramerSections } from '../../figma-plugin/src/framer/sections';
import { makeFrame, makeText } from '../helpers';

describe('organizeFramerSections', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  it('creates sections for Framer-named children', () => {
    const rootNode = makeFrame({
      children: [
        makeFrame({
          dataAttributes: { 'data-framer-name': 'Hero' },
          children: [makeText('content')],
        }),
        makeFrame({
          dataAttributes: { 'data-framer-name': 'Features' },
          children: [makeText('content')],
        }),
      ],
    });

    // Create mock pageFrame with matching children
    const child1 = { id: 'c1', name: 'div', x: 0, y: 0, width: 1440, height: 600 };
    const child2 = { id: 'c2', name: 'div', x: 0, y: 600, width: 1440, height: 800 };
    const pageFrame = {
      children: [child1, child2],
      insertChild: vi.fn(),
    } as any;

    const count = organizeFramerSections(pageFrame, rootNode);

    expect(count).toBe(2);
    expect(mockStore.sections).toHaveLength(2);
    expect(mockStore.sections[0]!.name).toBe('Features');  // Processed in reverse
    expect(mockStore.sections[1]!.name).toBe('Hero');
  });

  it('skips children without Framer names', () => {
    const rootNode = makeFrame({
      children: [
        makeFrame({
          dataAttributes: { 'data-framer-name': 'Hero' },
          children: [makeText('content')],
        }),
        makeFrame({ children: [makeText('no name')] }),
      ],
    });

    const child1 = { id: 'c1', name: 'div', x: 0, y: 0, width: 100, height: 50 };
    const child2 = { id: 'c2', name: 'div', x: 0, y: 50, width: 100, height: 50 };
    const pageFrame = {
      children: [child1, child2],
      insertChild: vi.fn(),
    } as any;

    const count = organizeFramerSections(pageFrame, rootNode);

    expect(count).toBe(1);
    expect(mockStore.sections).toHaveLength(1);
    expect(mockStore.sections[0]!.name).toBe('Hero');
  });

  it('returns 0 when no Framer sections found', () => {
    const rootNode = makeFrame({
      children: [
        makeFrame({ children: [makeText('a')] }),
        makeFrame({ children: [makeText('b')] }),
      ],
    });

    const pageFrame = {
      children: [{ id: 'c1' }, { id: 'c2' }],
      insertChild: vi.fn(),
    } as any;

    const count = organizeFramerSections(pageFrame, rootNode);

    expect(count).toBe(0);
    expect(mockStore.sections).toHaveLength(0);
  });

  it('returns 0 when child counts mismatch', () => {
    const rootNode = makeFrame({
      children: [
        makeFrame({
          dataAttributes: { 'data-framer-name': 'Hero' },
          children: [makeText('content')],
        }),
      ],
    });

    // Mismatched: 2 Figma children vs 1 BridgeNode child
    const pageFrame = {
      children: [{ id: 'c1' }, { id: 'c2' }],
      insertChild: vi.fn(),
    } as any;

    const count = organizeFramerSections(pageFrame, rootNode);

    expect(count).toBe(0);
  });

  it('handles empty root', () => {
    const rootNode = makeFrame();
    const pageFrame = { children: [], insertChild: vi.fn() } as any;

    const count = organizeFramerSections(pageFrame, rootNode);

    expect(count).toBe(0);
  });

  it('skips sections with empty children (not Framer sections)', () => {
    const rootNode = makeFrame({
      children: [
        makeFrame({
          dataAttributes: { 'data-framer-name': 'EmptySection' },
          children: [],  // No children = not a section
        }),
      ],
    });

    const pageFrame = {
      children: [{ id: 'c1', x: 0, y: 0, width: 100, height: 50 }],
      insertChild: vi.fn(),
    } as any;

    const count = organizeFramerSections(pageFrame, rootNode);

    expect(count).toBe(0);
  });

  it('positions section from figma child', () => {
    const rootNode = makeFrame({
      children: [
        makeFrame({
          dataAttributes: { 'data-framer-name': 'Hero' },
          children: [makeText('content')],
        }),
      ],
    });

    const child1 = { id: 'c1', name: 'div', x: 100, y: 200, width: 1440, height: 600 };
    const pageFrame = {
      children: [child1],
      insertChild: vi.fn(),
    } as any;

    organizeFramerSections(pageFrame, rootNode);

    const section = mockStore.sections[0]!;
    expect(section.x).toBe(100);
    expect(section.y).toBe(200);
    expect(section.resizeSansConstraints).toHaveBeenCalledWith(1440, 600);
  });

  it('inserts sections at correct indices', () => {
    const rootNode = makeFrame({
      children: [
        makeFrame({
          dataAttributes: { 'data-framer-name': 'Hero' },
          children: [makeText('content')],
        }),
        makeFrame({
          dataAttributes: { 'data-framer-name': 'Footer' },
          children: [makeText('content')],
        }),
      ],
    });

    const child1 = { id: 'c1', x: 0, y: 0, width: 100, height: 50 };
    const child2 = { id: 'c2', x: 0, y: 50, width: 100, height: 50 };
    const pageFrame = {
      children: [child1, child2],
      insertChild: vi.fn(),
    } as any;

    organizeFramerSections(pageFrame, rootNode);

    // Processed in reverse: index 1 first, then index 0
    expect(pageFrame.insertChild).toHaveBeenCalledTimes(2);
    expect(pageFrame.insertChild).toHaveBeenCalledWith(1, expect.anything());
    expect(pageFrame.insertChild).toHaveBeenCalledWith(0, expect.anything());
  });
});
