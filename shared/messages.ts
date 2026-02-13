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

import type { ExtractionResult, ImportSettings } from './types';

// --- Channel 1: Figma Plugin UI ↔ Sandbox ---

export type UiToSandboxMessage =
  | { type: 'START_IMPORT'; json: string }
  | { type: 'CANCEL_IMPORT' }
  | { type: 'UPDATE_SETTINGS'; settings: Partial<ImportSettings> }
  | { type: 'RESIZE_UI'; width: number; height: number };

export type SandboxToUiMessage =
  | { type: 'IMPORT_PROGRESS'; phase: ImportPhase; progress: number; message: string }
  | { type: 'IMPORT_COMPLETE'; nodeCount: number; tokenCount: number; componentCount: number; styleCount: number }
  | { type: 'IMPORT_ERROR'; error: string }
  | { type: 'SETTINGS_LOADED'; settings: ImportSettings };

export type ImportPhase =
  | 'parsing'
  | 'creating-nodes'
  | 'creating-styles'
  | 'creating-components'
  | 'loading-images'
  | 'finalizing';

export const PHASE_LABELS: Record<ImportPhase, string> = {
  parsing: 'Parsing extraction data...',
  'creating-nodes': 'Creating Figma nodes...',
  'creating-styles': 'Creating design tokens...',
  'creating-components': 'Detecting components...',
  'loading-images': 'Loading images...',
  finalizing: 'Finalizing import...',
};

// --- Channel 2 & 3: Chrome Extension Messages ---

export type ExtensionMessage =
  | { type: 'EXTRACT_PAGE' }
  | { type: 'EXTRACTION_COMPLETE'; result: ExtractionResult }
  | { type: 'EXTRACTION_ERROR'; error: string }
  | { type: 'EXTRACTION_PROGRESS'; phase: string; progress: number }
  | { type: 'GET_EXTRACTION' }
  | { type: 'COPY_TO_CLIPBOARD'; data: string };
