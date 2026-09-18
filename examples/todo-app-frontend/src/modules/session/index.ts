/**
 * The one place the session token is stored. A read that finds no token, or one the backend has already
 * expired, is indistinguishable from "signed out" at this layer - the task list hook turns that into its
 * refused state rather than treating it as a rendering-time crash.
 */
const STORAGE_KEY = 'todo-app.session-token';

type Listener = () => void;

const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) listener();
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, token);
  notify();
}

export function clearToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
  notify();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
