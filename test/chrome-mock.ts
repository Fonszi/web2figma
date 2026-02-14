/**
 * Chrome Extension API mock for testing.
 *
 * Mocks the global `chrome` object used by extension code.
 * Call `setupChromeMock()` in beforeEach to reset state between tests.
 */

type MessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void,
) => boolean | void;

export interface ChromeMockStore {
  sentMessages: Array<{ tabId: number; message: unknown }>;
  storedData: Record<string, unknown>;
  injectedScripts: Array<{ target: { tabId: number }; files?: string[]; func?: unknown }>;
  messageListeners: MessageListener[];
  postedMessages: unknown[];
}

export const chromeMockStore: ChromeMockStore = {
  sentMessages: [],
  storedData: {},
  injectedScripts: [],
  messageListeners: [],
  postedMessages: [],
};

function resetStore(): void {
  chromeMockStore.sentMessages = [];
  chromeMockStore.storedData = {};
  chromeMockStore.injectedScripts = [];
  chromeMockStore.messageListeners = [];
  chromeMockStore.postedMessages = [];
}

const DEFAULT_TAB = { id: 1, url: 'https://example.com', title: 'Example' };

export function setupChromeMock(activeTab = DEFAULT_TAB): void {
  resetStore();

  const chromeMock = {
    runtime: {
      onMessage: {
        addListener: vi.fn((listener: MessageListener) => {
          chromeMockStore.messageListeners.push(listener);
        }),
        removeListener: vi.fn((listener: MessageListener) => {
          const idx = chromeMockStore.messageListeners.indexOf(listener);
          if (idx >= 0) chromeMockStore.messageListeners.splice(idx, 1);
        }),
      },
      sendMessage: vi.fn(async (message: unknown) => {
        chromeMockStore.postedMessages.push(message);
      }),
      lastError: null as unknown,
    },

    tabs: {
      query: vi.fn(async () => [activeTab]),
      sendMessage: vi.fn(async (tabId: number, message: unknown) => {
        chromeMockStore.sentMessages.push({ tabId, message });
        return undefined;
      }),
    },

    storage: {
      local: {
        set: vi.fn(async (data: Record<string, unknown>) => {
          Object.assign(chromeMockStore.storedData, data);
        }),
        get: vi.fn(async (keys: string | string[]) => {
          const keyArr = typeof keys === 'string' ? [keys] : keys;
          const result: Record<string, unknown> = {};
          for (const k of keyArr) {
            if (k in chromeMockStore.storedData) {
              result[k] = chromeMockStore.storedData[k];
            }
          }
          return result;
        }),
      },
    },

    scripting: {
      executeScript: vi.fn(async (injection: { target: { tabId: number }; files?: string[]; func?: unknown }) => {
        chromeMockStore.injectedScripts.push(injection);
        return [{ result: undefined }];
      }),
    },
  };

  (globalThis as Record<string, unknown>).chrome = chromeMock;
}

export function teardownChromeMock(): void {
  resetStore();
  delete (globalThis as Record<string, unknown>).chrome;
}

/**
 * Simulate sending a message to registered chrome.runtime.onMessage listeners.
 * Returns the result of the first listener that handles it.
 */
export function simulateMessage(message: unknown, sender: unknown = {}): Promise<unknown> {
  return new Promise((resolve) => {
    const sendResponse = (response?: unknown) => resolve(response);
    for (const listener of chromeMockStore.messageListeners) {
      const result = listener(message, sender, sendResponse);
      if (result === true) return; // async response expected
    }
    resolve(undefined);
  });
}
