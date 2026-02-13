import { describe, it, expect, beforeEach } from 'vitest';
import {
  cssVarToStyleName,
  colorValueToStyleName,
  typographyToStyleName,
  effectToStyleName,
  resetNameTracker,
} from '../../figma-plugin/src/tokens/naming';

describe('naming', () => {
  beforeEach(() => {
    resetNameTracker();
  });

  describe('cssVarToStyleName', () => {
    it('converts --color-primary-500 to color/primary/500', () => {
      expect(cssVarToStyleName('--color-primary-500')).toBe('color/primary/500');
    });

    it('converts --spacing-lg to spacing/lg', () => {
      expect(cssVarToStyleName('--spacing-lg')).toBe('spacing/lg');
    });

    it('converts --font-size-base to font/size/base', () => {
      expect(cssVarToStyleName('--font-size-base')).toBe('font/size/base');
    });

    it('strips leading dashes', () => {
      expect(cssVarToStyleName('---triple-dash')).toBe('triple/dash');
    });

    it('handles single segment', () => {
      expect(cssVarToStyleName('--primary')).toBe('primary');
    });
  });

  describe('colorValueToStyleName', () => {
    it('uses CSS variable name when provided', () => {
      expect(colorValueToStyleName('rgb(59, 130, 246)', '--color-blue')).toBe('color/blue');
    });

    it('converts rgb to hex path when no CSS variable', () => {
      expect(colorValueToStyleName('rgb(255, 0, 0)')).toBe('color/ff0000');
    });

    it('converts rgba to hex path when no CSS variable', () => {
      expect(colorValueToStyleName('rgba(0, 128, 255, 1)')).toBe('color/0080ff');
    });

    it('falls back to sanitized value for non-rgb strings', () => {
      const result = colorValueToStyleName('hsl(120, 100%, 50%)');
      expect(result).toMatch(/^color\//);
      expect(result).not.toContain('(');
    });
  });

  describe('typographyToStyleName', () => {
    it('creates text/16-regular for 400 weight', () => {
      expect(typographyToStyleName(16, 400)).toBe('text/16-regular');
    });

    it('creates text/24-bold for 700 weight', () => {
      expect(typographyToStyleName(24, 700)).toBe('text/24-bold');
    });

    it('creates text/14-medium for 500 weight', () => {
      expect(typographyToStyleName(14, 500)).toBe('text/14-medium');
    });

    it('rounds fontSize', () => {
      expect(typographyToStyleName(15.7, 400)).toBe('text/16-regular');
    });
  });

  describe('effectToStyleName', () => {
    it('creates effect/drop-shadow-1 for index 0', () => {
      expect(effectToStyleName('drop-shadow', 0)).toBe('effect/drop-shadow-1');
    });

    it('creates effect/inner-shadow-3 for index 2', () => {
      expect(effectToStyleName('inner-shadow', 2)).toBe('effect/inner-shadow-3');
    });
  });

  describe('deduplication', () => {
    it('appends -2 for duplicate names', () => {
      const first = typographyToStyleName(16, 400);
      const second = typographyToStyleName(16, 400);
      expect(first).toBe('text/16-regular');
      expect(second).toBe('text/16-regular-2');
    });

    it('appends -3 for triple duplicates', () => {
      typographyToStyleName(16, 400);
      typographyToStyleName(16, 400);
      const third = typographyToStyleName(16, 400);
      expect(third).toBe('text/16-regular-3');
    });

    it('resets dedup state', () => {
      typographyToStyleName(16, 400);
      resetNameTracker();
      expect(typographyToStyleName(16, 400)).toBe('text/16-regular');
    });

    it('deduplicates across different naming functions', () => {
      // Both could produce the same path
      const first = cssVarToStyleName('--text-16-regular');
      const second = typographyToStyleName(16, 400);
      expect(first).toBe('text/16/regular');
      // These are different paths so no collision
      expect(second).toBe('text/16-regular');
    });
  });
});
