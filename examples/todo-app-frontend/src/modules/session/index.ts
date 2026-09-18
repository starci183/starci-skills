/**
 * The one place the session token is stored. A read that finds no token, or one the backend has already
 * expired, is indistinguishable from "signed out" at this layer - the task list hook turns that into its
 * refused state rather than treating it as a rendering-time crash.
 */
const STORAGE_KEY = 'todo-app.session-token';

type Listener = () => void;

const LISTENERS = new Set<Listener>();

const notify = () => {
  for (const listener of LISTENERS) listener();
};

/** The current session token, or null when signed out. */
export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
};

/** Stores a newly issued session token and notifies every subscriber. */
export const setToken = (token: string): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, token);
  notify();
};

/** Drops the session token and notifies every subscriber. */
export const clearToken = (): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
  notify();
};

/** Subscribes to session-token changes; call the returned function to unsubscribe. */
export const subscribe = (listener: Listener): (() => void) => {
  LISTENERS.add(listener);
  return () => LISTENERS.delete(listener);
};
