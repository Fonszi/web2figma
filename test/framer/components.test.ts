import { describe, it, expect } from 'vitest';
import { enhanceFramerComponents } from '../../figma-plugin/src/framer/components';
import { makeFrame, makeText } from '../helpers';
import type { BridgeNode, DetectedComponent } from '../../shared/types';

function makeFramerComponent(type: string, hash?: string): BridgeNode {
  return makeFrame({
    dataAttributes: { 'data-framer-component-type': type },
    componentHash: hash,
    children: [makeText('child')],
  });
}

function makeDetected(hash: string, name: string, count: number): DetectedComponent {
  const instances = Array.from({ length: count }, () =>
    makeFrame({ componentHash: hash, children: [makeText('x')] }),
  );
  return { hash, name, instances, representativeNode: instances[0]! };
}

describe('enhanceFramerComponents', () => {
  it('adds Framer components with 2+ instances', () => {
    const root = makeFrame({
      children: [
        makeFramerComponent('Card'),
        makeFramerComponent('Card'),
      ],
    });

    const result = enhanceFramerComponents([], root);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Card');
    expect(result[0]!.instances).toHaveLength(2);
  });

  it('skips Framer components with only 1 instance', () => {
    const root = makeFrame({
      children: [
        makeFramerComponent('UniqueWidget'),
      ],
    });

    const result = enhanceFramerComponents([], root);

    expect(result).toHaveLength(0);
  });

  it('detects multiple Framer component types', () => {
    const root = makeFrame({
      children: [
        makeFramerComponent('Card'),
        makeFramerComponent('Card'),
        makeFramerComponent('Button'),
        makeFramerComponent('Button'),
        makeFramerComponent('Button'),
      ],
    });

    const result = enhanceFramerComponents([], root);

    expect(result).toHaveLength(2);
    // Sorted by instance count
    expect(result[0]!.name).toBe('Button');
    expect(result[0]!.instances).toHaveLength(3);
    expect(result[1]!.name).toBe('Card');
  });

  it('merges with hash-detected components', () => {
    const hashDetected = [makeDetected('h1', 'Container Group', 4)];
    const root = makeFrame({
      children: [
        makeFramerComponent('Badge'),
        makeFramerComponent('Badge'),
      ],
    });

    const result = enhanceFramerComponents(hashDetected, root);

    expect(result).toHaveLength(2);
    expect(result.find(c => c.name === 'Container Group')).toBeDefined();
    expect(result.find(c => c.name === 'Badge')).toBeDefined();
  });

  it('prefers Framer name over hash-detected when overlapping', () => {
    // A component detected by hash with a generic name
    const hashDetected = [makeDetected('h1', 'Container Group', 3)];

    // Same nodes also have Framer component type with hash h1
    const root = makeFrame({
      children: [
        makeFramerComponent('Card', 'h1'),
        makeFramerComponent('Card', 'h1'),
        makeFramerComponent('Card', 'h1'),
      ],
    });

    const result = enhanceFramerComponents(hashDetected, root);

    // Should have Framer-named version, not hash-detected
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Card');
  });

  it('finds components in nested trees', () => {
    const root = makeFrame({
      children: [
        makeFrame({
          children: [
            makeFramerComponent('ListItem'),
            makeFramerComponent('ListItem'),
          ],
        }),
      ],
    });

    const result = enhanceFramerComponents([], root);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('List Item');
  });

  it('cleans camelCase component type names', () => {
    const root = makeFrame({
      children: [
        makeFramerComponent('NavMenuItem'),
        makeFramerComponent('NavMenuItem'),
      ],
    });

    const result = enhanceFramerComponents([], root);

    expect(result[0]!.name).toBe('Nav Menu Item');
  });

  it('returns empty for no Framer components', () => {
    const root = makeFrame({ children: [makeText('plain')] });
    const result = enhanceFramerComponents([], root);
    expect(result).toHaveLength(0);
  });

  it('ignores leaf nodes', () => {
    const root = makeFrame({
      children: [
        makeText('text', { dataAttributes: { 'data-framer-component-type': 'Label' } }),
        makeText('text', { dataAttributes: { 'data-framer-component-type': 'Label' } }),
      ],
    });

    const result = enhanceFramerComponents([], root);

    // Text nodes (type 'text') should be ignored
    expect(result).toHaveLength(0);
  });

  it('uses framer- prefixed hashes for Framer components', () => {
    const root = makeFrame({
      children: [
        makeFramerComponent('Card'),
        makeFramerComponent('Card'),
      ],
    });

    const result = enhanceFramerComponents([], root);

    expect(result[0]!.hash).toBe('framer-Card');
  });
});
