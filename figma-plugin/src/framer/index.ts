/**
 * Framer enhancement layer — barrel export.
 *
 * When `framework === 'framer'` and `settings.framerAwareMode`, the converter
 * uses these modules for better naming, token grouping, component detection,
 * and page section organization.
 */

export { getFramerName, isFramerSection, cleanFramerName } from './naming';
export { enhanceFramerTokens, isFramerVariable, cleanFramerVarName } from './tokens';
export { enhanceFramerComponents } from './components';
export { organizeFramerSections } from './sections';
