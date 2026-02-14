import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('relay-client', () => {
  let checkRelayHealth: typeof import('../../shared/relay-client').checkRelayHealth;
  let postExtraction: typeof import('../../shared/relay-client').postExtraction;
  let fetchExtraction: typeof import('../../shared/relay-client').fetchExtraction;

  const mockFetch = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', mockFetch);
    const mod = await import('../../shared/relay-client');
    checkRelayHealth = mod.checkRelayHealth;
    postExtraction = mod.postExtraction;
    fetchExtraction = mod.fetchExtraction;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('checkRelayHealth', () => {
    it('returns health object on 200', async () => {
      const health = { status: 'ok', version: '0.1.0', hasExtraction: false, timestamp: 123 };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => health,
      });

      const result = await checkRelayHealth();
      expect(result).toEqual(health);
    });

    it('returns null on non-200 response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false });
      const result = await checkRelayHealth();
      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await checkRelayHealth();
      expect(result).toBeNull();
    });

    it('calls correct URL', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });

      await checkRelayHealth();
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:19876/health',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });
  });

  describe('postExtraction', () => {
    it('returns true on success', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const result = await postExtraction({ url: 'test', type: 'multi-viewport', timestamp: 0, extractions: [] } as any);
      expect(result).toBe(true);
    });

    it('returns false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await postExtraction({ url: 'test' } as any);
      expect(result).toBe(false);
    });

    it('sends POST with correct headers', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      await postExtraction({ url: 'test' } as any);

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:19876/extraction',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('sends JSON body', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const payload = { url: 'test', timestamp: 123 };
      await postExtraction(payload as any);

      const call = mockFetch.mock.calls[0];
      expect(JSON.parse(call[1].body)).toEqual(payload);
    });
  });

  describe('fetchExtraction', () => {
    it('returns parsed JSON on 200', async () => {
      const payload = { url: 'test', rootNode: {} };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => payload,
      });

      const result = await fetchExtraction();
      expect(result).toEqual(payload);
    });

    it('returns null on 204 (empty)', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 204 });
      const result = await fetchExtraction();
      expect(result).toBeNull();
    });

    it('returns null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await fetchExtraction();
      expect(result).toBeNull();
    });

    it('returns null on non-200/204 response', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const result = await fetchExtraction();
      expect(result).toBeNull();
    });
  });
});
