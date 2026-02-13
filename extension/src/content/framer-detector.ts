/**
 * Framer Detector — detects Framer sites and provides enhanced extraction hints.
 *
 * Detection signals:
 * - `framerusercontent.com` in asset URLs
 * - `data-framer-*` attributes on elements
 * - Framer runtime scripts (framer.com/m/)
 * - `__framer_metadata` global variable
 *
 * Related files:
 * - Types: shared/types.ts (SiteMetadata.isFramerSite)
 * - Consumer: extension/src/content/extractor.ts
 */

export interface FramerDetectionResult {
  isFramerSite: boolean;
  framerProjectId?: string;
  /** Framer component boundaries detected via data-framer-component-type. */
  componentBoundaries: Element[];
}

/**
 * Detect whether the current page is a Framer site.
 */
export function detectFramerSite(doc: Document): FramerDetectionResult {
  const signals: boolean[] = [];

  // Signal 1: framerusercontent.com in any asset URL
  const hasFramerAssets = !!doc.querySelector(
    'img[src*="framerusercontent.com"], source[src*="framerusercontent.com"], link[href*="framerusercontent.com"]'
  );
  signals.push(hasFramerAssets);

  // Signal 2: data-framer-* attributes
  const hasFramerAttrs = !!doc.querySelector('[data-framer-component-type], [data-framer-name], [data-framer-appear-id]');
  signals.push(hasFramerAttrs);

  // Signal 3: Framer runtime scripts
  const scripts = doc.querySelectorAll('script[src]');
  const hasFramerRuntime = Array.from(scripts).some(
    (s) => (s as HTMLScriptElement).src.includes('framer.com/m/') || (s as HTMLScriptElement).src.includes('framerusercontent.com')
  );
  signals.push(hasFramerRuntime);

  // Signal 4: __framer_metadata global
  const hasFramerGlobal = '__framer_metadata' in (doc.defaultView ?? {});
  signals.push(hasFramerGlobal);

  // Need at least 1 signal to classify as Framer
  const isFramerSite = signals.some(Boolean);

  // Try to extract project ID
  let framerProjectId: string | undefined;
  if (isFramerSite && hasFramerGlobal) {
    try {
      const meta = (doc.defaultView as unknown as Record<string, unknown>).__framer_metadata;
      if (meta && typeof meta === 'object' && 'projectId' in meta) {
        framerProjectId = String((meta as Record<string, unknown>).projectId);
      }
    } catch {
      // Ignore
    }
  }

  // Collect component boundaries
  const componentBoundaries = Array.from(doc.querySelectorAll('[data-framer-component-type]'));

  return { isFramerSite, framerProjectId, componentBoundaries };
}

/**
 * Get Framer-specific metadata from an element.
 */
export function getFramerNodeInfo(el: Element): { componentType?: string; name?: string } | null {
  const componentType = el.getAttribute('data-framer-component-type') ?? undefined;
  const name = el.getAttribute('data-framer-name') ?? undefined;

  if (!componentType && !name) return null;
  return { componentType, name };
}
