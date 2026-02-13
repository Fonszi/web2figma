import { describe, it, expect } from 'vitest';
import { getFramerName, isFramerSection, cleanFramerName } from '../../figma-plugin/src/framer/naming';
import { makeFrame, makeText } from '../helpers';

describe('getFramerName', () => {
  it('returns data-framer-name when available', () => {
    const node = makeFrame({
      dataAttributes: { 'data-framer-name': 'Hero Section' },
    });
    expect(getFramerName(node)).toBe('Hero Section');
  });

  it('returns data-framer-component-type as fallback', () => {
    const node = makeFrame({
      dataAttributes: { 'data-framer-component-type': 'Card' },
    });
    expect(getFramerName(node)).toBe('Card');
  });

  it('prefers data-framer-name over component-type', () => {
    const node = makeFrame({
      dataAttributes: {
        'data-framer-name': 'Navigation',
        'data-framer-component-type': 'NavBar',
      },
    });
    expect(getFramerName(node)).toBe('Navigation');
  });

  it('returns null when no Framer metadata', () => {
    const node = makeFrame();
    expect(getFramerName(node)).toBeNull();
  });

  it('returns null when dataAttributes is undefined', () => {
    const node = makeFrame({ dataAttributes: undefined });
    expect(getFramerName(node)).toBeNull();
  });

  it('cleans hash suffixes from names', () => {
    const node = makeFrame({
      dataAttributes: { 'data-framer-name': 'Features__abc123' },
    });
    expect(getFramerName(node)).toBe('Features');
  });
});

describe('cleanFramerName', () => {
  it('strips __hash suffixes', () => {
    expect(cleanFramerName('Hero__3k2j')).toBe('Hero');
    expect(cleanFramerName('Section__abc123')).toBe('Section');
  });

  it('strips _longhash suffixes', () => {
    expect(cleanFramerName('Card_abc123def')).toBe('Card');
  });

  it('strips framer- prefix from IDs', () => {
    expect(cleanFramerName('framer-abc123')).toBe('abc123');
  });

  it('does not strip framer- prefix from regular names', () => {
    expect(cleanFramerName('framer-navigation bar')).toBe('framer-navigation bar');
  });

  it('collapses multiple spaces', () => {
    expect(cleanFramerName('Hero   Section')).toBe('Hero Section');
  });

  it('preserves clean names unchanged', () => {
    expect(cleanFramerName('Hero Section')).toBe('Hero Section');
    expect(cleanFramerName('Card')).toBe('Card');
  });

  it('returns original if cleaning produces empty string', () => {
    expect(cleanFramerName('   ')).toBe('');
  });
});

describe('isFramerSection', () => {
  it('detects section with data-framer-name and children', () => {
    const node = makeFrame({
      dataAttributes: { 'data-framer-name': 'Hero' },
      children: [makeText('content')],
    });
    expect(isFramerSection(node)).toBe(true);
  });

  it('rejects node without children', () => {
    const node = makeFrame({
      dataAttributes: { 'data-framer-name': 'Empty' },
      children: [],
    });
    expect(isFramerSection(node)).toBe(false);
  });

  it('rejects node without data attributes', () => {
    const node = makeFrame({ children: [makeText('content')] });
    expect(isFramerSection(node)).toBe(false);
  });

  it('detects section by component type containing "Section"', () => {
    const node = makeFrame({
      dataAttributes: { 'data-framer-component-type': 'HeroSection' },
      children: [makeText('content')],
    });
    expect(isFramerSection(node)).toBe(true);
  });

  it('detects section by component type containing "Page"', () => {
    const node = makeFrame({
      dataAttributes: { 'data-framer-component-type': 'PageWrapper' },
      children: [makeText('content')],
    });
    expect(isFramerSection(node)).toBe(true);
  });

  it('rejects non-section component types', () => {
    const node = makeFrame({
      dataAttributes: { 'data-framer-component-type': 'Button' },
      children: [makeText('content')],
    });
    expect(isFramerSection(node)).toBe(false);
  });
});
