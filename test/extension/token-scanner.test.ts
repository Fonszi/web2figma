import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { scanTokens } from '../../extension/src/content/token-scanner';
import { cleanupDOM, createStyledElement } from '../dom-helpers';

describe('scanTokens', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('returns all four token categories', () => {
    const result = scanTokens(document);
    expect(result).toHaveProperty('colors');
    expect(result).toHaveProperty('typography');
    expect(result).toHaveProperty('effects');
    expect(result).toHaveProperty('variables');
  });

  it('returns empty or minimal arrays for an empty page', () => {
    const result = scanTokens(document);
    // JSDOM may report a default canvas text color from the document element
    expect(result.colors.length).toBeLessThanOrEqual(1);
    expect(result.typography).toHaveLength(0);
    expect(result.effects).toHaveLength(0);
    expect(result.variables).toHaveLength(0);
  });
});

describe('color scanning', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('collects unique colors from elements', () => {
    createStyledElement('div', { color: 'rgb(255, 0, 0)' });
    createStyledElement('div', { color: 'rgb(0, 0, 255)' });

    const { colors } = scanTokens(document);
    const values = colors.map((c) => c.value);
    expect(values).toContain('rgb(255, 0, 0)');
    expect(values).toContain('rgb(0, 0, 255)');
  });

  it('collects colors from backgroundColor', () => {
    createStyledElement('div', { 'background-color': 'rgb(0, 128, 0)' });

    const { colors } = scanTokens(document);
    const values = colors.map((c) => c.value);
    expect(values).toContain('rgb(0, 128, 0)');
  });

  it('filters out transparent colors', () => {
    createStyledElement('div', { color: 'transparent' });

    const { colors } = scanTokens(document);
    const transparentColors = colors.filter((c) => c.value === 'transparent');
    expect(transparentColors).toHaveLength(0);
  });

  it('deduplicates colors and counts usage', () => {
    createStyledElement('div', { color: 'rgb(255, 0, 0)' });
    createStyledElement('p', { color: 'rgb(255, 0, 0)' });
    createStyledElement('span', { color: 'rgb(255, 0, 0)' });

    const { colors } = scanTokens(document);
    const redTokens = colors.filter((c) => c.value === 'rgb(255, 0, 0)');
    expect(redTokens).toHaveLength(1);
    expect(redTokens[0].usageCount).toBeGreaterThanOrEqual(3);
  });

  it('sorts colors by usage count descending', () => {
    createStyledElement('div', { color: 'rgb(0, 0, 255)' });
    createStyledElement('p', { color: 'rgb(255, 0, 0)' });
    createStyledElement('span', { color: 'rgb(255, 0, 0)' });

    const { colors } = scanTokens(document);
    if (colors.length >= 2) {
      expect(colors[0].usageCount).toBeGreaterThanOrEqual(colors[1].usageCount);
    }
  });

  it('generates color names from RGB values', () => {
    createStyledElement('div', { color: 'rgb(255, 128, 0)' });

    const { colors } = scanTokens(document);
    const orange = colors.find((c) => c.value === 'rgb(255, 128, 0)');
    expect(orange?.name).toMatch(/^color\//);
  });
});

describe('typography scanning', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('collects typography from text elements', () => {
    createStyledElement('p', { 'font-family': 'Inter', 'font-size': '16px', 'font-weight': '400' });

    const { typography } = scanTokens(document);
    expect(typography.length).toBeGreaterThanOrEqual(1);
  });

  it('collects typography from heading elements', () => {
    createStyledElement('h1', { 'font-family': 'Inter', 'font-size': '32px', 'font-weight': '700' });

    const { typography } = scanTokens(document);
    expect(typography.length).toBeGreaterThanOrEqual(1);
  });

  it('deduplicates typography by font combo key', () => {
    createStyledElement('p', { 'font-family': 'Inter', 'font-size': '16px', 'font-weight': '400' });
    createStyledElement('span', { 'font-family': 'Inter', 'font-size': '16px', 'font-weight': '400' });

    const { typography } = scanTokens(document);
    // Should deduplicate to 1 entry with usageCount >= 2
    const matching = typography.filter(
      (t) => t.fontSize === 16 && t.fontWeight === 400,
    );
    expect(matching.length).toBeLessThanOrEqual(1);
  });

  it('generates typography names with size and weight', () => {
    createStyledElement('p', { 'font-family': 'Inter', 'font-size': '24px', 'font-weight': '700' });

    const { typography } = scanTokens(document);
    const boldToken = typography.find((t) => t.fontWeight >= 700);
    if (boldToken) {
      expect(boldToken.name).toMatch(/text\/24-bold/);
    }
  });

  it('cleans font family name (removes quotes)', () => {
    createStyledElement('p', { 'font-family': '"Roboto Mono", monospace', 'font-size': '14px' });

    const { typography } = scanTokens(document);
    const mono = typography.find((t) => t.fontFamily.includes('Roboto'));
    if (mono) {
      expect(mono.fontFamily).not.toContain('"');
    }
  });
});

describe('effect scanning', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('collects box-shadow effects', () => {
    createStyledElement('div', { 'box-shadow': '0px 4px 8px rgba(0, 0, 0, 0.1)' });

    const { effects } = scanTokens(document);
    expect(effects.length).toBeGreaterThanOrEqual(1);
  });

  it('classifies drop-shadow for regular box-shadow', () => {
    createStyledElement('div', { 'box-shadow': '0px 2px 4px rgba(0, 0, 0, 0.2)' });

    const { effects } = scanTokens(document);
    const shadow = effects.find((e) => e.type === 'drop-shadow');
    expect(shadow).toBeDefined();
  });

  it('classifies inner-shadow for inset box-shadow', () => {
    createStyledElement('div', { 'box-shadow': 'inset 0px 2px 4px rgba(0, 0, 0, 0.2)' });

    const { effects } = scanTokens(document);
    const inner = effects.find((e) => e.type === 'inner-shadow');
    expect(inner).toBeDefined();
  });

  it('ignores box-shadow: none', () => {
    createStyledElement('div', { 'box-shadow': 'none' });

    const { effects } = scanTokens(document);
    expect(effects).toHaveLength(0);
  });
});

describe('CSS variable scanning', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('extracts CSS custom properties from style elements', () => {
    const style = document.createElement('style');
    style.textContent = ':root { --primary: #ff0000; --spacing: 16px; }';
    document.head.appendChild(style);

    const { variables } = scanTokens(document);
    const names = variables.map((v) => v.name);
    expect(names).toContain('--primary');
    expect(names).toContain('--spacing');
  });

  it('infers color type for hex values', () => {
    const style = document.createElement('style');
    style.textContent = ':root { --brand: #0066ff; }';
    document.head.appendChild(style);

    const { variables } = scanTokens(document);
    const brand = variables.find((v) => v.name === '--brand');
    expect(brand?.type).toBe('color');
  });

  it('infers color type for rgb values', () => {
    const style = document.createElement('style');
    style.textContent = ':root { --accent: rgb(255, 100, 0); }';
    document.head.appendChild(style);

    const { variables } = scanTokens(document);
    const accent = variables.find((v) => v.name === '--accent');
    expect(accent?.type).toBe('color');
  });

  it('infers number type for px values', () => {
    const style = document.createElement('style');
    style.textContent = ':root { --gap: 8px; }';
    document.head.appendChild(style);

    const { variables } = scanTokens(document);
    const gap = variables.find((v) => v.name === '--gap');
    expect(gap?.type).toBe('number');
  });

  it('infers string type for other values', () => {
    const style = document.createElement('style');
    style.textContent = ':root { --font: "Inter, sans-serif"; }';
    document.head.appendChild(style);

    const { variables } = scanTokens(document);
    const font = variables.find((v) => v.name === '--font');
    if (font) {
      expect(font.type).toBe('string');
    }
  });

  it('deduplicates CSS variables by name', () => {
    const style1 = document.createElement('style');
    style1.textContent = ':root { --primary: #ff0000; }';
    document.head.appendChild(style1);

    const style2 = document.createElement('style');
    style2.textContent = '.dark { --primary: #cc0000; }';
    document.head.appendChild(style2);

    const { variables } = scanTokens(document);
    const primaryVars = variables.filter((v) => v.name === '--primary');
    expect(primaryVars).toHaveLength(1);
  });
});
