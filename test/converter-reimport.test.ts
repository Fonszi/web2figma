import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupFigmaMock, teardownFigmaMock, mockStore } from './figma-mock';
import { makeFrame, makeText } from './helpers';
import type { ExtractionResult } from '../shared/types';
import { DEFAULT_SETTINGS } from '../shared/types';
import { computeFingerprint, buildFingerprintMap, computeDiff } from '../shared/diffing';
import type { ExistingFingerprintEntry } from '../shared/diffing';

function makeExtractionResult(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    url: 'https://example.com',
    viewport: { width: 1440, height: 900 },
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
    ...overrides,
  };
}

describe('converter pluginData integration', () => {
  beforeEach(async () => {
    setupFigmaMock();
    vi.resetModules();
  });

  afterEach(() => {
    teardownFigmaMock();
    vi.restoreAllMocks();
  });

  it('computeFingerprint returns consistent hash for BridgeNode', () => {
    const node = makeFrame();
    const fp1 = computeFingerprint(node);
    const fp2 = computeFingerprint(node);
    expect(fp1).toBe(fp2);
  });

  it('computeFingerprint differs for different nodes', () => {
    const frame = makeFrame();
    const text = makeText('Hello');
    expect(computeFingerprint(frame)).not.toBe(computeFingerprint(text));
  });

  it('buildFingerprintMap creates entries for all nodes', () => {
    const root = makeFrame({
      children: [makeText('A'), makeText('B')],
    });
    const map = buildFingerprintMap(root);
    expect(map.size).toBe(3);
    expect(map.has('root')).toBe(true);
    expect(map.has('root-0')).toBe(true);
    expect(map.has('root-1')).toBe(true);
  });
});

describe('re-import diffing pipeline', () => {
  it('detects no changes when extraction is identical', () => {
    const root = makeFrame({
      children: [makeText('Hello'), makeFrame()],
    });
    const newMap = buildFingerprintMap(root);

    // Simulate existing fingerprints from a previous import
    const existingMap = new Map<string, ExistingFingerprintEntry>();
    for (const [path, entry] of newMap) {
      existingMap.set(path, { fingerprint: entry.fingerprint, figmaNodeId: `node-${path}` });
    }

    const { summary } = computeDiff(newMap, existingMap);
    expect(summary.modifiedCount).toBe(0);
    expect(summary.addedCount).toBe(0);
    expect(summary.removedCount).toBe(0);
    expect(summary.unchangedCount).toBe(3);
  });

  it('detects when 3 elements changed and leaves rest unchanged', () => {
    // Original tree: root + 5 children
    const originalRoot = makeFrame({
      children: [
        makeText('Unchanged 1'),
        makeText('Unchanged 2'),
        makeText('Will Change'),
        makeFrame({ bounds: { x: 0, y: 0, width: 100, height: 50 } }),
        makeFrame({ bounds: { x: 0, y: 0, width: 200, height: 100 } }),
      ],
    });
    const originalMap = buildFingerprintMap(originalRoot);
    const existingMap = new Map<string, ExistingFingerprintEntry>();
    for (const [path, entry] of originalMap) {
      existingMap.set(path, { fingerprint: entry.fingerprint, figmaNodeId: `node-${path}` });
    }

    // Modified tree: change text, resize frame, add new child
    const modifiedRoot = makeFrame({
      children: [
        makeText('Unchanged 1'),
        makeText('Unchanged 2'),
        makeText('Changed!'),  // modified
        makeFrame({ bounds: { x: 0, y: 0, width: 150, height: 75 } }),  // modified (different size)
        makeFrame({ bounds: { x: 0, y: 0, width: 200, height: 100 } }),
        makeText('Brand new'),  // added
      ],
    });
    const newMap = buildFingerprintMap(modifiedRoot);

    const { summary, changes } = computeDiff(newMap, existingMap);

    // 3 elements changed (root unchanged, child 0 unchanged, child 1 unchanged)
    // child 2: modified (text changed)
    // child 3: modified (size changed)
    // child 4: unchanged
    // child 5: added (new)
    expect(summary.modifiedCount).toBe(2);
    expect(summary.addedCount).toBe(1);
    expect(summary.removedCount).toBe(0);
    expect(summary.unchangedCount).toBe(4); // root + children 0, 1, 4
  });

  it('detects removed nodes', () => {
    const root = makeFrame({ children: [makeText('A')] });
    const newMap = buildFingerprintMap(root);

    const existingMap = new Map<string, ExistingFingerprintEntry>();
    for (const [path, entry] of newMap) {
      existingMap.set(path, { fingerprint: entry.fingerprint, figmaNodeId: `node-${path}` });
    }
    // Simulate an extra node in existing that was removed
    existingMap.set('root-1', { fingerprint: 'old-hash', figmaNodeId: 'node-root-1' });

    const { summary } = computeDiff(newMap, existingMap);
    expect(summary.removedCount).toBe(1);
  });

  it('handles deep tree changes correctly', () => {
    const root = makeFrame({
      children: [
        makeFrame({
          children: [
            makeFrame({
              children: [makeText('Deep change')],
            }),
          ],
        }),
      ],
    });

    const originalRoot = makeFrame({
      children: [
        makeFrame({
          children: [
            makeFrame({
              children: [makeText('Original deep')],
            }),
          ],
        }),
      ],
    });

    const newMap = buildFingerprintMap(root);
    const existingMap = new Map<string, ExistingFingerprintEntry>();
    for (const [path, entry] of buildFingerprintMap(originalRoot)) {
      existingMap.set(path, { fingerprint: entry.fingerprint, figmaNodeId: `node-${path}` });
    }

    const { summary } = computeDiff(newMap, existingMap);
    // The deepest text node changed, which also changes its parent fingerprints? No -
    // fingerprint is per-node, not subtree. Only the text node at root-0-0-0 changed.
    expect(summary.modifiedCount).toBe(1);
    expect(summary.unchangedCount).toBe(3); // root, root-0, root-0-0
  });

  it('all changes have type and path', () => {
    const newRoot = makeFrame({ children: [makeText('New')] });
    const newMap = buildFingerprintMap(newRoot);
    const existingMap = new Map<string, ExistingFingerprintEntry>();

    const { changes } = computeDiff(newMap, existingMap);
    for (const change of changes) {
      expect(['modified', 'added', 'removed']).toContain(change.type);
      expect(change.path.length).toBeGreaterThan(0);
      expect(change.id).toBe(change.path);
    }
  });
});

describe('mock pluginData', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  it('frame nodes support setPluginData and getPluginData', () => {
    const frame = mockStore.frames[0] ?? figma.createFrame();
    frame.setPluginData('testKey', 'testValue');
    expect(frame.getPluginData('testKey')).toBe('testValue');
  });

  it('getPluginData returns empty string for missing key', () => {
    const frame = figma.createFrame();
    expect(frame.getPluginData('nonexistent')).toBe('');
  });

  it('text nodes support pluginData', () => {
    const text = figma.createText();
    text.setPluginData('bridgePath', 'root-0');
    expect(text.getPluginData('bridgePath')).toBe('root-0');
  });

  it('component nodes support pluginData', () => {
    const comp = figma.createComponent();
    comp.setPluginData('forgeImport', 'true');
    expect(comp.getPluginData('forgeImport')).toBe('true');
  });

  it('getNodeById finds frames', () => {
    const frame = figma.createFrame();
    const found = figma.getNodeById(frame.id);
    expect(found).toBe(frame);
  });

  it('getNodeById returns null for unknown id', () => {
    const found = figma.getNodeById('nonexistent-id');
    expect(found).toBeNull();
  });
});
