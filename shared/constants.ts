// ============================================================
// Constants shared between Chrome Extension and Figma Plugin.
// Referenced by: extension/src/content/*, figma-plugin/src/*
// ============================================================

/** Default viewports for extraction (used in extension/src/popup/ViewportPicker.tsx) */
export const VIEWPORTS = {
  desktop: { width: 1440, height: 900, label: 'Desktop' },
  laptop: { width: 1280, height: 800, label: 'Laptop' },
  tablet: { width: 768, height: 1024, label: 'Tablet' },
  mobile: { width: 375, height: 812, label: 'Mobile' },
} as const;

/** Figma plugin UI dimensions (used in figma-plugin/src/main.ts) */
export const UI_WIDTH = 420;
export const UI_HEIGHT = 640;

/** Maximum node depth to prevent infinite recursion (used in figma-plugin/src/converter.ts) */
export const MAX_NODE_DEPTH = 50;

/** Minimum occurrences to detect as component (used in figma-plugin/src/components/detector.ts) */
export const COMPONENT_THRESHOLD = 3;

/** Free tier extraction limit per 30 days */
export const FREE_EXTRACTION_LIMIT = 15;

/** Maximum image size to inline as data URI (bytes) — used in extension/src/content/image-collector.ts */
export const MAX_INLINE_IMAGE_SIZE = 100_000; // 100KB

/** Chrome storage key for extraction data (used in extension/src/background/service-worker.ts) */
export const STORAGE_KEY_EXTRACTION = 'forge_extraction';
export const STORAGE_KEY_SETTINGS = 'forge_settings';
export const STORAGE_KEY_USAGE = 'forge_usage';
export const STORAGE_KEY_SELECTED_VIEWPORTS = 'forge_selected_viewports';

/** Viewport preset keys for multi-viewport extraction. */
export type ViewportPreset = keyof typeof VIEWPORTS;

/** Default selected viewports (single desktop for backward compatibility). */
export const DEFAULT_SELECTED_VIEWPORTS: ViewportPreset[] = ['desktop'];
