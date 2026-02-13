import { describe, it, expect } from 'vitest';
import { detectComponents } from '../../figma-plugin/src/components/detector';
import { makeFrame, makeText } from '../helpers';
import type { BridgeNode } from '../../shared/types';

function makeHashedFrame(hash: string, overrides: Partial<BridgeNode> = {}): BridgeNode {
  return makeFrame({
    componentHash: hash,
    children: [makeText('child')],
    ...overrides,
  });
}

describe('detectComponents', () => {
  it('detects components when threshold (3) is met', () => {
    const root = makeFrame({
      children: [
        makeHashedFrame('abc123'),
        makeHashedFrame('abc123'),
        makeHashedFrame('abc123'),
      ],
    });

    const result = detectComponents(root);

    expect(result).toHaveLength(1);
    expect(result[0]!.hash).toBe('abc123');
    expect(result[0]!.instances).toHaveLength(3);
  });

  it('does not detect when below threshold', () => {
    const root = makeFrame({
      children: [
        makeHashedFrame('abc123'),
        makeHashedFrame('abc123'),
      ],
    });

    const result = detectComponents(root);

    expect(result).toHaveLength(0);
  });

  it('detects multiple component types', () => {
    const root = makeFrame({
      children: [
        makeHashedFrame('hash-a'),
        makeHashedFrame('hash-a'),
        makeHashedFrame('hash-a'),
        makeHashedFrame('hash-b'),
        makeHashedFrame('hash-b'),
        makeHashedFrame('hash-b'),
        makeHashedFrame('hash-b'),
      ],
    });

    const result = detectComponents(root);

    expect(result).toHaveLength(2);
    // Sorted by instance count descending
    expect(result[0]!.hash).toBe('hash-b');
    expect(result[0]!.instances).toHaveLength(4);
    expect(result[1]!.hash).toBe('hash-a');
    expect(result[1]!.instances).toHaveLength(3);
  });

  it('ignores leaf nodes (text, no children)', () => {
    const root = makeFrame({
      children: [
        makeText('text', { componentHash: 'abc123' }),
        makeText('text', { componentHash: 'abc123' }),
        makeText('text', { componentHash: 'abc123' }),
      ],
    });

    const result = detectComponents(root);

    expect(result).toHaveLength(0);
  });

  it('ignores nodes without componentHash', () => {
    const root = makeFrame({
      children: [
        makeFrame({ children: [makeText('a')] }),
        makeFrame({ children: [makeText('b')] }),
        makeFrame({ children: [makeText('c')] }),
      ],
    });

    const result = detectComponents(root);

    expect(result).toHaveLength(0);
  });

  it('finds components in nested trees', () => {
    const root = makeFrame({
      children: [
        makeFrame({
          children: [
            makeHashedFrame('deep-hash'),
            makeHashedFrame('deep-hash'),
          ],
        }),
        makeHashedFrame('deep-hash'),
      ],
    });

    const result = detectComponents(root);

    expect(result).toHaveLength(1);
    expect(result[0]!.instances).toHaveLength(3);
  });

  it('returns empty for empty tree', () => {
    const root = makeFrame();

    const result = detectComponents(root);

    expect(result).toHaveLength(0);
  });

  // --- Naming heuristic tests ---

  it('uses Framer component name when available', () => {
    const root = makeFrame({
      children: [
        makeHashedFrame('f1', { dataAttributes: { 'data-framer-name': 'Hero Section' } }),
        makeHashedFrame('f1', { dataAttributes: { 'data-framer-name': 'Hero Section' } }),
        makeHashedFrame('f1', { dataAttributes: { 'data-framer-name': 'Hero Section' } }),
      ],
    });

    const result = detectComponents(root);

    expect(result[0]!.name).toBe('Hero Section');
  });

  it('uses ARIA role for naming when no Framer name', () => {
    const root = makeFrame({
      children: [
        makeHashedFrame('nav1', { ariaRole: 'navigation' }),
        makeHashedFrame('nav1', { ariaRole: 'navigation' }),
        makeHashedFrame('nav1', { ariaRole: 'navigation' }),
      ],
    });

    const result = detectComponents(root);

    expect(result[0]!.name).toBe('Navigation');
  });

  it('ignores generic ARIA role', () => {
    const root = makeFrame({
      children: [
        makeHashedFrame('gen', { ariaRole: 'generic', tag: 'section' }),
        makeHashedFrame('gen', { ariaRole: 'generic', tag: 'section' }),
        makeHashedFrame('gen', { ariaRole: 'generic', tag: 'section' }),
      ],
    });

    const result = detectComponents(root);

    // Should fall through to tag name, not use "generic"
    expect(result[0]!.name).not.toBe('Generic');
  });

  it('uses best class name across instances', () => {
    const root = makeFrame({
      children: [
        makeHashedFrame('cls', { classNames: ['card', 'p-4'] }),
        makeHashedFrame('cls', { classNames: ['card', 'mt-2'] }),
        makeHashedFrame('cls', { classNames: ['card', 'p-4'] }),
      ],
    });

    const result = detectComponents(root);

    expect(result[0]!.name).toBe('Card');
  });

  it('filters utility classes (Tailwind-like)', () => {
    const root = makeFrame({
      children: [
        makeHashedFrame('tw', { classNames: ['p-4', 'bg-white'] }),
        makeHashedFrame('tw', { classNames: ['p-4', 'bg-white'] }),
        makeHashedFrame('tw', { classNames: ['p-4', 'bg-white'] }),
      ],
    });

    const result = detectComponents(root);

    // Utility classes filtered out, falls through to tag name
    expect(result[0]!.name).not.toContain('bg');
  });

  it('uses tag name as fallback', () => {
    const root = makeFrame({
      children: [
        makeHashedFrame('tag1', { tag: 'button' }),
        makeHashedFrame('tag1', { tag: 'button' }),
        makeHashedFrame('tag1', { tag: 'button' }),
      ],
    });

    const result = detectComponents(root);

    expect(result[0]!.name).toBe('Button Group');
  });

  it('sets representative node to first instance', () => {
    const first = makeHashedFrame('rep1');
    const root = makeFrame({
      children: [
        first,
        makeHashedFrame('rep1'),
        makeHashedFrame('rep1'),
      ],
    });

    const result = detectComponents(root);

    expect(result[0]!.representativeNode).toBe(first);
  });
});
