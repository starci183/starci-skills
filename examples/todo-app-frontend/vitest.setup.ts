import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

/*
 * THE BROWSER'S OWN STORAGE, reachable.
 *
 * vitest's jsdom environment copies the window's properties onto the global object it hands the
 * test, and jsdom's Storage is an exotic object whose API lives on its prototype and whose own
 * properties are the stored items. Copying it that way leaves a plain, empty object behind:
 * `window.localStorage` answers with something that has no getItem/setItem, and
 * `document.defaultView === window`, so the real window is not reachable from the other side
 * either. Every session-gated screen in this app stores its token there
 * (`modules/session`), which is the boundary the journey specs refuse to fake - so the setup
 * supplies a working storage instead, and the specs seed a session exactly the way a completed
 * sign-in does.
 *
 * It is installed only while the host's own storage is unusable, so a future vitest or jsdom that
 * hands out a real Storage silently makes this a no-op.
 */
const installReachableStorage = () => {
  if (typeof window === 'undefined') return;
  if (typeof window.localStorage?.setItem === 'function') return;

  const entries = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return entries.size;
    },
    key: (index: number) => Array.from(entries.keys())[index] ?? null,
    getItem: (key: string) => (entries.has(key) ? (entries.get(key) as string) : null),
    setItem: (key: string, value: string) => {
      entries.set(key, String(value));
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
    clear: () => {
      entries.clear();
    },
  };

  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
};

installReachableStorage();

beforeEach(() => {
  // One reader's session never carries into the next spec's first render.
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});
