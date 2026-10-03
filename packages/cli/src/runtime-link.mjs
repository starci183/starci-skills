import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
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

const hookLines = (result) => result?.ok
  ? result.hooks.map((hook) => `git hook ${hook.name}: ${hook.state} ${hook.path}`)
  : [`git hooks: ${result?.reason ?? 'not installed'}`];

const gitHookInstaller = async (root) => {
  const module = await import(pathToFileURL(path.join(root, 'scripts', 'guards', 'git-hooks.mjs')).href);
  if (typeof module.installGitHooks !== 'function') throw new Error('scripts/guards/git-hooks.mjs does not export installGitHooks');
  return module.installGitHooks;
};

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
export async function linkRuntime({ cwd = process.cwd(), home = os.homedir(), root = null, json = false, quiet = false,
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
    const installGitHooks = deps.installGitHooks ?? await gitHookInstaller(runtimeRoot);
    const hooks = await installGitHooks({ root: runtimeRoot });
    if (json) writeTo(stdout, `${JSON.stringify(result)}\n`);
    else if (!quiet) writeTo(stdout, `${[result.runtimeJson, result.shim, ...hookLines(hooks)].join('\n')}\n`);
    return 0;
  } catch (error) {
    writeTo(stderr, `starci: cannot link runtime: ${error?.message ?? error}\n`);
    return 1;
  }
}
