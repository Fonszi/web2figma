import { describe, it, expect } from 'vitest';
import { analyzeLayout } from '../../extension/src/content/layout-analyzer';
import { mockCSSStyles, mockElement } from '../dom-helpers';

describe('analyzeLayout', () => {
  const el = mockElement('div');

  // --- Non-flex/grid ---

  describe('non-flex/grid elements', () => {
    it('returns isAutoLayout false for display block', () => {
      const cs = mockCSSStyles({ display: 'block' });
      const result = analyzeLayout(el, cs);
      expect(result.isAutoLayout).toBe(false);
      expect(result.direction).toBe('none');
    });

    it('returns isAutoLayout false for display inline', () => {
      const cs = mockCSSStyles({ display: 'inline' });
      const result = analyzeLayout(el, cs);
      expect(result.isAutoLayout).toBe(false);
    });

    it('returns isAutoLayout false for display table', () => {
      const cs = mockCSSStyles({ display: 'table' });
      const result = analyzeLayout(el, cs);
      expect(result.isAutoLayout).toBe(false);
    });

    it('still extracts padding for non-flex elements', () => {
      const cs = mockCSSStyles({
        display: 'block',
        paddingTop: '10px',
        paddingRight: '20px',
        paddingBottom: '30px',
        paddingLeft: '40px',
      });
      const result = analyzeLayout(el, cs);
      expect(result.padding).toEqual({ top: 10, right: 20, bottom: 30, left: 40 });
    });
  });

  // --- Flex direction ---

  describe('flex direction', () => {
    it('detects flex display as auto layout', () => {
      const cs = mockCSSStyles({ display: 'flex' });
      const result = analyzeLayout(el, cs);
      expect(result.isAutoLayout).toBe(true);
    });

    it('detects inline-flex as auto layout', () => {
      const cs = mockCSSStyles({ display: 'inline-flex' });
      const result = analyzeLayout(el, cs);
      expect(result.isAutoLayout).toBe(true);
    });

    it('maps flex-direction row to horizontal', () => {
      const cs = mockCSSStyles({ display: 'flex', flexDirection: 'row' });
      const result = analyzeLayout(el, cs);
      expect(result.direction).toBe('horizontal');
    });

    it('maps flex-direction row-reverse to horizontal', () => {
      const cs = mockCSSStyles({ display: 'flex', flexDirection: 'row-reverse' });
      const result = analyzeLayout(el, cs);
      expect(result.direction).toBe('horizontal');
    });

    it('maps flex-direction column to vertical', () => {
      const cs = mockCSSStyles({ display: 'flex', flexDirection: 'column' });
      const result = analyzeLayout(el, cs);
      expect(result.direction).toBe('vertical');
    });

    it('maps flex-direction column-reverse to vertical', () => {
      const cs = mockCSSStyles({ display: 'flex', flexDirection: 'column-reverse' });
      const result = analyzeLayout(el, cs);
      expect(result.direction).toBe('vertical');
    });
  });

  // --- Grid ---

  describe('grid detection', () => {
    it('detects grid as auto layout', () => {
      const cs = mockCSSStyles({ display: 'grid' });
      const result = analyzeLayout(el, cs);
      expect(result.isAutoLayout).toBe(true);
      expect(result.direction).toBe('vertical');
    });

    it('detects inline-grid as auto layout', () => {
      const cs = mockCSSStyles({ display: 'inline-grid' });
      const result = analyzeLayout(el, cs);
      expect(result.isAutoLayout).toBe(true);
    });
  });

  // --- Wrap ---

  describe('wrap detection', () => {
    it('detects flex-wrap wrap', () => {
      const cs = mockCSSStyles({ display: 'flex', flexWrap: 'wrap' });
      const result = analyzeLayout(el, cs);
      expect(result.wrap).toBe(true);
    });

    it('detects flex-wrap wrap-reverse', () => {
      const cs = mockCSSStyles({ display: 'flex', flexWrap: 'wrap-reverse' });
      const result = analyzeLayout(el, cs);
      expect(result.wrap).toBe(true);
    });

    it('returns wrap false for nowrap', () => {
      const cs = mockCSSStyles({ display: 'flex', flexWrap: 'nowrap' });
      const result = analyzeLayout(el, cs);
      expect(result.wrap).toBe(false);
    });

    it('grid does not detect wrap', () => {
      const cs = mockCSSStyles({ display: 'grid', flexWrap: 'wrap' });
      const result = analyzeLayout(el, cs);
      expect(result.wrap).toBe(false);
    });
  });

  // --- Gap ---

  describe('gap extraction', () => {
    it('extracts gap value', () => {
      const cs = mockCSSStyles({ display: 'flex', gap: '16px' });
      const result = analyzeLayout(el, cs);
      expect(result.gap).toBe(16);
    });

    it('falls back to rowGap when gap is 0', () => {
      const cs = mockCSSStyles({ display: 'flex', gap: '0px', rowGap: '12px' });
      const result = analyzeLayout(el, cs);
      expect(result.gap).toBe(12);
    });

    it('returns 0 when no gap is set', () => {
      const cs = mockCSSStyles({ display: 'flex', gap: '0px', rowGap: '0px' });
      const result = analyzeLayout(el, cs);
      expect(result.gap).toBe(0);
    });
  });

  // --- Padding ---

  describe('padding extraction', () => {
    it('extracts all four padding values', () => {
      const cs = mockCSSStyles({
        display: 'flex',
        paddingTop: '8px',
        paddingRight: '16px',
        paddingBottom: '24px',
        paddingLeft: '32px',
      });
      const result = analyzeLayout(el, cs);
      expect(result.padding).toEqual({ top: 8, right: 16, bottom: 24, left: 32 });
    });

    it('returns 0 for missing padding values', () => {
      const cs = mockCSSStyles({ display: 'flex' });
      const result = analyzeLayout(el, cs);
      expect(result.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    });

    it('handles fractional padding', () => {
      const cs = mockCSSStyles({ display: 'flex', paddingTop: '12.5px' });
      const result = analyzeLayout(el, cs);
      expect(result.padding.top).toBe(12.5);
    });
  });

  // --- Sizing ---

  describe('sizing inference', () => {
    it('infers fill for 100% width', () => {
      const cs = mockCSSStyles({ display: 'flex', width: '100%' });
      const result = analyzeLayout(el, cs);
      expect(result.sizing.width).toBe('fill');
    });

    it('infers fill for flexGrow > 0', () => {
      const cs = mockCSSStyles({ display: 'flex', flexGrow: '1' });
      const result = analyzeLayout(el, cs);
      expect(result.sizing.width).toBe('fill');
    });

    it('infers hug for auto width', () => {
      const cs = mockCSSStyles({ display: 'flex', width: 'auto' });
      const result = analyzeLayout(el, cs);
      expect(result.sizing.width).toBe('hug');
    });

    it('infers hug for fit-content', () => {
      const cs = mockCSSStyles({ display: 'flex', width: 'fit-content' });
      const result = analyzeLayout(el, cs);
      expect(result.sizing.width).toBe('hug');
    });

    it('infers fixed for explicit px value', () => {
      const cs = mockCSSStyles({ display: 'flex', width: '320px' });
      const result = analyzeLayout(el, cs);
      expect(result.sizing.width).toBe('fixed');
    });

    it('height sizing defaults to fixed with flexGrow 0', () => {
      const cs = mockCSSStyles({ display: 'flex', height: '200px' });
      const result = analyzeLayout(el, cs);
      expect(result.sizing.height).toBe('fixed');
    });
  });

  // --- Alignment ---

  describe('alignment mapping', () => {
    it('maps justify-content center', () => {
      const cs = mockCSSStyles({ display: 'flex', justifyContent: 'center' });
      const result = analyzeLayout(el, cs);
      expect(result.mainAxisAlignment).toBe('center');
    });

    it('maps justify-content flex-end to end', () => {
      const cs = mockCSSStyles({ display: 'flex', justifyContent: 'flex-end' });
      const result = analyzeLayout(el, cs);
      expect(result.mainAxisAlignment).toBe('end');
    });

    it('maps justify-content space-between', () => {
      const cs = mockCSSStyles({ display: 'flex', justifyContent: 'space-between' });
      const result = analyzeLayout(el, cs);
      expect(result.mainAxisAlignment).toBe('space-between');
    });

    it('maps justify-content flex-start to start', () => {
      const cs = mockCSSStyles({ display: 'flex', justifyContent: 'flex-start' });
      const result = analyzeLayout(el, cs);
      expect(result.mainAxisAlignment).toBe('start');
    });

    it('maps align-items center', () => {
      const cs = mockCSSStyles({ display: 'flex', alignItems: 'center' });
      const result = analyzeLayout(el, cs);
      expect(result.crossAxisAlignment).toBe('center');
    });

    it('maps align-items flex-end to end', () => {
      const cs = mockCSSStyles({ display: 'flex', alignItems: 'flex-end' });
      const result = analyzeLayout(el, cs);
      expect(result.crossAxisAlignment).toBe('end');
    });

    it('maps align-items stretch', () => {
      const cs = mockCSSStyles({ display: 'flex', alignItems: 'stretch' });
      const result = analyzeLayout(el, cs);
      expect(result.crossAxisAlignment).toBe('stretch');
    });

    it('defaults align-items to start', () => {
      const cs = mockCSSStyles({ display: 'flex', alignItems: 'flex-start' });
      const result = analyzeLayout(el, cs);
      expect(result.crossAxisAlignment).toBe('start');
    });
  });
});
