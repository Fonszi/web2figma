import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupFigmaMock, teardownFigmaMock, mockStore } from '../figma-mock';
import { weightToStyle, resolveFigmaFont, createTextNode } from '../../figma-plugin/src/nodes/text';
import { makeText } from '../helpers';
import type { StyleMap } from '../../figma-plugin/src/tokens';

function emptyStyleMap(): StyleMap {
  return {
    colors: { byValue: new Map(), byVariable: new Map(), count: 0 },
    typography: { byKey: new Map(), count: 0 },
    effects: { byValue: new Map(), count: 0 },
    variables: { count: 0 },
  };
}

describe('weightToStyle', () => {
  it('maps 100 → Thin', () => {
    expect(weightToStyle(100)).toBe('Thin');
  });

  it('maps 200 → Extra Light', () => {
    expect(weightToStyle(200)).toBe('Extra Light');
  });

  it('maps 300 → Light', () => {
    expect(weightToStyle(300)).toBe('Light');
  });

  it('maps 400 → Regular', () => {
    expect(weightToStyle(400)).toBe('Regular');
  });

  it('maps 500 → Medium', () => {
    expect(weightToStyle(500)).toBe('Medium');
  });

  it('maps 600 → Semi Bold', () => {
    expect(weightToStyle(600)).toBe('Semi Bold');
  });

  it('maps 700 → Bold', () => {
    expect(weightToStyle(700)).toBe('Bold');
  });

  it('maps 800 → Extra Bold', () => {
    expect(weightToStyle(800)).toBe('Extra Bold');
  });

  it('maps 900 → Black', () => {
    expect(weightToStyle(900)).toBe('Black');
  });

  it('maps intermediate values to correct range', () => {
    // Each bucket is (prevMax, max]: 101-200 → Extra Light, 201-300 → Light, etc.
    expect(weightToStyle(150)).toBe('Extra Light');
    expect(weightToStyle(350)).toBe('Regular');
    expect(weightToStyle(450)).toBe('Medium');
    expect(weightToStyle(550)).toBe('Semi Bold');
    expect(weightToStyle(650)).toBe('Bold');
    expect(weightToStyle(750)).toBe('Extra Bold');
    expect(weightToStyle(950)).toBe('Black');
  });
});

describe('resolveFigmaFont', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  it('finds exact family and style match', async () => {
    const font = await resolveFigmaFont('Inter', 700);
    expect(font).toEqual({ family: 'Inter', style: 'Bold' });
  });

  it('falls back to Regular when style not available', async () => {
    // Inter has Regular, Bold, Medium — requesting Thin (100)
    const font = await resolveFigmaFont('Inter', 100);
    // No Thin available, falls to Regular
    expect(font).toEqual({ family: 'Inter', style: 'Regular' });
  });

  it('finds exact match for Roboto', async () => {
    const font = await resolveFigmaFont('Roboto', 400);
    expect(font).toEqual({ family: 'Roboto', style: 'Regular' });
  });

  it('strips quotes from font family', async () => {
    const font = await resolveFigmaFont('"Inter"', 400);
    expect(font).toEqual({ family: 'Inter', style: 'Regular' });
  });

  it('uses first family from comma-separated list', async () => {
    const font = await resolveFigmaFont('Inter, Arial, sans-serif', 400);
    expect(font).toEqual({ family: 'Inter', style: 'Regular' });
  });

  it('falls back to Inter for unknown family', async () => {
    const font = await resolveFigmaFont('Unknown Font', 400);
    expect(font).toEqual({ family: 'Inter', style: 'Regular' });
  });

  it('falls back to Inter with matching style for unknown family', async () => {
    const font = await resolveFigmaFont('Unknown Font', 700);
    expect(font).toEqual({ family: 'Inter', style: 'Bold' });
  });
});

describe('createTextNode', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  it('creates text node with content', async () => {
    const node = makeText('Hello World');
    const text = await createTextNode(node);

    expect(text.characters).toBe('Hello World');
    expect(text.type).toBe('TEXT');
  });

  it('uses text content as name (truncated to 40 chars)', async () => {
    const longText = 'A'.repeat(60);
    const node = makeText(longText);
    const text = await createTextNode(node);

    expect(text.name).toBe(longText.slice(0, 40));
  });

  it('falls back to tag as name when no text', async () => {
    const node = makeText('', { tag: 'p', text: undefined });
    const text = await createTextNode(node);
    expect(text.name).toBe('p');
  });

  it('uses framer name when provided', async () => {
    const node = makeText('Hello');
    const text = await createTextNode(node, undefined, 'CTA Label');
    expect(text.name).toBe('CTA Label');
  });

  it('loads font before setting text', async () => {
    const node = makeText('Hello', { styles: { fontFamily: 'Inter', fontWeight: '700' } });
    await createTextNode(node);

    expect(mockStore.loadedFonts).toHaveLength(1);
    expect(mockStore.loadedFonts[0]).toEqual({ family: 'Inter', style: 'Bold' });
  });

  it('sets font size from styles', async () => {
    const node = makeText('Hello', { styles: { fontFamily: 'Inter', fontWeight: '400', fontSize: '24' } });
    const text = await createTextNode(node);
    expect(text.fontSize).toBe(24);
  });

  it('sets letter spacing when non-zero', async () => {
    const node = makeText('Hello', {
      styles: { fontFamily: 'Inter', fontWeight: '400', fontSize: '16', letterSpacing: '1.5' },
    });
    const text = await createTextNode(node);
    expect(text.letterSpacing).toEqual({ value: 1.5, unit: 'PIXELS' });
  });

  it('does not set letter spacing when zero', async () => {
    const node = makeText('Hello', {
      styles: { fontFamily: 'Inter', fontWeight: '400', fontSize: '16', letterSpacing: '0' },
    });
    const text = await createTextNode(node);
    // Default letterSpacing from mock is undefined
    expect(text.letterSpacing).toBeUndefined();
  });

  it('sets line height when not normal', async () => {
    const node = makeText('Hello', {
      styles: { fontFamily: 'Inter', fontWeight: '400', fontSize: '16', lineHeight: '24' },
    });
    const text = await createTextNode(node);
    expect(text.lineHeight).toEqual({ value: 24, unit: 'PIXELS' });
  });

  it('skips line height for "normal"', async () => {
    const node = makeText('Hello', {
      styles: { fontFamily: 'Inter', fontWeight: '400', fontSize: '16', lineHeight: 'normal' },
    });
    const text = await createTextNode(node);
    // Default lineHeight from mock is undefined
    expect(text.lineHeight).toBeUndefined();
  });

  it('sets text alignment center', async () => {
    const node = makeText('Hello', {
      styles: { fontFamily: 'Inter', fontWeight: '400', fontSize: '16', textAlign: 'center' },
    });
    const text = await createTextNode(node);
    expect(text.textAlignHorizontal).toBe('CENTER');
  });

  it('sets text alignment right', async () => {
    const node = makeText('Hello', {
      styles: { fontFamily: 'Inter', fontWeight: '400', fontSize: '16', textAlign: 'right' },
    });
    const text = await createTextNode(node);
    expect(text.textAlignHorizontal).toBe('RIGHT');
  });

  it('sets text alignment justify', async () => {
    const node = makeText('Hello', {
      styles: { fontFamily: 'Inter', fontWeight: '400', fontSize: '16', textAlign: 'justify' },
    });
    const text = await createTextNode(node);
    expect(text.textAlignHorizontal).toBe('JUSTIFIED');
  });

  it('defaults text alignment to LEFT', async () => {
    const node = makeText('Hello');
    const text = await createTextNode(node);
    expect(text.textAlignHorizontal).toBe('LEFT');
  });

  it('applies underline text decoration', async () => {
    const node = makeText('Hello', {
      styles: { fontFamily: 'Inter', fontWeight: '400', fontSize: '16', textDecoration: 'underline' },
    });
    const text = await createTextNode(node);
    expect(text.textDecoration).toBe('UNDERLINE');
  });

  it('applies strikethrough text decoration', async () => {
    const node = makeText('Hello', {
      styles: { fontFamily: 'Inter', fontWeight: '400', fontSize: '16', textDecoration: 'line-through' },
    });
    const text = await createTextNode(node);
    expect(text.textDecoration).toBe('STRIKETHROUGH');
  });

  it('links to color paint style from styleMap', async () => {
    const styleMap = emptyStyleMap();
    styleMap.colors.byValue.set('rgb(0, 0, 255)', 'style-blue');
    const node = makeText('Hello', {
      styles: { fontFamily: 'Inter', fontWeight: '400', fontSize: '16', color: 'rgb(0, 0, 255)' },
    });
    const text = await createTextNode(node, styleMap);
    expect(text.fillStyleId).toBe('style-blue');
  });

  it('applies raw color when no style match', async () => {
    const node = makeText('Hello', {
      styles: { fontFamily: 'Inter', fontWeight: '400', fontSize: '16', color: 'rgb(255, 0, 0)' },
    });
    const text = await createTextNode(node);
    expect(text.fills).toHaveLength(1);
    expect((text.fills as any)[0].color.r).toBe(1);
  });

  it('links to text style from styleMap', async () => {
    const styleMap = emptyStyleMap();
    // Key: family|fontSize|fontWeight|lineHeight|letterSpacing
    styleMap.typography.byKey.set('Inter|16|400|0|0', 'typo-style-1');
    const node = makeText('Hello', {
      styles: { fontFamily: 'Inter', fontWeight: '400', fontSize: '16' },
    });
    const text = await createTextNode(node, styleMap);
    expect(text.textStyleId).toBe('typo-style-1');
  });

  it('sets auto-resize to WIDTH_AND_HEIGHT', async () => {
    const node = makeText('Hello');
    const text = await createTextNode(node);
    expect(text.textAutoResize).toBe('WIDTH_AND_HEIGHT');
  });
});
