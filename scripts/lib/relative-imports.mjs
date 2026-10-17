// relative-imports.mjs - how one runtime file names another: a relative import specifier resolved to a repository file (`resolveRelative`), and the
// runtime entries a file starts as a process by naming their path (`spawnedEntriesOf`). The import graph of scripts/supervisor/module-graph.mjs and
// the module index of scripts/lib/module-index.mjs read them. Pure: reads files, starts nothing.
import fs from 'node:fs';
import path from 'node:path';

const EXTENSIONS = ['', '.mjs', '.js', '.cjs', '.ts', '.mts', '.cts', '.json', '/index.mjs', '/index.js'];
const posix = (p) => p.split(path.sep).join('/');

const isFileOnDisk = (candidate) => {
  try { return fs.statSync(candidate).isFile(); } catch { return false; }
};

/** The repository-relative path of the file the relative specifier `fileName` names from `file` (absolute), or null when it resolves to no file inside `root`; `isFile(absolutePath)` says whether a candidate exists (the disk by default). */
export function resolveRelative(root, file, fileName, isFile = isFileOnDisk) {
  if (!fileName.startsWith('.')) return null;
  const base = path.resolve(path.dirname(file), fileName);
  const hit = EXTENSIONS.map((ext) => base + ext).find((candidate) => isFile(candidate));
  return hit && !path.relative(root, hit).startsWith('..') ? posix(path.relative(root, hit)) : null;
}

const ENTRY_ROOTS = '(?:scripts|engine|bin)';
/** Repository-relative runtime .mjs paths `text` names as a string ('scripts/kernel/cli.mjs') or as path segments ('scripts', 'kernel', 'cli.mjs'). */
export function spawnedEntriesOf(text) {
  const out = new Set();
  for (const m of text.matchAll(new RegExp(`['"\`](${ENTRY_ROOTS}/[\\w./-]+\\.mjs)['"\`]`, 'g'))) out.add(m[1]);
  for (const m of text.matchAll(new RegExp(`['"\`](${ENTRY_ROOTS})['"\`]((?:\\s*,\\s*['"\`][\\w.-]+['"\`])+)`, 'g'))) {
    const parts = [m[1], ...[...m[2].matchAll(/['"`]([\w.-]+)['"`]/g)].map((p) => p[1])];
    if (parts.at(-1).endsWith('.mjs')) out.add(parts.join('/'));
  }
  return [...out];
}
