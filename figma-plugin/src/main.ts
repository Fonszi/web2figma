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

import { UI_WIDTH, UI_HEIGHT, LICENSE_CACHE_MS, STORAGE_KEY_PRESETS, SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_PRESETS, SHARED_KEY_STYLE_REGISTRY, SHARED_KEY_TEAM_DEFAULTS, MAX_PERSONAL_PRESETS, MAX_TEAM_PRESETS } from '../../shared/constants';
import type { UiToSandboxMessage, SandboxToUiMessage } from '../../shared/messages';
import type { ExtractionResult, ImportSettings, LicenseInfo, Preset, StyleRegistry, TeamDefaults } from '../../shared/types';
import { DEFAULT_SETTINGS } from '../../shared/types';
import { isValidLicenseKeyFormat, isLicenseCacheValid, getEffectiveTier, applyTierToSettings, hasTeamAccess } from '../../shared/licensing';
import { activateLicense, logConversion } from '../../shared/api-client';
import { addPreset, removePreset, promoteToTeamPreset, demoteToPersonalPreset } from '../../shared/presets';
import { deserializeRegistry } from '../../shared/style-registry';
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

// --- Preset storage ---

async function loadPersonalPresets(): Promise<Preset[]> {
  const saved = await figma.clientStorage.getAsync(STORAGE_KEY_PRESETS);
  return Array.isArray(saved) ? saved : [];
}

async function savePersonalPresets(presets: Preset[]): Promise<void> {
  await figma.clientStorage.setAsync(STORAGE_KEY_PRESETS, presets);
}

function loadTeamPresets(): Preset[] {
  const json = figma.root.getSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_PRESETS);
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTeamPresets(presets: Preset[]): void {
  figma.root.setSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_PRESETS, JSON.stringify(presets));
}

// --- Style registry storage ---

function loadStyleRegistry(): StyleRegistry | null {
  const json = figma.root.getSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_STYLE_REGISTRY);
  if (!json) return null;
  return deserializeRegistry(json);
}

// --- Team defaults storage ---

function loadTeamDefaults(): TeamDefaults | null {
  const json = figma.root.getSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_DEFAULTS);
  if (!json) return null;
  try {
    return JSON.parse(json) as TeamDefaults;
  } catch {
    return null;
  }
}

function saveTeamDefaults(defaults: TeamDefaults): void {
  figma.root.setSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_DEFAULTS, JSON.stringify(defaults));
}

function clearStoredTeamDefaults(): void {
  figma.root.setSharedPluginData(SHARED_PLUGIN_NAMESPACE, SHARED_KEY_TEAM_DEFAULTS, '');
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

    // --- Preset handlers ---

    case 'LOAD_PRESETS': {
      const personal = await loadPersonalPresets();
      const team = loadTeamPresets();
      sendToUi({ type: 'PRESETS_LOADED', personal, team });
      break;
    }

    case 'SAVE_PRESET': {
      const newPreset = { ...(msg as UiToSandboxMessage & { type: 'SAVE_PRESET' }).preset };
      if (newPreset.isTeamPreset) {
        const license = await loadLicense();
        const tier = getEffectiveTier(license);
        if (!hasTeamAccess(tier)) {
          newPreset.isTeamPreset = false;
        }
      }
      if (newPreset.isTeamPreset) {
        const team = loadTeamPresets();
        saveTeamPresets(addPreset(team, newPreset, MAX_TEAM_PRESETS));
      } else {
        const personal = await loadPersonalPresets();
        await savePersonalPresets(addPreset(personal, newPreset, MAX_PERSONAL_PRESETS));
      }
      sendToUi({ type: 'PRESET_SAVED', preset: newPreset });
      sendToUi({ type: 'PRESETS_LOADED', personal: await loadPersonalPresets(), team: loadTeamPresets() });
      break;
    }

    case 'DELETE_PRESET': {
      const { presetId, isTeamPreset: isTeam } = msg as UiToSandboxMessage & { type: 'DELETE_PRESET' };
      if (isTeam) {
        saveTeamPresets(removePreset(loadTeamPresets(), presetId));
      } else {
        const personal = await loadPersonalPresets();
        await savePersonalPresets(removePreset(personal, presetId));
      }
      sendToUi({ type: 'PRESET_DELETED', presetId });
      sendToUi({ type: 'PRESETS_LOADED', personal: await loadPersonalPresets(), team: loadTeamPresets() });
      break;
    }

    case 'SHARE_PRESET': {
      const { presetId } = msg as UiToSandboxMessage & { type: 'SHARE_PRESET' };
      const license = await loadLicense();
      const tier = getEffectiveTier(license);
      if (!hasTeamAccess(tier)) break;

      const personal = await loadPersonalPresets();
      const found = personal.find((p) => p.id === presetId);
      if (!found) break;

      const teamPreset = promoteToTeamPreset(found);
      saveTeamPresets(addPreset(loadTeamPresets(), teamPreset, MAX_TEAM_PRESETS));
      await savePersonalPresets(removePreset(personal, presetId));

      sendToUi({ type: 'PRESET_SHARED', preset: teamPreset });
      sendToUi({ type: 'PRESETS_LOADED', personal: await loadPersonalPresets(), team: loadTeamPresets() });
      break;
    }

    case 'UNSHARE_PRESET': {
      const { presetId } = msg as UiToSandboxMessage & { type: 'UNSHARE_PRESET' };
      const team = loadTeamPresets();
      const found = team.find((p) => p.id === presetId);
      if (!found) break;

      const personalPreset = demoteToPersonalPreset(found);
      saveTeamPresets(removePreset(team, presetId));
      const personal = await loadPersonalPresets();
      await savePersonalPresets(addPreset(personal, personalPreset, MAX_PERSONAL_PRESETS));

      sendToUi({ type: 'PRESET_UNSHARED', presetId });
      sendToUi({ type: 'PRESETS_LOADED', personal: await loadPersonalPresets(), team: loadTeamPresets() });
      break;
    }

    case 'APPLY_PRESET': {
      const preset = (msg as UiToSandboxMessage & { type: 'APPLY_PRESET' }).preset;
      await saveSettings(preset.settings);
      sendToUi({ type: 'SETTINGS_LOADED', settings: preset.settings });
      break;
    }

    // --- Style registry handlers ---

    case 'LOAD_STYLE_REGISTRY': {
      const registry = loadStyleRegistry();
      sendToUi({ type: 'STYLE_REGISTRY_LOADED', registry });
      break;
    }

    // --- Team defaults handlers ---

    case 'LOAD_TEAM_DEFAULTS': {
      const defaults = loadTeamDefaults();
      sendToUi({ type: 'TEAM_DEFAULTS_LOADED', defaults });
      break;
    }

    case 'SET_TEAM_DEFAULTS': {
      const license = await loadLicense();
      const tier = getEffectiveTier(license);
      if (!hasTeamAccess(tier)) break;

      const settingsForDefaults = (msg as UiToSandboxMessage & { type: 'SET_TEAM_DEFAULTS' }).settings;
      const defaults: TeamDefaults = {
        settings: settingsForDefaults,
        setBy: license?.key?.slice(0, 10) ?? 'unknown',
        setAt: Date.now(),
      };
      saveTeamDefaults(defaults);
      sendToUi({ type: 'TEAM_DEFAULTS_SAVED', defaults });
      break;
    }

    case 'CLEAR_TEAM_DEFAULTS': {
      clearStoredTeamDefaults();
      sendToUi({ type: 'TEAM_DEFAULTS_CLEARED' });
      break;
    }
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
  let settings = await loadSettings();
  const license = await loadLicense();
  const tier = getEffectiveTier(license);

  // Apply team defaults on first load (if no personal settings saved)
  const savedSettings = await figma.clientStorage.getAsync('forge_settings');
  if (!savedSettings) {
    const teamDefaults = loadTeamDefaults();
    if (teamDefaults) {
      settings = teamDefaults.settings;
      await saveSettings(settings);
    }
  }

  sendToUi({ type: 'SETTINGS_LOADED', settings });
  sendToUi({ type: 'LICENSE_LOADED', license, tier });

  // Preload presets
  const personal = await loadPersonalPresets();
  const team = loadTeamPresets();
  sendToUi({ type: 'PRESETS_LOADED', personal, team });
})();
