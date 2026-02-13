/**
 * Variable creator — converts VariableToken[] into Figma Variables.
 *
 * Groups variables by their CSS variable name prefix into collections:
 * - --color-* → "Colors" collection
 * - --spacing-* → "Spacing" collection
 * - --font-* → "Typography" collection
 * - Everything else → "Tokens" collection
 *
 * Wrapped in try-catch because the Variables API is a paid Figma feature.
 */

import type { VariableToken } from '../../../shared/types';
import { parseCssColor } from '../nodes/styles';
import { cssVarToStyleName } from './naming';

export interface VariableMap {
  /** Map from CSS variable name to Figma Variable ID. */
  byName: Map<string, string>;
  /** Number of variables created. */
  count: number;
}

const MAX_VARIABLES = 200;

/** Map CSS variable prefixes to Figma collection names. */
function getCollectionName(varName: string): string {
  const stripped = varName.replace(/^-+/, '');
  const prefix = stripped.split('-')[0]?.toLowerCase() ?? '';

  switch (prefix) {
    case 'color':
    case 'bg':
    case 'background':
      return 'Colors';
    case 'spacing':
    case 'gap':
    case 'padding':
    case 'margin':
      return 'Spacing';
    case 'font':
    case 'text':
      return 'Typography';
    case 'radius':
    case 'border':
      return 'Border';
    case 'shadow':
      return 'Effects';
    default:
      return 'Tokens';
  }
}

/** Map VariableToken.type to Figma VariableResolvedDataType. */
function resolveType(type: VariableToken['type']): VariableResolvedDataType {
  switch (type) {
    case 'color': return 'COLOR';
    case 'number': return 'FLOAT';
    case 'string': return 'STRING';
  }
}

/** Parse a variable value to the correct Figma value for setValueForMode. */
function parseValue(token: VariableToken): VariableValue | null {
  switch (token.type) {
    case 'color': {
      const c = parseCssColor(token.resolvedValue);
      if (!c) return null;
      return { r: c.r, g: c.g, b: c.b, a: c.a };
    }
    case 'number': {
      const n = parseFloat(token.resolvedValue);
      return isNaN(n) ? null : n;
    }
    case 'string':
      return token.resolvedValue;
  }
}

export async function createVariables(
  tokens: VariableToken[],
  onProgress?: (created: number, total: number) => void,
): Promise<VariableMap> {
  const byName = new Map<string, string>();

  try {
    const capped = tokens.slice(0, MAX_VARIABLES);

    // Group tokens by collection
    const groups = new Map<string, VariableToken[]>();
    for (const token of capped) {
      const collection = getCollectionName(token.name);
      const group = groups.get(collection);
      if (group) {
        group.push(token);
      } else {
        groups.set(collection, [token]);
      }
    }

    let processed = 0;
    for (const [collectionName, groupTokens] of groups) {
      const collection = figma.variables.createVariableCollection(collectionName);
      const modeId = collection.modes[0]!.modeId;

      for (const token of groupTokens) {
        const varName = cssVarToStyleName(token.name);
        const value = parseValue(token);
        if (value === null) {
          processed++;
          continue;
        }

        const variable = figma.variables.createVariable(
          varName,
          collection.id,
          resolveType(token.type),
        );
        variable.setValueForMode(modeId, value);

        byName.set(token.name, variable.id);
        processed++;
        onProgress?.(processed, capped.length);
      }
    }
  } catch {
    // Variables API unavailable (free Figma plan or older API version)
    console.warn('web2figma: Variables API unavailable, skipping variable creation');
  }

  return { byName, count: byName.size };
}
