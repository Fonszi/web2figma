/**
 * Diff review panel — displays changes between new extraction and existing Figma tree.
 *
 * Shows a summary header with counts, a list of individual changes with checkboxes,
 * and action buttons for applying changes.
 */

import type { DiffChange, DiffSummary } from '../../../../shared/messages';

interface DiffPanelProps {
  changes: DiffChange[];
  summary: DiffSummary;
  onToggleChange: (id: string) => void;
  onApplySelected: () => void;
  onFullReimport: () => void;
  onCancel: () => void;
}

export function DiffPanel({ changes, summary, onToggleChange, onApplySelected, onFullReimport, onCancel }: DiffPanelProps) {
  const selectedCount = changes.filter((c) => c.selected).length;

  return (
    <div class="diff-panel">
      <div class="diff-header">
        <h2>Changes detected</h2>
        <div class="diff-summary">
          {summary.modifiedCount > 0 && (
            <span class="diff-badge diff-badge--modified">{summary.modifiedCount} modified</span>
          )}
          {summary.addedCount > 0 && (
            <span class="diff-badge diff-badge--added">{summary.addedCount} added</span>
          )}
          {summary.removedCount > 0 && (
            <span class="diff-badge diff-badge--removed">{summary.removedCount} removed</span>
          )}
          {summary.unchangedCount > 0 && (
            <span class="diff-badge diff-badge--unchanged">{summary.unchangedCount} unchanged</span>
          )}
        </div>
      </div>

      <div class="diff-list">
        {changes.map((change) => (
          <label key={change.id} class={`diff-item diff-item--${change.type}`}>
            <input
              type="checkbox"
              checked={change.selected}
              onChange={() => onToggleChange(change.id)}
            />
            <span class={`diff-type-icon diff-type-icon--${change.type}`}>
              {change.type === 'modified' ? '~' : change.type === 'added' ? '+' : '-'}
            </span>
            <span class="diff-item-desc">{change.description}</span>
            <span class="diff-item-path">{change.path}</span>
          </label>
        ))}
      </div>

      <div class="diff-actions">
        <button class="btn-apply" onClick={onApplySelected} disabled={selectedCount === 0}>
          Update {selectedCount} selected
        </button>
        <button class="btn-full-reimport" onClick={onFullReimport}>
          Full re-import
        </button>
        <button class="btn-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
