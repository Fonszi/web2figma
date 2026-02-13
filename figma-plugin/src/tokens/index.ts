/**
 * Token creation orchestrator — creates all Figma styles and variables from DesignTokens.
 *
 * Returns a StyleMap that the converter uses to link nodes to shared styles.
 *
 * Related files:
 * - Consumer: figma-plugin/src/converter.ts
 * - Node creators: figma-plugin/src/nodes/frame.ts, text.ts
 * - Token scanner: extension/src/content/token-scanner.ts (produces DesignTokens)
 */

import type { DesignTokens, ImportSettings } from '../../../shared/types';
import { createColorStyles, type ColorStyleMap } from './colors';
import { createTypographyStyles, type TypographyStyleMap } from './typography';
import { createEffectStyles, type EffectStyleMap } from './effects';
import { createVariables, type VariableMap } from './variables';
import { resetNameTracker } from './naming';

export interface StyleMap {
  colors: ColorStyleMap;
  typography: TypographyStyleMap;
  effects: EffectStyleMap;
  variables: VariableMap;
}

const EMPTY_COLOR_MAP: ColorStyleMap = { byValue: new Map(), count: 0 };
const EMPTY_TYPO_MAP: TypographyStyleMap = { byKey: new Map(), count: 0 };
const EMPTY_EFFECT_MAP: EffectStyleMap = { byValue: new Map(), count: 0 };
const EMPTY_VAR_MAP: VariableMap = { byName: new Map(), count: 0 };

export async function createAllStyles(
  tokens: DesignTokens,
  settings: ImportSettings,
  onProgress: (message: string, progress: number) => void,
): Promise<StyleMap> {
  // Reset the name dedup tracker for this import
  resetNameTracker();

  if (!settings.createStyles) {
    return {
      colors: EMPTY_COLOR_MAP,
      typography: EMPTY_TYPO_MAP,
      effects: EMPTY_EFFECT_MAP,
      variables: settings.createVariables
        ? await createVariables(tokens.variables)
        : EMPTY_VAR_MAP,
    };
  }

  const totalSteps = 4;
  let step = 0;

  // Color styles
  onProgress(`Creating ${tokens.colors.length} color styles...`, step / totalSteps);
  const colors = await createColorStyles(tokens.colors);
  step++;

  // Typography styles
  onProgress(`Creating ${tokens.typography.length} text styles...`, step / totalSteps);
  const typography = await createTypographyStyles(tokens.typography);
  step++;

  // Effect styles
  onProgress(`Creating ${tokens.effects.length} effect styles...`, step / totalSteps);
  const effects = await createEffectStyles(tokens.effects);
  step++;

  // Variables (separate flag)
  let variables: VariableMap = EMPTY_VAR_MAP;
  if (settings.createVariables) {
    onProgress(`Creating ${tokens.variables.length} variables...`, step / totalSteps);
    variables = await createVariables(tokens.variables);
  }
  step++;

  onProgress('Design tokens created', 1);
  return { colors, typography, effects, variables };
}
