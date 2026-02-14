/**
 * Figma Plugin Sandbox entry point.
 *
 * Receives BridgeNode JSON from the UI iframe (pasted by user or relayed from Chrome Extension).
 * Converts BridgeNode tree into Figma nodes with Auto Layout, styles, and components.
 *
 * Related files:
 * - Converter pipeline: figma-plugin/src/converter.ts
 * - Node creators: figma-plugin/src/nodes/ (frame.ts, text.ts, image.ts, vector.ts, styles.ts)
 * - Token creators: figma-plugin/src/tokens/ (colors.ts, typography.ts, effects.ts, variables.ts)
 * - Component creators: figma-plugin/src/components/ (detector.ts, creator.ts)
 * - Plugin UI: figma-plugin/src/ui/App.tsx
 * - Bridge format types: shared/types.ts
 * - Message types: shared/messages.ts
 * - Constants: shared/constants.ts
 * - CLAUDE.md: CLAUDE.md
 * - Product plan: PRODUCT_PLAN.md
 */

import { UI_WIDTH, UI_HEIGHT } from '../../shared/constants';
import type { UiToSandboxMessage, SandboxToUiMessage } from '../../shared/messages';
import type { ExtractionResult, ImportSettings } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';
import { convertToFigma } from './converter';
import { handleImageDataFromUi } from './nodes/image';
import { isMultiViewport } from '../../shared/types';
import { createViewportVariants } from './components/variants';

figma.showUI(__html__, { width: UI_WIDTH, height: UI_HEIGHT, themeColors: true });

async function loadSettings(): Promise<ImportSettings> {
  const saved = await figma.clientStorage.getAsync('forge_settings');
  return saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS;
}

async function saveSettings(settings: ImportSettings): Promise<void> {
  await figma.clientStorage.setAsync('forge_settings', settings);
}

function sendToUi(message: SandboxToUiMessage): void {
  figma.ui.postMessage(message);
}

figma.ui.onmessage = async (msg: UiToSandboxMessage & { type: string; nodeId?: string; data?: Uint8Array | null }) => {
  switch (msg.type) {
    case 'START_IMPORT':
      await handleImport((msg as UiToSandboxMessage & { type: 'START_IMPORT' }).json);
      break;

    case 'CANCEL_IMPORT':
      // TODO: implement cancellation via AbortController
      break;

    case 'UPDATE_SETTINGS': {
      const current = await loadSettings();
      const updated = { ...current, ...(msg as UiToSandboxMessage & { type: 'UPDATE_SETTINGS' }).settings };
      await saveSettings(updated);
      sendToUi({ type: 'SETTINGS_LOADED', settings: updated });
      break;
    }

    case 'RESIZE_UI':
      figma.ui.resize(
        (msg as UiToSandboxMessage & { type: 'RESIZE_UI' }).width,
        (msg as UiToSandboxMessage & { type: 'RESIZE_UI' }).height,
      );
      break;

    case 'IMAGE_DATA':
      // Image data relayed from UI iframe (fetched from URL)
      handleImageDataFromUi(msg.nodeId ?? '', msg.data ?? null);
      break;
  }
};

async function handleImport(json: string): Promise<void> {
  try {
    sendToUi({ type: 'IMPORT_PROGRESS', phase: 'parsing', progress: 0, message: 'Parsing extraction...' });

    const parsed = JSON.parse(json);
    const settings = await loadSettings();

    if (isMultiViewport(parsed)) {
      // Multi-viewport: create ComponentSet with viewport variants
      const variantResult = await createViewportVariants(
        parsed,
        settings,
        (phase, progress, message) => {
          sendToUi({ type: 'IMPORT_PROGRESS', phase, progress, message });
        },
      );

      sendToUi({
        type: 'IMPORT_COMPLETE',
        nodeCount: variantResult.totalNodeCount,
        tokenCount: variantResult.totalTokenCount,
        componentCount: variantResult.totalComponentCount,
        styleCount: variantResult.totalStyleCount,
        sectionCount: variantResult.totalSectionCount,
        variantCount: variantResult.variantCount,
      });
      return;
    }

    // Single viewport: existing path
    const result: ExtractionResult = parsed;
    const { nodeCount, tokenCount, componentCount, styleCount, sectionCount } = await convertToFigma(
      result,
      settings,
      (phase, progress, message) => {
        sendToUi({ type: 'IMPORT_PROGRESS', phase, progress, message });
      },
    );

    sendToUi({
      type: 'IMPORT_COMPLETE',
      nodeCount,
      tokenCount,
      componentCount,
      styleCount,
      sectionCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse extraction data';
    sendToUi({ type: 'IMPORT_ERROR', error: message });
  }
}

// Initialize
(async () => {
  const settings = await loadSettings();
  sendToUi({ type: 'SETTINGS_LOADED', settings });
})();
