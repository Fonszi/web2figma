import { describe, it, expect } from 'vitest';
import { enhanceFramerTokens, isFramerVariable, cleanFramerVarName } from '../../figma-plugin/src/framer/tokens';
import type { DesignTokens, VariableToken, ColorToken } from '../../shared/types';

function makeTokens(overrides: Partial<DesignTokens> = {}): DesignTokens {
  return {
    colors: [],
    typography: [],
    effects: [],
    variables: [],
    ...overrides,
  };
}

describe('isFramerVariable', () => {
  it('matches --token-{hash}-{name} pattern', () => {
    expect(isFramerVariable('--token-abc123-color-primary')).toBe(true);
    expect(isFramerVariable('--token-x1y2-spacing-md')).toBe(true);
  });

  it('matches --framer-{name} pattern', () => {
    expect(isFramerVariable('--framer-font-family')).toBe(true);
    expect(isFramerVariable('--framer-paragraph-spacing')).toBe(true);
  });

  it('rejects regular CSS variables', () => {
    expect(isFramerVariable('--color-primary')).toBe(false);
    expect(isFramerVariable('--spacing-md')).toBe(false);
  });
});

describe('cleanFramerVarName', () => {
  it('strips --token-{hash}- prefix', () => {
    expect(cleanFramerVarName('--token-abc123-color-primary')).toBe('color-primary');
    expect(cleanFramerVarName('--token-x1y2z3-spacing-md')).toBe('spacing-md');
  });

  it('strips --framer- prefix', () => {
    expect(cleanFramerVarName('--framer-font-family')).toBe('font-family');
  });

  it('strips leading dashes from regular vars', () => {
    expect(cleanFramerVarName('--color-primary')).toBe('color-primary');
  });
});

describe('enhanceFramerTokens', () => {
  it('does not mutate the input', () => {
    const tokens = makeTokens({
      variables: [{ name: '--token-abc-color-primary', cssProperty: '--token-abc-color-primary', resolvedValue: '#ff0000', type: 'color' }],
    });
    const original = JSON.stringify(tokens);

    enhanceFramerTokens(tokens);

    expect(JSON.stringify(tokens)).toBe(original);
  });

  it('cleans Framer variable names', () => {
    const tokens = makeTokens({
      variables: [
        { name: '--token-abc123-color-primary', cssProperty: '--token-abc123-color-primary', resolvedValue: '#ff0000', type: 'color' },
        { name: '--token-abc123-spacing-md', cssProperty: '--token-abc123-spacing-md', resolvedValue: '16px', type: 'number' },
      ],
    });

    const result = enhanceFramerTokens(tokens);

    expect(result.variables[0]!.name).toBe('color-primary');
    expect(result.variables[1]!.name).toBe('spacing-md');
  });

  it('adds collection prefix for ungrouped color variables', () => {
    const tokens = makeTokens({
      variables: [
        { name: '--token-abc-primary', cssProperty: '--token-abc-primary', resolvedValue: '#ff0000', type: 'color' as const },
      ],
    });

    const result = enhanceFramerTokens(tokens);

    expect(result.variables[0]!.name).toBe('color/primary');
  });

  it('adds collection prefix for ungrouped number variables', () => {
    const tokens = makeTokens({
      variables: [
        { name: '--token-abc-md', cssProperty: '--token-abc-md', resolvedValue: '16', type: 'number' as const },
      ],
    });

    const result = enhanceFramerTokens(tokens);

    expect(result.variables[0]!.name).toBe('spacing/md');
  });

  it('preserves already-categorized variable names', () => {
    const tokens = makeTokens({
      variables: [
        { name: '--token-abc-color-primary', cssProperty: '--token-abc-color-primary', resolvedValue: '#ff0000', type: 'color' },
      ],
    });

    const result = enhanceFramerTokens(tokens);

    // Already starts with "color", should NOT add "color/" prefix
    expect(result.variables[0]!.name).toBe('color-primary');
  });

  it('leaves non-Framer variables unchanged', () => {
    const tokens = makeTokens({
      variables: [
        { name: '--color-primary', cssProperty: '--color-primary', resolvedValue: '#ff0000', type: 'color' },
      ],
    });

    const result = enhanceFramerTokens(tokens);

    expect(result.variables[0]!.name).toBe('--color-primary');
  });

  it('enhances color token names from Framer CSS variables', () => {
    const tokens = makeTokens({
      colors: [
        { name: 'color/ff0000', value: 'rgb(255, 0, 0)', usageCount: 5, cssVariable: '--token-abc-brand-red' },
      ],
    });

    const result = enhanceFramerTokens(tokens);

    expect(result.colors[0]!.name).toBe('brand-red');
  });

  it('leaves color tokens without Framer CSS vars unchanged', () => {
    const tokens = makeTokens({
      colors: [
        { name: 'color/ff0000', value: 'rgb(255, 0, 0)', usageCount: 5 },
      ],
    });

    const result = enhanceFramerTokens(tokens);

    expect(result.colors[0]!.name).toBe('color/ff0000');
  });

  it('preserves typography and effects unchanged', () => {
    const tokens = makeTokens({
      typography: [{ name: 'text/16-bold', fontFamily: 'Inter', fontSize: 16, fontWeight: 700, lineHeight: 24, letterSpacing: 0, usageCount: 3 }],
      effects: [{ name: 'effect/drop-shadow-1', type: 'drop-shadow', value: '0 2px 4px rgba(0,0,0,0.1)', usageCount: 2 }],
    });

    const result = enhanceFramerTokens(tokens);

    expect(result.typography).toEqual(tokens.typography);
    expect(result.effects).toEqual(tokens.effects);
  });

  it('handles empty tokens', () => {
    const tokens = makeTokens();
    const result = enhanceFramerTokens(tokens);

    expect(result.colors).toHaveLength(0);
    expect(result.variables).toHaveLength(0);
  });
});
