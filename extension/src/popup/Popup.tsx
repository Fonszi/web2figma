/**
 * Chrome Extension Popup UI.
 *
 * Shows current tab info, viewport picker, extraction controls, results, and copy-to-clipboard.
 * Supports single-viewport and multi-viewport extraction.
 * Built with Preact for minimal bundle size.
 *
 * Related files:
 * - ViewportPicker: extension/src/popup/ViewportPicker.tsx
 * - Service worker: extension/src/background/service-worker.ts
 * - Content script: extension/src/content/extractor.ts
 * - Message types: shared/messages.ts
 */

import { render } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { ExtractionResult, MultiViewportResult, ViewportExtraction, UsageStats, LicenseInfo } from '../../../shared/types';
import { VIEWPORTS, STORAGE_KEY_SELECTED_VIEWPORTS, DEFAULT_SELECTED_VIEWPORTS, STORAGE_KEY_USAGE, STORAGE_KEY_LICENSE, STORAGE_KEY_SERVER_QUOTA, FREE_EXTRACTION_LIMIT, STRIPE_CHECKOUT_PRO_URL, STRIPE_CHECKOUT_TEAM_URL, PRICE_PRO_MONTHLY, PRICE_TEAM_PER_SEAT, type ViewportPreset } from '../../../shared/constants';
import { checkRelayHealth, postExtraction } from '../../../shared/relay-client';
import { getEffectiveTier, getRemainingExtractions, isExtractionLimitReached, needsMonthlyReset, resetUsageForNewMonth, incrementUsage } from '../../../shared/licensing';
import { ViewportPicker } from './ViewportPicker';

interface TabInfo {
  url: string;
  title: string;
  width: number;
  height: number;
}

type PopupState = 'idle' | 'extracting' | 'done' | 'error';

function App() {
  const [state, setState] = useState<PopupState>('idle');
  const [tabInfo, setTabInfo] = useState<TabInfo | null>(null);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [multiResult, setMultiResult] = useState<MultiViewportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [extractionTime, setExtractionTime] = useState(0);
  const [selectedViewports, setSelectedViewports] = useState<ViewportPreset[]>(DEFAULT_SELECTED_VIEWPORTS);
  const [customWidths, setCustomWidths] = useState<number[]>([]);
  const [extractionProgress, setExtractionProgress] = useState('');
  const [relayAvailable, setRelayAvailable] = useState(false);
  const [relaySent, setRelaySent] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [licenseInfo, setLicenseInfo] = useState<LicenseInfo | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [serverQuota, setServerQuota] = useState<{ quotaUsed: number; quotaLimit: number; syncedAt: number } | null>(null);

  // Get current tab info, load saved viewport selection, check relay on mount
  useEffect(() => {
    checkRelayHealth().then((health) => {
      setRelayAvailable(health !== null);
    });
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      if (tab) {
        setTabInfo({
          url: tab.url ?? 'Unknown',
          title: tab.title ?? 'Untitled',
          width: tab.width ?? 0,
          height: tab.height ?? 0,
        });
      }
    });

    chrome.storage.local.get(STORAGE_KEY_SELECTED_VIEWPORTS).then((data) => {
      const saved = data[STORAGE_KEY_SELECTED_VIEWPORTS];
      if (saved?.presets) setSelectedViewports(saved.presets);
      if (saved?.customWidths) setCustomWidths(saved.customWidths);
    });

    // Load usage stats, license, and server quota
    chrome.storage.local.get([STORAGE_KEY_USAGE, STORAGE_KEY_LICENSE, STORAGE_KEY_SERVER_QUOTA]).then((data) => {
      if (data[STORAGE_KEY_USAGE]) setUsageStats(data[STORAGE_KEY_USAGE]);
      if (data[STORAGE_KEY_LICENSE]) setLicenseInfo(data[STORAGE_KEY_LICENSE]);
      if (data[STORAGE_KEY_SERVER_QUOTA]) setServerQuota(data[STORAGE_KEY_SERVER_QUOTA]);
    });
  }, []);

  const handleViewportChange = useCallback((presets: ViewportPreset[], customs: number[]) => {
    setSelectedViewports(presets);
    setCustomWidths(customs);
    chrome.storage.local.set({
      [STORAGE_KEY_SELECTED_VIEWPORTS]: { presets, customWidths: customs },
    });
  }, []);

  const getTotalViewportCount = () => selectedViewports.length + customWidths.length;

  const tier = getEffectiveTier(licenseInfo);

  const handleExtract = useCallback(async () => {
    // Pre-extraction checks for free tier
    const currentTier = getEffectiveTier(licenseInfo);
    if (currentTier === 'free') {
      let stats = usageStats ?? resetUsageForNewMonth();
      if (needsMonthlyReset(stats)) {
        stats = resetUsageForNewMonth();
        setUsageStats(stats);
      }
      if (isExtractionLimitReached(stats)) {
        setShowUpgradeModal(true);
        return;
      }
      if (getTotalViewportCount() > 1) {
        setShowUpgradeModal(true);
        return;
      }
    }

    setState('extracting');
    setError(null);
    setResult(null);
    setMultiResult(null);
    setCopied(false);
    setExtractionProgress('');
    const startTime = Date.now();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('No active tab found');
      }

      // Inject content script
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
      } catch {
        // Already injected
      }

      const totalViewports = getTotalViewportCount();

      if (totalViewports === 1 && customWidths.length === 0) {
        // Single viewport — use existing simple extraction
        const vp = VIEWPORTS[selectedViewports[0]];
        setExtractionProgress(`Extracting at ${vp.label} (${vp.width}px)...`);

        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'EXTRACT_AT_VIEWPORT',
          width: vp.width,
          height: vp.height,
        });

        if (response?.type === 'EXTRACTION_ERROR') {
          throw new Error(response.error);
        }

        if (response?.type === 'EXTRACTION_COMPLETE' && response.result) {
          const extraction = response.result as ExtractionResult;
          setResult(extraction);
          setExtractionTime(Date.now() - startTime);
          setState('done');
          await chrome.storage.local.set({ forge_extraction: extraction });

          // Update local usage stats
          let stats = usageStats ?? resetUsageForNewMonth();
          if (needsMonthlyReset(stats)) stats = resetUsageForNewMonth();
          stats = incrementUsage(stats);
          setUsageStats(stats);

          // Auto-POST to relay (fire-and-forget)
          if (relayAvailable) {
            postExtraction(extraction).then((sent) => {
              if (sent) setRelaySent(true);
            });
          }
        } else {
          throw new Error('Unexpected response from content script');
        }

        // Restore viewport
        await chrome.tabs.sendMessage(tab.id, { type: 'RESTORE_VIEWPORT' });
      } else {
        // Multi-viewport extraction
        const extractions: ViewportExtraction[] = [];

        // Build viewport list: presets + custom widths
        const viewportList: { key: string; label: string; width: number; height: number }[] = [
          ...selectedViewports.map((key) => ({
            key,
            label: VIEWPORTS[key].label,
            width: VIEWPORTS[key].width,
            height: VIEWPORTS[key].height,
          })),
          ...customWidths.map((w) => ({
            key: `custom-${w}`,
            label: `Custom (${w}px)`,
            width: w,
            height: 900,
          })),
        ];

        // Sort by width descending (extract widest first)
        viewportList.sort((a, b) => b.width - a.width);

        for (let i = 0; i < viewportList.length; i++) {
          const vp = viewportList[i];
          setExtractionProgress(`Extracting ${vp.label} (${i + 1}/${viewportList.length})...`);

          const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'EXTRACT_AT_VIEWPORT',
            width: vp.width,
            height: vp.height,
          });

          if (response?.type === 'EXTRACTION_ERROR') {
            throw new Error(`${vp.label}: ${response.error}`);
          }

          if (response?.type === 'EXTRACTION_COMPLETE' && response.result) {
            extractions.push({
              viewportKey: vp.key,
              label: vp.label,
              width: vp.width,
              height: vp.height,
              result: response.result as ExtractionResult,
            });
          }
        }

        // Restore viewport
        await chrome.tabs.sendMessage(tab.id, { type: 'RESTORE_VIEWPORT' });

        const multi: MultiViewportResult = {
          type: 'multi-viewport',
          url: tab.url ?? '',
          timestamp: Date.now(),
          extractions,
        };

        setMultiResult(multi);
        setExtractionTime(Date.now() - startTime);
        setState('done');
        await chrome.storage.local.set({ forge_extraction: multi });

        // Update local usage stats
        let stats = usageStats ?? resetUsageForNewMonth();
        if (needsMonthlyReset(stats)) stats = resetUsageForNewMonth();
        stats = incrementUsage(stats);
        setUsageStats(stats);

        // Auto-POST to relay (fire-and-forget)
        if (relayAvailable) {
          postExtraction(multi).then((sent) => {
            if (sent) setRelaySent(true);
          });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
      setState('error');
    }
  }, [selectedViewports, customWidths]);

  const getExportPayload = (): ExtractionResult | MultiViewportResult | null => {
    return multiResult ?? result;
  };

  const handleCopy = useCallback(async () => {
    const payload = getExportPayload();
    if (!payload) return;
    try {
      const json = JSON.stringify(payload, null, 2);
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      chrome.runtime.sendMessage({
        type: 'COPY_TO_CLIPBOARD',
        data: JSON.stringify(getExportPayload()),
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result, multiResult]);

  const countNodes = (node: ExtractionResult['rootNode']): number => {
    let count = 1;
    for (const child of node.children) {
      count += countNodes(child);
    }
    return count;
  };

  const countImages = (node: ExtractionResult['rootNode']): number => {
    let count = node.imageUrl || node.imageDataUri ? 1 : 0;
    for (const child of node.children) {
      count += countImages(child);
    }
    return count;
  };

  const renderSingleResult = (res: ExtractionResult) => (
    <div class="result-stats">
      <div class="stat">
        <span class="stat-value">{countNodes(res.rootNode)}</span>
        <span class="stat-label">Nodes</span>
      </div>
      <div class="stat">
        <span class="stat-value">{countImages(res.rootNode)}</span>
        <span class="stat-label">Images</span>
      </div>
      <div class="stat">
        <span class="stat-value">{res.tokens.colors.length + res.tokens.typography.length}</span>
        <span class="stat-label">Tokens</span>
      </div>
      <div class="stat">
        <span class="stat-value">{extractionTime}ms</span>
        <span class="stat-label">Time</span>
      </div>
    </div>
  );

  const renderMultiResult = (multi: MultiViewportResult) => {
    const totalNodes = multi.extractions.reduce((sum, e) => sum + countNodes(e.result.rootNode), 0);
    return (
      <div>
        <div class="result-stats">
          <div class="stat">
            <span class="stat-value">{multi.extractions.length}</span>
            <span class="stat-label">Viewports</span>
          </div>
          <div class="stat">
            <span class="stat-value">{totalNodes}</span>
            <span class="stat-label">Nodes</span>
          </div>
          <div class="stat">
            <span class="stat-value">{multi.extractions[0]?.result.tokens.colors.length ?? 0}</span>
            <span class="stat-label">Colors</span>
          </div>
          <div class="stat">
            <span class="stat-value">{extractionTime}ms</span>
            <span class="stat-label">Time</span>
          </div>
        </div>
        <div class="viewport-results">
          {multi.extractions.map((e) => (
            <div key={e.viewportKey} class="viewport-result-row">
              <span class="viewport-result-label">{e.label}</span>
              <span class="viewport-result-detail">
                {countNodes(e.result.rootNode)} nodes at {e.width}px
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div class="header">
        <svg class="header-logo" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#0d99ff" />
          <path d="M6 8h12M6 12h12M6 16h8" stroke="white" stroke-width="2" stroke-linecap="round" />
        </svg>
        <span class="header-title">Forge</span>
        <span class="header-version">v0.1.0</span>
        <span class={`relay-status ${relayAvailable ? 'relay-connected' : ''}`} title={relayAvailable ? 'Relay server connected' : 'Relay server offline'} />
      </div>

      {/* Page info */}
      {tabInfo && (
        <div class="page-info">
          <div class="page-url" title={tabInfo.url}>{tabInfo.url}</div>
          <div class="page-viewport">{tabInfo.width} x {tabInfo.height}</div>
        </div>
      )}

      {/* Usage meter (free tier only) */}
      {tier === 'free' && usageStats && (() => {
        const SERVER_QUOTA_FRESH_MS = 5 * 60 * 1000;
        const useServer = serverQuota && serverQuota.quotaLimit > 0 && (Date.now() - serverQuota.syncedAt) < SERVER_QUOTA_FRESH_MS;
        const used = useServer ? serverQuota.quotaUsed : usageStats.extractionsThisMonth;
        const limit = useServer ? serverQuota.quotaLimit : FREE_EXTRACTION_LIMIT;
        const remaining = Math.max(0, limit - used);
        return (
          <div class="usage-meter">
            <div class="usage-meter-header">
              <span class="usage-meter-label">
                {remaining} of {limit} free extractions remaining
              </span>
            </div>
            <div class="usage-meter-bar">
              <div
                class={`usage-meter-fill ${used >= limit ? 'exhausted' : used >= limit * 0.8 ? 'warning' : ''}`}
                style={{ width: `${Math.min(100, (used / limit) * 100)}%` }}
              />
            </div>
          </div>
        );
      })()}

      {/* Viewport picker */}
      <ViewportPicker
        selected={selectedViewports}
        customWidths={customWidths}
        onChange={handleViewportChange}
        disabled={state === 'extracting'}
        tier={tier}
      />

      {/* Extract button */}
      <button
        class="btn-extract"
        onClick={handleExtract}
        disabled={state === 'extracting'}
      >
        {state === 'extracting' ? (
          <>
            <span class="spinner" />
            Extracting...
          </>
        ) : (
          getTotalViewportCount() > 1
            ? `Extract ${getTotalViewportCount()} Viewports`
            : 'Extract Page'
        )}
      </button>

      {/* Progress */}
      {state === 'extracting' && (
        <div class="status">
          <span class="spinner" />
          {extractionProgress || 'Walking DOM tree and collecting styles...'}
        </div>
      )}

      {/* Result */}
      {state === 'done' && (result || multiResult) && (
        <div class="result">
          {multiResult ? renderMultiResult(multiResult) : result ? renderSingleResult(result) : null}
          <button class={`btn-copy ${copied ? 'copied' : ''}`} onClick={handleCopy}>
            {copied ? 'Copied to clipboard' : 'Copy JSON for Figma'}
          </button>
          {relaySent && (
            <div class="relay-sent">Sent to Figma Plugin via relay</div>
          )}
        </div>
      )}

      {/* Error */}
      {state === 'error' && error && (
        <div class="error">
          {error}
          <button class="btn-retry" onClick={handleExtract}>Retry</button>
        </div>
      )}

      {/* Footer */}
      <div class="footer">
        {tier === 'free' ? 'Free tier — basic conversion only' : 'Paste the JSON into the Forge Figma plugin to import.'}
      </div>

      {/* Upgrade modal */}
      {showUpgradeModal && (
        <div class="upgrade-modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div class="upgrade-modal" onClick={(e: Event) => e.stopPropagation()}>
            <div class="upgrade-modal-title">Upgrade to Forge Pro</div>
            <div class="upgrade-modal-body">
              {usageStats && isExtractionLimitReached(usageStats)
                ? `You have used all ${FREE_EXTRACTION_LIMIT} free extractions this month. `
                : 'Multi-viewport extraction requires a Pro plan. '}
              Upgrade for unlimited extractions plus design tokens, components, and more.
            </div>
            <div class="upgrade-modal-plans">
              <button class="btn-plan" onClick={() => window.open(STRIPE_CHECKOUT_PRO_URL, '_blank')}>
                Pro — ${PRICE_PRO_MONTHLY}/mo
              </button>
              <button class="btn-plan" onClick={() => window.open(STRIPE_CHECKOUT_TEAM_URL, '_blank')}>
                Team — ${PRICE_TEAM_PER_SEAT}/seat/mo
              </button>
            </div>
            <button class="btn-dismiss" onClick={() => setShowUpgradeModal(false)}>
              Maybe later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

render(<App />, document.getElementById('app')!);
