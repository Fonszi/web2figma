// ============================================================
// Style Registry — Pure functions for tracking Forge-created
// Figma styles. No figma.* dependency.
//
// Storage via figma.root.setSharedPluginData() is handled by main.ts.
// ============================================================

import type { StyleRegistry, StyleRegistryEntry } from './types';
import { MAX_STYLE_REGISTRY_ENTRIES } from './constants';

/** Create an empty style registry. */
export function createEmptyRegistry(): StyleRegistry {
  return { entries: [], lastUpdatedAt: Date.now() };
}

/** Add an entry to the registry. Deduplicates by figmaStyleId. Returns new StyleRegistry. */
export function addRegistryEntry(
  registry: StyleRegistry,
  entry: StyleRegistryEntry,
): StyleRegistry {
  const filtered = registry.entries.filter((e) => e.figmaStyleId !== entry.figmaStyleId);
  const entries = [...filtered, entry].slice(-MAX_STYLE_REGISTRY_ENTRIES);
  return { entries, lastUpdatedAt: Date.now() };
}

/** Add multiple entries at once (batch after import). Returns new StyleRegistry. */
export function addRegistryEntries(
  registry: StyleRegistry,
  newEntries: StyleRegistryEntry[],
): StyleRegistry {
  let result = registry;
  for (const entry of newEntries) {
    result = addRegistryEntry(result, entry);
  }
  return result;
}

/** Remove an entry by Figma style ID. Returns new StyleRegistry. */
export function removeRegistryEntry(
  registry: StyleRegistry,
  figmaStyleId: string,
): StyleRegistry {
  return {
    entries: registry.entries.filter((e) => e.figmaStyleId !== figmaStyleId),
    lastUpdatedAt: Date.now(),
  };
}

/** Find entries by source URL. */
export function findEntriesByUrl(
  registry: StyleRegistry,
  sourceUrl: string,
): StyleRegistryEntry[] {
  return registry.entries.filter((e) => e.sourceUrl === sourceUrl);
}

/** Find entries by style type. */
export function findEntriesByType(
  registry: StyleRegistry,
  styleType: StyleRegistryEntry['styleType'],
): StyleRegistryEntry[] {
  return registry.entries.filter((e) => e.styleType === styleType);
}

/** Check if a style with this name already exists in the registry. */
export function hasStyleWithName(
  registry: StyleRegistry,
  styleName: string,
): boolean {
  return registry.entries.some((e) => e.styleName === styleName);
}

/** Get a summary of the registry for display. */
export function getRegistrySummary(
  registry: StyleRegistry,
): { totalStyles: number; colorCount: number; typographyCount: number; effectCount: number; variableCount: number; sourceUrls: string[] } {
  return {
    totalStyles: registry.entries.length,
    colorCount: registry.entries.filter((e) => e.styleType === 'color').length,
    typographyCount: registry.entries.filter((e) => e.styleType === 'typography').length,
    effectCount: registry.entries.filter((e) => e.styleType === 'effect').length,
    variableCount: registry.entries.filter((e) => e.styleType === 'variable').length,
    sourceUrls: [...new Set(registry.entries.map((e) => e.sourceUrl))],
  };
}

/** Serialize registry to JSON string (for sharedPluginData). */
export function serializeRegistry(registry: StyleRegistry): string {
  return JSON.stringify(registry);
}

/** Deserialize registry from JSON string. Returns null on invalid input. */
export function deserializeRegistry(json: string): StyleRegistry | null {
  try {
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.entries)) return null;
    return parsed as StyleRegistry;
  } catch {
    return null;
  }
}
