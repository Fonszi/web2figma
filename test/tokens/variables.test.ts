import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupFigmaMock, teardownFigmaMock, mockStore } from '../figma-mock';
import { createVariables } from '../../figma-plugin/src/tokens/variables';
import { resetNameTracker } from '../../figma-plugin/src/tokens/naming';
import type { VariableToken } from '../../shared/types';

describe('createVariables', () => {
  beforeEach(() => {
    setupFigmaMock();
    resetNameTracker();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  it('creates variables from tokens', async () => {
    const tokens: VariableToken[] = [
      { name: '--color-primary', cssProperty: '--color-primary', resolvedValue: '#ff0000', type: 'color' },
      { name: '--spacing-lg', cssProperty: '--spacing-lg', resolvedValue: '24px', type: 'number' },
    ];

    const result = await createVariables(tokens);

    expect(result.count).toBe(2);
    expect(result.byName.size).toBe(2);
    expect(mockStore.variables).toHaveLength(2);
  });

  it('groups into collections by prefix', async () => {
    const tokens: VariableToken[] = [
      { name: '--color-primary', cssProperty: '--color-primary', resolvedValue: '#ff0000', type: 'color' },
      { name: '--color-secondary', cssProperty: '--color-secondary', resolvedValue: '#00ff00', type: 'color' },
      { name: '--spacing-lg', cssProperty: '--spacing-lg', resolvedValue: '24px', type: 'number' },
    ];

    await createVariables(tokens);

    const collectionNames = mockStore.variableCollections.map(c => c.name);
    expect(collectionNames).toContain('Colors');
    expect(collectionNames).toContain('Spacing');
    expect(mockStore.variableCollections).toHaveLength(2);
  });

  it('puts unknown prefixes in "Tokens" collection', async () => {
    const tokens: VariableToken[] = [
      { name: '--custom-value', cssProperty: '--custom-value', resolvedValue: 'hello', type: 'string' },
    ];

    await createVariables(tokens);

    expect(mockStore.variableCollections[0]!.name).toBe('Tokens');
  });

  it('parses color values correctly', async () => {
    const tokens: VariableToken[] = [
      { name: '--color-red', cssProperty: '--color-red', resolvedValue: 'rgb(255, 0, 0)', type: 'color' },
    ];

    await createVariables(tokens);

    const variable = mockStore.variables[0]!;
    expect(variable.setValueForMode).toHaveBeenCalledWith(
      'default-mode',
      { r: 1, g: 0, b: 0, a: 1 },
    );
  });

  it('parses number values correctly', async () => {
    const tokens: VariableToken[] = [
      { name: '--spacing-sm', cssProperty: '--spacing-sm', resolvedValue: '8px', type: 'number' },
    ];

    await createVariables(tokens);

    expect(mockStore.variables[0]!.setValueForMode).toHaveBeenCalledWith('default-mode', 8);
  });

  it('passes string values directly', async () => {
    const tokens: VariableToken[] = [
      { name: '--font-family', cssProperty: '--font-family', resolvedValue: 'Inter, sans-serif', type: 'string' },
    ];

    await createVariables(tokens);

    expect(mockStore.variables[0]!.setValueForMode).toHaveBeenCalledWith(
      'default-mode',
      'Inter, sans-serif',
    );
  });

  it('skips tokens with unparseable values', async () => {
    const tokens: VariableToken[] = [
      { name: '--color-bad', cssProperty: '--color-bad', resolvedValue: 'not-a-color', type: 'color' },
      { name: '--spacing-bad', cssProperty: '--spacing-bad', resolvedValue: 'auto', type: 'number' },
    ];

    const result = await createVariables(tokens);
    expect(result.count).toBe(0);
  });

  it('returns empty map for empty tokens', async () => {
    const result = await createVariables([]);
    expect(result.count).toBe(0);
    expect(result.byName.size).toBe(0);
  });

  it('handles Variables API failure gracefully', async () => {
    const mock = (globalThis as any).figma;
    mock.variables.createVariableCollection.mockImplementation(() => {
      throw new Error('Variables API not available');
    });

    const tokens: VariableToken[] = [
      { name: '--color-red', cssProperty: '--color-red', resolvedValue: '#ff0000', type: 'color' },
    ];

    const result = await createVariables(tokens);
    expect(result.count).toBe(0);
  });

  it('calls progress callback', async () => {
    const tokens: VariableToken[] = [
      { name: '--color-primary', cssProperty: '--color-primary', resolvedValue: '#ff0000', type: 'color' },
      { name: '--color-secondary', cssProperty: '--color-secondary', resolvedValue: '#00ff00', type: 'color' },
    ];

    const progress = vi.fn();
    await createVariables(tokens, progress);

    expect(progress).toHaveBeenCalled();
    expect(progress).toHaveBeenCalledWith(2, 2);
  });

  it('maps token name to variable ID', async () => {
    const tokens: VariableToken[] = [
      { name: '--color-primary', cssProperty: '--color-primary', resolvedValue: '#ff0000', type: 'color' },
    ];

    const result = await createVariables(tokens);
    expect(result.byName.get('--color-primary')).toBe(mockStore.variables[0]!.id);
  });

  it('maps font prefix to Typography collection', async () => {
    const tokens: VariableToken[] = [
      { name: '--font-size-lg', cssProperty: '--font-size-lg', resolvedValue: '18px', type: 'number' },
    ];

    await createVariables(tokens);
    expect(mockStore.variableCollections[0]!.name).toBe('Typography');
  });

  it('maps border prefix to Border collection', async () => {
    const tokens: VariableToken[] = [
      { name: '--border-radius', cssProperty: '--border-radius', resolvedValue: '8px', type: 'number' },
    ];

    await createVariables(tokens);
    expect(mockStore.variableCollections[0]!.name).toBe('Border');
  });

  it('maps shadow prefix to Effects collection', async () => {
    const tokens: VariableToken[] = [
      { name: '--shadow-sm', cssProperty: '--shadow-sm', resolvedValue: 'hello', type: 'string' },
    ];

    await createVariables(tokens);
    expect(mockStore.variableCollections[0]!.name).toBe('Effects');
  });
});
