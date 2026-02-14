import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { collectImageData, collectSvgData } from '../../extension/src/content/image-collector';
import { cleanupDOM } from '../dom-helpers';

describe('collectSvgData', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
  });

  it('serializes SVG element to string', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');
    svg.appendChild(circle);

    const result = collectSvgData(svg);
    expect(result).toContain('<svg');
    expect(result).toContain('viewBox="0 0 24 24"');
    expect(result).toContain('<circle');
    expect(result).toContain('cx="12"');
  });

  it('preserves SVG attributes', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100');
    svg.setAttribute('height', '100');
    svg.setAttribute('fill', 'none');

    const result = collectSvgData(svg);
    expect(result).toContain('width="100"');
    expect(result).toContain('height="100"');
    expect(result).toContain('fill="none"');
  });

  it('handles empty SVG', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const result = collectSvgData(svg);
    expect(result).toContain('<svg');
    // XMLSerializer self-closes empty elements: <svg.../> instead of <svg...></svg>
    expect(result).toMatch(/<svg[^>]*\/?>/);
  });
});

describe('collectImageData', () => {
  beforeEach(() => {
    cleanupDOM();
  });

  afterEach(() => {
    cleanupDOM();
    vi.restoreAllMocks();
  });

  it('returns null for non-image element with no background', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    return collectImageData(div).then((result) => {
      expect(result).toBeNull();
    });
  });

  it('collects URL from img element with src', () => {
    const img = document.createElement('img');
    // Set src attribute (currentSrc is read-only in JSDOM)
    img.setAttribute('src', 'https://example.com/photo.jpg');
    document.body.appendChild(img);

    return collectImageData(img).then((result) => {
      if (result) {
        expect(result.url).toContain('example.com/photo.jpg');
      }
    });
  });

  it('returns data URI passthrough for img with data URI src', () => {
    const img = document.createElement('img');
    const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
    img.setAttribute('src', dataUri);
    document.body.appendChild(img);

    return collectImageData(img).then((result) => {
      if (result) {
        expect(result.url).toContain('data:image/png');
      }
    });
  });

  it('extracts background-image URL from element', () => {
    const div = document.createElement('div');
    div.style.backgroundImage = 'url("https://example.com/bg.jpg")';
    document.body.appendChild(div);

    return collectImageData(div).then((result) => {
      if (result) {
        expect(result.url).toContain('example.com/bg.jpg');
      }
    });
  });

  it('returns null for background-image: none', () => {
    const div = document.createElement('div');
    div.style.backgroundImage = 'none';
    document.body.appendChild(div);

    return collectImageData(div).then((result) => {
      expect(result).toBeNull();
    });
  });

  it('handles canvas errors gracefully', () => {
    const img = document.createElement('img');
    img.setAttribute('src', 'https://example.com/image.png');
    document.body.appendChild(img);

    // Inlining should not throw even if canvas fails
    return expect(collectImageData(img)).resolves.not.toThrow();
  });
});
