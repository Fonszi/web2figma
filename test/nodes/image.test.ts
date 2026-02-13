import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupFigmaMock, teardownFigmaMock, mockStore } from '../figma-mock';
import { createImageNode, handleImageDataFromUi } from '../../figma-plugin/src/nodes/image';
import { makeImage } from '../helpers';

describe('createImageNode', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  it('creates rectangle with correct size', async () => {
    const node = makeImage({ bounds: { x: 0, y: 0, width: 200, height: 150 } });
    const rect = await createImageNode(node, 'img-1');
    expect(rect.width).toBe(200);
    expect(rect.height).toBe(150);
  });

  it('clamps size to minimum 1px', async () => {
    const node = makeImage({ bounds: { x: 0, y: 0, width: 0, height: 0 } });
    const rect = await createImageNode(node, 'img-2');
    expect(rect.width).toBe(1);
    expect(rect.height).toBe(1);
  });

  it('uses alt text as name for img tags', async () => {
    const node = makeImage({ tag: 'img', text: 'Logo' });
    const rect = await createImageNode(node, 'img-3');
    expect(rect.name).toBe('Logo');
  });

  it('defaults to "Image" for img tag without alt text', async () => {
    const node = makeImage({ tag: 'img' });
    const rect = await createImageNode(node, 'img-4');
    expect(rect.name).toBe('Image');
  });

  it('uses tag name for non-img elements', async () => {
    const node = makeImage({ tag: 'div' });
    const rect = await createImageNode(node, 'img-5');
    expect(rect.name).toBe('div');
  });

  it('applies image fill from data URI', async () => {
    // Base64 for a tiny 1x1 PNG
    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const node = makeImage({ imageDataUri: dataUri });
    const rect = await createImageNode(node, 'img-6');

    expect(rect.fills).toHaveLength(1);
    expect((rect.fills as any)[0].type).toBe('IMAGE');
    expect((rect.fills as any)[0].scaleMode).toBe('FILL');
  });

  it('applies placeholder when no image data', async () => {
    const node = makeImage();
    const rect = await createImageNode(node, 'img-7');

    // Placeholder: light gray fill
    expect(rect.fills).toHaveLength(1);
    expect((rect.fills as any)[0].type).toBe('SOLID');
    expect((rect.fills as any)[0].color.r).toBeCloseTo(0.9);

    // Dashed stroke
    expect(rect.strokes).toHaveLength(1);
    expect(rect.dashPattern).toEqual([4, 4]);
  });

  it('applies placeholder when data URI is invalid', async () => {
    const node = makeImage({ imageDataUri: 'not-a-data-uri' });
    const rect = await createImageNode(node, 'img-8');

    expect(rect.fills).toHaveLength(1);
    expect((rect.fills as any)[0].type).toBe('SOLID');
  });

  it('applies placeholder when figma.createImage throws', async () => {
    // Override createImage to throw
    (globalThis as any).figma.createImage = vi.fn(() => { throw new Error('Image too large'); });

    const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const node = makeImage({ imageDataUri: dataUri });
    const rect = await createImageNode(node, 'img-9');

    // Should fall back to placeholder
    expect((rect.fills as any)[0].type).toBe('SOLID');
  });

  it('does not try URL fetch when imageUrl starts with data:', async () => {
    const node = makeImage({ imageUrl: 'data:image/svg+xml,...' });
    const rect = await createImageNode(node, 'img-10');

    // Should get placeholder (data: URLs with wrong format not decoded)
    expect((rect.fills as any)[0].type).toBe('SOLID');
    // Should NOT have posted a FETCH_IMAGE message
    expect((globalThis as any).figma.ui.postMessage).not.toHaveBeenCalled();
  });
});

describe('handleImageDataFromUi', () => {
  beforeEach(() => {
    setupFigmaMock();
  });

  afterEach(() => {
    teardownFigmaMock();
  });

  it('resolves pending image request', async () => {
    // Start an image request with URL to create a pending entry
    const node = makeImage({ imageUrl: 'https://example.com/img.png' });
    const promise = createImageNode(node, 'pending-1');

    // Simulate UI responding with image data
    const mockData = new Uint8Array([1, 2, 3]);
    handleImageDataFromUi('pending-1', mockData);

    const rect = await promise;
    // Image was created (fill type IMAGE)
    expect(rect.fills).toHaveLength(1);
    expect((rect.fills as any)[0].type).toBe('IMAGE');
  });

  it('resolves with null for missing image', async () => {
    const node = makeImage({ imageUrl: 'https://example.com/missing.png' });
    const promise = createImageNode(node, 'pending-2');

    // UI responds with null (fetch failed)
    handleImageDataFromUi('pending-2', null);

    const rect = await promise;
    // Should be placeholder
    expect((rect.fills as any)[0].type).toBe('SOLID');
  });

  it('ignores unknown nodeId', () => {
    // Should not throw
    handleImageDataFromUi('unknown-id', new Uint8Array([1]));
  });
});
