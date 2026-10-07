import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const runtimeEntry = (root) => path.join(root, 'scripts', 'cli', 'main.mjs');
const embeddedRuntimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const usableRoot = (candidate, exists) => {
  if (!candidate || typeof candidate !== 'string') return null;
  const root = path.resolve(candidate);
  return exists(runtimeEntry(root)) ? root : null;
};

/**
 * Locate the runtime in the binding order: env, per-user record, upward .claude, embedded checkout.
 * A source that is set but unusable (a stale record, a bad env root) never throws: it falls through to the next source
 * and is described in `skipped` (when given) so the caller can say why the lookup came up empty.
 */
export function locateRuntime({ cwd = process.cwd(), env = process.env, home = os.homedir(), exists = existsSync, read = readFileSync,
  embeddedRoot = embeddedRuntimeRoot, skipped = [] } = {}) {
  const fromEnv = usableRoot(env.STARCI_RUNTIME, exists);
  if (fromEnv) return { root: fromEnv, source: 'STARCI_RUNTIME' };
  if (env.STARCI_RUNTIME) skipped.push(`STARCI_RUNTIME "${env.STARCI_RUNTIME}" has no scripts/cli/main.mjs`);

  const record = path.join(home, '.starci', 'runtime.json');
  if (exists(record)) {
    let recorded;
    let readable = true;
    try {
      recorded = JSON.parse(read(record, 'utf8'))?.root;
    } catch {
      readable = false;
      skipped.push(`${record} is not valid JSON`);
    }
    const root = usableRoot(recorded, exists);
    if (root) return { root, source: record };
    if (readable) skipped.push(`${record} points at ${JSON.stringify(recorded ?? null)}, which has no scripts/cli/main.mjs (stale record)`);
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

/** The runtime root of the checkout this CLI file lives in, or null when that checkout is not a runtime root (a published install). */
export const ownRuntimeRoot = ({ exists = existsSync, embeddedRoot = embeddedRuntimeRoot } = {}) => usableRoot(embeddedRoot, exists);

/**
 * The one stderr line naming a located runtime that is not the checkout the CLI runs from, or null when they are the same
 * or the CLI lives outside a runtime. The record and STARCI_RUNTIME outrank the checkout, so the mismatch is said, never silent.
 */
export function foreignRuntimeNotice(located, own) {
  if (!located || !own) return null;
  const same = process.platform === 'win32' ? located.root.toLowerCase() === own.toLowerCase() : located.root === own;
  return same ? null : `starci: running the runtime at ${located.root} (${located.source}), not this checkout's ${own}; set STARCI_RUNTIME=${own} to use the checkout\n`;
}

export const runtimeEntryOf = runtimeEntry;
