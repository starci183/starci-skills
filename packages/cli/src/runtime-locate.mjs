import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeEntry = (root) => path.join(root, 'scripts', 'cli', 'main.mjs');
const embeddedRuntimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const usableRoot = (candidate, exists) => {
  if (!candidate) return null;
  const root = path.resolve(String(candidate));
  return exists(runtimeEntry(root)) ? root : null;
};

/** Locate the runtime in the binding order: env, per-user record, upward .claude. */
export function locateRuntime({ cwd = process.cwd(), env = process.env, home = os.homedir(), exists = existsSync, read = readFileSync,
  embeddedRoot = embeddedRuntimeRoot } = {}) {
  const fromEnv = usableRoot(env.STARCI_RUNTIME, exists);
  if (fromEnv) return { root: fromEnv, source: 'STARCI_RUNTIME' };

  const record = path.join(home, '.starci', 'runtime.json');
  if (exists(record)) {
    try {
      const root = usableRoot(JSON.parse(read(record, 'utf8')).root, exists);
      if (root) return { root, source: record };
    } catch {
      // A stale/corrupt per-user record is not authority; continue to the local tree.
    }
  }

  let directory = path.resolve(cwd);
  for (;;) {
    const root = usableRoot(path.join(directory, '.claude'), exists);
    if (root) return { root, source: 'upward' };
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  const embedded = usableRoot(embeddedRoot, exists);
  if (embedded) return { root: embedded, source: 'embedded' };
  return null;
}

export const runtimeEntryOf = runtimeEntry;
