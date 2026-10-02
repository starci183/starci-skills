import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { writeRuntimeShim } from './shim.mjs';

export const RUNTIME_ROOT_FILES = Object.freeze([
  path.join('scripts', 'cli', 'main.mjs'),
  path.join('packages', 'cli', 'bin', 'starci.mjs'),
]);

const writeTo = (target, text) => {
  if (typeof target === 'function') target(text);
  else target.write(text);
};

const missingAt = (root, exists) => RUNTIME_ROOT_FILES.filter((relative) => !exists(path.join(root, relative)));

/** Find the nearest checkout or installed .claude runtime at or above cwd. */
export function findRuntimeRoot({ cwd = process.cwd(), exists = existsSync } = {}) {
  let directory = path.resolve(cwd);
  for (;;) {
    for (const candidate of [directory, path.join(directory, '.claude')]) {
      if (missingAt(candidate, exists).length === 0) return candidate;
    }
    const parent = path.dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
}

/** Point the per-user StarCi launcher at a live runtime checkout. */
export function linkRuntime({ cwd = process.cwd(), home = os.homedir(), root = null, json = false, quiet = false,
  stdout = process.stdout, stderr = process.stderr } = {}, deps = {}) {
  const exists = deps.exists ?? existsSync;
  const requested = root == null ? null : path.resolve(cwd, root);
  const runtimeRoot = requested ?? findRuntimeRoot({ cwd, exists });
  if (!runtimeRoot) {
    writeTo(stderr, `starci: no StarCi runtime root found upward from "${path.resolve(cwd)}"; missing ${RUNTIME_ROOT_FILES.join(', ')}\n`);
    return 2;
  }

  const missing = missingAt(runtimeRoot, exists);
  if (missing.length) {
    writeTo(stderr, `starci: "${runtimeRoot}" is not a StarCi runtime root; missing ${missing.join(', ')}\n`);
    return 2;
  }

  try {
    const result = writeRuntimeShim({ root: runtimeRoot, home }, deps);
    if (json) writeTo(stdout, `${JSON.stringify(result)}\n`);
    else if (!quiet) writeTo(stdout, `${result.runtimeJson}\n${result.shim}\n`);
    return 0;
  } catch (error) {
    writeTo(stderr, `starci: cannot link runtime: ${error?.message ?? error}\n`);
    return 1;
  }
}
