/**
 * Input node creator — creates Figma FrameNode with styled interior for form elements.
 *
 * Handles:
 * - <input type="text"> — bordered frame with placeholder text
 * - <textarea> — multi-line variant
 * - <select> — dropdown appearance with chevron
 * - <input type="checkbox"> / <input type="radio"> — small indicator frames
 */

import type { BridgeNode } from '../../../shared/types';
import type { StyleMap } from '../tokens';
import { createFrameNode } from './frame';
import { solidPaint, parseCssColor } from './styles';

export async function createInputNode(
  node: BridgeNode,
  styleMap?: StyleMap,
  framerName?: string | null,
): Promise<FrameNode> {
  const frame = createFrameNode(node, styleMap, framerName);
  const tag = node.tag;
  const inputType = node.dataAttributes?.['type'] ?? 'text';

  // Apply border if not already set
  if (frame.strokes.length === 0) {
    const borderColor = node.styles.borderColor;
    if (borderColor) {
      const paint = solidPaint(borderColor);
      if (paint) {
        frame.strokes = [paint];
        frame.strokeWeight = parseFloat(node.styles.borderWidth ?? '1') || 1;
      }
    } else {
      // Default form element border
      frame.strokes = [{ type: 'SOLID', color: { r: 0.8, g: 0.8, b: 0.8 }, opacity: 1 }];
      frame.strokeWeight = 1;
    }
  }

  // Add placeholder text for text inputs and textareas
  if (tag === 'input' && (inputType === 'text' || inputType === 'email' || inputType === 'password' || inputType === 'search' || inputType === 'url' || inputType === 'tel' || inputType === 'number')) {
    await addPlaceholderText(frame, node);
  } else if (tag === 'textarea') {
    await addPlaceholderText(frame, node);
  } else if (tag === 'select') {
    await addPlaceholderText(frame, node);
  }

  return frame;
}

async function addPlaceholderText(frame: FrameNode, node: BridgeNode): Promise<void> {
  const placeholderText = node.text || node.dataAttributes?.['placeholder'] || '';
  if (!placeholderText) return;

  const text = figma.createText();
  text.name = 'placeholder';

  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  text.fontName = { family: 'Inter', style: 'Regular' };
  text.characters = placeholderText;

  const fontSize = parseFloat(node.styles.fontSize ?? '14');
  if (fontSize > 0) text.fontSize = fontSize;

  // Placeholder color — use text color or default gray
  if (node.styles.color) {
    const color = parseCssColor(node.styles.color);
    if (color) {
      text.fills = [{ type: 'SOLID', color: { r: color.r, g: color.g, b: color.b }, opacity: color.a }];
    }
  } else {
    text.fills = [{ type: 'SOLID', color: { r: 0.6, g: 0.6, b: 0.6 }, opacity: 1 }];
  }

  text.textAutoResize = 'WIDTH_AND_HEIGHT';
  frame.appendChild(text);
}
