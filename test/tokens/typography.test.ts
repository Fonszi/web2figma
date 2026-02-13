import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupFigmaMock, teardownFigmaMock, mockStore } from '../figma-mock';
import { createTypographyStyles, typographyKey } from '../../figma-plugin/src/tokens/typography';
import { resetNameTracker } from '../../figma-plugin/src/tokens/naming';
import type { TypographyToken } from '../../shared/types';

function makeToken(overrides: Partial<TypographyToken> = {}): TypographyToken {
  return {
    name: 'text/16-regular',
    fontFamily: 'Inter',
    fontSize: 16,
    fontWeight: 400,
    lineHeight: 24,
    letterSpacing: 0,
    usageCount: 1,
    ...overrides,
  };
}

describe('typographyKey', () => {
  it('builds pipe-separated key', () => {
    const token = makeToken();
    expect(typographyKey(token)).toBe('Inter|16|400|24|0');
  });
});

describe('createTypographyStyles', () => {
  beforeEach(() => {
    setupFigmaMock();
    resetNameTracker();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  it('creates TextStyles from typography tokens', async () => {
    const tokens = [makeToken(), makeToken({ fontWeight: 700, name: 'text/16-bold' })];
    const result = await createTypographyStyles(tokens);

    expect(result.count).toBe(2);
    expect(mockStore.textStyles).toHaveLength(2);
  });

  it('sets font properties on style', async () => {
    const tokens = [makeToken({ fontSize: 20, lineHeight: 28, letterSpacing: 0.5 })];
    const result = await createTypographyStyles(tokens);

    expect(result.count).toBe(1);
    const style = mockStore.textStyles[0]!;
    expect(style.fontSize).toBe(20);
    expect(style.lineHeight).toEqual({ value: 28, unit: 'PIXELS' });
    expect(style.letterSpacing).toEqual({ value: 0.5, unit: 'PIXELS' });
  });

  it('skips lineHeight when 0', async () => {
    const tokens = [makeToken({ lineHeight: 0 })];
    await createTypographyStyles(tokens);

    const style = mockStore.textStyles[0]!;
    expect(style.lineHeight).toBeUndefined();
  });

  it('skips letterSpacing when 0', async () => {
    const tokens = [makeToken({ letterSpacing: 0 })];
    await createTypographyStyles(tokens);

    const style = mockStore.textStyles[0]!;
    expect(style.letterSpacing).toBeUndefined();
  });

  it('deduplicates same typography key', async () => {
    const tokens = [makeToken(), makeToken()];
    const result = await createTypographyStyles(tokens);

    expect(result.count).toBe(1);
    expect(mockStore.textStyles).toHaveLength(1);
  });

  it('returns empty map for empty tokens', async () => {
    const result = await createTypographyStyles([]);
    expect(result.count).toBe(0);
    expect(result.byKey.size).toBe(0);
  });

  it('loads fonts via figma.loadFontAsync', async () => {
    await createTypographyStyles([makeToken()]);
    expect(mockStore.loadedFonts).toHaveLength(1);
  });

  it('skips style on font loading failure', async () => {
    const mock = (globalThis as any).figma;
    mock.loadFontAsync.mockRejectedValueOnce(new Error('Font not found'));

    const result = await createTypographyStyles([makeToken()]);
    expect(result.count).toBe(0);
    expect(mockStore.textStyles).toHaveLength(0);
  });

  it('calls progress callback', async () => {
    const tokens = [makeToken(), makeToken({ fontWeight: 700 })];
    const progress = vi.fn();
    await createTypographyStyles(tokens, progress);

    expect(progress).toHaveBeenCalledTimes(2);
    expect(progress).toHaveBeenCalledWith(1, 2);
    expect(progress).toHaveBeenCalledWith(2, 2);
  });

  it('maps key to style ID', async () => {
    const token = makeToken();
    const result = await createTypographyStyles([token]);

    const key = typographyKey(token);
    const styleId = result.byKey.get(key);
    expect(styleId).toBe(mockStore.textStyles[0]!.id);
  });
});
