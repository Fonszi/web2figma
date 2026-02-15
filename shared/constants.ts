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

/** Figma clientStorage key for personal presets. */
export const STORAGE_KEY_PRESETS = 'forge_presets';

/** SharedPluginData namespace for all Forge team data. */
export const SHARED_PLUGIN_NAMESPACE = 'forge';

/** SharedPluginData keys (within 'forge' namespace). */
export const SHARED_KEY_TEAM_PRESETS = 'team_presets';
export const SHARED_KEY_STYLE_REGISTRY = 'style_registry';
export const SHARED_KEY_TEAM_DEFAULTS = 'team_defaults';

/** Maximum preset counts. */
export const MAX_PERSONAL_PRESETS = 20;
export const MAX_TEAM_PRESETS = 50;

/** Maximum style registry entries per file. */
export const MAX_STYLE_REGISTRY_ENTRIES = 500;

/** Viewport preset keys for multi-viewport extraction. */
export type ViewportPreset = keyof typeof VIEWPORTS;

/** Default selected viewports (single desktop for backward compatibility). */
export const DEFAULT_SELECTED_VIEWPORTS: ViewportPreset[] = ['desktop'];

// ============================================================
// Relay Server — Local HTTP bridge between Extension and Plugin
// ============================================================

/** Port for the local relay server. */
export const RELAY_PORT = 19876;

/** Base URL for the local relay server. */
export const RELAY_BASE_URL = `http://localhost:${RELAY_PORT}`;

/** Relay health check endpoint. */
export const RELAY_HEALTH_ENDPOINT = '/health';

/** Relay extraction data endpoint. */
export const RELAY_EXTRACTION_ENDPOINT = '/extraction';

// ============================================================
// Backend API
// ============================================================

/** Base URL for the Fonszi backend API. */
export const API_BASE_URL = 'https://api.fonszi.com';

/** API request timeout in milliseconds. */
export const API_TIMEOUT_MS = 5000;

/** Chrome storage key for server-side quota cache. */
export const STORAGE_KEY_SERVER_QUOTA = 'forge_server_quota';

// ============================================================
// Licensing & Monetization
// ============================================================

/** Chrome storage key for license info. */
export const STORAGE_KEY_LICENSE = 'forge_license';

/** License key format: FORGE-XXXX-XXXX-XXXX-XXXX (A-Z0-9). */
export const LICENSE_KEY_REGEX = /^FORGE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** License cache duration — 30 days in ms. */
export const LICENSE_CACHE_MS = 30 * 24 * 60 * 60 * 1000;

/** Stripe checkout URLs (placeholders until backend is live). */
export const STRIPE_CHECKOUT_PRO_URL = 'https://buy.stripe.com/forge-pro-placeholder';
export const STRIPE_CHECKOUT_TEAM_URL = 'https://buy.stripe.com/forge-team-placeholder';

/** Pricing display constants. */
export const PRICE_PRO_MONTHLY = 12;
export const PRICE_TEAM_PER_SEAT = 9;

/** Pro-only features. Free tier gets: single viewport, basic frames/text/images. */
export const PRO_FEATURES: readonly string[] = [
  'multi-viewport',
  'design-tokens',
  'components',
  'framer-aware',
  'variables',
] as const;

/** Team-only features. Team tier includes all Pro features plus these. */
export type TeamFeature = 'shared-presets' | 'team-defaults' | 'style-registry';

export const TEAM_FEATURES: readonly TeamFeature[] = [
  'shared-presets',
  'team-defaults',
  'style-registry',
] as const;
