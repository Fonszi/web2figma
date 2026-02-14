import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupChromeMock, teardownChromeMock, chromeMockStore, simulateMessage } from '../chrome-mock';
import { STORAGE_KEY_USAGE } from '../../shared/constants';
import type { UsageStats } from '../../shared/types';
import { getCurrentMonthKey } from '../../shared/licensing';

describe('usage-tracking (service worker)', () => {
  beforeEach(async () => {
    setupChromeMock();
    vi.resetModules();
    await import('../../extension/src/background/service-worker');
  });

  afterEach(() => {
    teardownChromeMock();
    vi.restoreAllMocks();
  });

  // --- GET_USAGE ---

  describe('GET_USAGE message', () => {
    it('returns null when no usage data exists', async () => {
      const result = await simulateMessage({ type: 'GET_USAGE' });
      expect(result).toBeNull();
    });

    it('returns stored usage stats', async () => {
      const stats: UsageStats = {
        extractionsThisMonth: 5,
        monthKey: getCurrentMonthKey(),
        lastExtractionAt: Date.now(),
      };
      chromeMockStore.storedData[STORAGE_KEY_USAGE] = stats;

      const result = await simulateMessage({ type: 'GET_USAGE' });
      expect(result).toEqual(stats);
    });
  });

  // --- Usage counter increment ---

  describe('extraction usage counter', () => {
    it('creates usage stats on first extraction', async () => {
      // Simulate EXTRACTION_COMPLETE (the service worker increments usage on this message)
      await simulateMessage({ type: 'EXTRACTION_COMPLETE', data: makeFakeExtraction() });

      // Allow async operations to settle
      await vi.waitFor(() => {
        expect(chromeMockStore.storedData[STORAGE_KEY_USAGE]).toBeDefined();
      });

      const stats = chromeMockStore.storedData[STORAGE_KEY_USAGE] as UsageStats;
      expect(stats.extractionsThisMonth).toBe(1);
      expect(stats.monthKey).toBe(getCurrentMonthKey());
    });

    it('increments existing usage counter', async () => {
      // Pre-populate with existing usage
      const existing: UsageStats = {
        extractionsThisMonth: 7,
        monthKey: getCurrentMonthKey(),
        lastExtractionAt: Date.now() - 60_000,
      };
      chromeMockStore.storedData[STORAGE_KEY_USAGE] = existing;

      await simulateMessage({ type: 'EXTRACTION_COMPLETE', data: makeFakeExtraction() });

      await vi.waitFor(() => {
        const stats = chromeMockStore.storedData[STORAGE_KEY_USAGE] as UsageStats;
        expect(stats.extractionsThisMonth).toBe(8);
      });
    });

    it('resets counter when month changes', async () => {
      // Pre-populate with last month's data
      const existing: UsageStats = {
        extractionsThisMonth: 14,
        monthKey: '2025-01', // old month
        lastExtractionAt: Date.now() - 86400_000 * 60,
      };
      chromeMockStore.storedData[STORAGE_KEY_USAGE] = existing;

      await simulateMessage({ type: 'EXTRACTION_COMPLETE', data: makeFakeExtraction() });

      await vi.waitFor(() => {
        const stats = chromeMockStore.storedData[STORAGE_KEY_USAGE] as UsageStats;
        // Should have reset to 0 then incremented to 1
        expect(stats.extractionsThisMonth).toBe(1);
        expect(stats.monthKey).toBe(getCurrentMonthKey());
      });
    });

    it('updates lastExtractionAt timestamp', async () => {
      const before = Date.now();

      await simulateMessage({ type: 'EXTRACTION_COMPLETE', data: makeFakeExtraction() });

      await vi.waitFor(() => {
        const stats = chromeMockStore.storedData[STORAGE_KEY_USAGE] as UsageStats;
        expect(stats.lastExtractionAt).toBeGreaterThanOrEqual(before);
      });
    });
  });
});

// Helper — minimal fake extraction result for triggering the usage counter
function makeFakeExtraction() {
  return {
    url: 'https://example.com',
    timestamp: Date.now(),
    viewport: { width: 1440, height: 900 },
    metadata: { title: 'Test', isFramerSite: false },
    rootNode: { type: 'frame', tag: 'div', visible: true, bounds: { x: 0, y: 0, width: 1440, height: 900 }, children: [] },
    tokens: { colors: [], typography: [], effects: [], variables: [] },
    components: [],
  };
}
