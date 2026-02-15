import { describe, it, expect } from 'vitest';
import {
  createEmptyRegistry,
  addRegistryEntry,
  addRegistryEntries,
  removeRegistryEntry,
  findEntriesByUrl,
  findEntriesByType,
  hasStyleWithName,
  getRegistrySummary,
  serializeRegistry,
  deserializeRegistry,
} from '../../shared/style-registry';
import type { StyleRegistry, StyleRegistryEntry } from '../../shared/types';
import { MAX_STYLE_REGISTRY_ENTRIES } from '../../shared/constants';

function makeEntry(overrides: Partial<StyleRegistryEntry> = {}): StyleRegistryEntry {
  return {
    figmaStyleId: 'S:abc123',
    styleName: 'colors/primary',
    styleType: 'color',
    sourceUrl: 'https://example.com',
    createdAt: 1000,
    createdBy: 'user',
    ...overrides,
  };
}

describe('createEmptyRegistry', () => {
  it('creates registry with empty entries', () => {
    const reg = createEmptyRegistry();
    expect(reg.entries).toEqual([]);
    expect(reg.lastUpdatedAt).toBeGreaterThan(0);
  });
});

describe('addRegistryEntry', () => {
  it('adds an entry to empty registry', () => {
    const reg = createEmptyRegistry();
    const entry = makeEntry();
    const result = addRegistryEntry(reg, entry);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toBe(entry);
  });

  it('deduplicates by figmaStyleId', () => {
    const reg = createEmptyRegistry();
    const entry1 = makeEntry({ figmaStyleId: 'S:1', styleName: 'old' });
    const entry2 = makeEntry({ figmaStyleId: 'S:1', styleName: 'new' });
    let result = addRegistryEntry(reg, entry1);
    result = addRegistryEntry(result, entry2);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].styleName).toBe('new');
  });

  it('keeps different IDs separate', () => {
    const reg = createEmptyRegistry();
    const entry1 = makeEntry({ figmaStyleId: 'S:1' });
    const entry2 = makeEntry({ figmaStyleId: 'S:2' });
    let result = addRegistryEntry(reg, entry1);
    result = addRegistryEntry(result, entry2);
    expect(result.entries).toHaveLength(2);
  });

  it('respects max entries limit', () => {
    let reg = createEmptyRegistry();
    for (let i = 0; i < MAX_STYLE_REGISTRY_ENTRIES + 10; i++) {
      reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: `S:${i}` }));
    }
    expect(reg.entries.length).toBeLessThanOrEqual(MAX_STYLE_REGISTRY_ENTRIES);
  });

  it('updates lastUpdatedAt', () => {
    const reg = createEmptyRegistry();
    const before = reg.lastUpdatedAt;
    const result = addRegistryEntry(reg, makeEntry());
    expect(result.lastUpdatedAt).toBeGreaterThanOrEqual(before);
  });
});

describe('addRegistryEntries', () => {
  it('adds multiple entries at once', () => {
    const reg = createEmptyRegistry();
    const entries = [
      makeEntry({ figmaStyleId: 'S:1' }),
      makeEntry({ figmaStyleId: 'S:2' }),
      makeEntry({ figmaStyleId: 'S:3' }),
    ];
    const result = addRegistryEntries(reg, entries);
    expect(result.entries).toHaveLength(3);
  });

  it('deduplicates within the batch', () => {
    const reg = createEmptyRegistry();
    const entries = [
      makeEntry({ figmaStyleId: 'S:1', styleName: 'first' }),
      makeEntry({ figmaStyleId: 'S:1', styleName: 'second' }),
    ];
    const result = addRegistryEntries(reg, entries);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].styleName).toBe('second');
  });
});

describe('removeRegistryEntry', () => {
  it('removes entry by figmaStyleId', () => {
    let reg = createEmptyRegistry();
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:1' }));
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:2' }));
    const result = removeRegistryEntry(reg, 'S:1');
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].figmaStyleId).toBe('S:2');
  });

  it('handles unknown ID gracefully', () => {
    let reg = createEmptyRegistry();
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:1' }));
    const result = removeRegistryEntry(reg, 'S:unknown');
    expect(result.entries).toHaveLength(1);
  });
});

describe('findEntriesByUrl', () => {
  it('returns matching entries', () => {
    let reg = createEmptyRegistry();
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:1', sourceUrl: 'https://a.com' }));
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:2', sourceUrl: 'https://b.com' }));
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:3', sourceUrl: 'https://a.com' }));
    const result = findEntriesByUrl(reg, 'https://a.com');
    expect(result).toHaveLength(2);
  });

  it('returns empty for no matches', () => {
    const reg = createEmptyRegistry();
    expect(findEntriesByUrl(reg, 'https://missing.com')).toHaveLength(0);
  });
});

describe('findEntriesByType', () => {
  it('filters by style type', () => {
    let reg = createEmptyRegistry();
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:1', styleType: 'color' }));
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:2', styleType: 'typography' }));
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:3', styleType: 'color' }));
    expect(findEntriesByType(reg, 'color')).toHaveLength(2);
    expect(findEntriesByType(reg, 'typography')).toHaveLength(1);
    expect(findEntriesByType(reg, 'effect')).toHaveLength(0);
  });
});

describe('hasStyleWithName', () => {
  it('returns true when name exists', () => {
    let reg = createEmptyRegistry();
    reg = addRegistryEntry(reg, makeEntry({ styleName: 'colors/primary' }));
    expect(hasStyleWithName(reg, 'colors/primary')).toBe(true);
  });

  it('returns false when name does not exist', () => {
    const reg = createEmptyRegistry();
    expect(hasStyleWithName(reg, 'colors/primary')).toBe(false);
  });
});

describe('getRegistrySummary', () => {
  it('returns correct counts', () => {
    let reg = createEmptyRegistry();
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:1', styleType: 'color' }));
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:2', styleType: 'color' }));
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:3', styleType: 'typography' }));
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:4', styleType: 'effect' }));
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:5', styleType: 'variable' }));

    const summary = getRegistrySummary(reg);
    expect(summary.totalStyles).toBe(5);
    expect(summary.colorCount).toBe(2);
    expect(summary.typographyCount).toBe(1);
    expect(summary.effectCount).toBe(1);
    expect(summary.variableCount).toBe(1);
  });

  it('returns unique source URLs', () => {
    let reg = createEmptyRegistry();
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:1', sourceUrl: 'https://a.com' }));
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:2', sourceUrl: 'https://b.com' }));
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:3', sourceUrl: 'https://a.com' }));

    const summary = getRegistrySummary(reg);
    expect(summary.sourceUrls).toEqual(['https://a.com', 'https://b.com']);
  });
});

describe('serializeRegistry / deserializeRegistry', () => {
  it('round-trips correctly', () => {
    let reg = createEmptyRegistry();
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:1' }));
    reg = addRegistryEntry(reg, makeEntry({ figmaStyleId: 'S:2', styleType: 'typography' }));

    const json = serializeRegistry(reg);
    const deserialized = deserializeRegistry(json);

    expect(deserialized).not.toBeNull();
    expect(deserialized!.entries).toHaveLength(2);
    expect(deserialized!.lastUpdatedAt).toBe(reg.lastUpdatedAt);
  });

  it('returns null for invalid JSON', () => {
    expect(deserializeRegistry('not json')).toBeNull();
  });

  it('returns null for missing entries array', () => {
    expect(deserializeRegistry('{"lastUpdatedAt": 123}')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(deserializeRegistry('')).toBeNull();
  });
});
