// ============================================================
// Preset Logic — Pure functions for creating, validating,
// and managing extraction presets.
//
// No figma.* or chrome.* API calls — safe for all contexts.
// Storage operations are handled by the caller (main.ts).
// ============================================================

import type { Preset, ImportSettings } from './types';
import { MAX_PERSONAL_PRESETS, MAX_TEAM_PRESETS } from './constants';

/** Generate a simple UUID v4 (no crypto dependency). */
export function generatePresetId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Create a new Preset from current settings and viewport config. */
export function createPreset(
  name: string,
  settings: ImportSettings,
  viewports: { presets: string[]; customWidths: number[] },
  createdBy: string,
  isTeamPreset: boolean = false,
): Preset {
  return {
    id: generatePresetId(),
    name: name.trim(),
    settings: { ...settings },
    viewports: {
      presets: [...viewports.presets],
      customWidths: [...viewports.customWidths],
    },
    createdBy,
    createdAt: Date.now(),
    isTeamPreset,
  };
}

/** Validate a preset name (non-empty, max 50 chars). */
export function isValidPresetName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= 50;
}

/** Add a preset to a list, enforcing the max limit. Returns new array. */
export function addPreset(presets: Preset[], preset: Preset, maxCount: number): Preset[] {
  if (presets.length >= maxCount) {
    const sorted = [...presets].sort((a, b) => a.createdAt - b.createdAt);
    sorted.shift();
    return [...sorted, preset];
  }
  return [...presets, preset];
}

/** Remove a preset by ID. Returns new array. */
export function removePreset(presets: Preset[], presetId: string): Preset[] {
  return presets.filter((p) => p.id !== presetId);
}

/** Find a preset by ID in personal or team lists. */
export function findPreset(personal: Preset[], team: Preset[], presetId: string): Preset | null {
  return personal.find((p) => p.id === presetId) ?? team.find((p) => p.id === presetId) ?? null;
}

/** Convert a personal preset to a team preset (clone with isTeamPreset = true). */
export function promoteToTeamPreset(preset: Preset): Preset {
  return { ...preset, isTeamPreset: true };
}

/** Convert a team preset back to personal (clone with isTeamPreset = false). */
export function demoteToPersonalPreset(preset: Preset): Preset {
  return { ...preset, isTeamPreset: false };
}

/** Check if a personal preset list is at capacity. */
export function isPersonalPresetsAtCapacity(presets: Preset[]): boolean {
  return presets.length >= MAX_PERSONAL_PRESETS;
}

/** Check if a team preset list is at capacity. */
export function isTeamPresetsAtCapacity(presets: Preset[]): boolean {
  return presets.length >= MAX_TEAM_PRESETS;
}

/** Sort presets by name (alphabetical, case-insensitive). */
export function sortPresetsByName(presets: Preset[]): Preset[] {
  return [...presets].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

/** Sort presets by creation date (newest first). */
export function sortPresetsByDate(presets: Preset[]): Preset[] {
  return [...presets].sort((a, b) => b.createdAt - a.createdAt);
}
