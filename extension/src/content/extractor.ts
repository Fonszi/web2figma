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

import type { BridgeNode, ExtractionResult, SiteMetadata, ComputedStyles, DetectedFont } from '../../../shared/types';
import { MAX_NODE_DEPTH } from '../../../shared/constants';
import { analyzeLayout } from './layout-analyzer';
import { detectFramerSite, getFramerNodeInfo } from './framer-detector';
import { collectImageData, collectSvgData } from './image-collector';
import { scanTokens } from './token-scanner';
import { hashComponent } from './component-hasher';

/**
 * Extract the full page as a BridgeNode tree.
 * Called when user clicks "Extract" in extension popup.
 */
export async function extractPage(): Promise<ExtractionResult> {
  const startTime = Date.now();

  // Detect site framework (Framer, Webflow, WordPress, generic)
  const framerResult = detectFramerSite(document);
  const framework = framerResult.isFramerSite ? 'framer' : detectFramework();

  // Walk DOM tree from body
  const rootNode = await walkDomNode(document.body, 0);

  // Scan for design tokens (colors, typography, effects, CSS variables)
  const tokens = scanTokens(document);

  // Detect fonts used on the page
  const fonts = detectFonts();

  // Collect metadata
  const metadata = extractMetadata(framerResult.isFramerSite, framerResult.framerProjectId);

  return {
    url: window.location.href,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    timestamp: startTime,
    framework,
    rootNode,
    tokens,
    components: [], // Component detection happens post-extraction via hashes
    fonts,
    metadata,
  };
}

/**
 * Recursively walk a DOM node and create a BridgeNode.
 */
async function walkDomNode(element: Element, depth: number): Promise<BridgeNode> {
  const computed = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();

  // Use layout analyzer for proper flex/grid detection
  const layout = analyzeLayout(element, computed);

  const node: BridgeNode = {
    tag: element.tagName.toLowerCase(),
    type: inferNodeType(element),
    children: [],
    styles: extractComputedStyles(computed),
    layout,
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

  // Extract image data
  if (element instanceof HTMLImageElement) {
    const imageData = await collectImageData(element);
    if (imageData) {
      node.imageUrl = imageData.url;
      node.imageDataUri = imageData.dataUri;
    }
  }

  // Extract SVG data
  if (element instanceof SVGSVGElement) {
    node.svgData = collectSvgData(element);
  }

  // Component hash for detection
  node.componentHash = hashComponent(element);

  // Framer-specific metadata
  const framerInfo = getFramerNodeInfo(element);
  if (framerInfo) {
    node.dataAttributes = {
      ...node.dataAttributes,
      ...(framerInfo.componentType ? { 'data-framer-component-type': framerInfo.componentType } : {}),
      ...(framerInfo.name ? { 'data-framer-name': framerInfo.name } : {}),
    };
  }

  // Recurse into children (up to MAX_NODE_DEPTH)
  if (depth < MAX_NODE_DEPTH) {
    for (const child of element.children) {
      const childNode = await walkDomNode(child, depth + 1);
      node.children.push(childNode);
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
    rowGap: cs.rowGap,
    columnGap: cs.columnGap,
    paddingTop: cs.paddingTop,
    paddingRight: cs.paddingRight,
    paddingBottom: cs.paddingBottom,
    paddingLeft: cs.paddingLeft,
    width: cs.width,
    height: cs.height,
    minWidth: cs.minWidth,
    maxWidth: cs.maxWidth,
    borderRadius: cs.borderRadius,
    borderTopLeftRadius: cs.borderTopLeftRadius,
    borderTopRightRadius: cs.borderTopRightRadius,
    borderBottomRightRadius: cs.borderBottomRightRadius,
    borderBottomLeftRadius: cs.borderBottomLeftRadius,
    borderWidth: cs.borderWidth,
    borderStyle: cs.borderStyle,
    boxShadow: cs.boxShadow,
    opacity: cs.opacity,
    overflow: cs.overflow,
    backgroundImage: cs.backgroundImage,
    transform: cs.transform,
  };
}

function extractMetadata(isFramerSite: boolean, framerProjectId?: string): SiteMetadata {
  return {
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content') || undefined,
    favicon: (document.querySelector('link[rel="icon"]') as HTMLLinkElement)?.href || undefined,
    ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') || undefined,
    isFramerSite,
    framerProjectId,
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

/**
 * Detect the site framework (non-Framer).
 */
function detectFramework(): ExtractionResult['framework'] {
  // Webflow
  if (document.querySelector('html.w-mod-js') || document.querySelector('[data-wf-page]')) {
    return 'webflow';
  }
  // WordPress
  if (document.querySelector('meta[name="generator"][content*="WordPress"]') || document.body.classList.contains('wp-site')) {
    return 'wordpress';
  }
  return 'unknown';
}

/**
 * Detect fonts used on the page.
 */
function detectFonts(): DetectedFont[] {
  const fontMap = new Map<string, Set<number>>();

  const elements = document.querySelectorAll('*');
  for (const el of elements) {
    const cs = window.getComputedStyle(el);
    const family = cs.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
    const weight = parseInt(cs.fontWeight, 10) || 400;

    if (!fontMap.has(family)) {
      fontMap.set(family, new Set());
    }
    fontMap.get(family)!.add(weight);
  }

  const googleFonts = new Set<string>();
  document.querySelectorAll('link[href*="fonts.googleapis.com"]').forEach((link) => {
    const href = (link as HTMLLinkElement).href;
    const familyMatch = href.match(/family=([^&:]+)/);
    if (familyMatch) {
      googleFonts.add(familyMatch[1].replace(/\+/g, ' '));
    }
  });

  return Array.from(fontMap.entries()).map(([family, weights]) => ({
    family,
    weights: Array.from(weights).sort((a, b) => a - b),
    isGoogleFont: googleFonts.has(family),
  }));
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
