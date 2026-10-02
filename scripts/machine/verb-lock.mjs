// The RIGHTS lane's host lock is the real lock; this helper is the only door verbs use so that API can change once.
import fs from 'node:fs';

const siblingHostLock = new URL('./host-lock.mjs', import.meta.url);

const wrapLockResult = (result) => {
  if (result?.ok === false && result.reason === 'held') return result;
  return { ok: true, locked: true, value: result };
};

/** Run one verb operation under the host lock when the RIGHTS implementation is available. */
export async function underHostLock({ role, purpose, env }, fn, deps = {}) {
  void env;
  if (deps.withHostLock) return wrapLockResult(await deps.withHostLock({ role, purpose }, fn));

  const hostLockUrl = deps.hostLockUrl ?? siblingHostLock;
  const existsSync = deps.existsSync ?? fs.existsSync;
  if (existsSync(hostLockUrl)) {
    const loaded = await (deps.importModule ?? ((specifier) => import(specifier)))(hostLockUrl.href);
    return wrapLockResult(await loaded.withHostLock({ role, purpose }, fn));
  }

  return { ok: true, locked: false, value: await fn() };
}
