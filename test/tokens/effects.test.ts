import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupFigmaMock, teardownFigmaMock, mockStore } from '../figma-mock';
import { createEffectStyles } from '../../figma-plugin/src/tokens/effects';
import { resetNameTracker } from '../../figma-plugin/src/tokens/naming';
import type { EffectToken } from '../../shared/types';

describe('createEffectStyles', () => {
  beforeEach(() => {
    setupFigmaMock();
    resetNameTracker();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  it('creates EffectStyles from drop-shadow tokens', async () => {
    const tokens: EffectToken[] = [
      { name: 'shadow-1', type: 'drop-shadow', value: '0px 4px 6px rgba(0, 0, 0, 0.1)', usageCount: 5 },
    ];

    const result = await createEffectStyles(tokens);

    expect(result.count).toBe(1);
    expect(mockStore.effectStyles).toHaveLength(1);
    expect(mockStore.effectStyles[0]!.effects[0]).toMatchObject({
      type: 'DROP_SHADOW',
      visible: true,
    });
  });

  it('creates EffectStyles from inner-shadow tokens', async () => {
    const tokens: EffectToken[] = [
      { name: 'shadow-2', type: 'inner-shadow', value: 'inset 0px 2px 4px rgba(0, 0, 0, 0.2)', usageCount: 3 },
    ];

    const result = await createEffectStyles(tokens);

    expect(result.count).toBe(1);
    expect(mockStore.effectStyles[0]!.effects[0]).toMatchObject({
      type: 'INNER_SHADOW',
    });
  });

  it('deduplicates same shadow values', async () => {
    const tokens: EffectToken[] = [
      { name: 'a', type: 'drop-shadow', value: '0px 4px 6px rgba(0, 0, 0, 0.1)', usageCount: 5 },
      { name: 'b', type: 'drop-shadow', value: '0px 4px 6px rgba(0, 0, 0, 0.1)', usageCount: 3 },
    ];

    const result = await createEffectStyles(tokens);
    expect(result.count).toBe(1);
  });

  it('skips unparseable shadow values', async () => {
    const tokens: EffectToken[] = [
      { name: 'bad', type: 'drop-shadow', value: 'not-a-shadow', usageCount: 1 },
      { name: 'good', type: 'drop-shadow', value: '0px 4px 6px rgba(0, 0, 0, 0.1)', usageCount: 1 },
    ];

    const result = await createEffectStyles(tokens);
    expect(result.count).toBe(1);
  });

  it('returns empty map for empty tokens', async () => {
    const result = await createEffectStyles([]);
    expect(result.count).toBe(0);
    expect(result.byValue.size).toBe(0);
  });

  it('sets style name', async () => {
    const tokens: EffectToken[] = [
      { name: 'shadow-1', type: 'drop-shadow', value: '0px 4px 6px rgba(0, 0, 0, 0.1)', usageCount: 1 },
    ];

    await createEffectStyles(tokens);
    expect(mockStore.effectStyles[0]!.name).toBe('effect/drop-shadow-1');
  });

  it('calls progress callback', async () => {
    const tokens: EffectToken[] = [
      { name: 'a', type: 'drop-shadow', value: '0px 4px 6px rgba(0, 0, 0, 0.1)', usageCount: 1 },
    ];

    const progress = vi.fn();
    await createEffectStyles(tokens, progress);
    expect(progress).toHaveBeenCalledWith(1, 1);
  });

  it('maps trimmed value to style ID', async () => {
    const tokens: EffectToken[] = [
      { name: 'a', type: 'drop-shadow', value: '  0px 4px 6px rgba(0, 0, 0, 0.1)  ', usageCount: 1 },
    ];

    const result = await createEffectStyles(tokens);
    const key = '0px 4px 6px rgba(0, 0, 0, 0.1)';
    expect(result.byValue.get(key)).toBe(mockStore.effectStyles[0]!.id);
  });
});
