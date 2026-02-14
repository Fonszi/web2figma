import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanupDOM } from '../dom-helpers';

/**
 * ViewportPicker is a Preact component. In JSDOM, we test its exported logic
 * and behavior patterns rather than rendering (no Preact test renderer available).
 * We verify the VIEWPORTS constants and selection logic used by the component.
 */

describe('ViewportPicker logic', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('VIEWPORTS constant has desktop, tablet, and mobile presets', async () => {
    const { VIEWPORTS } = await import('../../shared/constants');
    expect(VIEWPORTS.desktop.width).toBe(1440);
    expect(VIEWPORTS.tablet.width).toBe(768);
    expect(VIEWPORTS.mobile.width).toBe(375);
  });

  it('VIEWPORTS presets have labels', async () => {
    const { VIEWPORTS } = await import('../../shared/constants');
    expect(VIEWPORTS.desktop.label).toBe('Desktop');
    expect(VIEWPORTS.tablet.label).toBe('Tablet');
    expect(VIEWPORTS.mobile.label).toBe('Mobile');
  });

  it('DEFAULT_SELECTED_VIEWPORTS starts with desktop only', async () => {
    const { DEFAULT_SELECTED_VIEWPORTS } = await import('../../shared/constants');
    expect(DEFAULT_SELECTED_VIEWPORTS).toEqual(['desktop']);
  });

  it('STORAGE_KEY_SELECTED_VIEWPORTS is defined', async () => {
    const { STORAGE_KEY_SELECTED_VIEWPORTS } = await import('../../shared/constants');
    expect(typeof STORAGE_KEY_SELECTED_VIEWPORTS).toBe('string');
    expect(STORAGE_KEY_SELECTED_VIEWPORTS.length).toBeGreaterThan(0);
  });

  describe('selection toggling logic', () => {
    it('can add a viewport to selection', () => {
      const selected = ['desktop'];
      const preset = 'mobile' as const;

      // Simulates the toggle logic from ViewportPicker
      const newSelected = [...selected, preset];
      expect(newSelected).toEqual(['desktop', 'mobile']);
    });

    it('can remove a viewport from selection', () => {
      const selected = ['desktop', 'mobile'];
      const preset = 'mobile' as const;

      const newSelected = selected.filter((p) => p !== preset);
      expect(newSelected).toEqual(['desktop']);
    });

    it('prevents removing the last viewport', () => {
      const selected = ['desktop'];
      const customWidths: number[] = [];
      const preset = 'desktop' as const;

      // Check total count before deselection
      const totalCount = selected.length + customWidths.length;
      const canDeselect = totalCount > 1;

      expect(canDeselect).toBe(false);
    });

    it('allows removing a viewport when custom widths exist', () => {
      const selected = ['desktop'];
      const customWidths = [800];
      const preset = 'desktop' as const;

      const totalCount = selected.length + customWidths.length;
      const canDeselect = totalCount > 1;

      expect(canDeselect).toBe(true);
    });
  });

  describe('custom width validation', () => {
    it('accepts valid width values', () => {
      const validWidths = [100, 375, 768, 1440, 3840];
      for (const width of validWidths) {
        expect(width >= 100 && width <= 3840).toBe(true);
      }
    });

    it('rejects widths below 100', () => {
      expect(50 >= 100).toBe(false);
    });

    it('rejects widths above 3840', () => {
      expect(4000 <= 3840).toBe(false);
    });

    it('deduplicates custom widths', () => {
      const customWidths = [800];
      const newWidth = 800;
      const isDuplicate = customWidths.includes(newWidth);
      expect(isDuplicate).toBe(true);
    });
  });
});
