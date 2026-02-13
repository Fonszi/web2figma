/**
 * Chrome Extension Popup UI.
 *
 * Shows current tab info, extraction controls, results, and copy-to-clipboard.
 * Built with Preact for minimal bundle size.
 *
 * Related files:
 * - Service worker: extension/src/background/service-worker.ts
 * - Content script: extension/src/content/extractor.ts
 * - Message types: shared/messages.ts
 */

import { render } from 'preact';
import { useState, useEffect, useCallback } from 'preact/hooks';
import type { ExtractionResult } from '../../../shared/types';

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
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [extractionTime, setExtractionTime] = useState(0);

  // Get current tab info on mount
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
  }, []);

  const handleExtract = useCallback(async () => {
    setState('extracting');
    setError(null);
    setResult(null);
    setCopied(false);
    const startTime = Date.now();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('No active tab found');
      }

      // Inject content script programmatically (in case manifest injection hasn't run)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js'],
        });
      } catch {
        // Already injected — ignore
      }

      const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_PAGE' });

      if (response?.type === 'EXTRACTION_ERROR') {
        throw new Error(response.error);
      }

      if (response?.type === 'EXTRACTION_COMPLETE' && response.result) {
        const extraction = response.result as ExtractionResult;
        setResult(extraction);
        setExtractionTime(Date.now() - startTime);
        setState('done');

        // Store in chrome.storage for Figma plugin relay
        await chrome.storage.local.set({ web2figma_extraction: extraction });
      } else {
        throw new Error('Unexpected response from content script');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
      setState('error');
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      const json = JSON.stringify(result, null, 2);
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: try via service worker
      chrome.runtime.sendMessage({ type: 'COPY_TO_CLIPBOARD', data: JSON.stringify(result) });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [result]);

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

  return (
    <div>
      {/* Header */}
      <div class="header">
        <svg class="header-logo" viewBox="0 0 24 24" fill="none">
          <rect width="24" height="24" rx="4" fill="#0d99ff" />
          <path d="M6 8h12M6 12h12M6 16h8" stroke="white" stroke-width="2" stroke-linecap="round" />
        </svg>
        <span class="header-title">web2figma</span>
        <span class="header-version">v0.1.0</span>
      </div>

      {/* Page info */}
      {tabInfo && (
        <div class="page-info">
          <div class="page-url" title={tabInfo.url}>{tabInfo.url}</div>
          <div class="page-viewport">{tabInfo.width} × {tabInfo.height}</div>
        </div>
      )}

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
          'Extract Page'
        )}
      </button>

      {/* Progress */}
      {state === 'extracting' && (
        <div class="status">
          <span class="spinner" />
          Walking DOM tree and collecting styles...
        </div>
      )}

      {/* Result */}
      {state === 'done' && result && (
        <div class="result">
          <div class="result-stats">
            <div class="stat">
              <span class="stat-value">{countNodes(result.rootNode)}</span>
              <span class="stat-label">Nodes</span>
            </div>
            <div class="stat">
              <span class="stat-value">{countImages(result.rootNode)}</span>
              <span class="stat-label">Images</span>
            </div>
            <div class="stat">
              <span class="stat-value">{result.tokens.colors.length + result.tokens.typography.length}</span>
              <span class="stat-label">Tokens</span>
            </div>
            <div class="stat">
              <span class="stat-value">{extractionTime}ms</span>
              <span class="stat-label">Time</span>
            </div>
          </div>
          <button class={`btn-copy ${copied ? 'copied' : ''}`} onClick={handleCopy}>
            {copied ? '✓ Copied to clipboard' : 'Copy JSON for Figma'}
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
        Paste the JSON into the web2figma Figma plugin to import.
      </div>
    </div>
  );
}

render(<App />, document.getElementById('app')!);
