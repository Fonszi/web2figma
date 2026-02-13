/**
 * Component panel — post-import collapsible summary of detected components.
 *
 * Shows detected component patterns with instance counts.
 * Uses the same collapsible section pattern as TokenPanel.
 */

import { useState } from 'preact/hooks';

interface ComponentInfo {
  name: string;
  instanceCount: number;
  hash: string;
}

interface ComponentPanelProps {
  components: ComponentInfo[];
  componentCount: number;
}

export function ComponentPanel({ components, componentCount }: ComponentPanelProps) {
  const [open, setOpen] = useState(false);

  if (componentCount === 0 || components.length === 0) return null;

  return (
    <div class="component-panel">
      <button class="component-panel-header" onClick={() => setOpen(!open)}>
        <span class="token-section-arrow">{open ? '\u25BE' : '\u25B8'}</span>
        <span class="component-panel-title">Components</span>
        <span class="component-panel-count">{componentCount} created</span>
      </button>

      {open && (
        <div class="component-panel-body">
          {components.map((c) => (
            <div class="component-item" key={c.hash}>
              <span class="component-item-icon">◇</span>
              <span class="component-item-name">{c.name}</span>
              <span class="component-item-count">{c.instanceCount}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
