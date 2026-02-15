import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupFigmaMock, teardownFigmaMock, mockStore } from '../figma-mock';
import { createInputNode } from '../../figma-plugin/src/nodes/input';
import { makeFrame } from '../helpers';

describe('createInputNode', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  it('creates a frame for input elements', async () => {
    const node = makeFrame({ tag: 'input', type: 'input' });
    const frame = await createInputNode(node);
    expect(frame.type).toBe('FRAME');
    expect(frame.name).toBe('input');
  });

  it('applies default border when no border color specified', async () => {
    const node = makeFrame({ tag: 'input', type: 'input' });
    const frame = await createInputNode(node);
    expect(frame.strokes).toHaveLength(1);
    expect(frame.strokeWeight).toBe(1);
  });

  it('applies custom border from styles', async () => {
    const node = makeFrame({
      tag: 'input',
      type: 'input',
      styles: { borderColor: 'rgb(0, 0, 255)', borderWidth: '2' },
    });
    const frame = await createInputNode(node);
    expect(frame.strokes).toHaveLength(1);
    expect(frame.strokeWeight).toBe(2);
  });

  it('adds placeholder text child for text input with text content', async () => {
    const node = makeFrame({
      tag: 'input',
      type: 'input',
      text: 'Enter your email',
      dataAttributes: { type: 'text' },
    });
    const frame = await createInputNode(node);
    expect(frame.appendChild).toHaveBeenCalled();
    expect(mockStore.textNodes).toHaveLength(1);
    expect(mockStore.textNodes[0].characters).toBe('Enter your email');
    expect(mockStore.textNodes[0].name).toBe('placeholder');
  });

  it('adds placeholder text for textarea', async () => {
    const node = makeFrame({
      tag: 'textarea',
      type: 'input',
      text: 'Write a message...',
    });
    const frame = await createInputNode(node);
    expect(frame.appendChild).toHaveBeenCalled();
    expect(mockStore.textNodes).toHaveLength(1);
    expect(mockStore.textNodes[0].characters).toBe('Write a message...');
  });

  it('adds placeholder text for select', async () => {
    const node = makeFrame({
      tag: 'select',
      type: 'input',
      text: 'Choose option',
    });
    const frame = await createInputNode(node);
    expect(frame.appendChild).toHaveBeenCalled();
    expect(mockStore.textNodes[0].characters).toBe('Choose option');
  });

  it('does not add placeholder when no text content', async () => {
    const node = makeFrame({
      tag: 'input',
      type: 'input',
      dataAttributes: { type: 'text' },
    });
    const frame = await createInputNode(node);
    expect(mockStore.textNodes).toHaveLength(0);
  });

  it('uses framerName when provided', async () => {
    const node = makeFrame({ tag: 'input', type: 'input' });
    const frame = await createInputNode(node, undefined, 'Email Field');
    expect(frame.name).toBe('Email Field');
  });

  it('uses font size from styles for placeholder text', async () => {
    const node = makeFrame({
      tag: 'input',
      type: 'input',
      text: 'Hello',
      styles: { fontSize: '18' },
      dataAttributes: { type: 'text' },
    });
    await createInputNode(node);
    expect(mockStore.textNodes[0].fontSize).toBe(18);
  });
});
