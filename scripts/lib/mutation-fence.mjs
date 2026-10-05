// mutation-fence.mjs — ephemeral admission carried through awaited work, never a state store.
import { AsyncLocalStorage } from 'node:async_hooks';
const scope = new AsyncLocalStorage();

/** Run one admitted call; the checker is synchronous and reads its existing durable owners again. */
export const withMutationFence = (check, authority, fn) => scope.run({ check, authority, checking: false }, fn);
/** Recheck after the actual transaction lock or immediately before a native effect. */
export function assertMutationFence(boundary) {
  const current = scope.getStore();
  if (!current || current.checking) return;
  current.checking = true;
  try { current.check(boundary); } finally { current.checking = false; }
}
/** Identity stamped by existing write owners, never accepted from a command argument. */
export const mutationAuthority = () => scope.getStore()?.authority ?? null;
