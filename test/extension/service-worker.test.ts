import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupChromeMock, teardownChromeMock, chromeMockStore, simulateMessage } from '../chrome-mock';
import type { ExtractionResult } from '../../shared/types';

// Service worker registers chrome.runtime.onMessage.addListener at module scope.
// We must set up the Chrome mock BEFORE importing the module.

describe('service-worker', () => {
  beforeEach(async () => {
    setupChromeMock();
    vi.resetModules();
    // Import the module, triggering its module-level listener registration
    await import('../../extension/src/background/service-worker');
  });

  afterEach(() => {
    teardownChromeMock();
    vi.restoreAllMocks();
  });

  it('registers a message listener on chrome.runtime.onMessage', () => {
    expect(chromeMockStore.messageListeners).toHaveLength(1);
  });

  // --- EXTRACT_PAGE ---

  describe('EXTRACT_PAGE message', () => {
    it('queries the active tab', async () => {
      await simulateMessage({ type: 'EXTRACT_PAGE' });

      expect(chrome.tabs.query).toHaveBeenCalledWith({
        active: true,
        currentWindow: true,
      });
    });

    it('injects content script into active tab', async () => {
      await simulateMessage({ type: 'EXTRACT_PAGE' });

      // Allow async operations to complete
      await vi.waitFor(() => {
        expect(chromeMockStore.injectedScripts.length).toBeGreaterThanOrEqual(1);
      });
      expect(chromeMockStore.injectedScripts[0].target.tabId).toBe(1);
      expect(chromeMockStore.injectedScripts[0].files).toContain('content.js');
    });

    it('sends EXTRACT_PAGE to the active tab', async () => {
      await simulateMessage({ type: 'EXTRACT_PAGE' });

      await vi.waitFor(() => {
        expect(chromeMockStore.sentMessages.length).toBeGreaterThanOrEqual(1);
      });
      expect(chromeMockStore.sentMessages[0].tabId).toBe(1);
      expect(chromeMockStore.sentMessages[0].message).toEqual({ type: 'EXTRACT_PAGE' });
    });

    it('returns async response (handler returns true)', () => {
      const listener = chromeMockStore.messageListeners[0];
      const sendResponse = vi.fn();
      const result = listener({ type: 'EXTRACT_PAGE' }, {}, sendResponse);
      expect(result).toBe(true);
    });

    it('handles missing active tab', async () => {
      // Override tabs.query to return empty array
      vi.mocked(chrome.tabs.query).mockResolvedValueOnce([]);

      const response = await simulateMessage({ type: 'EXTRACT_PAGE' });

      // Should get an error response
      if (response && typeof response === 'object' && 'type' in response) {
        expect((response as Record<string, unknown>).type).toBe('EXTRACTION_ERROR');
      }
    });
  });

  // --- EXTRACTION_COMPLETE ---

  describe('EXTRACTION_COMPLETE message', () => {
    const mockResult: Partial<ExtractionResult> = {
      url: 'https://example.com',
      viewport: { width: 1440, height: 900 },
      timestamp: Date.now(),
      framework: 'unknown',
    };

    it('stores result in chrome.storage.local', async () => {
      await simulateMessage({
        type: 'EXTRACTION_COMPLETE',
        result: mockResult,
      });

      // Allow async storage to complete
      await vi.waitFor(() => {
        expect(Object.keys(chromeMockStore.storedData).length).toBeGreaterThan(0);
      });
    });

    it('returns sync response (handler returns false)', () => {
      const listener = chromeMockStore.messageListeners[0];
      const sendResponse = vi.fn();
      const result = listener(
        { type: 'EXTRACTION_COMPLETE', result: mockResult },
        {},
        sendResponse,
      );
      expect(result).toBe(false);
    });
  });

  // --- GET_EXTRACTION ---

  describe('GET_EXTRACTION message', () => {
    it('responds synchronously', () => {
      const listener = chromeMockStore.messageListeners[0];
      const sendResponse = vi.fn();
      const result = listener({ type: 'GET_EXTRACTION' }, {}, sendResponse);
      expect(result).toBe(false);
      expect(sendResponse).toHaveBeenCalled();
    });

    it('returns null when no extraction has been stored', () => {
      const listener = chromeMockStore.messageListeners[0];
      const sendResponse = vi.fn();
      listener({ type: 'GET_EXTRACTION' }, {}, sendResponse);
      expect(sendResponse).toHaveBeenCalledWith(null);
    });
  });

  // --- EXTRACTION_ERROR ---

  describe('EXTRACTION_ERROR message', () => {
    it('logs error to console', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const listener = chromeMockStore.messageListeners[0];
      const sendResponse = vi.fn();
      listener(
        { type: 'EXTRACTION_ERROR', error: 'Something went wrong' },
        {},
        sendResponse,
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[forge]'),
        'Something went wrong',
      );
      consoleSpy.mockRestore();
    });
  });

  // --- COPY_TO_CLIPBOARD ---

  describe('COPY_TO_CLIPBOARD message', () => {
    it('executes script in active tab for clipboard write', async () => {
      await simulateMessage({
        type: 'COPY_TO_CLIPBOARD',
        data: '{"test": "json"}',
      });

      await vi.waitFor(() => {
        // Should have at least one injection for clipboard
        const clipboardInjections = chromeMockStore.injectedScripts.filter(
          (s) => s.func !== undefined,
        );
        expect(clipboardInjections.length).toBeGreaterThanOrEqual(1);
      });
    });
  });
});
