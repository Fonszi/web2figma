/**
 * Chrome Extension Service Worker (MV3).
 *
 * Relays messages between popup ↔ content script.
 * Stores the latest extraction result in chrome.storage.local.
 *
 * Related files:
 * - Content script: extension/src/content/extractor.ts
 * - Popup: extension/src/popup/Popup.tsx
 * - Message types: shared/messages.ts
 * - Constants: shared/constants.ts
 */

import {
  STORAGE_KEY_EXTRACTION,
  STORAGE_KEY_USAGE,
  STORAGE_KEY_LICENSE,
  STORAGE_KEY_SERVER_QUOTA,
} from '../../../shared/constants';
import type { ExtensionMessage } from '../../../shared/messages';
import type { ExtractionResult, UsageStats, LicenseInfo } from '../../../shared/types';
import { needsMonthlyReset, resetUsageForNewMonth, incrementUsage } from '../../../shared/licensing';
import { trackUsage } from '../../../shared/api-client';
import { captureExtensionError } from '../../../shared/monitor';

/** Cache the latest extraction in memory for quick access. */
let latestExtraction: ExtractionResult | null = null;

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, sender, sendResponse) => {
    switch (message.type) {
      case 'EXTRACT_PAGE':
        handleExtractPage(sendResponse);
        return true; // async response

      case 'EXTRACTION_COMPLETE':
        handleExtractionComplete(message.result);
        break;

      case 'EXTRACTION_ERROR':
        console.error('[forge] Extraction error:', message.error);
        captureExtensionError(message.error ?? 'Unknown extraction error', 'extractionRelay');
        break;

      case 'GET_EXTRACTION':
        sendResponse(latestExtraction);
        return false; // sync response

      case 'GET_USAGE':
        chrome.storage.local.get(STORAGE_KEY_USAGE).then((data) => {
          sendResponse(data[STORAGE_KEY_USAGE] ?? null);
        });
        return true; // async response

      case 'GET_SERVER_QUOTA':
        chrome.storage.local.get(STORAGE_KEY_SERVER_QUOTA).then((data) => {
          sendResponse(data[STORAGE_KEY_SERVER_QUOTA] ?? null);
        });
        return true; // async response

      case 'COPY_TO_CLIPBOARD':
        // Content script handles clipboard — relay to active tab
        copyToClipboard(message.data);
        break;
    }
    return false;
  }
);

/**
 * Send EXTRACT_PAGE to the content script in the active tab.
 */
async function handleExtractPage(
  sendResponse: (response: unknown) => void
): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      sendResponse({ type: 'EXTRACTION_ERROR', error: 'No active tab found' });
      return;
    }

    // Inject content script if not already present (programmatic injection as fallback)
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });
    } catch {
      // Script may already be injected via manifest — ignore
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE' });
    sendResponse(response);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to extract page';
    captureExtensionError(msg, 'handleExtractPage', error instanceof Error ? error : null);
    sendResponse({
      type: 'EXTRACTION_ERROR',
      error: msg,
    });
  }
}

/**
 * Store extraction result in memory and chrome.storage.local.
 * Also increments the usage counter for free tier tracking.
 */
function handleExtractionComplete(result: ExtractionResult): void {
  latestExtraction = result;
  chrome.storage.local.set({ [STORAGE_KEY_EXTRACTION]: result }).catch((err) => {
    console.error('[forge] Failed to store extraction:', err);
  });
  incrementUsageCounter();
  syncUsageToServer();
}

/**
 * Increment the extraction usage counter in chrome.storage.local.
 */
async function incrementUsageCounter(): Promise<void> {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY_USAGE);
    let stats: UsageStats = data[STORAGE_KEY_USAGE] ?? resetUsageForNewMonth();

    if (needsMonthlyReset(stats)) {
      stats = resetUsageForNewMonth();
    }

    stats = incrementUsage(stats);
    await chrome.storage.local.set({ [STORAGE_KEY_USAGE]: stats });
  } catch (err) {
    console.error('[forge] Failed to update usage counter:', err);
  }
}

/**
 * Fire-and-forget: sync usage event to the backend.
 * Stores the returned quota in chrome.storage for the popup to display.
 */
async function syncUsageToServer(): Promise<void> {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY_LICENSE);
    const license = data[STORAGE_KEY_LICENSE] as LicenseInfo | undefined;
    const licenseKey = license?.key;

    const result = await trackUsage('forge', 'extraction', licenseKey);
    if (result) {
      await chrome.storage.local.set({
        [STORAGE_KEY_SERVER_QUOTA]: {
          quotaUsed: result.quotaUsed,
          quotaLimit: result.quotaLimit,
          syncedAt: Date.now(),
        },
      });
    }
  } catch {
    // Server sync is best-effort — fail silently
  }
}

/**
 * Copy text to clipboard via the offscreen document or active tab.
 */
async function copyToClipboard(data: string): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (text: string) => navigator.clipboard.writeText(text),
        args: [data],
      });
    }
  } catch (error) {
    console.error('[forge] Clipboard copy failed:', error);
    captureExtensionError(
      error instanceof Error ? error.message : 'Clipboard copy failed',
      'copyToClipboard',
      error instanceof Error ? error : null,
      'WARNING',
    );
  }
}

// Log when service worker starts
console.log('[forge] Service worker initialized');
