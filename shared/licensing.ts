// ============================================================
// Licensing — Pure logic for tier checking, feature gating,
// usage validation, and license key format validation.
//
// No chrome.* or figma.* API calls — safe for all contexts.
// Used by: extension popup, service worker, plugin sandbox, plugin UI.
// ============================================================

import { FREE_EXTRACTION_LIMIT, LICENSE_KEY_REGEX, LICENSE_CACHE_MS, PRO_FEATURES } from './constants';
import type { Tier, LicenseInfo, UsageStats, ProFeature, ImportSettings } from './types';
import { simpleHash } from './diffing';

/** Get the current month key in "YYYY-MM" format. */
export function getCurrentMonthKey(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** Check if usage stats need a monthly reset. */
export function needsMonthlyReset(stats: UsageStats, now = new Date()): boolean {
  return stats.monthKey !== getCurrentMonthKey(now);
}

/** Create fresh usage stats for a new month. */
export function resetUsageForNewMonth(now = new Date()): UsageStats {
  return {
    extractionsThisMonth: 0,
    monthKey: getCurrentMonthKey(now),
    lastExtractionAt: 0,
  };
}

/** Increment the extraction count. Returns a new UsageStats object. */
export function incrementUsage(stats: UsageStats, now = new Date()): UsageStats {
  return {
    ...stats,
    extractionsThisMonth: stats.extractionsThisMonth + 1,
    lastExtractionAt: now.getTime(),
  };
}

/** Check if the free tier extraction limit has been reached. */
export function isExtractionLimitReached(stats: UsageStats): boolean {
  return stats.extractionsThisMonth >= FREE_EXTRACTION_LIMIT;
}

/** Get remaining extractions for free tier. */
export function getRemainingExtractions(stats: UsageStats): number {
  return Math.max(0, FREE_EXTRACTION_LIMIT - stats.extractionsThisMonth);
}

/**
 * Compute the checksum for a license key.
 * The checksum is the first 4 characters of the FNV-1a hash
 * of the prefix and first 3 groups joined by dashes.
 */
function computeChecksum(prefix: string, groups: string[]): string {
  const input = `${prefix}-${groups.join('-')}`;
  return simpleHash(input).slice(0, 4).toUpperCase();
}

/** Validate a license key format (regex + checksum). */
export function isValidLicenseKeyFormat(key: string): boolean {
  if (!LICENSE_KEY_REGEX.test(key)) return false;

  // Split: FORGE-XXXX-XXXX-XXXX-XXXX
  const parts = key.split('-');
  const prefix = parts[0];           // "FORGE"
  const groups = parts.slice(1, 4);  // First 3 groups
  const checkGroup = parts[4];       // Last group (checksum)

  const expected = computeChecksum(prefix, groups);
  return checkGroup === expected;
}

/**
 * Generate a valid license key for a given tier.
 * Used for testing and future key generation.
 */
export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const randomGroup = () => {
    let g = '';
    for (let i = 0; i < 4; i++) {
      g += chars[Math.floor(Math.random() * chars.length)];
    }
    return g;
  };

  const groups = [randomGroup(), randomGroup(), randomGroup()];
  const checksum = computeChecksum('FORGE', groups);
  return `FORGE-${groups.join('-')}-${checksum}`;
}

/** Check if a cached license is still valid. */
export function isLicenseCacheValid(license: LicenseInfo, now = Date.now()): boolean {
  if (now > license.validUntil) return false;
  if (now - license.cachedAt > LICENSE_CACHE_MS) return false;
  return true;
}

/** Determine the effective tier from a license (or null). */
export function getEffectiveTier(license: LicenseInfo | null): Tier {
  if (!license) return 'free';
  if (!isLicenseCacheValid(license)) return 'free';
  return license.tier;
}

/** Check if a specific feature requires Pro. */
export function isProFeature(feature: ProFeature): boolean {
  return PRO_FEATURES.includes(feature);
}

/** Check if the current tier has access to a feature. */
export function hasFeatureAccess(tier: Tier, feature: ProFeature): boolean {
  if (tier === 'pro' || tier === 'team') return true;
  return !isProFeature(feature);
}

/**
 * Apply tier restrictions to import settings.
 * Free tier: disables design tokens, components, variables, Framer-aware mode.
 * Pro/Team: returns settings unchanged.
 */
export function applyTierToSettings(settings: ImportSettings, tier: Tier): ImportSettings {
  if (tier === 'pro' || tier === 'team') return settings;

  return {
    ...settings,
    createStyles: false,
    createComponents: false,
    createVariables: false,
    framerAwareMode: false,
  };
}
