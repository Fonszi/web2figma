/**
 * Image Collector — collects image URLs and optionally inlines small images as data URIs.
 *
 * Handles:
 * - <img> src attributes
 * - CSS background-image: url(...)
 * - <picture> / <source> elements
 * - SVG elements (serialized to string)
 *
 * Related files:
 * - Constants: shared/constants.ts (MAX_INLINE_IMAGE_SIZE)
 * - Types: shared/types.ts (BridgeNode)
 * - Consumer: extension/src/content/extractor.ts
 */

import { MAX_INLINE_IMAGE_SIZE } from '../../../shared/constants';

export interface CollectedImage {
  url: string;
  dataUri?: string;
  width?: number;
  height?: number;
}

/**
 * Collect image data from an element.
 * Returns the image URL and optionally a data URI for small images.
 */
export async function collectImageData(el: Element): Promise<CollectedImage | null> {
  // <img> element
  if (el instanceof HTMLImageElement) {
    const url = el.currentSrc || el.src;
    if (!url || url.startsWith('data:')) {
      return url ? { url, dataUri: url } : null;
    }

    // Try to inline small images
    const dataUri = await tryInlineImage(el, url);
    return {
      url,
      dataUri: dataUri ?? undefined,
      width: el.naturalWidth || undefined,
      height: el.naturalHeight || undefined,
    };
  }

  // Background image
  const computed = window.getComputedStyle(el);
  const bgImage = computed.backgroundImage;
  if (bgImage && bgImage !== 'none') {
    const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
    if (urlMatch?.[1]) {
      return { url: urlMatch[1] };
    }
  }

  return null;
}

/**
 * Serialize an SVG element to a string.
 */
export function collectSvgData(el: SVGSVGElement): string {
  const serializer = new XMLSerializer();
  return serializer.serializeToString(el);
}

/**
 * Try to convert an image to a data URI via canvas.
 * Returns null if the image is too large or cross-origin.
 */
async function tryInlineImage(img: HTMLImageElement, url: string): Promise<string | null> {
  try {
    // Skip cross-origin images (canvas will be tainted)
    if (!isSameOrigin(url)) return null;

    // Skip large images
    if (img.naturalWidth * img.naturalHeight * 4 > MAX_INLINE_IMAGE_SIZE * 10) return null;

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0);
    const dataUri = canvas.toDataURL('image/png');

    // Check size (rough estimate: data URI is ~33% larger than binary)
    if (dataUri.length > MAX_INLINE_IMAGE_SIZE * 1.33) return null;

    return dataUri;
  } catch {
    return null; // Cross-origin or other canvas error
  }
}

function isSameOrigin(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.href);
    return parsed.origin === window.location.origin;
  } catch {
    return false;
  }
}
