/**
 * Component detection and creation — barrel export.
 *
 * Flow: detectComponents → createComponents → converter uses ComponentMap
 * Multi-viewport: createViewportVariants → ComponentSet with Viewport= variants
 */

export { detectComponents } from './detector';
export { createComponents, createInstanceNode, type ComponentMap } from './creator';
export { createViewportVariants, type VariantResult } from './variants';
