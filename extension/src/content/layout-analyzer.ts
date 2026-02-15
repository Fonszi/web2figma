/**
 * Layout Analyzer — detects CSS flex/grid layout and maps to LayoutInfo.
 *
 * Called by extractor.ts for each DOM element to determine Auto Layout properties.
 *
 * Related files:
 * - Types: shared/types.ts (LayoutInfo)
 * - Consumer: extension/src/content/extractor.ts
 */

import type { LayoutInfo } from '../../../shared/types';

/**
 * Analyze an element's computed styles and return a LayoutInfo object.
 */
export function analyzeLayout(el: Element, computed: CSSStyleDeclaration): LayoutInfo {
  const display = computed.display;
  const isFlex = display === 'flex' || display === 'inline-flex';
  const isGrid = display === 'grid' || display === 'inline-grid';

  if (!isFlex && !isGrid) {
    return {
      isAutoLayout: false,
      direction: 'none',
      wrap: false,
      gap: 0,
      padding: extractPadding(computed),
      sizing: { width: 'fixed', height: 'fixed' },
      mainAxisAlignment: 'start',
      crossAxisAlignment: 'start',
    };
  }

  // Grid layout: approximate as vertical or horizontal based on column count
  let gridDirection: 'horizontal' | 'vertical' = 'vertical';
  let gridWrap = false;
  if (isGrid) {
    const templateCols = computed.gridTemplateColumns;
    const colCount = templateCols ? templateCols.split(/\s+/).filter((v: string) => v && v !== 'none').length : 1;
    if (colCount > 1) {
      // Multi-column grid → approximate as horizontal wrapping layout
      gridDirection = 'horizontal';
      gridWrap = true;
    }
  }

  const direction = isFlex ? mapFlexDirection(computed.flexDirection) : gridDirection;
  const wrap = isFlex
    ? computed.flexWrap === 'wrap' || computed.flexWrap === 'wrap-reverse'
    : gridWrap;
  const gap = parseFloat(computed.gap) || parseFloat(computed.rowGap) || parseFloat(computed.columnGap) || 0;

  return {
    isAutoLayout: true,
    direction,
    wrap,
    gap,
    padding: extractPadding(computed),
    sizing: inferSizing(el, computed),
    mainAxisAlignment: mapJustifyContent(computed.justifyContent),
    crossAxisAlignment: mapAlignItems(computed.alignItems),
  };
}

function extractPadding(cs: CSSStyleDeclaration): LayoutInfo['padding'] {
  return {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
}

function mapFlexDirection(value: string): 'horizontal' | 'vertical' | 'none' {
  if (value === 'column' || value === 'column-reverse') return 'vertical';
  return 'horizontal'; // row, row-reverse, or default
}

function mapJustifyContent(value: string): LayoutInfo['mainAxisAlignment'] {
  if (value.includes('center')) return 'center';
  if (value.includes('end') || value.includes('right')) return 'end';
  if (value.includes('space-between')) return 'space-between';
  return 'start';
}

function mapAlignItems(value: string): LayoutInfo['crossAxisAlignment'] {
  if (value.includes('center')) return 'center';
  if (value.includes('end')) return 'end';
  if (value.includes('stretch')) return 'stretch';
  return 'start';
}

/**
 * Infer sizing mode from CSS properties.
 * - 100% width/height → fill
 * - auto or fit-content → hug
 * - explicit px value → fixed
 */
function inferSizing(el: Element, cs: CSSStyleDeclaration): LayoutInfo['sizing'] {
  return {
    width: inferDimension(cs.width, cs.flexGrow),
    height: inferDimension(cs.height, '0'),
  };
}

function inferDimension(value: string, flexGrow: string): 'fixed' | 'hug' | 'fill' {
  if (value === '100%' || parseFloat(flexGrow) > 0) return 'fill';
  if (value === 'auto' || value === 'fit-content' || value === 'min-content' || value === 'max-content') return 'hug';
  return 'fixed';
}
