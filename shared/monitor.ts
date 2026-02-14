/**
 * Fonszi Monitor — error capture adapter for Forge (Chrome Extension + Figma Plugin).
 *
 * Provides a shared captureError function for both Chrome Extension and Figma Plugin
 * contexts. Chrome Extension stores reports in chrome.storage.local; Figma Plugin
 * stores in figma.clientStorage. Both use the same JSON format matching the fonsitor
 * KMP SDK MonitorEvent schema.
 */

const PRODUCT_ID = 'forge';
const STORAGE_KEY = 'fonszi_monitor_reports';
const MAX_STORED_REPORTS = 50;

export interface MonitorEvent {
  id: string;
  product: string;
  platform: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'FATAL';
  message: string;
  tag: string;
  exception: ExceptionInfo | null;
  context: EventContext;
  timestamp: string;
  source: string;
}

interface ExceptionInfo {
  class: string;
  message: string;
  stack: string[];
  cause: { class: string; message: string } | null;
}

interface EventContext {
  screen: string;
  buildType: string;
  appVersion: string;
  osVersion: string;
  device: string | null;
}

let eventCounter = 0;

function generateId(prefix: string): string {
  return `evt_${prefix}_${Date.now()}_${++eventCounter}`;
}

function parseStack(stack: string | undefined): string[] {
  if (!stack) return [];
  return stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 10);
}

function buildEvent(
  platform: string,
  severity: MonitorEvent['severity'],
  message: string,
  tag: string,
  error?: Error | null,
): MonitorEvent {
  return {
    id: generateId(platform === 'chrome-extension' ? 'ext' : 'fig'),
    product: PRODUCT_ID,
    platform,
    severity,
    message,
    tag,
    exception: error
      ? {
          class: error.name || 'Error',
          message: error.message || '',
          stack: parseStack(error.stack),
          cause: null,
        }
      : null,
    context: {
      screen: platform,
      buildType: 'release',
      appVersion: '1.0.0',
      osVersion: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      device: null,
    },
    timestamp: new Date().toISOString(),
    source: platform === 'chrome-extension' ? 'CHROME_EXTENSION' : 'FIGMA_PLUGIN',
  };
}

// ── Chrome Extension Storage ─────────────────────────────────────────────────

async function storeInChromeStorage(event: MonitorEvent): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const reports: MonitorEvent[] = result[STORAGE_KEY] ?? [];
    reports.push(event);
    const trimmed = reports.slice(-MAX_STORED_REPORTS);
    await chrome.storage.local.set({ [STORAGE_KEY]: trimmed });
  } catch {
    // silently ignore storage failures
  }
}

// ── Figma Plugin Storage ─────────────────────────────────────────────────────

async function storeInFigmaStorage(event: MonitorEvent): Promise<void> {
  try {
    const existing: MonitorEvent[] =
      (await figma.clientStorage.getAsync(STORAGE_KEY)) ?? [];
    existing.push(event);
    const trimmed = existing.slice(-MAX_STORED_REPORTS);
    await figma.clientStorage.setAsync(STORAGE_KEY, trimmed);
  } catch {
    // silently ignore
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/** Capture an error from the Chrome Extension context. */
export function captureExtensionError(
  message: string,
  tag: string,
  error?: Error | null,
  severity: MonitorEvent['severity'] = 'ERROR',
): void {
  const event = buildEvent('chrome-extension', severity, message, tag, error);
  void storeInChromeStorage(event);
}

/** Capture an error from the Figma Plugin context. */
export function capturePluginError(
  message: string,
  tag: string,
  error?: Error | null,
  severity: MonitorEvent['severity'] = 'ERROR',
): void {
  const event = buildEvent('figma-plugin', severity, message, tag, error);
  void storeInFigmaStorage(event);
}
