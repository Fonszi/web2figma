/**
 * Style registry panel — shows Forge-created styles in this file.
 *
 * Helps team members see existing tokens before importing (avoid duplicates).
 */

import { useState } from 'preact/hooks';
import type { StyleRegistry } from '../../../../shared/types';
import { getRegistrySummary } from '../../../../shared/style-registry';

interface StyleRegistryPanelProps {
  registry: StyleRegistry | null;
}

export function StyleRegistryPanel({ registry }: StyleRegistryPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!registry || registry.entries.length === 0) return null;

  const summary = getRegistrySummary(registry);

  if (!expanded) {
    return (
      <div class="style-registry-panel">
        <button class="panel-toggle" onClick={() => setExpanded(true)}>
          Existing styles <span class="panel-count">{summary.totalStyles}</span>
        </button>
      </div>
    );
  }

  // Group entries by source URL
  const byUrl = new Map<string, typeof registry.entries>();
  for (const entry of registry.entries) {
    const list = byUrl.get(entry.sourceUrl) ?? [];
    list.push(entry);
    byUrl.set(entry.sourceUrl, list);
  }

  return (
    <div class="style-registry-panel style-registry-expanded">
      <button class="panel-toggle" onClick={() => setExpanded(false)}>
        Existing styles <span class="panel-count">{summary.totalStyles}</span>
      </button>

      <div class="registry-summary">
        {summary.colorCount > 0 && <span class="registry-stat">{summary.colorCount} colors</span>}
        {summary.typographyCount > 0 && <span class="registry-stat">{summary.typographyCount} typography</span>}
        {summary.effectCount > 0 && <span class="registry-stat">{summary.effectCount} effects</span>}
        {summary.variableCount > 0 && <span class="registry-stat">{summary.variableCount} variables</span>}
      </div>

      {Array.from(byUrl.entries()).map(([url, entries]) => (
        <div key={url} class="registry-source-group">
          <div class="registry-source-url" title={url}>
            {new URL(url).hostname}
          </div>
          {entries.map((entry) => (
            <div key={entry.figmaStyleId} class="registry-entry">
              <span class="registry-entry-type">{entry.styleType}</span>
              <span class="registry-entry-name">{entry.styleName}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
