// repo-root-guard.mjs - the node --test preload (loaded by isolated-temp.mjs, so by every preload list) that fails a spec process leaving files in the repository.
//
// A spec builds its fixtures under the OS temp root (isolated-temp.mjs gives every spec its own). One that writes into the checkout itself - the boot proof spec
// put its fixtures in <repo>/.tmp-docs to resolve @nestjs/common - leaves a tree the next check judges (HFS_EMPTY_DIR), and nothing says which spec did it.
// This guard watches the writes the spec process makes (fs sync, callback and promise forms, plus createWriteStream) and records the FIRST missing
// ancestor each creates inside the repository root (a directory a mkdir -p makes, or the file itself). When the process exits, every recorded path that
// still exists is a leak: the spec is named by its process, the leftovers are listed, and the process exits nonzero, which fails that spec file.
// Writes the spec cleans up in its own after hooks pass. Writes to an existing path (a file a spec overwrites) are not recorded, and nothing here deletes a leftover.
// DECLARED_AREAS are the repository's own tmp and generated areas (the git-ignored roots of .gitignore): a spec may leave files there.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { syncBuiltinESMExports } from 'node:module';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** The repository-relative path patterns (posix) where a leftover is not a leak. */
export const DECLARED_AREAS = Object.freeze([
  /(^|\/)\.git(\/|$)/, /(^|\/)node_modules(\/|$)/, /(^|\/)coverage(\/|$)/, /(^|\/)__pycache__(\/|$)/, /(^|\/)storybook-static(\/|$)/,
  /^\.runtime(\/|$)/, /^\.turbo(\/|$)/, /^\.starciwork(\/|$)/, /^\.starci-wk-spec-/, /^\.tmp-hfs-fe-build-/, /^\.dist/, /^dist(\/|$)/,
  /^ex-testing(\/|$)/, /^\.secrets(\/|$)/, /^ui\/fixtures\/seed(\/|$)/, /^ui\/src\/i18n\/generated(\/|$)/,
  /^packages\/(hfs|eslint\/be|eslint\/fe)\/runtime(\/|$)/,
]);

/** The path as text, or null for a file descriptor or anything else that is not a path. */
function textOf(value) {
  if (typeof value === 'string') return value;
  if (value instanceof URL) return fileURLToPath(value);
  return Buffer.isBuffer(value) ? value.toString() : null;
}

/** The repository-relative posix path of `target`, or null outside the repository. */
export function relativeIn(root, target) {
  const rel = path.relative(root, path.resolve(root, target));
  return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel.split(path.sep).join('/') : null;
}

export const isDeclared = (rel) => DECLARED_AREAS.some((area) => area.test(rel));

/** The first missing ancestor of `target` (the path a write creates first), looking at disk through `exists`. */
export function firstMissing(target, exists) {
  let missing = null;
  for (let at = path.resolve(target); !exists(at); at = path.dirname(at)) {
    missing = at;
    if (path.dirname(at) === at) break;
  }
  return missing;
}

/** The recorded paths still on disk, outermost only, and the declared areas left out: the leaks. */
export function leaksOf(root, recorded, exists) {
  const rels = [...recorded].map((abs) => relativeIn(root, abs)).filter((rel) => rel && !isDeclared(rel) && exists(path.join(root, rel))).sort();
  return rels.filter((rel, index) => !rels.slice(0, index).some((outer) => rel.startsWith(`${outer}/`)));
}

// [function name, index of the argument that names what is created]. copy, rename and symlink create their second argument.
const WRITERS = [['writeFile', 0], ['appendFile', 0], ['mkdir', 0], ['copyFile', 1], ['cp', 1], ['rename', 1], ['symlink', 1], ['createWriteStream', 0]];
const MKDTEMP = 'mkdtemp';

/**
 * Wrap the writers of `target` (the fs module or fs.promises) so each records what it creates inside `root`. `exists` is the real existence test; `record` receives absolute paths.
 * forms: the name suffixes to wrap ('Sync' for the sync API, '' for the callback API and fs.promises); promise: `target` is fs.promises, whose mkdtemp answers a Promise.
 * Returns the restore function.
 */
export function watchWrites(target, { root, exists, record, forms, promise = false }) {
  const saved = [];
  const wrap = (name, make) => { const original = target[name]; if (typeof original !== 'function') return; saved.push([name, original]); target[name] = make(original); };
  const note = (value) => {
    try {
      const text = textOf(value);
      if (text === null || !relativeIn(root, text)) return;
      const first = firstMissing(path.resolve(text), exists);
      if (first && relativeIn(root, first)) record(first);
    } catch { /* an argument the real call rejects too */ }
  };
  for (const [name, index] of WRITERS) {
    for (const form of forms) wrap(`${name}${form}`, (original) => function watched(...args) { note(args[index]); return original.apply(this, args); });
  }
  const made = (created) => { if (typeof created === 'string' && relativeIn(root, created)) record(created); return created; };
  if (forms.includes('Sync')) wrap(`${MKDTEMP}Sync`, (original) => function watched(...args) { return made(original.apply(this, args)); });
  if (promise) wrap(MKDTEMP, (original) => function watched(...args) { return Promise.resolve(original.apply(this, args)).then(made); });
  return () => { for (const [name, original] of saved) target[name] = original; };
}

const installed = Symbol.for('starci.repo-root-guard');
if (!globalThis[installed]) {
  globalThis[installed] = true;
  const recorded = new Set();
  const exists = (file) => fs.existsSync(file);
  const record = (abs) => recorded.add(abs);
  // fs: the sync forms, the callback forms (named without a suffix; createWriteStream has none), the stream; fs.promises: the callback-free forms.
  watchWrites(fs, { root: REPO_ROOT, exists, record, forms: ['Sync'] });
  watchWrites(fs, { root: REPO_ROOT, exists, record, forms: [''] });
  watchWrites(fs.promises, { root: REPO_ROOT, exists, record, forms: [''], promise: true });
  syncBuiltinESMExports();
  process.on('exit', (code) => {
    const left = leaksOf(REPO_ROOT, recorded, exists);
    if (!left.length) return;
    try {
      process.stderr.write(`\nSTARCI REPO ROOT LEAK: ${left.length} path${left.length === 1 ? '' : 's'} left in the repository by this spec process (a spec builds its fixtures under os.tmpdir() and removes them in t.after; a fixture that must live under the repo root removes its own directory, parent included):\n  ${left.join('\n  ')}\n`);
    } catch { /* stderr already closed */ }
    process.exitCode = code || 1;
  });
}
