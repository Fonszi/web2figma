// ============================================================
// Message types for communication channels.
//
// Channel 1: Figma Plugin UI ↔ Plugin Sandbox (postMessage)
//   Used in: figma-plugin/src/main.ts, figma-plugin/src/ui/App.tsx
//
// Channel 2: Chrome Extension Content Script ↔ Service Worker (chrome.runtime)
//   Used in: extension/src/content/extractor.ts, extension/src/background/service-worker.ts
//
// Channel 3: Chrome Extension Popup ↔ Service Worker (chrome.runtime)
//   Used in: extension/src/popup/Popup.tsx, extension/src/background/service-worker.ts
// ============================================================

import type { ExtractionResult, ImportSettings, LicenseInfo, Tier, Preset, StyleRegistry, TeamDefaults } from './types';

// --- Channel 1: Figma Plugin UI ↔ Sandbox ---

export type UiToSandboxMessage =
  | { type: 'START_IMPORT'; json: string }
  | { type: 'START_REIMPORT'; json: string }
  | { type: 'APPLY_DIFF'; changeIds: string[]; mode: 'update-changed' | 'full-reimport' }
  | { type: 'CANCEL_IMPORT' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<ImportSettings> }
  | { type: 'RESIZE_UI'; width: number; height: number }
  | { type: 'SET_LICENSE'; key: string }
  | { type: 'CLEAR_LICENSE' }
  // --- Preset messages ---
  | { type: 'LOAD_PRESETS' }
  | { type: 'SAVE_PRESET'; preset: Preset }
  | { type: 'DELETE_PRESET'; presetId: string; isTeamPreset: boolean }
  | { type: 'SHARE_PRESET'; presetId: string }
  | { type: 'UNSHARE_PRESET'; presetId: string }
  | { type: 'APPLY_PRESET'; preset: Preset }
  // --- Style registry messages ---
  | { type: 'LOAD_STYLE_REGISTRY' }
  // --- Team defaults messages ---
  | { type: 'LOAD_TEAM_DEFAULTS' }
  | { type: 'SET_TEAM_DEFAULTS'; settings: ImportSettings }
  | { type: 'CLEAR_TEAM_DEFAULTS' };

export type SandboxToUiMessage =
  | { type: 'IMPORT_PROGRESS'; phase: ImportPhase; progress: number; message: string }
  | { type: 'IMPORT_COMPLETE'; nodeCount: number; tokenCount: number; componentCount: number; styleCount: number; sectionCount: number; variantCount?: number }
  | { type: 'IMPORT_ERROR'; error: string }
  | { type: 'SETTINGS_LOADED'; settings: ImportSettings }
  | { type: 'DIFF_RESULT'; changes: DiffChange[]; summary: DiffSummary }
  | { type: 'REIMPORT_COMPLETE'; updatedCount: number; addedCount: number; removedCount: number }
  | { type: 'LICENSE_LOADED'; license: LicenseInfo | null; tier: Tier }
  // --- Preset responses ---
  | { type: 'PRESETS_LOADED'; personal: Preset[]; team: Preset[] }
  | { type: 'PRESET_SAVED'; preset: Preset }
  | { type: 'PRESET_DELETED'; presetId: string }
  | { type: 'PRESET_SHARED'; preset: Preset }
  | { type: 'PRESET_UNSHARED'; presetId: string }
  // --- Style registry responses ---
  | { type: 'STYLE_REGISTRY_LOADED'; registry: StyleRegistry | null }
  // --- Team defaults responses ---
  | { type: 'TEAM_DEFAULTS_LOADED'; defaults: TeamDefaults | null }
  | { type: 'TEAM_DEFAULTS_SAVED'; defaults: TeamDefaults }
  | { type: 'TEAM_DEFAULTS_CLEARED' };

export type ImportPhase =
  | 'parsing'
  | 'creating-nodes'
  | 'creating-styles'
  | 'creating-components'
  | 'creating-sections'
  | 'creating-variants'
  | 'loading-images'
  | 'diffing'
  | 'applying-diff'
  | 'finalizing';

export const PHASE_LABELS: Record<ImportPhase, string> = {
  parsing: 'Parsing extraction data...',
  'creating-nodes': 'Creating Figma nodes...',
  'creating-styles': 'Creating design tokens...',
  'creating-components': 'Detecting components...',
  'creating-sections': 'Organizing sections...',
  'creating-variants': 'Creating viewport variants...',
  'loading-images': 'Loading images...',
  diffing: 'Comparing with existing import...',
  'applying-diff': 'Applying changes...',
  finalizing: 'Finalizing import...',
};

// --- Re-Import Diffing Types ---

export interface DiffChange {
  id: string;
  type: 'modified' | 'added' | 'removed';
  path: string;
  nodeType: string;
  description: string;
  selected: boolean;
}

export interface DiffSummary {
  totalNodes: number;
  modifiedCount: number;
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
}

// --- Channel 2 & 3: Chrome Extension Messages ---

export type ExtensionMessage =
  | { type: 'EXTRACT_PAGE' }
  | { type: 'EXTRACT_AT_VIEWPORT'; width: number; height: number }
  | { type: 'RESTORE_VIEWPORT' }
  | { type: 'EXTRACTION_COMPLETE'; result: ExtractionResult }
  | { type: 'EXTRACTION_ERROR'; error: string }
  | { type: 'EXTRACTION_PROGRESS'; phase: string; progress: number }
  | { type: 'GET_EXTRACTION' }
  | { type: 'COPY_TO_CLIPBOARD'; data: string }
  | { type: 'GET_USAGE' }
  | { type: 'GET_SERVER_QUOTA' };
