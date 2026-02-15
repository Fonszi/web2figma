import { describe, it, expect } from 'vitest';
import {
  generatePresetId,
  createPreset,
  isValidPresetName,
  addPreset,
  removePreset,
  findPreset,
  promoteToTeamPreset,
  demoteToPersonalPreset,
  isPersonalPresetsAtCapacity,
  isTeamPresetsAtCapacity,
  sortPresetsByName,
  sortPresetsByDate,
} from '../../shared/presets';
import { DEFAULT_SETTINGS } from '../../shared/types';
import type { Preset } from '../../shared/types';
import { MAX_PERSONAL_PRESETS, MAX_TEAM_PRESETS } from '../../shared/constants';

function makePreset(overrides: Partial<Preset> = {}): Preset {
  return {
    id: 'test-id',
    name: 'Test Preset',
    settings: { ...DEFAULT_SETTINGS },
    viewports: { presets: ['desktop'], customWidths: [] },
    createdBy: 'user',
    createdAt: 1000,
    isTeamPreset: false,
    ...overrides,
  };
}

describe('generatePresetId', () => {
  it('returns a UUID v4 format string', () => {
    const id = generatePresetId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 20 }, () => generatePresetId()));
    expect(ids.size).toBe(20);
  });
});

describe('createPreset', () => {
  it('creates a preset with correct fields', () => {
    const settings = { ...DEFAULT_SETTINGS };
    const viewports = { presets: ['desktop', 'mobile'], customWidths: [1280] };
    const preset = createPreset('My Preset', settings, viewports, 'user123');

    expect(preset.name).toBe('My Preset');
    expect(preset.settings).toEqual(settings);
    expect(preset.viewports.presets).toEqual(['desktop', 'mobile']);
    expect(preset.viewports.customWidths).toEqual([1280]);
    expect(preset.createdBy).toBe('user123');
    expect(preset.isTeamPreset).toBe(false);
    expect(preset.id).toBeTruthy();
    expect(preset.createdAt).toBeGreaterThan(0);
  });

  it('trims the name', () => {
    const preset = createPreset('  Padded Name  ', DEFAULT_SETTINGS, { presets: [], customWidths: [] }, 'user');
    expect(preset.name).toBe('Padded Name');
  });

  it('clones settings (not same reference)', () => {
    const settings = { ...DEFAULT_SETTINGS };
    const preset = createPreset('Test', settings, { presets: [], customWidths: [] }, 'user');
    expect(preset.settings).not.toBe(settings);
    expect(preset.settings).toEqual(settings);
  });

  it('clones viewports (not same reference)', () => {
    const viewports = { presets: ['desktop'], customWidths: [800] };
    const preset = createPreset('Test', DEFAULT_SETTINGS, viewports, 'user');
    expect(preset.viewports.presets).not.toBe(viewports.presets);
    expect(preset.viewports.customWidths).not.toBe(viewports.customWidths);
  });

  it('creates team preset when specified', () => {
    const preset = createPreset('Team', DEFAULT_SETTINGS, { presets: [], customWidths: [] }, 'user', true);
    expect(preset.isTeamPreset).toBe(true);
  });
});

describe('isValidPresetName', () => {
  it('returns true for valid names', () => {
    expect(isValidPresetName('My Preset')).toBe(true);
    expect(isValidPresetName('a')).toBe(true);
    expect(isValidPresetName('A'.repeat(50))).toBe(true);
  });

  it('returns false for empty string', () => {
    expect(isValidPresetName('')).toBe(false);
  });

  it('returns false for whitespace-only', () => {
    expect(isValidPresetName('   ')).toBe(false);
  });

  it('returns false for names over 50 chars', () => {
    expect(isValidPresetName('A'.repeat(51))).toBe(false);
  });

  it('trims before checking', () => {
    expect(isValidPresetName('  Valid  ')).toBe(true);
  });
});

describe('addPreset', () => {
  it('adds a preset to an empty list', () => {
    const preset = makePreset();
    const result = addPreset([], preset, 20);
    expect(result).toEqual([preset]);
  });

  it('adds a preset to a non-empty list', () => {
    const existing = makePreset({ id: 'a' });
    const newPreset = makePreset({ id: 'b' });
    const result = addPreset([existing], newPreset, 20);
    expect(result).toHaveLength(2);
    expect(result[1]).toBe(newPreset);
  });

  it('evicts oldest when at capacity', () => {
    const presets = Array.from({ length: 3 }, (_, i) =>
      makePreset({ id: `p${i}`, createdAt: i * 100 }),
    );
    const newPreset = makePreset({ id: 'new', createdAt: 999 });
    const result = addPreset(presets, newPreset, 3);

    expect(result).toHaveLength(3);
    expect(result.find((p) => p.id === 'p0')).toBeUndefined();
    expect(result.find((p) => p.id === 'new')).toBeTruthy();
  });

  it('returns a new array', () => {
    const original: Preset[] = [];
    const result = addPreset(original, makePreset(), 20);
    expect(result).not.toBe(original);
  });
});

describe('removePreset', () => {
  it('removes a preset by ID', () => {
    const presets = [makePreset({ id: 'a' }), makePreset({ id: 'b' })];
    const result = removePreset(presets, 'a');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });

  it('returns same content for unknown ID', () => {
    const presets = [makePreset({ id: 'a' })];
    const result = removePreset(presets, 'unknown');
    expect(result).toHaveLength(1);
  });

  it('returns a new array', () => {
    const presets = [makePreset({ id: 'a' })];
    const result = removePreset(presets, 'a');
    expect(result).not.toBe(presets);
  });
});

describe('findPreset', () => {
  it('finds in personal list', () => {
    const personal = [makePreset({ id: 'p1' })];
    const team: Preset[] = [];
    expect(findPreset(personal, team, 'p1')?.id).toBe('p1');
  });

  it('finds in team list', () => {
    const personal: Preset[] = [];
    const team = [makePreset({ id: 't1', isTeamPreset: true })];
    expect(findPreset(personal, team, 't1')?.id).toBe('t1');
  });

  it('returns null when not found', () => {
    expect(findPreset([], [], 'missing')).toBeNull();
  });

  it('prefers personal over team with same ID', () => {
    const personal = [makePreset({ id: 'dup', name: 'personal' })];
    const team = [makePreset({ id: 'dup', name: 'team' })];
    expect(findPreset(personal, team, 'dup')?.name).toBe('personal');
  });
});

describe('promoteToTeamPreset', () => {
  it('sets isTeamPreset to true', () => {
    const preset = makePreset({ isTeamPreset: false });
    const result = promoteToTeamPreset(preset);
    expect(result.isTeamPreset).toBe(true);
  });

  it('preserves other fields', () => {
    const preset = makePreset({ id: 'abc', name: 'Test', createdBy: 'user' });
    const result = promoteToTeamPreset(preset);
    expect(result.id).toBe('abc');
    expect(result.name).toBe('Test');
    expect(result.createdBy).toBe('user');
  });

  it('returns a new object', () => {
    const preset = makePreset();
    const result = promoteToTeamPreset(preset);
    expect(result).not.toBe(preset);
  });
});

describe('demoteToPersonalPreset', () => {
  it('sets isTeamPreset to false', () => {
    const preset = makePreset({ isTeamPreset: true });
    const result = demoteToPersonalPreset(preset);
    expect(result.isTeamPreset).toBe(false);
  });

  it('preserves other fields', () => {
    const preset = makePreset({ id: 'xyz', name: 'Team Preset', isTeamPreset: true });
    const result = demoteToPersonalPreset(preset);
    expect(result.id).toBe('xyz');
    expect(result.name).toBe('Team Preset');
  });

  it('returns a new object', () => {
    const preset = makePreset({ isTeamPreset: true });
    const result = demoteToPersonalPreset(preset);
    expect(result).not.toBe(preset);
  });
});

describe('isPersonalPresetsAtCapacity', () => {
  it('returns false when under limit', () => {
    const presets = Array.from({ length: MAX_PERSONAL_PRESETS - 1 }, (_, i) =>
      makePreset({ id: `p${i}` }),
    );
    expect(isPersonalPresetsAtCapacity(presets)).toBe(false);
  });

  it('returns true when at limit', () => {
    const presets = Array.from({ length: MAX_PERSONAL_PRESETS }, (_, i) =>
      makePreset({ id: `p${i}` }),
    );
    expect(isPersonalPresetsAtCapacity(presets)).toBe(true);
  });
});

describe('isTeamPresetsAtCapacity', () => {
  it('returns false when under limit', () => {
    expect(isTeamPresetsAtCapacity([])).toBe(false);
  });

  it('returns true when at limit', () => {
    const presets = Array.from({ length: MAX_TEAM_PRESETS }, (_, i) =>
      makePreset({ id: `t${i}` }),
    );
    expect(isTeamPresetsAtCapacity(presets)).toBe(true);
  });
});

describe('sortPresetsByName', () => {
  it('sorts alphabetically case-insensitive', () => {
    const presets = [
      makePreset({ name: 'Zebra' }),
      makePreset({ name: 'apple' }),
      makePreset({ name: 'Banana' }),
    ];
    const sorted = sortPresetsByName(presets);
    expect(sorted.map((p) => p.name)).toEqual(['apple', 'Banana', 'Zebra']);
  });

  it('returns a new array', () => {
    const presets = [makePreset({ name: 'A' })];
    const sorted = sortPresetsByName(presets);
    expect(sorted).not.toBe(presets);
  });
});

describe('sortPresetsByDate', () => {
  it('sorts newest first', () => {
    const presets = [
      makePreset({ createdAt: 100 }),
      makePreset({ createdAt: 300 }),
      makePreset({ createdAt: 200 }),
    ];
    const sorted = sortPresetsByDate(presets);
    expect(sorted.map((p) => p.createdAt)).toEqual([300, 200, 100]);
  });

  it('returns a new array', () => {
    const presets = [makePreset()];
    const sorted = sortPresetsByDate(presets);
    expect(sorted).not.toBe(presets);
  });
});
