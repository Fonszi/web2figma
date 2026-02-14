/**
 * DOM test helpers — factory functions for creating styled elements and mock objects.
 *
 * Used by extension test files that run in jsdom environment.
 */

/**
 * Create a mock CSSStyleDeclaration with default values and optional overrides.
 * Useful for layout-analyzer.ts which takes CSSStyleDeclaration as an argument.
 */
export function mockCSSStyles(overrides: Record<string, string> = {}): CSSStyleDeclaration {
  const base: Record<string, string> = {
    display: 'block',
    position: 'static',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    flexGrow: '0',
    gap: '0px',
    rowGap: '0px',
    columnGap: '0px',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    alignSelf: 'auto',
    paddingTop: '0px',
    paddingRight: '0px',
    paddingBottom: '0px',
    paddingLeft: '0px',
    width: 'auto',
    height: 'auto',
    minWidth: '',
    maxWidth: '',
    color: '',
    backgroundColor: '',
    borderColor: '',
    borderWidth: '0px',
    borderStyle: 'none',
    borderRadius: '0px',
    borderTopLeftRadius: '0px',
    borderTopRightRadius: '0px',
    borderBottomRightRadius: '0px',
    borderBottomLeftRadius: '0px',
    fontFamily: 'Arial',
    fontSize: '16px',
    fontWeight: '400',
    fontStyle: 'normal',
    lineHeight: 'normal',
    letterSpacing: 'normal',
    textAlign: 'start',
    textDecoration: 'none',
    textTransform: 'none',
    boxShadow: 'none',
    opacity: '1',
    overflow: 'visible',
    backgroundImage: 'none',
    transform: 'none',
  };

  const merged = { ...base, ...overrides };

  // Make it behave like CSSStyleDeclaration (property access + getPropertyValue)
  const proxy = new Proxy(merged, {
    get(target, prop) {
      if (prop === 'getPropertyValue') {
        return (name: string) => target[name] ?? '';
      }
      if (prop === 'length') return Object.keys(target).length;
      if (typeof prop === 'string') return target[prop] ?? '';
      return undefined;
    },
  });

  return proxy as unknown as CSSStyleDeclaration;
}

/**
 * Create a DOM element with inline styles and append it to document.body.
 * Returns the element for further manipulation.
 */
export function createStyledElement(
  tag: string,
  styles: Record<string, string> = {},
  parent: Element = document.body,
): HTMLElement {
  const el = document.createElement(tag);
  for (const [prop, value] of Object.entries(styles)) {
    el.style.setProperty(prop, value);
  }
  parent.appendChild(el);
  return el;
}

/**
 * Create a minimal mock Element with basic properties.
 * For tests that only need tag and children access.
 */
export function mockElement(tag: string, children: Element[] = []): Element {
  const el = document.createElement(tag);
  for (const child of children) {
    el.appendChild(child);
  }
  return el;
}

/**
 * Clean up all children from document.body between tests.
 */
export function cleanupDOM(): void {
  document.body.innerHTML = '';
}
