/**
 * Preset panel — displays personal and team presets with save/load/share actions.
 *
 * Shown in the plugin idle state. Uses the same collapsible pattern as TokenPanel.
 */

import { useState } from 'preact/hooks';
import type { Preset, Tier } from '../../../../shared/types';

interface PresetPanelProps {
  personalPresets: Preset[];
  teamPresets: Preset[];
  tier: Tier;
  onApplyPreset: (preset: Preset) => void;
  onSavePreset: (name: string, isTeam: boolean) => void;
  onDeletePreset: (presetId: string, isTeamPreset: boolean) => void;
  onSharePreset: (presetId: string) => void;
  onUnsharePreset: (presetId: string) => void;
}

export function PresetPanel({
  personalPresets,
  teamPresets,
  tier,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
  onSharePreset,
  onUnsharePreset,
}: PresetPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [newName, setNewName] = useState('');
  const [saveAsTeam, setSaveAsTeam] = useState(false);

  const totalCount = personalPresets.length + teamPresets.length;
  const isTeamTier = tier === 'team';

  const handleSave = () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.length > 50) return;
    onSavePreset(trimmed, saveAsTeam && isTeamTier);
    setNewName('');
    setSaveAsTeam(false);
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  };

  if (!expanded) {
    return (
      <div class="preset-panel">
        <button class="panel-toggle" onClick={() => setExpanded(true)}>
          Presets {totalCount > 0 && <span class="panel-count">{totalCount}</span>}
        </button>
      </div>
    );
  }

  return (
    <div class="preset-panel preset-panel-expanded">
      <button class="panel-toggle" onClick={() => setExpanded(false)}>
        Presets {totalCount > 0 && <span class="panel-count">{totalCount}</span>}
      </button>

      {/* Save new preset */}
      <div class="preset-save-row">
        <input
          type="text"
          class="preset-name-input"
          placeholder="Preset name..."
          value={newName}
          onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          maxLength={50}
        />
        {isTeamTier && (
          <label class="preset-team-toggle">
            <input
              type="checkbox"
              checked={saveAsTeam}
              onChange={(e) => setSaveAsTeam((e.target as HTMLInputElement).checked)}
            />
            Team
          </label>
        )}
        <button
          class="btn-preset-save"
          onClick={handleSave}
          disabled={!newName.trim()}
        >
          Save
        </button>
      </div>

      {/* Personal presets */}
      {personalPresets.length > 0 && (
        <div class="preset-section">
          <div class="preset-section-label">Personal</div>
          {personalPresets.map((preset) => (
            <div key={preset.id} class="preset-row">
              <button class="preset-apply" onClick={() => onApplyPreset(preset)} title="Apply preset">
                {preset.name}
              </button>
              <span class="preset-date">{formatDate(preset.createdAt)}</span>
              {isTeamTier && (
                <button class="btn-preset-share" onClick={() => onSharePreset(preset.id)} title="Share with team">
                  Share
                </button>
              )}
              <button class="btn-preset-delete" onClick={() => onDeletePreset(preset.id, false)} title="Delete">
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Team presets */}
      {teamPresets.length > 0 && (
        <div class="preset-section">
          <div class="preset-section-label">
            Team <span class="team-badge">TEAM</span>
          </div>
          {teamPresets.map((preset) => (
            <div key={preset.id} class="preset-row">
              <button class="preset-apply" onClick={() => onApplyPreset(preset)} title="Apply preset">
                {preset.name}
              </button>
              <span class="preset-date">{formatDate(preset.createdAt)}</span>
              {isTeamTier && (
                <button class="btn-preset-unshare" onClick={() => onUnsharePreset(preset.id)} title="Make personal">
                  Unshare
                </button>
              )}
              <button class="btn-preset-delete" onClick={() => onDeletePreset(preset.id, true)} title="Delete">
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {totalCount === 0 && (
        <div class="preset-empty">No presets yet. Save your current settings as a preset.</div>
      )}
    </div>
  );
}
