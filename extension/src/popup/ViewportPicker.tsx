/**
 * Viewport preset picker for multi-viewport extraction.
 *
 * Renders toggle pill buttons for Desktop (1440), Tablet (768), Mobile (375),
 * plus a custom width input. At least one viewport must remain selected.
 *
 * Related files:
 * - Constants: shared/constants.ts (VIEWPORTS, ViewportPreset)
 * - Popup: extension/src/popup/Popup.tsx (parent component)
 */

import { h } from 'preact';
import { useState } from 'preact/hooks';
import { VIEWPORTS, type ViewportPreset } from '../../../shared/constants';

/** Presets shown in the picker (excluding laptop to keep it simple). */
const PICKER_PRESETS: ViewportPreset[] = ['desktop', 'tablet', 'mobile'];

export interface ViewportPickerProps {
  selected: ViewportPreset[];
  customWidths: number[];
  onChange: (presets: ViewportPreset[], customWidths: number[]) => void;
  disabled?: boolean;
}

export function ViewportPicker({ selected, customWidths, onChange, disabled }: ViewportPickerProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState('');

  const togglePreset = (preset: ViewportPreset) => {
    if (disabled) return;

    const isSelected = selected.includes(preset);
    if (isSelected) {
      // Don't deselect if it's the only selection
      if (selected.length + customWidths.length <= 1) return;
      onChange(selected.filter((p) => p !== preset), customWidths);
    } else {
      onChange([...selected, preset], customWidths);
    }
  };

  const addCustom = () => {
    const width = parseInt(customValue, 10);
    if (!width || width < 100 || width > 3840) return;
    if (customWidths.includes(width)) return;
    onChange(selected, [...customWidths, width]);
    setCustomValue('');
    setShowCustomInput(false);
  };

  const removeCustom = (width: number) => {
    if (disabled) return;
    if (selected.length + customWidths.length <= 1) return;
    onChange(selected, customWidths.filter((w) => w !== width));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') addCustom();
    if (e.key === 'Escape') {
      setShowCustomInput(false);
      setCustomValue('');
    }
  };

  return (
    <div class="viewport-picker">
      <div class="viewport-picker-label">Viewports</div>
      <div class="viewport-picker-pills">
        {PICKER_PRESETS.map((preset) => (
          <button
            key={preset}
            class={`viewport-pill ${selected.includes(preset) ? 'active' : ''}`}
            onClick={() => togglePreset(preset)}
            disabled={disabled}
            title={`${VIEWPORTS[preset].label} (${VIEWPORTS[preset].width}px)`}
          >
            {VIEWPORTS[preset].label}
            <span class="viewport-pill-width">{VIEWPORTS[preset].width}</span>
          </button>
        ))}

        {customWidths.map((width) => (
          <button
            key={`custom-${width}`}
            class="viewport-pill active custom"
            onClick={() => removeCustom(width)}
            disabled={disabled}
            title={`Custom (${width}px) — click to remove`}
          >
            {width}px
          </button>
        ))}

        {!showCustomInput && (
          <button
            class="viewport-pill add-custom"
            onClick={() => setShowCustomInput(true)}
            disabled={disabled}
          >
            +
          </button>
        )}
      </div>

      {showCustomInput && (
        <div class="viewport-custom-input">
          <input
            type="number"
            value={customValue}
            onInput={(e) => setCustomValue((e.target as HTMLInputElement).value)}
            onKeyDown={handleKeyDown}
            placeholder="Width (px)"
            min={100}
            max={3840}
            disabled={disabled}
          />
          <button onClick={addCustom} disabled={disabled || !customValue}>Add</button>
          <button onClick={() => { setShowCustomInput(false); setCustomValue(''); }}>Cancel</button>
        </div>
      )}
    </div>
  );
}
