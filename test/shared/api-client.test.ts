import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('api-client', () => {
  let activateLicense: typeof import('../../shared/api-client').activateLicense;
  let trackUsage: typeof import('../../shared/api-client').trackUsage;
  let getQuota: typeof import('../../shared/api-client').getQuota;
  let logConversion: typeof import('../../shared/api-client').logConversion;

  const mockFetch = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', mockFetch);
    const mod = await import('../../shared/api-client');
    activateLicense = mod.activateLicense;
    trackUsage = mod.trackUsage;
    getQuota = mod.getQuota;
    logConversion = mod.logConversion;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  // ---- activateLicense ----

  describe('activateLicense', () => {
    it('returns data on success', async () => {
      const data = { id: '1', tier: 'pro', product: 'forge', status: 'ACTIVE', validUntil: null, activatedAt: '2026-01-01' };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data }),
      });

      const result = await activateLicense('FORGE-AAAA-BBBB-CCCC-DDDD', 'forge', 'figma');
      expect(result).toEqual(data);
    });

    it('sends POST to correct URL with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      });

      await activateLicense('KEY', 'forge', 'chrome');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fonszi.com/v1/licenses/activate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'KEY', product: 'forge', platform: 'chrome' }),
        }),
      );
    });

    it('returns null on non-200 response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      const result = await activateLicense('KEY', 'forge', 'figma');
      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await activateLicense('KEY', 'forge', 'figma');
      expect(result).toBeNull();
    });

    it('returns null when API returns success: false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Invalid key' }),
      });

      const result = await activateLicense('BAD-KEY', 'forge', 'figma');
      expect(result).toBeNull();
    });
  });

  // ---- trackUsage ----

  describe('trackUsage', () => {
    it('returns quota data on success', async () => {
      const data = { id: '1', quotaUsed: 5, quotaLimit: 15 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data }),
      });

      const result = await trackUsage('forge', 'extraction');
      expect(result).toEqual(data);
    });

    it('sends POST with license key header when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      });

      await trackUsage('forge', 'extraction', 'MY-KEY');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fonszi.com/v1/usage/track',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-License-Key': 'MY-KEY' },
          body: JSON.stringify({ product: 'forge', eventType: 'extraction', metadata: {} }),
        }),
      );
    });

    it('sends POST without license key header when not provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      });

      await trackUsage('forge', 'extraction');

      const call = mockFetch.mock.calls[0];
      expect(call[1].headers).not.toHaveProperty('X-License-Key');
    });

    it('includes metadata when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      });

      await trackUsage('forge', 'extraction', undefined, { source: 'popup' });

      const call = mockFetch.mock.calls[0];
      expect(JSON.parse(call[1].body).metadata).toEqual({ source: 'popup' });
    });

    it('returns null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Offline'));
      const result = await trackUsage('forge', 'extraction');
      expect(result).toBeNull();
    });
  });

  // ---- getQuota ----

  describe('getQuota', () => {
    it('returns quota on success', async () => {
      const data = { product: 'forge', monthKey: '2026-02', used: 3, limit: 15, remaining: 12 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data }),
      });

      const result = await getQuota('forge');
      expect(result).toEqual(data);
    });

    it('sends GET with correct URL and encoded product', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      });

      await getQuota('forge');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fonszi.com/v1/usage/quota?product=forge',
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('includes license key header when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      });

      await getQuota('forge', 'MY-KEY');

      const call = mockFetch.mock.calls[0];
      expect(call[1].headers['X-License-Key']).toBe('MY-KEY');
    });

    it('returns null on failure', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      const result = await getQuota('forge');
      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));
      const result = await getQuota('forge');
      expect(result).toBeNull();
    });
  });

  // ---- logConversion ----

  describe('logConversion', () => {
    it('returns conversion result on success', async () => {
      const data = {
        id: '1',
        sourceType: 'figma',
        nodeCount: 42,
        tokenCount: 10,
        componentCount: 3,
        durationMs: 500,
        viewportCount: 1,
        createdAt: '2026-01-01',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data }),
      });

      const result = await logConversion({ sourceType: 'figma', nodeCount: 42, tokenCount: 10, componentCount: 3 });
      expect(result).toEqual(data);
    });

    it('sends POST with correct body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      });

      const convData = { sourceType: 'figma', nodeCount: 100, tokenCount: 20, componentCount: 5, viewportCount: 2 };
      await logConversion(convData, 'MY-KEY');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.fonszi.com/v1/conversions/log',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-License-Key': 'MY-KEY' },
          body: JSON.stringify(convData),
        }),
      );
    });

    it('returns null on non-200 response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      const result = await logConversion({ nodeCount: 10 });
      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await logConversion({ nodeCount: 10 });
      expect(result).toBeNull();
    });

    it('returns null when success is false', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: false, error: 'Server error' }),
      });

      const result = await logConversion({ nodeCount: 10 });
      expect(result).toBeNull();
    });
  });
});
