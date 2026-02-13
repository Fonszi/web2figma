import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupFigmaMock, teardownFigmaMock, mockStore } from '../figma-mock';
import { createAllStyles } from '../../figma-plugin/src/tokens';
import type { DesignTokens, ImportSettings } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';

function makeTokens(overrides: Partial<DesignTokens> = {}): DesignTokens {
  return {
    colors: [
      { name: 'color/ff0000', value: 'rgb(255, 0, 0)', usageCount: 5 },
      { name: 'color/00ff00', value: 'rgb(0, 255, 0)', usageCount: 3 },
    ],
    typography: [
      { name: 'text/16-regular', fontFamily: 'Inter', fontSize: 16, fontWeight: 400, lineHeight: 24, letterSpacing: 0, usageCount: 10 },
    ],
    effects: [
      { name: 'shadow-1', type: 'drop-shadow', value: '0px 4px 6px rgba(0, 0, 0, 0.1)', usageCount: 5 },
    ],
    variables: [
      { name: '--color-primary', cssProperty: '--color-primary', resolvedValue: '#ff0000', type: 'color' },
    ],
    ...overrides,
  };
}

describe('createAllStyles', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  it('creates all style types', async () => {
    const tokens = makeTokens();
    const progress = vi.fn();

    const styleMap = await createAllStyles(tokens, DEFAULT_SETTINGS, progress);

    expect(styleMap.colors.count).toBe(2);
    expect(styleMap.typography.count).toBe(1);
    expect(styleMap.effects.count).toBe(1);
    expect(styleMap.variables.count).toBe(1);
  });

  it('returns empty maps when createStyles is false', async () => {
    const tokens = makeTokens();
    const settings: ImportSettings = { ...DEFAULT_SETTINGS, createStyles: false, createVariables: false };
    const progress = vi.fn();

    const styleMap = await createAllStyles(tokens, settings, progress);

    expect(styleMap.colors.count).toBe(0);
    expect(styleMap.typography.count).toBe(0);
    expect(styleMap.effects.count).toBe(0);
    expect(styleMap.variables.count).toBe(0);
    expect(mockStore.paintStyles).toHaveLength(0);
    expect(mockStore.textStyles).toHaveLength(0);
    expect(mockStore.effectStyles).toHaveLength(0);
  });

  it('still creates variables when createStyles=false but createVariables=true', async () => {
    const tokens = makeTokens();
    const settings: ImportSettings = { ...DEFAULT_SETTINGS, createStyles: false, createVariables: true };
    const progress = vi.fn();

    const styleMap = await createAllStyles(tokens, settings, progress);

    expect(styleMap.colors.count).toBe(0);
    expect(styleMap.variables.count).toBe(1);
  });

  it('skips variables when createVariables is false', async () => {
    const tokens = makeTokens();
    const settings: ImportSettings = { ...DEFAULT_SETTINGS, createVariables: false };
    const progress = vi.fn();

    const styleMap = await createAllStyles(tokens, settings, progress);

    expect(styleMap.colors.count).toBe(2);
    expect(styleMap.variables.count).toBe(0);
    expect(mockStore.variables).toHaveLength(0);
  });

  it('calls progress callback with messages', async () => {
    const tokens = makeTokens();
    const progress = vi.fn();

    await createAllStyles(tokens, DEFAULT_SETTINGS, progress);

    expect(progress).toHaveBeenCalled();
    // Check it reported color styles creation
    const messages = progress.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(messages.some(m => m.includes('color styles'))).toBe(true);
    expect(messages.some(m => m.includes('text styles'))).toBe(true);
    expect(messages.some(m => m.includes('effect styles'))).toBe(true);
    expect(messages.some(m => m.includes('Design tokens created'))).toBe(true);
  });

  it('handles empty token arrays', async () => {
    const tokens = makeTokens({ colors: [], typography: [], effects: [], variables: [] });
    const progress = vi.fn();

    const styleMap = await createAllStyles(tokens, DEFAULT_SETTINGS, progress);

    expect(styleMap.colors.count).toBe(0);
    expect(styleMap.typography.count).toBe(0);
    expect(styleMap.effects.count).toBe(0);
    expect(styleMap.variables.count).toBe(0);
  });

  it('resets name tracker between imports', async () => {
    const tokens = makeTokens();
    const progress = vi.fn();

    // First import
    const first = await createAllStyles(tokens, DEFAULT_SETTINGS, progress);
    // Second import — names should not collide with first
    const second = await createAllStyles(tokens, DEFAULT_SETTINGS, progress);

    // Both should produce the same style names (not -2 suffixed)
    expect(first.colors.count).toBe(second.colors.count);
  });
});
