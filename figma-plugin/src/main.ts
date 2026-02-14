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

import { UI_WIDTH, UI_HEIGHT, LICENSE_CACHE_MS } from '../../shared/constants';
import type { UiToSandboxMessage, SandboxToUiMessage } from '../../shared/messages';
import type { ExtractionResult, ImportSettings, LicenseInfo } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';
import { isValidLicenseKeyFormat, isLicenseCacheValid, getEffectiveTier, applyTierToSettings } from '../../shared/licensing';
import { activateLicense, logConversion } from '../../shared/api-client';
import { convertToFigma } from './converter';
import { handleImageDataFromUi } from './nodes/image';
import { isMultiViewport } from '../../shared/types';
import { createViewportVariants } from './components/variants';
import { findExistingImport, computeReimportDiff, applyDiffChanges } from './reimporter';
import { capturePluginError } from '../../shared/monitor';

figma.showUI(__html__, { width: UI_WIDTH, height: UI_HEIGHT, themeColors: true });

async function loadSettings(): Promise<ImportSettings> {
  const saved = await figma.clientStorage.getAsync('forge_settings');
  return saved ? { ...DEFAULT_SETTINGS, ...saved } : DEFAULT_SETTINGS;
}

async function saveSettings(settings: ImportSettings): Promise<void> {
  await figma.clientStorage.setAsync('forge_settings', settings);
}

async function loadLicense(): Promise<LicenseInfo | null> {
  const saved = await figma.clientStorage.getAsync('forge_license');
  if (!saved) return null;
  if (!isLicenseCacheValid(saved as LicenseInfo)) return null;
  return saved as LicenseInfo;
}

async function saveLicense(license: LicenseInfo): Promise<void> {
  await figma.clientStorage.setAsync('forge_license', license);
}

async function clearLicense(): Promise<void> {
  await figma.clientStorage.deleteAsync('forge_license');
}

function sendToUi(message: SandboxToUiMessage): void {
  figma.ui.postMessage(message);
}

figma.ui.onmessage = async (msg: UiToSandboxMessage & { type: string; nodeId?: string; data?: Uint8Array | null }) => {
  switch (msg.type) {
    case 'START_IMPORT':
      await handleImport((msg as UiToSandboxMessage & { type: 'START_IMPORT' }).json);
      break;

    case 'START_REIMPORT':
      await handleReimport((msg as UiToSandboxMessage & { type: 'START_REIMPORT' }).json);
      break;

    case 'APPLY_DIFF':
      await handleApplyDiff(msg as UiToSandboxMessage & { type: 'APPLY_DIFF' });
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

    case 'SET_LICENSE': {
      const key = (msg as UiToSandboxMessage & { type: 'SET_LICENSE' }).key;
      if (!isValidLicenseKeyFormat(key)) {
        sendToUi({ type: 'LICENSE_LOADED', license: null, tier: 'free' });
        break;
      }
      // Server validation (fallback to 'pro' if unreachable)
      let tier: 'free' | 'pro' | 'team' = 'pro';
      const serverResult = await activateLicense(key, 'forge', 'figma');
      if (serverResult) {
        tier = serverResult.tier as 'free' | 'pro' | 'team';
      }
      const license: LicenseInfo = {
        key,
        tier,
        validUntil: Date.now() + LICENSE_CACHE_MS,
        cachedAt: Date.now(),
      };
      await saveLicense(license);
      sendToUi({ type: 'LICENSE_LOADED', license, tier });
      break;
    }

    case 'CLEAR_LICENSE':
      await clearLicense();
      sendToUi({ type: 'LICENSE_LOADED', license: null, tier: 'free' });
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
    const license = await loadLicense();
    const tier = getEffectiveTier(license);
    const gatedSettings = applyTierToSettings(settings, tier);

    if (isMultiViewport(parsed)) {
      // Multi-viewport: create ComponentSet with viewport variants
      const variantResult = await createViewportVariants(
        parsed,
        gatedSettings,
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
      logConversionAfterImport(license, {
        nodeCount: variantResult.totalNodeCount,
        tokenCount: variantResult.totalTokenCount,
        componentCount: variantResult.totalComponentCount,
        viewportCount: variantResult.variantCount ?? 1,
      });
      return;
    }

    // Single viewport: existing path
    const result: ExtractionResult = parsed;
    const { nodeCount, tokenCount, componentCount, styleCount, sectionCount } = await convertToFigma(
      result,
      gatedSettings,
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
    logConversionAfterImport(license, { nodeCount, tokenCount, componentCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse extraction data';
    capturePluginError(message, 'handleImport', error instanceof Error ? error : null);
    sendToUi({ type: 'IMPORT_ERROR', error: message });
  }
}

// Re-import state (held between START_REIMPORT and APPLY_DIFF)
let pendingReimportJson: string | null = null;
let pendingReimportFrame: FrameNode | null = null;

async function handleReimport(json: string): Promise<void> {
  try {
    sendToUi({ type: 'IMPORT_PROGRESS', phase: 'parsing', progress: 0, message: 'Parsing extraction...' });

    const parsed = JSON.parse(json);
    if (isMultiViewport(parsed)) {
      // Multi-viewport re-import not supported yet — fall through to normal import
      await handleImport(json);
      return;
    }

    const result: ExtractionResult = parsed;
    const existingFrame = findExistingImport(result.url);

    if (!existingFrame) {
      // No existing import found — do a fresh import
      await handleImport(json);
      return;
    }

    // Compute diff
    const { changes, summary } = await computeReimportDiff(
      result,
      existingFrame,
      (phase, progress, message) => {
        sendToUi({ type: 'IMPORT_PROGRESS', phase, progress, message });
      },
    );

    // Store for APPLY_DIFF
    pendingReimportJson = json;
    pendingReimportFrame = existingFrame;

    sendToUi({ type: 'DIFF_RESULT', changes, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to compute diff';
    capturePluginError(message, 'handleReimport', error instanceof Error ? error : null);
    sendToUi({ type: 'IMPORT_ERROR', error: message });
  }
}

async function handleApplyDiff(msg: { changeIds: string[]; mode: 'update-changed' | 'full-reimport' }): Promise<void> {
  try {
    if (msg.mode === 'full-reimport') {
      if (pendingReimportJson) {
        await handleImport(pendingReimportJson);
      }
      pendingReimportJson = null;
      pendingReimportFrame = null;
      return;
    }

    if (!pendingReimportJson || !pendingReimportFrame) {
      sendToUi({ type: 'IMPORT_ERROR', error: 'No pending re-import data' });
      return;
    }

    const result: ExtractionResult = JSON.parse(pendingReimportJson);
    const settings = await loadSettings();
    const license = await loadLicense();
    const tier = getEffectiveTier(license);
    const gatedSettings = applyTierToSettings(settings, tier);

    // Re-compute diff to get change objects with selection state
    const { changes } = await computeReimportDiff(
      result,
      pendingReimportFrame,
      () => {},
    );

    // Mark selected changes
    const selectedIds = new Set(msg.changeIds);
    const selectedChanges = changes.map((c) => ({
      ...c,
      selected: selectedIds.has(c.id),
    }));

    const counts = await applyDiffChanges(
      selectedChanges,
      result,
      pendingReimportFrame,
      gatedSettings,
      (phase, progress, message) => {
        sendToUi({ type: 'IMPORT_PROGRESS', phase, progress, message });
      },
    );

    sendToUi({
      type: 'REIMPORT_COMPLETE',
      updatedCount: counts.updatedCount,
      addedCount: counts.addedCount,
      removedCount: counts.removedCount,
    });

    pendingReimportJson = null;
    pendingReimportFrame = null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to apply diff';
    capturePluginError(message, 'handleApplyDiff', error instanceof Error ? error : null);
    sendToUi({ type: 'IMPORT_ERROR', error: message });
  }
}

/** Fire-and-forget: log conversion metrics to the backend. */
function logConversionAfterImport(
  license: LicenseInfo | null,
  metrics: { nodeCount: number; tokenCount: number; componentCount: number; viewportCount?: number },
): void {
  logConversion(
    {
      sourceType: 'figma',
      nodeCount: metrics.nodeCount,
      tokenCount: metrics.tokenCount,
      componentCount: metrics.componentCount,
      viewportCount: metrics.viewportCount ?? 1,
    },
    license?.key,
  ).catch(() => {
    // Best-effort — fail silently
  });
}

// Initialize
(async () => {
  const settings = await loadSettings();
  sendToUi({ type: 'SETTINGS_LOADED', settings });

  const license = await loadLicense();
  const tier = getEffectiveTier(license);
  sendToUi({ type: 'LICENSE_LOADED', license, tier });
})();
