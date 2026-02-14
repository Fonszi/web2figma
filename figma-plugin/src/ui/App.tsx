/**
 * Figma Plugin UI — Preact app rendered in the plugin iframe.
 *
 * Provides:
 * - JSON paste textarea for BridgeNode data
 * - Import button
 * - Progress bar during conversion
 * - Result summary
 * - Settings panel
 *
 * Communicates with the plugin sandbox via parent.postMessage().
 */

import { render } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import type { SandboxToUiMessage, ImportPhase, DiffChange, DiffSummary } from '../../../shared/messages';
import { PHASE_LABELS } from '../../../shared/messages';
import type { ImportSettings, ExtractionResult } from '../../../shared/types';
import { DEFAULT_SETTINGS } from '../../../shared/types';
import { checkRelayHealth, fetchExtraction } from '../../../shared/relay-client';
import { TokenPanel } from './components/TokenPanel';
import { ComponentPanel } from './components/ComponentPanel';
import { DiffPanel } from './components/DiffPanel';

type UiState = 'idle' | 'importing' | 'done' | 'error' | 'diff-review';

function App() {
  const [state, setState] = useState<UiState>('idle');
  const [json, setJson] = useState('');
  const [phase, setPhase] = useState<ImportPhase>('parsing');
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [result, setResult] = useState<{ nodeCount: number; tokenCount: number; componentCount: number; styleCount: number; sectionCount: number; variantCount?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ImportSettings>(DEFAULT_SETTINGS);
  const [relayAvailable, setRelayAvailable] = useState(false);
  const [diffChanges, setDiffChanges] = useState<DiffChange[]>([]);
  const [diffSummary, setDiffSummary] = useState<DiffSummary | null>(null);
  const [reimportResult, setReimportResult] = useState<{ updatedCount: number; addedCount: number; removedCount: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check relay health on mount
  useEffect(() => {
    checkRelayHealth().then((health) => {
      setRelayAvailable(health !== null);
    });
  }, []);

  // Listen for messages from the plugin sandbox
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage as SandboxToUiMessage | undefined;
      if (!msg) return;

      switch (msg.type) {
        case 'IMPORT_PROGRESS':
          setPhase(msg.phase);
          setProgress(msg.progress);
          setProgressMessage(msg.message);
          break;

        case 'IMPORT_COMPLETE':
          setState('done');
          setResult({ nodeCount: msg.nodeCount, tokenCount: msg.tokenCount, componentCount: msg.componentCount, styleCount: msg.styleCount, sectionCount: msg.sectionCount, variantCount: msg.variantCount });
          break;

        case 'IMPORT_ERROR':
          setState('error');
          setError(msg.error);
          break;

        case 'SETTINGS_LOADED':
          setSettings(msg.settings);
          break;

        case 'DIFF_RESULT':
          setState('diff-review');
          setDiffChanges(msg.changes);
          setDiffSummary(msg.summary);
          break;

        case 'REIMPORT_COMPLETE':
          setState('done');
          setReimportResult({ updatedCount: msg.updatedCount, addedCount: msg.addedCount, removedCount: msg.removedCount });
          break;
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Handle image fetch requests from sandbox
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data.pluginMessage;
      if (msg?.type === 'FETCH_IMAGE') {
        fetchImage(msg.nodeId, msg.url);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const fetchImage = async (nodeId: string, url: string) => {
    try {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      parent.postMessage({
        pluginMessage: {
          type: 'IMAGE_DATA',
          nodeId,
          data: new Uint8Array(buffer),
        },
      }, '*');
    } catch {
      parent.postMessage({
        pluginMessage: {
          type: 'IMAGE_DATA',
          nodeId,
          data: null,
        },
      }, '*');
    }
  };

  const handleImport = useCallback(() => {
    if (!json.trim()) return;
    setState('importing');
    setError(null);
    setResult(null);
    setProgress(0);
    parent.postMessage({ pluginMessage: { type: 'START_IMPORT', json } }, '*');
  }, [json]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJson(text);
    } catch {
      // Clipboard API not available in iframe — user must paste manually
    }
  }, []);

  const handleFetchFromRelay = useCallback(async () => {
    const data = await fetchExtraction();
    if (data) {
      const jsonStr = JSON.stringify(data, null, 2);
      setJson(jsonStr);
    }
  }, []);

  const handleReimport = useCallback(() => {
    if (!json.trim()) return;
    setState('importing');
    setError(null);
    setResult(null);
    setReimportResult(null);
    setDiffChanges([]);
    setDiffSummary(null);
    setProgress(0);
    parent.postMessage({ pluginMessage: { type: 'START_REIMPORT', json } }, '*');
  }, [json]);

  const handleApplyDiff = useCallback((changeIds: string[], mode: 'update-changed' | 'full-reimport') => {
    setState('importing');
    setProgress(0);
    parent.postMessage({ pluginMessage: { type: 'APPLY_DIFF', changeIds, mode } }, '*');
  }, []);

  const handleToggleDiffChange = useCallback((id: string) => {
    setDiffChanges((prev) =>
      prev.map((c) => (c.id === id ? { ...c, selected: !c.selected } : c)),
    );
  }, []);

  const handleReset = useCallback(() => {
    setState('idle');
    setJson('');
    setError(null);
    setResult(null);
    setReimportResult(null);
    setDiffChanges([]);
    setDiffSummary(null);
    setProgress(0);
  }, []);

  const isValidJson = json.trim().length > 0 && (() => {
    try { JSON.parse(json); return true; } catch { return false; }
  })();

  const jsonSize = json.length > 0 ? `${(json.length / 1024).toFixed(1)} KB` : '';

  return (
    <div class="app">
      {/* Header */}
      <div class="header">
        <h1>Forge</h1>
        <span class="version">v0.1.0</span>
        <span class={`relay-status ${relayAvailable ? 'relay-connected' : ''}`} title={relayAvailable ? 'Relay connected' : 'Relay offline'} />
      </div>

      {/* Idle: JSON input */}
      {state === 'idle' && (
        <div class="input-section">
          <div class="input-label">
            <span>Paste extraction JSON</span>
            {jsonSize && <span class="json-size">{jsonSize}</span>}
          </div>
          <textarea
            ref={textareaRef}
            class="json-input"
            placeholder='Paste the JSON from the Forge Chrome Extension here...'
            value={json}
            onInput={(e) => setJson((e.target as HTMLTextAreaElement).value)}
            rows={8}
          />
          <div class="actions">
            <button class="btn-paste" onClick={handlePaste}>Paste from clipboard</button>
            {relayAvailable && (
              <button class="btn-relay" onClick={handleFetchFromRelay}>Fetch from Relay</button>
            )}
            <button
              class="btn-import"
              onClick={handleImport}
              disabled={!isValidJson}
            >
              Import to Figma
            </button>
            {isValidJson && (
              <button
                class="btn-reimport"
                onClick={handleReimport}
              >
                Re-import (diff)
              </button>
            )}
          </div>
          {json.trim().length > 0 && !isValidJson && (
            <div class="validation-error">Invalid JSON format</div>
          )}
        </div>
      )}

      {/* Importing: Progress */}
      {state === 'importing' && (
        <div class="progress-section">
          <div class="progress-phase">{PHASE_LABELS[phase]}</div>
          <div class="progress-bar">
            <div class="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <div class="progress-detail">{progressMessage}</div>
        </div>
      )}

      {/* Diff Review */}
      {state === 'diff-review' && diffSummary && (
        <DiffPanel
          changes={diffChanges}
          summary={diffSummary}
          onToggleChange={handleToggleDiffChange}
          onApplySelected={() => {
            const selectedIds = diffChanges.filter((c) => c.selected).map((c) => c.id);
            handleApplyDiff(selectedIds, 'update-changed');
          }}
          onFullReimport={() => {
            handleApplyDiff([], 'full-reimport');
          }}
          onCancel={handleReset}
        />
      )}

      {/* Re-import complete */}
      {state === 'done' && reimportResult && (
        <div class="result-section">
          <div class="result-icon">✓</div>
          <div class="result-title">Re-import complete</div>
          <div class="result-stats">
            <div class="stat">
              <span class="stat-value">{reimportResult.updatedCount}</span>
              <span class="stat-label">Updated</span>
            </div>
            <div class="stat">
              <span class="stat-value">{reimportResult.addedCount}</span>
              <span class="stat-label">Added</span>
            </div>
            <div class="stat">
              <span class="stat-value">{reimportResult.removedCount}</span>
              <span class="stat-label">Removed</span>
            </div>
          </div>
          <button class="btn-reset" onClick={handleReset}>Import another</button>
        </div>
      )}

      {/* Done: Result */}
      {state === 'done' && result && !reimportResult && (
        <div class="result-section">
          <div class="result-icon">✓</div>
          <div class="result-title">Import complete</div>
          <div class="result-stats">
            <div class="stat">
              <span class="stat-value">{result.nodeCount}</span>
              <span class="stat-label">Nodes</span>
            </div>
            <div class="stat">
              <span class="stat-value">{result.styleCount}</span>
              <span class="stat-label">Styles</span>
            </div>
            <div class="stat">
              <span class="stat-value">{result.tokenCount}</span>
              <span class="stat-label">Tokens</span>
            </div>
            <div class="stat">
              <span class="stat-value">{result.componentCount}</span>
              <span class="stat-label">Components</span>
            </div>
            {result.sectionCount > 0 && (
              <div class="stat">
                <span class="stat-value">{result.sectionCount}</span>
                <span class="stat-label">Sections</span>
              </div>
            )}
            {result.variantCount && result.variantCount > 0 && (
              <div class="stat">
                <span class="stat-value">{result.variantCount}</span>
                <span class="stat-label">Variants</span>
              </div>
            )}
          </div>
          {(() => {
            try {
              const parsed = JSON.parse(json) as ExtractionResult;
              return (
                <>
                  <TokenPanel
                    colors={parsed.tokens.colors.map(c => ({ name: c.name, value: c.value }))}
                    typography={parsed.tokens.typography.map(t => ({ name: t.name, detail: `${t.fontFamily} ${t.fontSize}px ${t.fontWeight >= 700 ? 'Bold' : 'Regular'}` }))}
                    effects={parsed.tokens.effects.map(e => ({ name: e.name, detail: e.value }))}
                    variables={parsed.tokens.variables.map(v => ({ name: v.name, value: v.resolvedValue, type: v.type }))}
                    styleCount={result.styleCount}
                  />
                  <ComponentPanel
                    components={parsed.components.map(c => ({ name: c.name, instanceCount: c.instances.length, hash: c.hash }))}
                    componentCount={result.componentCount}
                  />
                </>
              );
            } catch {
              return null;
            }
          })()}
          <button class="btn-reset" onClick={handleReset}>Import another</button>
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div class="error-section">
          <div class="error-icon">✕</div>
          <div class="error-title">Import failed</div>
          <div class="error-message">{error}</div>
          <button class="btn-reset" onClick={handleReset}>Try again</button>
        </div>
      )}
    </div>
  );
}

render(<App />, document.getElementById('app')!);
