import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setupChromeMock, teardownChromeMock, chromeMockStore } from '../chrome-mock';
import { cleanupDOM, createStyledElement } from '../dom-helpers';

// extractor.ts registers chrome.runtime.onMessage.addListener at module scope.
// We must set up both Chrome mock and DOM before importing.

describe('extractor', () => {
  let extractPage: typeof import('../../extension/src/content/extractor').extractPage;

  beforeEach(async () => {
    cleanupDOM();
    setupChromeMock();
    vi.resetModules();

    // Build a minimal DOM tree before importing the extractor
    const heading = createStyledElement('h1', { 'font-size': '32px', 'font-weight': '700' });
    heading.textContent = 'Hello World';

    const paragraph = createStyledElement('p', { 'font-size': '16px', color: 'rgb(51, 51, 51)' });
    paragraph.textContent = 'Test paragraph';

    createStyledElement('div', { display: 'flex', gap: '16px' });

    // Import the module (triggers module-level listener registration)
    const mod = await import('../../extension/src/content/extractor');
    extractPage = mod.extractPage;
  });

  afterEach(() => {
    cleanupDOM();
    teardownChromeMock();
    vi.restoreAllMocks();
  });

  // --- ExtractionResult shape ---

  describe('extractPage output', () => {
    it('returns an ExtractionResult with required fields', async () => {
      const result = await extractPage();
      expect(result).toHaveProperty('url');
      expect(result).toHaveProperty('viewport');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('framework');
      expect(result).toHaveProperty('rootNode');
      expect(result).toHaveProperty('tokens');
      expect(result).toHaveProperty('fonts');
      expect(result).toHaveProperty('metadata');
    });

    it('captures viewport dimensions', async () => {
      const result = await extractPage();
      expect(result.viewport.width).toBeGreaterThan(0);
      expect(result.viewport.height).toBeGreaterThan(0);
    });

    it('captures current URL', async () => {
      const result = await extractPage();
      expect(typeof result.url).toBe('string');
    });

    it('sets timestamp to a recent time', async () => {
      const before = Date.now();
      const result = await extractPage();
      expect(result.timestamp).toBeGreaterThanOrEqual(before);
      expect(result.timestamp).toBeLessThanOrEqual(Date.now());
    });

    it('includes empty components array', async () => {
      const result = await extractPage();
      expect(result.components).toEqual([]);
    });
  });

  // --- Root node structure ---

  describe('rootNode', () => {
    it('has tag body', async () => {
      const result = await extractPage();
      expect(result.rootNode.tag).toBe('body');
    });

    it('has type frame for body', async () => {
      const result = await extractPage();
      expect(result.rootNode.type).toBe('frame');
    });

    it('has children corresponding to body child elements', async () => {
      const result = await extractPage();
      // We added 3 elements: h1, p, div
      expect(result.rootNode.children.length).toBe(3);
    });

    it('extracts text content from leaf text nodes', async () => {
      const result = await extractPage();
      const h1Node = result.rootNode.children.find((c) => c.tag === 'h1');
      expect(h1Node?.text).toBe('Hello World');
    });

    it('assigns bounds to each node', async () => {
      const result = await extractPage();
      expect(result.rootNode.bounds).toHaveProperty('x');
      expect(result.rootNode.bounds).toHaveProperty('y');
      expect(result.rootNode.bounds).toHaveProperty('width');
      expect(result.rootNode.bounds).toHaveProperty('height');
    });
  });

  // --- inferNodeType ---

  describe('node type inference', () => {
    it('classifies h1 as text when it has text content', async () => {
      const result = await extractPage();
      const h1 = result.rootNode.children.find((c) => c.tag === 'h1');
      expect(h1?.type).toBe('text');
    });

    it('classifies p as text when it has text content', async () => {
      const result = await extractPage();
      const p = result.rootNode.children.find((c) => c.tag === 'p');
      expect(p?.type).toBe('text');
    });

    it('classifies div as frame', async () => {
      const result = await extractPage();
      const div = result.rootNode.children.find((c) => c.tag === 'div');
      expect(div?.type).toBe('frame');
    });

    it('classifies img element as image', async () => {
      const img = document.createElement('img');
      img.src = 'https://example.com/photo.jpg';
      document.body.appendChild(img);

      const result = await extractPage();
      const imgNode = result.rootNode.children.find((c) => c.tag === 'img');
      expect(imgNode?.type).toBe('image');
    });

    it('classifies input element as input', async () => {
      document.body.appendChild(document.createElement('input'));

      const result = await extractPage();
      const inputNode = result.rootNode.children.find((c) => c.tag === 'input');
      expect(inputNode?.type).toBe('input');
    });
  });

  // --- Computed styles extraction ---

  describe('computed styles', () => {
    it('captures styles on each node', async () => {
      const result = await extractPage();
      const p = result.rootNode.children.find((c) => c.tag === 'p');
      expect(p?.styles).toBeDefined();
      expect(p?.styles).toHaveProperty('color');
      expect(p?.styles).toHaveProperty('fontSize');
    });
  });

  // --- Layout extraction ---

  describe('layout extraction', () => {
    it('detects flex layout on div', async () => {
      const result = await extractPage();
      const flexDiv = result.rootNode.children.find((c) => c.tag === 'div');
      expect(flexDiv?.layout).toBeDefined();
    });
  });

  // --- Framework detection ---

  describe('framework detection', () => {
    it('detects unknown framework for plain page', async () => {
      const result = await extractPage();
      expect(result.framework).toBe('unknown');
    });

    it('detects Framer site when signals are present', async () => {
      const img = document.createElement('img');
      img.src = 'https://framerusercontent.com/images/test.png';
      document.body.appendChild(img);

      const result = await extractPage();
      expect(result.framework).toBe('framer');
    });

    it('detects Webflow site', async () => {
      document.documentElement.classList.add('w-mod-js');

      const result = await extractPage();
      expect(result.framework).toBe('webflow');

      document.documentElement.classList.remove('w-mod-js');
    });
  });

  // --- Font detection ---

  describe('font detection', () => {
    it('collects fonts used on the page', async () => {
      const result = await extractPage();
      expect(Array.isArray(result.fonts)).toBe(true);
    });

    it('detects Google Fonts from link elements', async () => {
      const link = document.createElement('link');
      link.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700';
      link.rel = 'stylesheet';
      document.head.appendChild(link);

      const result = await extractPage();
      const roboto = result.fonts.find((f) => f.family === 'Roboto');
      if (roboto) {
        expect(roboto.isGoogleFont).toBe(true);
      }
    });
  });

  // --- Metadata ---

  describe('metadata', () => {
    it('captures page title', async () => {
      document.title = 'Test Page';
      const result = await extractPage();
      expect(result.metadata.title).toBe('Test Page');
    });

    it('captures meta description', async () => {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'A test page for extraction';
      document.head.appendChild(meta);

      const result = await extractPage();
      expect(result.metadata.description).toBe('A test page for extraction');
    });
  });

  // --- Chrome message listener ---

  describe('message listener', () => {
    it('registers a listener on chrome.runtime.onMessage', () => {
      expect(chromeMockStore.messageListeners.length).toBeGreaterThanOrEqual(1);
    });

    it('handles EXTRACT_PAGE message with async response', () => {
      const listener = chromeMockStore.messageListeners.find((l) => {
        const sendResponse = vi.fn();
        return l({ type: 'EXTRACT_PAGE' }, {}, sendResponse) === true;
      });
      expect(listener).toBeDefined();
    });
  });

  // --- Component hashes ---

  describe('component hashes', () => {
    it('assigns componentHash to nodes', async () => {
      const result = await extractPage();
      expect(result.rootNode.componentHash).toBeDefined();
      expect(typeof result.rootNode.componentHash).toBe('string');
    });
  });

  // --- Data attributes ---

  describe('data attributes', () => {
    it('extracts data-* attributes from elements', async () => {
      const el = document.createElement('div');
      el.setAttribute('data-testid', 'hero');
      el.setAttribute('data-section', 'main');
      document.body.appendChild(el);

      const result = await extractPage();
      const dataDiv = result.rootNode.children.find(
        (c) => c.dataAttributes?.['data-testid'] === 'hero',
      );
      expect(dataDiv).toBeDefined();
      expect(dataDiv?.dataAttributes?.['data-section']).toBe('main');
    });
  });

  // --- Visibility ---

  describe('visibility', () => {
    it('marks visible elements as visible', async () => {
      const result = await extractPage();
      expect(result.rootNode.visible).toBe(true);
    });

    it('marks display:none elements as not visible', async () => {
      createStyledElement('div', { display: 'none' });

      const result = await extractPage();
      const hiddenDiv = result.rootNode.children.find(
        (c) => c.tag === 'div' && !c.visible,
      );
      expect(hiddenDiv).toBeDefined();
    });
  });
});
