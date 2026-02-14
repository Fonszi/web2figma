import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isValidLicenseKeyFormat,
  generateLicenseKey,
  getEffectiveTier,
  applyTierToSettings,
  isLicenseCacheValid,
} from '../../shared/licensing';
import { LICENSE_CACHE_MS } from '../../shared/constants';
import type { LicenseInfo, ImportSettings } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';

/**
 * Feature gating tests for the Figma plugin sandbox.
 *
 * These test the licensing logic as used by the plugin (main.ts):
 * - License key validation (SET_LICENSE path)
 * - License clearing (CLEAR_LICENSE path)
 * - Tier-based settings gating (handleImport / handleApplyDiff path)
 * - License cache validity on load
 */

describe('plugin feature gating', () => {
  // --- SET_LICENSE validation ---

  describe('SET_LICENSE key validation', () => {
    it('accepts a valid generated key', () => {
      const key = generateLicenseKey();
      expect(isValidLicenseKeyFormat(key)).toBe(true);
    });

    it('rejects an invalid key format', () => {
      expect(isValidLicenseKeyFormat('not-a-key')).toBe(false);
    });

    it('rejects key with bad checksum', () => {
      const key = generateLicenseKey();
      const tampered = key.slice(0, -4) + 'ZZZZ';
      expect(isValidLicenseKeyFormat(tampered)).toBe(false);
    });
  });

  // --- CLEAR_LICENSE → tier becomes free ---

  describe('CLEAR_LICENSE flow', () => {
    it('getEffectiveTier returns free after clearing (null license)', () => {
      expect(getEffectiveTier(null)).toBe('free');
    });
  });

  // --- License loaded on init ---

  describe('license cache on init', () => {
    it('accepts fresh license from clientStorage', () => {
      const license: LicenseInfo = {
        key: generateLicenseKey(),
        tier: 'pro',
        validUntil: Date.now() + 86400_000,
        cachedAt: Date.now(),
      };
      expect(isLicenseCacheValid(license)).toBe(true);
      expect(getEffectiveTier(license)).toBe('pro');
    });

    it('rejects expired license from clientStorage', () => {
      const license: LicenseInfo = {
        key: generateLicenseKey(),
        tier: 'pro',
        validUntil: Date.now() - 1000,
        cachedAt: Date.now() - 86400_000,
      };
      expect(isLicenseCacheValid(license)).toBe(false);
      expect(getEffectiveTier(license)).toBe('free');
    });

    it('rejects stale cache (beyond LICENSE_CACHE_MS)', () => {
      const license: LicenseInfo = {
        key: generateLicenseKey(),
        tier: 'pro',
        validUntil: Date.now() + 86400_000 * 365,
        cachedAt: Date.now() - LICENSE_CACHE_MS - 1000,
      };
      expect(isLicenseCacheValid(license)).toBe(false);
      expect(getEffectiveTier(license)).toBe('free');
    });
  });

  // --- Settings gated for free tier ---

  describe('settings gating for free tier', () => {
    const fullSettings: ImportSettings = {
      ...DEFAULT_SETTINGS,
      createStyles: true,
      createComponents: true,
      createVariables: true,
      framerAwareMode: true,
    };

    it('disables createStyles for free tier', () => {
      const gated = applyTierToSettings(fullSettings, 'free');
      expect(gated.createStyles).toBe(false);
    });

    it('disables createComponents for free tier', () => {
      const gated = applyTierToSettings(fullSettings, 'free');
      expect(gated.createComponents).toBe(false);
    });

    it('disables createVariables for free tier', () => {
      const gated = applyTierToSettings(fullSettings, 'free');
      expect(gated.createVariables).toBe(false);
    });

    it('disables framerAwareMode for free tier', () => {
      const gated = applyTierToSettings(fullSettings, 'free');
      expect(gated.framerAwareMode).toBe(false);
    });

    it('preserves maxDepth for free tier', () => {
      const gated = applyTierToSettings(fullSettings, 'free');
      expect(gated.maxDepth).toBe(fullSettings.maxDepth);
    });

    it('preserves includeHiddenElements for free tier', () => {
      const gated = applyTierToSettings(fullSettings, 'free');
      expect(gated.includeHiddenElements).toBe(fullSettings.includeHiddenElements);
    });
  });

  // --- Settings unchanged for pro tier ---

  describe('settings unchanged for pro/team tier', () => {
    const fullSettings: ImportSettings = {
      ...DEFAULT_SETTINGS,
      createStyles: true,
      createComponents: true,
      createVariables: true,
      framerAwareMode: true,
    };

    it('returns same reference for pro tier', () => {
      const gated = applyTierToSettings(fullSettings, 'pro');
      expect(gated).toBe(fullSettings);
    });

    it('returns same reference for team tier', () => {
      const gated = applyTierToSettings(fullSettings, 'team');
      expect(gated).toBe(fullSettings);
    });

    it('keeps all features enabled for pro tier', () => {
      const gated = applyTierToSettings(fullSettings, 'pro');
      expect(gated.createStyles).toBe(true);
      expect(gated.createComponents).toBe(true);
      expect(gated.createVariables).toBe(true);
      expect(gated.framerAwareMode).toBe(true);
    });
  });
});
