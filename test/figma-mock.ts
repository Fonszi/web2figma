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

interface PluginDataMixin {
  pluginData: Record<string, string>;
  setPluginData: ReturnType<typeof vi.fn>;
  getPluginData: ReturnType<typeof vi.fn>;
}

function withPluginData(): PluginDataMixin {
  const data: Record<string, string> = {};
  return {
    pluginData: data,
    setPluginData: vi.fn((key: string, value: string) => { data[key] = value; }),
    getPluginData: vi.fn((key: string) => data[key] ?? ''),
  };
}

export interface MockFrameNode extends PluginDataMixin {
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
  remove: ReturnType<typeof vi.fn>;
}

export interface MockTextNode extends PluginDataMixin {
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
  remove: ReturnType<typeof vi.fn>;
}

export interface MockRectangleNode extends PluginDataMixin {
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
  remove: ReturnType<typeof vi.fn>;
}

export interface MockComponentNode extends PluginDataMixin {
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
  remove: ReturnType<typeof vi.fn>;
}

export interface MockInstanceNode {
  id: string;
  type: 'INSTANCE';
  name: string;
  width: number;
  height: number;
  resize: ReturnType<typeof vi.fn>;
}

export interface MockSectionNode {
  id: string;
  type: 'SECTION';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  appendChild: ReturnType<typeof vi.fn>;
  resizeSansConstraints: ReturnType<typeof vi.fn>;
  children: unknown[];
}

export interface MockComponentSetNode {
  id: string;
  type: 'COMPONENT_SET';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  children: MockComponentNode[];
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
  sections: [] as MockSectionNode[],
  componentSets: [] as MockComponentSetNode[],
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
    remove: vi.fn(),
    ...withPluginData(),
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
    remove: vi.fn(),
    ...withPluginData(),
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
    remove: vi.fn(),
    ...withPluginData(),
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
    remove: vi.fn(),
    ...withPluginData(),
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
  mockStore.sections = [];
  mockStore.componentSets = [];

  const figmaMock = {
    createFrame: vi.fn(() => createMockFrame()),

    createText: vi.fn(() => createMockTextNode()),

    createRectangle: vi.fn(() => createMockRectangle()),

    createComponent: vi.fn(() => createMockComponent()),

    createSection: vi.fn(() => {
      const section: MockSectionNode = {
        id: nextId(),
        type: 'SECTION',
        name: '',
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        appendChild: vi.fn(),
        resizeSansConstraints: vi.fn(function (this: MockSectionNode, w: number, h: number) {
          this.width = w;
          this.height = h;
        }),
        children: [],
      };
      mockStore.sections.push(section);
      return section;
    }),

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

    combineAsVariants: vi.fn((components: MockComponentNode[], _parent: unknown) => {
      const componentSet: MockComponentSetNode = {
        id: nextId(),
        type: 'COMPONENT_SET',
        name: '',
        x: 0,
        y: 0,
        width: Math.max(...components.map((c) => c.width), 0),
        height: components.reduce((sum, c) => sum + c.height, 0),
        children: components,
      };
      mockStore.componentSets.push(componentSet);
      return componentSet;
    }),

    viewport: {
      center: { x: 0, y: 0 },
      scrollAndZoomIntoView: vi.fn(),
    },

    getNodeById: vi.fn((id: string) => {
      const allNodes = [
        ...mockStore.frames,
        ...mockStore.textNodes,
        ...mockStore.rectangles,
        ...mockStore.components,
        ...mockStore.instances,
        ...mockStore.sections,
      ];
      return allNodes.find((n) => n.id === id) ?? null;
    }),

    currentPage: {
      selection: [] as unknown[],
      children: [] as unknown[],
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
