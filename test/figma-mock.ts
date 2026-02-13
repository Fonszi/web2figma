/**
 * Figma Plugin API mock for testing.
 *
 * Mocks the global `figma` object used by plugin sandbox code.
 * Call `setupFigmaMock()` in beforeEach to reset state between tests.
 */

let idCounter = 0;

function nextId(): string {
  return `mock-id-${++idCounter}`;
}

export interface MockPaintStyle {
  id: string;
  name: string;
  paints: unknown[];
}

export interface MockTextStyle {
  id: string;
  name: string;
  fontName: unknown;
  fontSize: number;
  lineHeight: unknown;
  letterSpacing: unknown;
}

export interface MockEffectStyle {
  id: string;
  name: string;
  effects: unknown[];
}

export interface MockVariable {
  id: string;
  name: string;
  setValueForMode: ReturnType<typeof vi.fn>;
}

export interface MockVariableCollection {
  id: string;
  name: string;
  modes: { modeId: string }[];
}

export interface MockFrameNode {
  id: string;
  type: 'FRAME';
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  fills: unknown[];
  strokes: unknown[];
  effects: unknown[];
  opacity: number;
  clipsContent: boolean;
  strokeWeight: number;
  dashPattern: number[];
  layoutMode: string;
  itemSpacing: number;
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  primaryAxisAlignItems: string;
  counterAxisAlignItems: string;
  primaryAxisSizingMode: string;
  counterAxisSizingMode: string;
  layoutWrap: string;
  topLeftRadius: number;
  topRightRadius: number;
  bottomRightRadius: number;
  bottomLeftRadius: number;
  fillStyleId: string;
  effectStyleId: string;
  resize: ReturnType<typeof vi.fn>;
  appendChild: ReturnType<typeof vi.fn>;
  children: unknown[];
}

export interface MockTextNode {
  id: string;
  type: 'TEXT';
  name: string;
  characters: string;
  fontName: unknown;
  fontSize: number;
  letterSpacing: unknown;
  lineHeight: unknown;
  textAlignHorizontal: string;
  textDecoration: string;
  textAutoResize: string;
  fills: unknown[];
  fillStyleId: string;
  textStyleId: string;
  resize: ReturnType<typeof vi.fn>;
}

export interface MockRectangleNode {
  id: string;
  type: 'RECTANGLE';
  name: string;
  width: number;
  height: number;
  fills: unknown[];
  strokes: unknown[];
  strokeWeight: number;
  dashPattern: number[];
  resize: ReturnType<typeof vi.fn>;
}

export interface MockComponentNode {
  id: string;
  type: 'COMPONENT';
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  resize: ReturnType<typeof vi.fn>;
  appendChild: ReturnType<typeof vi.fn>;
  createInstance: ReturnType<typeof vi.fn>;
  children: unknown[];
}

export interface MockInstanceNode {
  id: string;
  type: 'INSTANCE';
  name: string;
  width: number;
  height: number;
  resize: ReturnType<typeof vi.fn>;
}

/** Stores all created mocks for assertions. */
export const mockStore = {
  paintStyles: [] as MockPaintStyle[],
  textStyles: [] as MockTextStyle[],
  effectStyles: [] as MockEffectStyle[],
  variables: [] as MockVariable[],
  variableCollections: [] as MockVariableCollection[],
  loadedFonts: [] as unknown[],
  frames: [] as MockFrameNode[],
  textNodes: [] as MockTextNode[],
  rectangles: [] as MockRectangleNode[],
  components: [] as MockComponentNode[],
  instances: [] as MockInstanceNode[],
};

function createMockFrame(): MockFrameNode {
  const frame: MockFrameNode = {
    id: nextId(),
    type: 'FRAME',
    name: '',
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    fills: [],
    strokes: [],
    effects: [],
    opacity: 1,
    clipsContent: false,
    strokeWeight: 0,
    dashPattern: [],
    layoutMode: 'NONE',
    itemSpacing: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'MIN',
    primaryAxisSizingMode: 'FIXED',
    counterAxisSizingMode: 'FIXED',
    layoutWrap: 'NO_WRAP',
    topLeftRadius: 0,
    topRightRadius: 0,
    bottomRightRadius: 0,
    bottomLeftRadius: 0,
    fillStyleId: '',
    effectStyleId: '',
    resize: vi.fn(function (this: MockFrameNode, w: number, h: number) {
      this.width = w;
      this.height = h;
    }),
    appendChild: vi.fn(),
    children: [],
  };
  mockStore.frames.push(frame);
  return frame;
}

function createMockTextNode(): MockTextNode {
  const text: MockTextNode = {
    id: nextId(),
    type: 'TEXT',
    name: '',
    characters: '',
    fontName: null,
    fontSize: 12,
    letterSpacing: undefined,
    lineHeight: undefined,
    textAlignHorizontal: 'LEFT',
    textDecoration: 'NONE',
    textAutoResize: 'NONE',
    fills: [],
    fillStyleId: '',
    textStyleId: '',
    resize: vi.fn(),
  };
  mockStore.textNodes.push(text);
  return text;
}

function createMockRectangle(): MockRectangleNode {
  const rect: MockRectangleNode = {
    id: nextId(),
    type: 'RECTANGLE',
    name: '',
    width: 0,
    height: 0,
    fills: [],
    strokes: [],
    strokeWeight: 0,
    dashPattern: [],
    resize: vi.fn(function (this: MockRectangleNode, w: number, h: number) {
      this.width = w;
      this.height = h;
    }),
  };
  mockStore.rectangles.push(rect);
  return rect;
}

function createMockComponent(): MockComponentNode {
  const component: MockComponentNode = {
    id: nextId(),
    type: 'COMPONENT',
    name: '',
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    resize: vi.fn(function (this: MockComponentNode, w: number, h: number) {
      this.width = w;
      this.height = h;
    }),
    appendChild: vi.fn(),
    createInstance: vi.fn(() => {
      const instance: MockInstanceNode = {
        id: nextId(),
        type: 'INSTANCE',
        name: '',
        width: 0,
        height: 0,
        resize: vi.fn(function (this: MockInstanceNode, w: number, h: number) {
          this.width = w;
          this.height = h;
        }),
      };
      mockStore.instances.push(instance);
      return instance;
    }),
    children: [],
  };
  mockStore.components.push(component);
  return component;
}

export function setupFigmaMock(): void {
  idCounter = 0;
  mockStore.paintStyles = [];
  mockStore.textStyles = [];
  mockStore.effectStyles = [];
  mockStore.variables = [];
  mockStore.variableCollections = [];
  mockStore.loadedFonts = [];
  mockStore.frames = [];
  mockStore.textNodes = [];
  mockStore.rectangles = [];
  mockStore.components = [];
  mockStore.instances = [];

  const figmaMock = {
    createFrame: vi.fn(() => createMockFrame()),

    createText: vi.fn(() => createMockTextNode()),

    createRectangle: vi.fn(() => createMockRectangle()),

    createComponent: vi.fn(() => createMockComponent()),

    createNodeFromSvg: vi.fn((svg: string) => {
      const frame = createMockFrame();
      frame.name = 'SVG';
      return frame;
    }),

    createImage: vi.fn((data: Uint8Array) => ({
      hash: `mock-image-hash-${nextId()}`,
    })),

    createPaintStyle: vi.fn(() => {
      const style: MockPaintStyle = { id: nextId(), name: '', paints: [] };
      mockStore.paintStyles.push(style);
      return style;
    }),

    createTextStyle: vi.fn(() => {
      const style: MockTextStyle = {
        id: nextId(),
        name: '',
        fontName: null,
        fontSize: 12,
        lineHeight: undefined,
        letterSpacing: undefined,
      };
      mockStore.textStyles.push(style);
      return style;
    }),

    createEffectStyle: vi.fn(() => {
      const style: MockEffectStyle = { id: nextId(), name: '', effects: [] };
      mockStore.effectStyles.push(style);
      return style;
    }),

    loadFontAsync: vi.fn(async (fontName: unknown) => {
      mockStore.loadedFonts.push(fontName);
    }),

    listAvailableFontsAsync: vi.fn(async () => [
      { fontName: { family: 'Inter', style: 'Regular' } },
      { fontName: { family: 'Inter', style: 'Bold' } },
      { fontName: { family: 'Inter', style: 'Medium' } },
      { fontName: { family: 'Roboto', style: 'Regular' } },
      { fontName: { family: 'Roboto', style: 'Bold' } },
    ]),

    variables: {
      createVariableCollection: vi.fn((name: string) => {
        const collection: MockVariableCollection = {
          id: nextId(),
          name,
          modes: [{ modeId: 'default-mode' }],
        };
        mockStore.variableCollections.push(collection);
        return collection;
      }),

      createVariable: vi.fn((_name: string, _collectionId: string, _resolveType: string) => {
        const variable: MockVariable = {
          id: nextId(),
          name: _name,
          setValueForMode: vi.fn(),
        };
        mockStore.variables.push(variable);
        return variable;
      }),
    },

    ui: {
      postMessage: vi.fn(),
    },
  };

  (globalThis as Record<string, unknown>).figma = figmaMock;
}

/** Tear down the figma mock. */
export function teardownFigmaMock(): void {
  delete (globalThis as Record<string, unknown>).figma;
}
