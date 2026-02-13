import { describe, it, expect } from 'vitest';
import {
  parseCssColor,
  isTransparent,
  solidPaint,
  parseRadius,
  parseCornerRadii,
  parseBoxShadow,
} from '../../figma-plugin/src/nodes/styles';

describe('parseCssColor', () => {
  it('parses rgb(R, G, B)', () => {
    const c = parseCssColor('rgb(255, 128, 0)');
    expect(c).toEqual({ r: 1, g: 128 / 255, b: 0, a: 1 });
  });

  it('parses rgba(R, G, B, A)', () => {
    const c = parseCssColor('rgba(100, 200, 50, 0.5)');
    expect(c).toEqual({ r: 100 / 255, g: 200 / 255, b: 50 / 255, a: 0.5 });
  });

  it('parses #RRGGBB', () => {
    const c = parseCssColor('#ff0000');
    expect(c).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('parses #RGB', () => {
    const c = parseCssColor('#f00');
    expect(c).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('parses #RRGGBBAA', () => {
    const c = parseCssColor('#ff000080');
    expect(c!.r).toBe(1);
    expect(c!.g).toBe(0);
    expect(c!.b).toBe(0);
    expect(c!.a).toBeCloseTo(0.502, 2);
  });

  it('returns null for unsupported formats', () => {
    expect(parseCssColor('hsl(120, 100%, 50%)')).toBeNull();
    expect(parseCssColor('invalid')).toBeNull();
    expect(parseCssColor('')).toBeNull();
  });
});

describe('isTransparent', () => {
  it('returns true for undefined', () => {
    expect(isTransparent(undefined)).toBe(true);
  });

  it('returns true for "transparent"', () => {
    expect(isTransparent('transparent')).toBe(true);
  });

  it('returns true for rgba(0, 0, 0, 0)', () => {
    expect(isTransparent('rgba(0, 0, 0, 0)')).toBe(true);
  });

  it('returns false for opaque colors', () => {
    expect(isTransparent('rgb(255, 0, 0)')).toBe(false);
    expect(isTransparent('#ff0000')).toBe(false);
  });

  it('returns true for zero-alpha hex', () => {
    expect(isTransparent('#ff000000')).toBe(true);
  });
});

describe('solidPaint', () => {
  it('returns SolidPaint for valid color', () => {
    const paint = solidPaint('rgb(255, 0, 0)');
    expect(paint).toEqual({
      type: 'SOLID',
      color: { r: 1, g: 0, b: 0 },
      opacity: 1,
    });
  });

  it('returns null for unparseable color', () => {
    expect(solidPaint('invalid')).toBeNull();
  });

  it('preserves alpha as opacity', () => {
    const paint = solidPaint('rgba(0, 0, 0, 0.3)');
    expect(paint!.opacity).toBe(0.3);
  });
});

describe('parseRadius', () => {
  it('parses pixel value', () => {
    expect(parseRadius('8px')).toBe(8);
  });

  it('returns 0 for undefined', () => {
    expect(parseRadius(undefined)).toBe(0);
  });

  it('returns 0 for non-numeric', () => {
    expect(parseRadius('auto')).toBe(0);
  });
});

describe('parseCornerRadii', () => {
  it('returns null when all radii are 0', () => {
    expect(parseCornerRadii({})).toBeNull();
  });

  it('parses individual corner radii', () => {
    expect(parseCornerRadii({
      borderTopLeftRadius: '4px',
      borderTopRightRadius: '8px',
      borderBottomRightRadius: '12px',
      borderBottomLeftRadius: '16px',
    })).toEqual([4, 8, 12, 16]);
  });

  it('defaults missing corners to 0', () => {
    expect(parseCornerRadii({
      borderTopLeftRadius: '10px',
    })).toEqual([10, 0, 0, 0]);
  });
});

describe('parseBoxShadow', () => {
  it('returns null for "none"', () => {
    expect(parseBoxShadow('none')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseBoxShadow(undefined)).toBeNull();
  });

  it('parses drop shadow', () => {
    const effect = parseBoxShadow('0px 4px 6px rgba(0, 0, 0, 0.1)');
    expect(effect).not.toBeNull();
    expect(effect!.type).toBe('DROP_SHADOW');
    expect((effect as any).offset).toEqual({ x: 0, y: 4 });
    expect((effect as any).radius).toBe(6);
    expect((effect as any).color.a).toBeCloseTo(0.1);
  });

  it('parses drop shadow with spread', () => {
    const effect = parseBoxShadow('2px 4px 6px 8px rgba(0, 0, 0, 0.5)');
    expect(effect).not.toBeNull();
    expect((effect as any).spread).toBe(8);
  });

  it('parses inset shadow as INNER_SHADOW', () => {
    const effect = parseBoxShadow('inset 0px 2px 4px rgba(0, 0, 0, 0.2)');
    expect(effect).not.toBeNull();
    expect(effect!.type).toBe('INNER_SHADOW');
    expect((effect as any).offset).toEqual({ x: 0, y: 2 });
    expect((effect as any).radius).toBe(4);
  });

  it('parses negative offsets', () => {
    const effect = parseBoxShadow('-2px -4px 6px rgba(0, 0, 0, 0.5)');
    expect(effect).not.toBeNull();
    expect((effect as any).offset).toEqual({ x: -2, y: -4 });
  });

  it('returns null for unparseable value', () => {
    expect(parseBoxShadow('some-random-text')).toBeNull();
  });
});
