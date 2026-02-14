import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectFramerSite, getFramerNodeInfo } from '../../extension/src/content/framer-detector';
import { cleanupDOM } from '../dom-helpers';

describe('detectFramerSite', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
    // Clean up __framer_metadata if set
    delete (window as Record<string, unknown>).__framer_metadata;
  });

  // --- No signals ---

  it('returns isFramerSite false for a plain page', () => {
    const result = detectFramerSite(document);
    expect(result.isFramerSite).toBe(false);
    expect(result.framerProjectId).toBeUndefined();
    expect(result.componentBoundaries).toHaveLength(0);
  });

  // --- Signal 1: framerusercontent.com assets ---

  it('detects framerusercontent.com in img src', () => {
    const img = document.createElement('img');
    img.src = 'https://framerusercontent.com/images/abc.png';
    document.body.appendChild(img);

    const result = detectFramerSite(document);
    expect(result.isFramerSite).toBe(true);
  });

  it('detects framerusercontent.com in source src', () => {
    const picture = document.createElement('picture');
    const source = document.createElement('source');
    source.src = 'https://framerusercontent.com/images/abc.webp';
    picture.appendChild(source);
    document.body.appendChild(picture);

    const result = detectFramerSite(document);
    expect(result.isFramerSite).toBe(true);
  });

  it('detects framerusercontent.com in link href', () => {
    const link = document.createElement('link');
    link.href = 'https://framerusercontent.com/styles/main.css';
    document.head.appendChild(link);

    const result = detectFramerSite(document);
    expect(result.isFramerSite).toBe(true);
  });

  // --- Signal 2: data-framer-* attributes ---

  it('detects data-framer-component-type attribute', () => {
    const div = document.createElement('div');
    div.setAttribute('data-framer-component-type', 'Hero');
    document.body.appendChild(div);

    const result = detectFramerSite(document);
    expect(result.isFramerSite).toBe(true);
  });

  it('detects data-framer-name attribute', () => {
    const div = document.createElement('div');
    div.setAttribute('data-framer-name', 'Header');
    document.body.appendChild(div);

    const result = detectFramerSite(document);
    expect(result.isFramerSite).toBe(true);
  });

  it('detects data-framer-appear-id attribute', () => {
    const div = document.createElement('div');
    div.setAttribute('data-framer-appear-id', 'abc123');
    document.body.appendChild(div);

    const result = detectFramerSite(document);
    expect(result.isFramerSite).toBe(true);
  });

  // --- Signal 3: Framer runtime scripts ---

  it('detects framer.com/m/ runtime script', () => {
    const script = document.createElement('script');
    script.src = 'https://framer.com/m/runtime.js';
    document.body.appendChild(script);

    const result = detectFramerSite(document);
    expect(result.isFramerSite).toBe(true);
  });

  it('detects framerusercontent.com runtime script', () => {
    const script = document.createElement('script');
    script.src = 'https://framerusercontent.com/scripts/bundle.js';
    document.body.appendChild(script);

    const result = detectFramerSite(document);
    expect(result.isFramerSite).toBe(true);
  });

  // --- Signal 4: __framer_metadata global ---

  it('detects __framer_metadata global', () => {
    (window as Record<string, unknown>).__framer_metadata = { projectId: 'proj_123' };

    const result = detectFramerSite(document);
    expect(result.isFramerSite).toBe(true);
  });

  it('extracts framerProjectId from __framer_metadata', () => {
    (window as Record<string, unknown>).__framer_metadata = { projectId: 'my-project-id' };

    const result = detectFramerSite(document);
    expect(result.framerProjectId).toBe('my-project-id');
  });

  it('handles __framer_metadata without projectId', () => {
    (window as Record<string, unknown>).__framer_metadata = { version: '2.0' };

    const result = detectFramerSite(document);
    expect(result.isFramerSite).toBe(true);
    expect(result.framerProjectId).toBeUndefined();
  });

  // --- Component boundaries ---

  it('collects elements with data-framer-component-type', () => {
    const hero = document.createElement('div');
    hero.setAttribute('data-framer-component-type', 'Hero');
    const nav = document.createElement('nav');
    nav.setAttribute('data-framer-component-type', 'Navigation');
    document.body.appendChild(hero);
    document.body.appendChild(nav);

    const result = detectFramerSite(document);
    expect(result.componentBoundaries).toHaveLength(2);
  });

  it('returns empty componentBoundaries for non-Framer page', () => {
    const result = detectFramerSite(document);
    expect(result.componentBoundaries).toHaveLength(0);
  });

  // --- Multiple signals ---

  it('detects with multiple signals combined', () => {
    const img = document.createElement('img');
    img.src = 'https://framerusercontent.com/images/abc.png';
    document.body.appendChild(img);

    const div = document.createElement('div');
    div.setAttribute('data-framer-component-type', 'Card');
    document.body.appendChild(div);

    const result = detectFramerSite(document);
    expect(result.isFramerSite).toBe(true);
    expect(result.componentBoundaries).toHaveLength(1);
  });
});

describe('getFramerNodeInfo', () => {
  it('returns componentType and name from data attributes', () => {
    const el = document.createElement('div');
    el.setAttribute('data-framer-component-type', 'Button');
    el.setAttribute('data-framer-name', 'Primary CTA');

    const info = getFramerNodeInfo(el);
    expect(info).toEqual({ componentType: 'Button', name: 'Primary CTA' });
  });

  it('returns only componentType when name is absent', () => {
    const el = document.createElement('div');
    el.setAttribute('data-framer-component-type', 'Card');

    const info = getFramerNodeInfo(el);
    expect(info?.componentType).toBe('Card');
    expect(info?.name).toBeUndefined();
  });

  it('returns only name when componentType is absent', () => {
    const el = document.createElement('div');
    el.setAttribute('data-framer-name', 'Hero');

    const info = getFramerNodeInfo(el);
    expect(info?.name).toBe('Hero');
    expect(info?.componentType).toBeUndefined();
  });

  it('returns null when no framer attributes exist', () => {
    const el = document.createElement('div');
    const info = getFramerNodeInfo(el);
    expect(info).toBeNull();
  });
});
