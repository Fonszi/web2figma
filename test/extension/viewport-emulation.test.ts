import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanupDOM } from '../dom-helpers';
import { setupChromeMock, teardownChromeMock, chromeMockStore } from '../chrome-mock';

describe('viewport emulation', () => {
  let emulateViewport: typeof import('../../extension/src/content/extractor').emulateViewport;
  let restoreViewport: typeof import('../../extension/src/content/extractor').restoreViewport;
  let extractPageAtViewport: typeof import('../../extension/src/content/extractor').extractPageAtViewport;

  beforeEach(async () => {
    cleanupDOM();
    setupChromeMock();
    vi.resetModules();
    vi.useFakeTimers();

    const mod = await import('../../extension/src/content/extractor');
    emulateViewport = mod.emulateViewport;
    restoreViewport = mod.restoreViewport;
    extractPageAtViewport = mod.extractPageAtViewport;
  });

  afterEach(() => {
    cleanupDOM();
    teardownChromeMock();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('emulateViewport', () => {
    it('injects a style element with the viewport override ID', async () => {
      const promise = emulateViewport(375);
      vi.advanceTimersByTime(300);
      await promise;

      const style = document.getElementById('forge-viewport-override');
      expect(style).not.toBeNull();
      expect(style?.tagName.toLowerCase()).toBe('style');
    });

    it('sets max-width to the specified width', async () => {
      const promise = emulateViewport(768);
      vi.advanceTimersByTime(300);
      await promise;

      const style = document.getElementById('forge-viewport-override');
      expect(style?.textContent).toContain('max-width: 768px');
    });

    it('sets overflow-x to hidden', async () => {
      const promise = emulateViewport(375);
      vi.advanceTimersByTime(300);
      await promise;

      const style = document.getElementById('forge-viewport-override');
      expect(style?.textContent).toContain('overflow-x: hidden');
    });

    it('reuses existing style element on second call', async () => {
      let promise = emulateViewport(375);
      vi.advanceTimersByTime(300);
      await promise;

      promise = emulateViewport(768);
      vi.advanceTimersByTime(300);
      await promise;

      const styles = document.querySelectorAll('#forge-viewport-override');
      expect(styles.length).toBe(1);
      expect(styles[0].textContent).toContain('768px');
    });
  });

  describe('restoreViewport', () => {
    it('removes the injected style element', async () => {
      const promise = emulateViewport(375);
      vi.advanceTimersByTime(300);
      await promise;

      restoreViewport();

      const style = document.getElementById('forge-viewport-override');
      expect(style).toBeNull();
    });

    it('does nothing if no style element exists', () => {
      expect(() => restoreViewport()).not.toThrow();
    });
  });

  describe('extractPageAtViewport', () => {
    it('returns result with overridden viewport dimensions', async () => {
      const promise = extractPageAtViewport(375, 812);
      vi.advanceTimersByTime(300);
      const result = await promise;

      expect(result.viewport.width).toBe(375);
      expect(result.viewport.height).toBe(812);
    });

    it('returns a valid ExtractionResult', async () => {
      const promise = extractPageAtViewport(768, 1024);
      vi.advanceTimersByTime(300);
      const result = await promise;

      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('rootNode');
      expect(result).toHaveProperty('tokens');
      expect(result).toHaveProperty('framework');
    });
  });

  describe('message handlers', () => {
    it('registers handlers for EXTRACT_AT_VIEWPORT and RESTORE_VIEWPORT', () => {
      expect(chromeMockStore.messageListeners.length).toBeGreaterThanOrEqual(1);

      const listener = chromeMockStore.messageListeners[0];
      const sendResponse = vi.fn();

      // EXTRACT_AT_VIEWPORT should return true (async)
      const result = listener({ type: 'EXTRACT_AT_VIEWPORT', width: 375, height: 812 }, {}, sendResponse);
      expect(result).toBe(true);
    });

    it('handles RESTORE_VIEWPORT synchronously', () => {
      const listener = chromeMockStore.messageListeners[0];
      const sendResponse = vi.fn();

      const result = listener({ type: 'RESTORE_VIEWPORT' }, {}, sendResponse);
      expect(result).toBe(false);
      expect(sendResponse).toHaveBeenCalledWith({ type: 'ok' });
    });
  });
});
