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

import { STORAGE_KEY_EXTRACTION } from '../../../shared/constants';
import type { ExtensionMessage } from '../../../shared/messages';
import type { ExtractionResult } from '../../../shared/types';

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
        break;

      case 'GET_EXTRACTION':
        sendResponse(latestExtraction);
        return false; // sync response

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
    sendResponse({
      type: 'EXTRACTION_ERROR',
      error: error instanceof Error ? error.message : 'Failed to extract page',
    });
  }
}

/**
 * Store extraction result in memory and chrome.storage.local.
 */
function handleExtractionComplete(result: ExtractionResult): void {
  latestExtraction = result;
  chrome.storage.local.set({ [STORAGE_KEY_EXTRACTION]: result }).catch((err) => {
    console.error('[forge] Failed to store extraction:', err);
  });
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
  }
}

// Log when service worker starts
console.log('[forge] Service worker initialized');
