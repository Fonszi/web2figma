/**
 * Component detection and creation — barrel export.
 *
 * Flow: detectComponents → createComponents → converter uses ComponentMap
 */

export { detectComponents } from './detector';
export { createComponents, createInstanceNode, type ComponentMap } from './creator';
