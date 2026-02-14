import { describe, it, expect } from 'vitest';
import { simpleHash, computeFingerprint, buildFingerprintMap, computeDiff } from '../../shared/diffing';
import type { ExistingFingerprintEntry } from '../../shared/diffing';
import { makeFrame, makeText } from '../helpers';

describe('simpleHash', () => {
  it('produces consistent results for same input', () => {
    expect(simpleHash('hello')).toBe(simpleHash('hello'));
  });

  it('produces different results for different inputs', () => {
    expect(simpleHash('hello')).not.toBe(simpleHash('world'));
  });

  it('returns 8-character hex string', () => {
    const hash = simpleHash('test');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('handles empty string', () => {
    const hash = simpleHash('');
    expect(hash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('computeFingerprint', () => {
  it('produces consistent fingerprint for same node', () => {
    const node = makeFrame();
    expect(computeFingerprint(node)).toBe(computeFingerprint(node));
  });

  it('produces different fingerprint for different node types', () => {
    const frame = makeFrame();
    const text = makeText('Hello');
    expect(computeFingerprint(frame)).not.toBe(computeFingerprint(text));
  });

  it('includes text content in fingerprint', () => {
    const text1 = makeText('Hello');
    const text2 = makeText('World');
    expect(computeFingerprint(text1)).not.toBe(computeFingerprint(text2));
  });

  it('includes bounds dimensions in fingerprint', () => {
    const small = makeFrame({ bounds: { x: 0, y: 0, width: 100, height: 50 } });
    const large = makeFrame({ bounds: { x: 0, y: 0, width: 200, height: 100 } });
    expect(computeFingerprint(small)).not.toBe(computeFingerprint(large));
  });

  it('includes background color in fingerprint', () => {
    const red = makeFrame({ styles: { backgroundColor: 'red' } });
    const blue = makeFrame({ styles: { backgroundColor: 'blue' } });
    expect(computeFingerprint(red)).not.toBe(computeFingerprint(blue));
  });
});

describe('buildFingerprintMap', () => {
  it('includes root node with default prefix', () => {
    const node = makeFrame();
    const map = buildFingerprintMap(node);
    expect(map.has('root')).toBe(true);
  });

  it('builds correct paths for children', () => {
    const node = makeFrame({
      children: [makeText('A'), makeFrame()],
    });
    const map = buildFingerprintMap(node);
    expect(map.has('root-0')).toBe(true);
    expect(map.has('root-1')).toBe(true);
  });

  it('builds correct paths for nested children', () => {
    const node = makeFrame({
      children: [
        makeFrame({
          children: [makeText('Deep')],
        }),
      ],
    });
    const map = buildFingerprintMap(node);
    expect(map.has('root-0-0')).toBe(true);
  });

  it('includes all nodes recursively', () => {
    const node = makeFrame({
      children: [makeText('A'), makeText('B'), makeText('C')],
    });
    const map = buildFingerprintMap(node);
    expect(map.size).toBe(4); // root + 3 children
  });

  it('uses custom path prefix', () => {
    const node = makeFrame();
    const map = buildFingerprintMap(node, 'custom');
    expect(map.has('custom')).toBe(true);
  });
});

describe('computeDiff', () => {
  it('detects unchanged nodes', () => {
    const node = makeFrame();
    const fingerprint = computeFingerprint(node);
    const newMap = buildFingerprintMap(node);
    const existingMap = new Map<string, ExistingFingerprintEntry>([
      ['root', { fingerprint, figmaNodeId: 'id-1' }],
    ]);

    const { summary } = computeDiff(newMap, existingMap);
    expect(summary.unchangedCount).toBe(1);
    expect(summary.modifiedCount).toBe(0);
  });

  it('detects modified nodes', () => {
    const node = makeFrame();
    const newMap = buildFingerprintMap(node);
    const existingMap = new Map<string, ExistingFingerprintEntry>([
      ['root', { fingerprint: 'different-hash', figmaNodeId: 'id-1' }],
    ]);

    const { changes, summary } = computeDiff(newMap, existingMap);
    expect(summary.modifiedCount).toBe(1);
    expect(changes[0].type).toBe('modified');
  });

  it('detects added nodes', () => {
    const node = makeFrame({ children: [makeText('New')] });
    const newMap = buildFingerprintMap(node);
    const existingMap = new Map<string, ExistingFingerprintEntry>([
      ['root', { fingerprint: computeFingerprint(node), figmaNodeId: 'id-1' }],
    ]);

    const { changes, summary } = computeDiff(newMap, existingMap);
    expect(summary.addedCount).toBe(1);
    const added = changes.find((c) => c.type === 'added');
    expect(added).toBeDefined();
    expect(added?.path).toBe('root-0');
  });

  it('detects removed nodes', () => {
    const node = makeFrame();
    const newMap = buildFingerprintMap(node);
    const existingMap = new Map<string, ExistingFingerprintEntry>([
      ['root', { fingerprint: computeFingerprint(node), figmaNodeId: 'id-1' }],
      ['root-0', { fingerprint: 'old-child-hash', figmaNodeId: 'id-2' }],
    ]);

    const { changes, summary } = computeDiff(newMap, existingMap);
    expect(summary.removedCount).toBe(1);
    const removed = changes.find((c) => c.type === 'removed');
    expect(removed).toBeDefined();
    expect(removed?.path).toBe('root-0');
  });

  it('handles empty trees', () => {
    const newMap = new Map();
    const existingMap = new Map<string, ExistingFingerprintEntry>();
    const { summary } = computeDiff(newMap, existingMap);
    expect(summary.totalNodes).toBe(0);
  });

  it('handles mixed changes', () => {
    const node = makeFrame({
      children: [makeText('Modified'), makeText('New')],
    });
    const newMap = buildFingerprintMap(node);
    const existingMap = new Map<string, ExistingFingerprintEntry>([
      ['root', { fingerprint: computeFingerprint(node), figmaNodeId: 'id-1' }],
      ['root-0', { fingerprint: 'old-hash', figmaNodeId: 'id-2' }],
      ['root-2', { fingerprint: 'deleted-hash', figmaNodeId: 'id-4' }],
    ]);

    const { summary } = computeDiff(newMap, existingMap);
    expect(summary.unchangedCount).toBe(1);
    expect(summary.modifiedCount).toBe(1);
    expect(summary.addedCount).toBe(1);
    expect(summary.removedCount).toBe(1);
  });

  it('summary totalNodes matches new map size', () => {
    const node = makeFrame({ children: [makeText('A'), makeText('B')] });
    const newMap = buildFingerprintMap(node);
    const existingMap = new Map<string, ExistingFingerprintEntry>();
    const { summary } = computeDiff(newMap, existingMap);
    expect(summary.totalNodes).toBe(3);
  });

  it('changes have correct descriptions for added nodes', () => {
    const node = makeFrame({ children: [makeText('Hello')] });
    const newMap = buildFingerprintMap(node);
    const existingMap = new Map<string, ExistingFingerprintEntry>([
      ['root', { fingerprint: computeFingerprint(node), figmaNodeId: 'id-1' }],
    ]);

    const { changes } = computeDiff(newMap, existingMap);
    const added = changes.find((c) => c.type === 'added');
    expect(added?.description).toContain('New');
    expect(added?.description).toContain('Hello');
  });

  it('all changes are selected by default', () => {
    const node = makeFrame({ children: [makeText('A')] });
    const newMap = buildFingerprintMap(node);
    const existingMap = new Map<string, ExistingFingerprintEntry>();

    const { changes } = computeDiff(newMap, existingMap);
    expect(changes.every((c) => c.selected)).toBe(true);
  });
});
