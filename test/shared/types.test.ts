import { describe, it, expect } from 'vitest';
import { isMultiViewport } from '../../shared/types';
import type { ExtractionResult, MultiViewportResult } from '../../shared/types';
import { makeFrame } from '../helpers';

describe('isMultiViewport', () => {
  const mockSingleResult: ExtractionResult = {
    url: 'https://example.com',
    viewport: { width: 1440, height: 900 },
    timestamp: Date.now(),
    framework: 'unknown',
    rootNode: makeFrame(),
    tokens: { colors: [], typography: [], effects: [], variables: [] },
    components: [],
    fonts: [],
    metadata: { title: 'Test', isFramerSite: false },
  };

  const mockMultiResult: MultiViewportResult = {
    type: 'multi-viewport',
    url: 'https://example.com',
    timestamp: Date.now(),
    extractions: [
      {
        viewportKey: 'desktop',
        label: 'Desktop',
        width: 1440,
        height: 900,
        result: mockSingleResult,
      },
    ],
  };

  it('returns true for MultiViewportResult', () => {
    expect(isMultiViewport(mockMultiResult)).toBe(true);
  });

  it('returns false for plain ExtractionResult', () => {
    expect(isMultiViewport(mockSingleResult)).toBe(false);
  });

  it('returns true when type field is "multi-viewport"', () => {
    const payload = { type: 'multi-viewport' as const, url: '', timestamp: 0, extractions: [] };
    expect(isMultiViewport(payload)).toBe(true);
  });

  it('returns false when no type field exists', () => {
    const payload = { url: '', viewport: { width: 0, height: 0 }, timestamp: 0 } as unknown as ExtractionResult;
    expect(isMultiViewport(payload as any)).toBe(false);
  });
});
