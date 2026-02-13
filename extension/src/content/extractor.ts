/**
 * Content script: DOM tree extraction.
 *
 * Injected into the active tab by Chrome Extension.
 * Walks the DOM tree from <body>, collecting:
 * - Tag names, text content, visibility
 * - Computed styles via getComputedStyle()
 * - Bounding boxes via getBoundingClientRect()
 * - Layout info (flex/grid detection) via layout-analyzer.ts
 * - Image URLs via image-collector.ts
 * - CSS variables via token-scanner.ts
 * - Component hashes via component-hasher.ts
 * - Framer metadata via framer-detector.ts
 *
 * Output: ExtractionResult (shared/types.ts)
 *
 * Related files:
 * - Layout analysis: extension/src/content/layout-analyzer.ts
 * - Framer detection: extension/src/content/framer-detector.ts
 * - Image collection: extension/src/content/image-collector.ts
 * - Token scanning: extension/src/content/token-scanner.ts
 * - Component hashing: extension/src/content/component-hasher.ts
 * - Bridge format types: shared/types.ts
 * - Message types: shared/messages.ts
 * - Constants: shared/constants.ts (MAX_NODE_DEPTH, MAX_INLINE_IMAGE_SIZE)
 */

import type { BridgeNode, ExtractionResult, SiteMetadata, ComputedStyles } from '../../../shared/types';
import { MAX_NODE_DEPTH } from '../../../shared/constants';
// import { analyzeLayout } from './layout-analyzer';
// import { detectFramerSite, enhanceFramerNode } from './framer-detector';
// import { collectImageData } from './image-collector';
// import { scanTokens } from './token-scanner';
// import { hashComponent } from './component-hasher';

/**
 * Extract the full page as a BridgeNode tree.
 * Called when user clicks "Extract" in extension popup.
 */
export async function extractPage(): Promise<ExtractionResult> {
  const startTime = Date.now();

  // Detect site framework (Framer, Webflow, WordPress, generic)
  // const isFramer = detectFramerSite(document);

  // Walk DOM tree from body
  const rootNode = walkDomNode(document.body, 0);

  // Scan for design tokens (colors, typography, effects, CSS variables)
  // const tokens = scanTokens(document);

  // Collect metadata
  const metadata = extractMetadata();

  return {
    url: window.location.href,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    timestamp: startTime,
    framework: 'unknown', // TODO: detectFramerSite()
    rootNode,
    tokens: { colors: [], typography: [], effects: [], variables: [] },
    components: [],
    fonts: [],
    metadata,
  };
}

/**
 * Recursively walk a DOM node and create a BridgeNode.
 */
function walkDomNode(element: Element, depth: number): BridgeNode {
  const computed = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  const node: BridgeNode = {
    tag: element.tagName.toLowerCase(),
    type: inferNodeType(element),
    children: [],
    styles: extractComputedStyles(computed),
    layout: {
      isAutoLayout: computed.display === 'flex' || computed.display === 'inline-flex',
      direction: computed.flexDirection === 'column' ? 'vertical' : 'horizontal',
      wrap: computed.flexWrap === 'wrap',
      gap: parseFloat(computed.gap) || 0,
      padding: {
        top: parseFloat(computed.paddingTop) || 0,
        right: parseFloat(computed.paddingRight) || 0,
        bottom: parseFloat(computed.paddingBottom) || 0,
        left: parseFloat(computed.paddingLeft) || 0,
      },
      sizing: { width: 'fixed', height: 'fixed' }, // TODO: infer from flex properties
      mainAxisAlignment: mapJustifyContent(computed.justifyContent),
      crossAxisAlignment: mapAlignItems(computed.alignItems),
    },
    bounds: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    visible: computed.display !== 'none' && computed.visibility !== 'hidden' && computed.opacity !== '0',
    classNames: Array.from(element.classList),
    ariaRole: element.getAttribute('role') || undefined,
    dataAttributes: extractDataAttributes(element),
  };

  // Extract text content (for leaf text nodes)
  if (element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE) {
    node.text = element.textContent?.trim() || undefined;
  }

  // Extract image URL
  if (element instanceof HTMLImageElement) {
    node.imageUrl = element.src;
  }

  // Recurse into children (up to MAX_NODE_DEPTH)
  if (depth < MAX_NODE_DEPTH) {
    for (const child of element.children) {
      node.children.push(walkDomNode(child, depth + 1));
    }
  }

  return node;
}

function inferNodeType(el: Element): BridgeNode['type'] {
  const tag = el.tagName.toLowerCase();
  if (tag === 'img' || tag === 'picture') return 'image';
  if (tag === 'svg') return 'svg';
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return 'input';
  if (tag === 'video') return 'video';
  if (['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'a', 'label', 'li', 'td', 'th', 'button'].includes(tag)) {
    if (el.children.length === 0 || (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE)) {
      return 'text';
    }
  }
  return 'frame';
}

function extractComputedStyles(cs: CSSStyleDeclaration): ComputedStyles {
  return {
    color: cs.color,
    backgroundColor: cs.backgroundColor,
    borderColor: cs.borderColor,
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    fontStyle: cs.fontStyle,
    lineHeight: cs.lineHeight,
    letterSpacing: cs.letterSpacing,
    textAlign: cs.textAlign,
    textDecoration: cs.textDecoration,
    textTransform: cs.textTransform,
    display: cs.display,
    position: cs.position,
    flexDirection: cs.flexDirection,
    flexWrap: cs.flexWrap,
    justifyContent: cs.justifyContent,
    alignItems: cs.alignItems,
    alignSelf: cs.alignSelf,
    gap: cs.gap,
    paddingTop: cs.paddingTop,
    paddingRight: cs.paddingRight,
    paddingBottom: cs.paddingBottom,
    paddingLeft: cs.paddingLeft,
    borderRadius: cs.borderRadius,
    borderWidth: cs.borderWidth,
    boxShadow: cs.boxShadow,
    opacity: cs.opacity,
    overflow: cs.overflow,
  };
}

function extractMetadata(): SiteMetadata {
  return {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') || undefined,
    favicon: (document.querySelector('link[rel="icon"]') as HTMLLinkElement)?.href || undefined,
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || undefined,
    isFramerSite: false, // TODO: detectFramerSite()
  };
}

function extractDataAttributes(el: Element): Record<string, string> | undefined {
  const data: Record<string, string> = {};
  for (const attr of el.attributes) {
    if (attr.name.startsWith('data-')) {
      data[attr.name] = attr.value;
    }
  }
  return Object.keys(data).length > 0 ? data : undefined;
}

function mapJustifyContent(value: string): 'start' | 'center' | 'end' | 'space-between' {
  if (value.includes('center')) return 'center';
  if (value.includes('end') || value.includes('right')) return 'end';
  if (value.includes('space-between')) return 'space-between';
  return 'start';
}

function mapAlignItems(value: string): 'start' | 'center' | 'end' | 'stretch' {
  if (value.includes('center')) return 'center';
  if (value.includes('end')) return 'end';
  if (value.includes('stretch')) return 'stretch';
  return 'start';
}

// Listen for extraction requests from popup/service worker
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXTRACT_PAGE') {
    extractPage()
      .then((result) => sendResponse({ type: 'EXTRACTION_COMPLETE', result }))
      .catch((error) => sendResponse({ type: 'EXTRACTION_ERROR', error: String(error) }));
    return true; // Keep message channel open for async response
  }
});
