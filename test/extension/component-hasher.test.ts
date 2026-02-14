import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hashComponent } from '../../extension/src/content/component-hasher';
import { cleanupDOM } from '../dom-helpers';

describe('hashComponent', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  // --- Basic hashing ---

  it('returns a string hash', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const hash = hashComponent(el);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  it('produces same hash for identical structure', () => {
    const el1 = document.createElement('div');
    const child1 = document.createElement('span');
    el1.appendChild(child1);
    document.body.appendChild(el1);

    const el2 = document.createElement('div');
    const child2 = document.createElement('span');
    el2.appendChild(child2);
    document.body.appendChild(el2);

    expect(hashComponent(el1)).toBe(hashComponent(el2));
  });

  it('produces different hash for different tags', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    const section = document.createElement('section');
    document.body.appendChild(section);

    expect(hashComponent(div)).not.toBe(hashComponent(section));
  });

  // --- Structural differences ---

  it('produces different hash for different child counts', () => {
    const el1 = document.createElement('div');
    el1.appendChild(document.createElement('span'));
    document.body.appendChild(el1);

    const el2 = document.createElement('div');
    el2.appendChild(document.createElement('span'));
    el2.appendChild(document.createElement('span'));
    document.body.appendChild(el2);

    expect(hashComponent(el1)).not.toBe(hashComponent(el2));
  });

  it('ignores text content (only hashes structure)', () => {
    const el1 = document.createElement('div');
    el1.textContent = 'Hello World';
    document.body.appendChild(el1);

    const el2 = document.createElement('div');
    el2.textContent = 'Different Text';
    document.body.appendChild(el2);

    expect(hashComponent(el1)).toBe(hashComponent(el2));
  });

  it('considers child tag types in hash', () => {
    const el1 = document.createElement('div');
    el1.appendChild(document.createElement('span'));
    document.body.appendChild(el1);

    const el2 = document.createElement('div');
    el2.appendChild(document.createElement('p'));
    document.body.appendChild(el2);

    expect(hashComponent(el1)).not.toBe(hashComponent(el2));
  });

  // --- Depth limiting ---

  it('respects maxDepth parameter', () => {
    // Deep tree: div > div > div > div > span
    const root = document.createElement('div');
    let current = root;
    for (let i = 0; i < 4; i++) {
      const child = document.createElement('div');
      current.appendChild(child);
      current = child;
    }
    current.appendChild(document.createElement('span'));
    document.body.appendChild(root);

    // With depth 0, children are ignored
    const hashDepth0 = hashComponent(root, 0);

    // With depth 5, children are included
    const hashDepth5 = hashComponent(root, 5);

    // Different because depth 0 ignores child signatures
    expect(hashDepth0).not.toBe(hashDepth5);
  });

  it('handles element with no children', () => {
    const el = document.createElement('img');
    document.body.appendChild(el);
    const hash = hashComponent(el);
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });

  // --- Hash determinism ---

  it('produces deterministic output', () => {
    const el = document.createElement('div');
    el.appendChild(document.createElement('span'));
    el.appendChild(document.createElement('p'));
    document.body.appendChild(el);

    const hash1 = hashComponent(el);
    const hash2 = hashComponent(el);
    expect(hash1).toBe(hash2);
  });

  it('produces base-36 string output', () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    const hash = hashComponent(el);
    // Base-36 uses characters 0-9, a-z
    expect(hash).toMatch(/^[0-9a-z]+$/);
  });

  // --- Style-based grouping ---

  it('same display property produces same hash', () => {
    const el1 = document.createElement('div');
    el1.style.display = 'flex';
    document.body.appendChild(el1);

    const el2 = document.createElement('div');
    el2.style.display = 'flex';
    document.body.appendChild(el2);

    expect(hashComponent(el1)).toBe(hashComponent(el2));
  });

  it('groups similar font sizes (roundToStep)', () => {
    // Font sizes 14 and 15 both round to 16 at step 4
    const el1 = document.createElement('div');
    el1.style.fontSize = '14px';
    document.body.appendChild(el1);

    const el2 = document.createElement('div');
    el2.style.fontSize = '16px';
    document.body.appendChild(el2);

    // Both should round to 16 (step 4: 14/4=3.5→4*4=16, 16/4=4→4*4=16)
    expect(hashComponent(el1)).toBe(hashComponent(el2));
  });
});
