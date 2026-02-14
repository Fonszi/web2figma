import { describe, it, expect } from 'vitest';
import {
  getCurrentMonthKey,
  needsMonthlyReset,
  resetUsageForNewMonth,
  incrementUsage,
  isExtractionLimitReached,
  getRemainingExtractions,
  isValidLicenseKeyFormat,
  generateLicenseKey,
  isLicenseCacheValid,
  getEffectiveTier,
  isProFeature,
  hasFeatureAccess,
  applyTierToSettings,
} from '../../shared/licensing';
import { FREE_EXTRACTION_LIMIT, LICENSE_CACHE_MS } from '../../shared/constants';
import type { LicenseInfo, UsageStats, ImportSettings } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';

// ---------------------------------------------------------------------------
// getCurrentMonthKey
// ---------------------------------------------------------------------------
describe('getCurrentMonthKey', () => {
  it('returns YYYY-MM format', () => {
    const key = getCurrentMonthKey(new Date('2026-03-15'));
    expect(key).toBe('2026-03');
  });

  it('pads single-digit month', () => {
    const key = getCurrentMonthKey(new Date('2026-01-05'));
    expect(key).toBe('2026-01');
  });

  it('handles December', () => {
    const key = getCurrentMonthKey(new Date('2025-12-31'));
    expect(key).toBe('2025-12');
  });

  it('uses current date by default', () => {
    const key = getCurrentMonthKey();
    expect(key).toMatch(/^\d{4}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// needsMonthlyReset
// ---------------------------------------------------------------------------
describe('needsMonthlyReset', () => {
  it('returns false for same month', () => {
    const stats: UsageStats = { extractionsThisMonth: 5, monthKey: '2026-03', lastExtractionAt: 0 };
    expect(needsMonthlyReset(stats, new Date('2026-03-20'))).toBe(false);
  });

  it('returns true for different month', () => {
    const stats: UsageStats = { extractionsThisMonth: 5, monthKey: '2026-02', lastExtractionAt: 0 };
    expect(needsMonthlyReset(stats, new Date('2026-03-01'))).toBe(true);
  });

  it('returns true across year boundary', () => {
    const stats: UsageStats = { extractionsThisMonth: 5, monthKey: '2025-12', lastExtractionAt: 0 };
    expect(needsMonthlyReset(stats, new Date('2026-01-01'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// resetUsageForNewMonth
// ---------------------------------------------------------------------------
describe('resetUsageForNewMonth', () => {
  it('returns zero extractions', () => {
    const stats = resetUsageForNewMonth(new Date('2026-03-15'));
    expect(stats.extractionsThisMonth).toBe(0);
  });

  it('sets correct monthKey', () => {
    const stats = resetUsageForNewMonth(new Date('2026-03-15'));
    expect(stats.monthKey).toBe('2026-03');
  });

  it('sets lastExtractionAt to zero', () => {
    const stats = resetUsageForNewMonth();
    expect(stats.lastExtractionAt).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// incrementUsage
// ---------------------------------------------------------------------------
describe('incrementUsage', () => {
  it('increments extraction count', () => {
    const stats: UsageStats = { extractionsThisMonth: 3, monthKey: '2026-03', lastExtractionAt: 0 };
    const updated = incrementUsage(stats, new Date('2026-03-15T10:00:00Z'));
    expect(updated.extractionsThisMonth).toBe(4);
  });

  it('updates lastExtractionAt timestamp', () => {
    const now = new Date('2026-03-15T10:00:00Z');
    const stats: UsageStats = { extractionsThisMonth: 0, monthKey: '2026-03', lastExtractionAt: 0 };
    const updated = incrementUsage(stats, now);
    expect(updated.lastExtractionAt).toBe(now.getTime());
  });

  it('preserves monthKey', () => {
    const stats: UsageStats = { extractionsThisMonth: 0, monthKey: '2026-03', lastExtractionAt: 0 };
    const updated = incrementUsage(stats);
    expect(updated.monthKey).toBe('2026-03');
  });

  it('returns a new object (immutable)', () => {
    const stats: UsageStats = { extractionsThisMonth: 0, monthKey: '2026-03', lastExtractionAt: 0 };
    const updated = incrementUsage(stats);
    expect(updated).not.toBe(stats);
  });
});

// ---------------------------------------------------------------------------
// isExtractionLimitReached
// ---------------------------------------------------------------------------
describe('isExtractionLimitReached', () => {
  it('returns false when under limit', () => {
    const stats: UsageStats = { extractionsThisMonth: FREE_EXTRACTION_LIMIT - 1, monthKey: '2026-03', lastExtractionAt: 0 };
    expect(isExtractionLimitReached(stats)).toBe(false);
  });

  it('returns true when at limit', () => {
    const stats: UsageStats = { extractionsThisMonth: FREE_EXTRACTION_LIMIT, monthKey: '2026-03', lastExtractionAt: 0 };
    expect(isExtractionLimitReached(stats)).toBe(true);
  });

  it('returns true when over limit', () => {
    const stats: UsageStats = { extractionsThisMonth: FREE_EXTRACTION_LIMIT + 5, monthKey: '2026-03', lastExtractionAt: 0 };
    expect(isExtractionLimitReached(stats)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getRemainingExtractions
// ---------------------------------------------------------------------------
describe('getRemainingExtractions', () => {
  it('returns remaining count', () => {
    const stats: UsageStats = { extractionsThisMonth: 5, monthKey: '2026-03', lastExtractionAt: 0 };
    expect(getRemainingExtractions(stats)).toBe(FREE_EXTRACTION_LIMIT - 5);
  });

  it('returns zero when at limit', () => {
    const stats: UsageStats = { extractionsThisMonth: FREE_EXTRACTION_LIMIT, monthKey: '2026-03', lastExtractionAt: 0 };
    expect(getRemainingExtractions(stats)).toBe(0);
  });

  it('never returns negative', () => {
    const stats: UsageStats = { extractionsThisMonth: FREE_EXTRACTION_LIMIT + 10, monthKey: '2026-03', lastExtractionAt: 0 };
    expect(getRemainingExtractions(stats)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isValidLicenseKeyFormat
// ---------------------------------------------------------------------------
describe('isValidLicenseKeyFormat', () => {
  it('accepts a generated key', () => {
    const key = generateLicenseKey();
    expect(isValidLicenseKeyFormat(key)).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidLicenseKeyFormat('')).toBe(false);
  });

  it('rejects wrong prefix', () => {
    expect(isValidLicenseKeyFormat('BOGUS-AAAA-BBBB-CCCC-DDDD')).toBe(false);
  });

  it('rejects too few groups', () => {
    expect(isValidLicenseKeyFormat('FORGE-AAAA-BBBB')).toBe(false);
  });

  it('rejects lowercase', () => {
    expect(isValidLicenseKeyFormat('forge-aaaa-bbbb-cccc-dddd')).toBe(false);
  });

  it('rejects invalid checksum', () => {
    // Generate a valid key, then tamper with the checksum
    const key = generateLicenseKey();
    const parts = key.split('-');
    parts[4] = 'ZZZZ'; // invalid checksum
    expect(isValidLicenseKeyFormat(parts.join('-'))).toBe(false);
  });

  it('rejects key with special characters', () => {
    expect(isValidLicenseKeyFormat('FORGE-AA!A-BBBB-CCCC-DDDD')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// generateLicenseKey
// ---------------------------------------------------------------------------
describe('generateLicenseKey', () => {
  it('generates keys that pass validation', () => {
    for (let i = 0; i < 10; i++) {
      expect(isValidLicenseKeyFormat(generateLicenseKey())).toBe(true);
    }
  });

  it('generates unique keys', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 20; i++) {
      keys.add(generateLicenseKey());
    }
    expect(keys.size).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// isLicenseCacheValid
// ---------------------------------------------------------------------------
describe('isLicenseCacheValid', () => {
  it('returns true for fresh license', () => {
    const license: LicenseInfo = {
      key: 'FORGE-TEST-TEST-TEST-TEST',
      tier: 'pro',
      validUntil: Date.now() + 86400_000,
      cachedAt: Date.now(),
    };
    expect(isLicenseCacheValid(license)).toBe(true);
  });

  it('returns false when validUntil is past', () => {
    const license: LicenseInfo = {
      key: 'FORGE-TEST-TEST-TEST-TEST',
      tier: 'pro',
      validUntil: Date.now() - 1000,
      cachedAt: Date.now() - 2000,
    };
    expect(isLicenseCacheValid(license)).toBe(false);
  });

  it('returns false when cache is stale', () => {
    const license: LicenseInfo = {
      key: 'FORGE-TEST-TEST-TEST-TEST',
      tier: 'pro',
      validUntil: Date.now() + 86400_000,
      cachedAt: Date.now() - LICENSE_CACHE_MS - 1000,
    };
    expect(isLicenseCacheValid(license)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getEffectiveTier
// ---------------------------------------------------------------------------
describe('getEffectiveTier', () => {
  it('returns free for null license', () => {
    expect(getEffectiveTier(null)).toBe('free');
  });

  it('returns pro for valid pro license', () => {
    const license: LicenseInfo = {
      key: 'FORGE-TEST-TEST-TEST-TEST',
      tier: 'pro',
      validUntil: Date.now() + 86400_000,
      cachedAt: Date.now(),
    };
    expect(getEffectiveTier(license)).toBe('pro');
  });

  it('returns team for valid team license', () => {
    const license: LicenseInfo = {
      key: 'FORGE-TEST-TEST-TEST-TEST',
      tier: 'team',
      validUntil: Date.now() + 86400_000,
      cachedAt: Date.now(),
    };
    expect(getEffectiveTier(license)).toBe('team');
  });

  it('returns free for expired license', () => {
    const license: LicenseInfo = {
      key: 'FORGE-TEST-TEST-TEST-TEST',
      tier: 'pro',
      validUntil: Date.now() - 1000,
      cachedAt: Date.now() - 2000,
    };
    expect(getEffectiveTier(license)).toBe('free');
  });
});

// ---------------------------------------------------------------------------
// isProFeature & hasFeatureAccess
// ---------------------------------------------------------------------------
describe('isProFeature', () => {
  it('returns true for design-tokens', () => {
    expect(isProFeature('design-tokens')).toBe(true);
  });

  it('returns true for multi-viewport', () => {
    expect(isProFeature('multi-viewport')).toBe(true);
  });

  it('returns true for components', () => {
    expect(isProFeature('components')).toBe(true);
  });
});

describe('hasFeatureAccess', () => {
  it('denies free tier access to pro features', () => {
    expect(hasFeatureAccess('free', 'design-tokens')).toBe(false);
    expect(hasFeatureAccess('free', 'components')).toBe(false);
    expect(hasFeatureAccess('free', 'variables')).toBe(false);
    expect(hasFeatureAccess('free', 'framer-aware')).toBe(false);
    expect(hasFeatureAccess('free', 'multi-viewport')).toBe(false);
  });

  it('grants pro tier access to all features', () => {
    expect(hasFeatureAccess('pro', 'design-tokens')).toBe(true);
    expect(hasFeatureAccess('pro', 'components')).toBe(true);
    expect(hasFeatureAccess('pro', 'multi-viewport')).toBe(true);
  });

  it('grants team tier access to all features', () => {
    expect(hasFeatureAccess('team', 'design-tokens')).toBe(true);
    expect(hasFeatureAccess('team', 'variables')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyTierToSettings
// ---------------------------------------------------------------------------
describe('applyTierToSettings', () => {
  const proSettings: ImportSettings = {
    ...DEFAULT_SETTINGS,
    createStyles: true,
    createComponents: true,
    createVariables: true,
    framerAwareMode: true,
  };

  it('disables pro features for free tier', () => {
    const gated = applyTierToSettings(proSettings, 'free');
    expect(gated.createStyles).toBe(false);
    expect(gated.createComponents).toBe(false);
    expect(gated.createVariables).toBe(false);
    expect(gated.framerAwareMode).toBe(false);
  });

  it('preserves non-gated settings for free tier', () => {
    const gated = applyTierToSettings(proSettings, 'free');
    expect(gated.maxDepth).toBe(proSettings.maxDepth);
    expect(gated.includeHiddenElements).toBe(proSettings.includeHiddenElements);
  });

  it('returns settings unchanged for pro tier', () => {
    const gated = applyTierToSettings(proSettings, 'pro');
    expect(gated).toBe(proSettings); // same reference
  });

  it('returns settings unchanged for team tier', () => {
    const gated = applyTierToSettings(proSettings, 'team');
    expect(gated).toBe(proSettings);
  });
});
