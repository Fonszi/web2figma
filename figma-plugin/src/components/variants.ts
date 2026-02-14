/**
 * Variant creator — creates Figma ComponentSets from multi-viewport extractions.
 *
 * Each viewport extraction becomes a ComponentNode with name "Viewport=Label".
 * All components are combined into a ComponentSet using figma.combineAsVariants().
 *
 * Design tokens are created once from the widest viewport and shared across
 * all variant conversions to avoid duplicate Figma styles.
 *
 * Related files:
 * - Converter: figma-plugin/src/converter.ts (convertToFigmaAsComponent)
 * - Types: shared/types.ts (MultiViewportResult, ViewportExtraction)
 * - Messages: shared/messages.ts (ImportPhase)
 */

import type { MultiViewportResult, ImportSettings } from '../../../shared/types';
import type { ImportPhase } from '../../../shared/messages';
import { convertToFigmaAsComponent } from '../converter';
import type { StyleMap } from '../tokens';
import { createAllStyles } from '../tokens';
import { enhanceFramerTokens } from '../framer';

export interface VariantResult {
  variantCount: number;
  totalNodeCount: number;
  totalTokenCount: number;
  totalComponentCount: number;
  totalStyleCount: number;
  totalSectionCount: number;
}

type ProgressCallback = (phase: ImportPhase, progress: number, message: string) => void;

/**
 * Create a ComponentSet with one variant per viewport extraction.
 */
export async function createViewportVariants(
  multiResult: MultiViewportResult,
  settings: ImportSettings,
  onProgress: ProgressCallback,
): Promise<VariantResult> {
  const components: ComponentNode[] = [];
  let totalNodes = 0;
  let totalTokens = 0;
  let totalComponents = 0;
  let totalStyles = 0;
  let totalSections = 0;

  // Sort extractions by width descending (widest first for token creation)
  const sorted = [...multiResult.extractions].sort((a, b) => b.width - a.width);

  // Create design tokens once from the widest viewport
  let sharedStyleMap: StyleMap | undefined;

  for (let i = 0; i < sorted.length; i++) {
    const extraction = sorted[i];
    const variantProgress = i / sorted.length;

    onProgress(
      'creating-variants',
      variantProgress,
      `Creating ${extraction.label} variant (${extraction.width}px)...`,
    );

    // Create tokens only for the first (widest) viewport
    if (i === 0 && settings.createStyles) {
      const isFramer = extraction.result.metadata.isFramerSite && settings.framerAwareMode;
      const tokens = isFramer ? enhanceFramerTokens(extraction.result.tokens) : extraction.result.tokens;

      onProgress('creating-styles', 0, 'Creating design tokens...');
      sharedStyleMap = await createAllStyles(
        tokens,
        settings,
        (message, progress) => onProgress('creating-styles', progress, message),
      );
    }

    const { component, counts } = await convertToFigmaAsComponent(
      extraction.result,
      extraction.label,
      settings,
      (phase, progress, message) => {
        const overallProgress = (i + progress) / sorted.length;
        onProgress(phase, overallProgress, `[${extraction.label}] ${message}`);
      },
      sharedStyleMap,
    );

    // Set variant property name (Figma convention: "Property=Value")
    component.name = `Viewport=${extraction.label}`;

    components.push(component);
    totalNodes += counts.nodeCount;
    totalTokens += counts.tokenCount;
    totalComponents += counts.componentCount;
    totalStyles += counts.styleCount;
    totalSections += counts.sectionCount;
  }

  onProgress('creating-variants', 0.9, 'Combining into component set...');

  // Combine into a ComponentSet
  const componentSet = figma.combineAsVariants(components, figma.currentPage);

  // Name the component set
  const hostname = (() => {
    try { return new URL(multiResult.url).hostname; } catch { return 'unknown'; }
  })();
  componentSet.name = sorted[0]?.result.metadata.title || `Import from ${hostname}`;

  // Position and select
  const viewport = figma.viewport.center;
  componentSet.x = Math.round(viewport.x - componentSet.width / 2);
  componentSet.y = Math.round(viewport.y - componentSet.height / 2);
  figma.currentPage.selection = [componentSet];
  figma.viewport.scrollAndZoomIntoView([componentSet]);

  onProgress('finalizing', 1, 'Done!');

  return {
    variantCount: components.length,
    totalNodeCount: totalNodes,
    totalTokenCount: totalTokens,
    totalComponentCount: totalComponents,
    totalStyleCount: totalStyles,
    totalSectionCount: totalSections,
  };
}
