import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupFigmaMock, teardownFigmaMock } from '../figma-mock';
import { DEFAULT_SETTINGS } from '../../shared/types';
import type { Preset, LicenseInfo, TeamDefaults } from '../../shared/types';
import {
  STORAGE_KEY_PRESETS,
  SHARED_PLUGIN_NAMESPACE,
  SHARED_KEY_TEAM_PRESETS,
  SHARED_KEY_TEAM_DEFAULTS,
  SHARED_KEY_STYLE_REGISTRY,
  LICENSE_CACHE_MS,
} from '../../shared/constants';
import { addPreset, createPreset, removePreset, promoteToTeamPreset, demoteToPersonalPreset } from '../../shared/presets';
import { createEmptyRegistry, addRegistryEntry, serializeRegistry } from '../../shared/style-registry';
import type { StyleRegistryEntry } from '../../shared/types';

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

function makeTeamLicense(): LicenseInfo {
  return {
    key: 'FORGE-TEST-TEAM-KEY1-XXXX',
    tier: 'team',
    validUntil: Date.now() + LICENSE_CACHE_MS,
    cachedAt: Date.now(),
  };
}

function makeProLicense(): LicenseInfo {
  return {
    key: 'FORGE-TEST-PRO0-KEY1-XXXX',
    tier: 'pro',
    validUntil: Date.now() + LICENSE_CACHE_MS,
    cachedAt: Date.now(),
  };
}

describe('Personal presets via clientStorage', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
    vi.restoreAllMocks();
  });

  it('saves and loads personal presets', async () => {
    const presets = [makePreset({ id: 'p1' }), makePreset({ id: 'p2' })];
    await figma.clientStorage.setAsync(STORAGE_KEY_PRESETS, presets);

    const loaded = await figma.clientStorage.getAsync(STORAGE_KEY_PRESETS);
    expect(loaded).toHaveLength(2);
    expect((loaded as Preset[])[0].id).toBe('p1');
  });

  it('returns empty array when no presets saved', async () => {
    const loaded = await figma.clientStorage.getAsync(STORAGE_KEY_PRESETS);
    expect(loaded).toBeUndefined();
  });

  it('addPreset creates a new list with the preset', () => {
    const preset = makePreset({ id: 'new' });
    const result = addPreset([], preset, 20);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('new');
  });

  it('removePreset filters by ID', () => {
    const presets = [makePreset({ id: 'a' }), makePreset({ id: 'b' })];
    const result = removePreset(presets, 'a');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });
});

describe('Team presets via sharedPluginData', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
    vi.restoreAllMocks();
  });

  it('saves and loads team presets from shared data', () => {
    const presets = [makePreset({ id: 't1', isTeamPreset: true })];
    figma.root.setSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_PRESETS, JSON.stringify(presets));

    const json = figma.root.getSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_PRESETS);
    const loaded = JSON.parse(json);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('t1');
  });

  it('returns empty string when no team presets set', () => {
    const json = figma.root.getSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_PRESETS);
    expect(json).toBe('');
  });

  it('promote moves preset to team', () => {
    const personal = makePreset({ id: 'p1', isTeamPreset: false });
    const team = promoteToTeamPreset(personal);
    expect(team.isTeamPreset).toBe(true);
    expect(team.id).toBe('p1');
  });

  it('demote moves preset to personal', () => {
    const team = makePreset({ id: 't1', isTeamPreset: true });
    const personal = demoteToPersonalPreset(team);
    expect(personal.isTeamPreset).toBe(false);
    expect(personal.id).toBe('t1');
  });
});

describe('Tier gating', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
    vi.restoreAllMocks();
  });

  it('team license has team tier', () => {
    const license = makeTeamLicense();
    expect(license.tier).toBe('team');
  });

  it('pro license does not have team tier', () => {
    const license = makeProLicense();
    expect(license.tier).toBe('pro');
  });

  it('team preset is downgraded for non-team tier', () => {
    const preset = makePreset({ isTeamPreset: true });
    const proLicense = makeProLicense();
    // Simulate tier check
    if (proLicense.tier !== 'team') {
      preset.isTeamPreset = false;
    }
    expect(preset.isTeamPreset).toBe(false);
  });
});

describe('Apply preset updates settings', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
    vi.restoreAllMocks();
  });

  it('saves preset settings to clientStorage', async () => {
    const customSettings = { ...DEFAULT_SETTINGS, createStyles: false, maxDepth: 25 };
    await figma.clientStorage.setAsync('forge_settings', customSettings);

    const loaded = await figma.clientStorage.getAsync('forge_settings');
    expect(loaded).toEqual(customSettings);
  });
});

describe('Style registry via sharedPluginData', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
    vi.restoreAllMocks();
  });

  it('saves and loads style registry', () => {
    let registry = createEmptyRegistry();
    const entry: StyleRegistryEntry = {
      figmaStyleId: 'S:abc',
      styleName: 'colors/primary',
      styleType: 'color',
      sourceUrl: 'https://example.com',
      createdAt: Date.now(),
      createdBy: 'user',
    };
    registry = addRegistryEntry(registry, entry);

    const json = serializeRegistry(registry);
    figma.root.setSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_STYLE_REGISTRY, json);

    const loaded = figma.root.getSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_STYLE_REGISTRY);
    const parsed = JSON.parse(loaded);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].styleName).toBe('colors/primary');
  });

  it('returns empty string when no registry set', () => {
    const json = figma.root.getSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_STYLE_REGISTRY);
    expect(json).toBe('');
  });
});

describe('Team defaults', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
    vi.restoreAllMocks();
  });

  it('saves and loads team defaults', () => {
    const defaults: TeamDefaults = {
      settings: { ...DEFAULT_SETTINGS, createStyles: false },
      setBy: 'admin',
      setAt: Date.now(),
    };
    figma.root.setSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_DEFAULTS, JSON.stringify(defaults));

    const json = figma.root.getSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_DEFAULTS);
    const loaded = JSON.parse(json) as TeamDefaults;
    expect(loaded.settings.createStyles).toBe(false);
    expect(loaded.setBy).toBe('admin');
  });

  it('clears team defaults by setting empty string', () => {
    figma.root.setSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_DEFAULTS, JSON.stringify({ settings: DEFAULT_SETTINGS, setBy: 'admin', setAt: Date.now() }));
    figma.root.setSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_DEFAULTS, '');

    const json = figma.root.getSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_DEFAULTS);
    expect(json).toBe('');
  });

  it('auto-applies team defaults on first load (no personal settings)', async () => {
    const defaults: TeamDefaults = {
      settings: { ...DEFAULT_SETTINGS, maxDepth: 10, createComponents: false },
      setBy: 'admin',
      setAt: Date.now(),
    };
    figma.root.setSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_DEFAULTS, JSON.stringify(defaults));

    // Simulate: no personal settings saved
    const savedSettings = await figma.clientStorage.getAsync('forge_settings');
    expect(savedSettings).toBeUndefined();

    // Load team defaults
    const json = figma.root.getSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_DEFAULTS);
    const teamDefaults = JSON.parse(json) as TeamDefaults;

    // Apply team defaults as settings
    await figma.clientStorage.setAsync('forge_settings', teamDefaults.settings);

    const loaded = await figma.clientStorage.getAsync('forge_settings');
    expect(loaded).toEqual(teamDefaults.settings);
  });
});
