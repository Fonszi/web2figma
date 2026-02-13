/**
 * Token panel — post-import collapsible summary of design tokens created.
 *
 * Shows color swatches, typography previews, effect previews, and variable name-value pairs.
 * Grouped by type with expandable sections.
 */

import { useState } from 'preact/hooks';

interface ColorInfo {
  name: string;
  value: string;
}

interface TypographyInfo {
  name: string;
  detail: string;
}

interface EffectInfo {
  name: string;
  detail: string;
}

interface VariableInfo {
  name: string;
  value: string;
  type: string;
}

interface TokenPanelProps {
  colors: ColorInfo[];
  typography: TypographyInfo[];
  effects: EffectInfo[];
  variables: VariableInfo[];
  styleCount: number;
}

function TokenSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: preact.ComponentChildren;
}) {
  const [open, setOpen] = useState(false);

  if (count === 0) return null;

  return (
    <div class="token-section">
      <button class="token-section-header" onClick={() => setOpen(!open)}>
        <span class="token-section-arrow">{open ? '\u25BE' : '\u25B8'}</span>
        <span class="token-section-title">{title}</span>
        <span class="token-section-count">{count}</span>
      </button>
      {open && <div class="token-section-body">{children}</div>}
    </div>
  );
}

export function TokenPanel({ colors, typography, effects, variables, styleCount }: TokenPanelProps) {
  if (styleCount === 0) return null;

  return (
    <div class="token-panel">
      <div class="token-panel-header">
        <span class="token-panel-title">Design Tokens</span>
        <span class="token-panel-count">{styleCount} created</span>
      </div>

      <TokenSection title="Colors" count={colors.length}>
        <div class="token-color-grid">
          {colors.map((c) => (
            <div class="token-color-item" key={c.name}>
              <div class="token-color-swatch" style={{ background: c.value }} />
              <span class="token-color-name">{c.name}</span>
            </div>
          ))}
        </div>
      </TokenSection>

      <TokenSection title="Typography" count={typography.length}>
        <div class="token-list">
          {typography.map((t) => (
            <div class="token-list-item" key={t.name}>
              <span class="token-item-name">{t.name}</span>
              <span class="token-item-detail">{t.detail}</span>
            </div>
          ))}
        </div>
      </TokenSection>

      <TokenSection title="Effects" count={effects.length}>
        <div class="token-list">
          {effects.map((e) => (
            <div class="token-list-item" key={e.name}>
              <span class="token-item-name">{e.name}</span>
              <span class="token-item-detail">{e.detail}</span>
            </div>
          ))}
        </div>
      </TokenSection>

      <TokenSection title="Variables" count={variables.length}>
        <div class="token-list">
          {variables.map((v) => (
            <div class="token-list-item" key={v.name}>
              <span class="token-item-name">{v.name}</span>
              <span class="token-item-detail">
                <span class="token-var-type">{v.type}</span>
                {v.value}
              </span>
            </div>
          ))}
        </div>
      </TokenSection>
    </div>
  );
}
