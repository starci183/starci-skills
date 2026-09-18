import { useSyncExternalStore } from 'react';
import { getToken, subscribe } from '@/modules/session';

/** The reactive read of the current session token; null means signed out (or a session already gone). */
export function useSessionToken(): string | null {
  return useSyncExternalStore(subscribe, getToken, () => null);
}
