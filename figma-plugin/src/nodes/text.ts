/**
 * Text node creator — creates Figma TextNode from BridgeNode.
 *
 * IMPORTANT: Must call `figma.loadFontAsync()` before setting characters.
 * Falls back to available fonts via `figma.listAvailableFontsAsync()`.
 *
 * Handles:
 * - Font family, size, weight
 * - Line height, letter spacing
 * - Text alignment
 * - Text color
 * - Text decoration (underline, strikethrough)
 */

import type { BridgeNode } from '../../../shared/types';
import type { StyleMap } from '../tokens';
import { parseCssColor } from './styles';

/** Cache of available fonts to avoid repeated API calls. */
let availableFontsCache: Font[] | null = null;

export async function getAvailableFonts(): Promise<Font[]> {
  if (!availableFontsCache) {
    availableFontsCache = await figma.listAvailableFontsAsync();
  }
  return availableFontsCache;
}

/** Map CSS font-weight to Figma font style name. */
export function weightToStyle(weight: number): string {
  if (weight <= 100) return 'Thin';
  if (weight <= 200) return 'Extra Light';
  if (weight <= 300) return 'Light';
  if (weight <= 400) return 'Regular';
  if (weight <= 500) return 'Medium';
  if (weight <= 600) return 'Semi Bold';
  if (weight <= 700) return 'Bold';
  if (weight <= 800) return 'Extra Bold';
  return 'Black';
}

/** Find the best matching Figma font for a CSS font-family + weight. */
export async function resolveFigmaFont(
  cssFamily: string,
  cssWeight: number,
): Promise<FontName> {
  const fonts = await getAvailableFonts();
  const familyName = cssFamily.split(',')[0]!.trim().replace(/['"]/g, '');
  const targetStyle = weightToStyle(cssWeight);

  // Try exact family match
  const familyFonts = fonts.filter(
    (f) => f.fontName.family.toLowerCase() === familyName.toLowerCase(),
  );

  if (familyFonts.length > 0) {
    // Try exact style match
    const exactMatch = familyFonts.find(
      (f) => f.fontName.style.toLowerCase() === targetStyle.toLowerCase(),
    );
    if (exactMatch) return exactMatch.fontName;

    // Try "Regular" fallback
    const regular = familyFonts.find((f) => f.fontName.style === 'Regular');
    if (regular) return regular.fontName;

    // Use first available style
    return familyFonts[0]!.fontName;
  }

  // Fallback: Inter > Roboto > first sans-serif
  const fallbacks = ['Inter', 'Roboto', 'Helvetica', 'Arial'];
  for (const fb of fallbacks) {
    const match = fonts.find(
      (f) => f.fontName.family === fb && f.fontName.style === targetStyle,
    );
    if (match) return match.fontName;

    const regular = fonts.find(
      (f) => f.fontName.family === fb && f.fontName.style === 'Regular',
    );
    if (regular) return regular.fontName;
  }

  // Last resort
  return { family: 'Inter', style: 'Regular' };
}

export async function createTextNode(node: BridgeNode, styleMap?: StyleMap): Promise<TextNode> {
  const text = figma.createText();
  text.name = node.text?.slice(0, 40) ?? node.tag;

  // Resolve and load font
  const fontFamily = node.styles.fontFamily ?? 'Inter';
  const fontWeight = parseInt(node.styles.fontWeight ?? '400', 10) || 400;
  const fontName = await resolveFigmaFont(fontFamily, fontWeight);

  await figma.loadFontAsync(fontName);
  text.fontName = fontName;

  // Set text content
  text.characters = node.text ?? '';

  // Font size
  const fontSize = parseFloat(node.styles.fontSize ?? '16');
  if (fontSize > 0) text.fontSize = fontSize;

  // Letter spacing
  const letterSpacing = parseFloat(node.styles.letterSpacing ?? '0');
  if (letterSpacing !== 0) {
    text.letterSpacing = { value: letterSpacing, unit: 'PIXELS' };
  }

  // Line height
  const lineHeight = node.styles.lineHeight;
  if (lineHeight && lineHeight !== 'normal') {
    const lhPx = parseFloat(lineHeight);
    if (lhPx > 0) {
      text.lineHeight = { value: lhPx, unit: 'PIXELS' };
    }
  }

  // Text alignment
  switch (node.styles.textAlign) {
    case 'center': text.textAlignHorizontal = 'CENTER'; break;
    case 'right': text.textAlignHorizontal = 'RIGHT'; break;
    case 'justify': text.textAlignHorizontal = 'JUSTIFIED'; break;
    default: text.textAlignHorizontal = 'LEFT'; break;
  }

  // Text color — link to PaintStyle if available
  if (node.styles.color) {
    const normalizedColor = node.styles.color.trim().toLowerCase();
    const colorStyleId = styleMap?.colors.byValue.get(normalizedColor);
    if (colorStyleId) {
      text.fillStyleId = colorStyleId;
    } else {
      const color = parseCssColor(node.styles.color);
      if (color) {
        text.fills = [{ type: 'SOLID', color: { r: color.r, g: color.g, b: color.b }, opacity: color.a }];
      }
    }
  }

  // Text decoration
  const decoration = node.styles.textDecoration;
  if (decoration) {
    if (decoration.includes('underline')) text.textDecoration = 'UNDERLINE';
    else if (decoration.includes('line-through')) text.textDecoration = 'STRIKETHROUGH';
  }

  // Size — auto-size to fit text
  text.textAutoResize = 'WIDTH_AND_HEIGHT';

  // Link to TextStyle if available (applied last — overrides individual properties)
  const cleanFamily = fontFamily.split(',')[0]!.trim().replace(/['"]/g, '');
  const lh = parseFloat(node.styles.lineHeight ?? '0') || 0;
  const ls = parseFloat(node.styles.letterSpacing ?? '0') || 0;
  const typoKey = `${cleanFamily}|${fontSize}|${fontWeight}|${lh}|${ls}`;
  const textStyleId = styleMap?.typography.byKey.get(typoKey);
  if (textStyleId) {
    text.textStyleId = textStyleId;
  }

  return text;
}
