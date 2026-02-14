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
import type { ExtractionResult, MultiViewportResult, ViewportExtraction } from '../../../shared/types';
import { VIEWPORTS, STORAGE_KEY_SELECTED_VIEWPORTS, DEFAULT_SELECTED_VIEWPORTS, type ViewportPreset } from '../../../shared/constants';
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

  // Get current tab info and load saved viewport selection on mount
  useEffect(() => {
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
  }, []);

  const handleViewportChange = useCallback((presets: ViewportPreset[], customs: number[]) => {
    setSelectedViewports(presets);
    setCustomWidths(customs);
    chrome.storage.local.set({
      [STORAGE_KEY_SELECTED_VIEWPORTS]: { presets, customWidths: customs },
    });
  }, []);

  const getTotalViewportCount = () => selectedViewports.length + customWidths.length;

  const handleExtract = useCallback(async () => {
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
      </div>

      {/* Page info */}
      {tabInfo && (
        <div class="page-info">
          <div class="page-url" title={tabInfo.url}>{tabInfo.url}</div>
          <div class="page-viewport">{tabInfo.width} x {tabInfo.height}</div>
        </div>
      )}

      {/* Viewport picker */}
      <ViewportPicker
        selected={selectedViewports}
        customWidths={customWidths}
        onChange={handleViewportChange}
        disabled={state === 'extracting'}
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
        Paste the JSON into the Forge Figma plugin to import.
      </div>
    </div>
  );
}

render(<App />, document.getElementById('app')!);
