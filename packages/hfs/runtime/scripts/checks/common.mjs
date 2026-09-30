import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** Whether `target` is `root` itself or inside it (filesystem paths, either separator). */
export function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

/** True when this module is the process entry point (`node file.mjs`, not an import). */
export const isMain = (metaUrl, argv = process.argv) => Boolean(argv[1]) && path.resolve(argv[1]) === fileURLToPath(metaUrl);

/**
 * Every entry under `dir` that is not a directory, depth-first; `filter` sees the entry name and full
 * path. `sorted` sorts each directory's entries by name (default: readdir order). `exclude`
 * applies to files and directories before descent; `maxDepth` counts from the starting dir.
 */
export function walkFiles(dir, {filter = () => true, sorted = false, exclude = () => false,
  maxDepth = Infinity, ignoreReadErrors = false} = {}) {
  const out = [];
  const visit = (current, depth) => {
    if (depth > maxDepth) return;
    let entries;
    try { entries = fs.readdirSync(current, {withFileTypes: true}); }
    catch (error) { if (ignoreReadErrors) return; throw error; }
    if (sorted) entries = entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (exclude(entry.name, full, entry)) continue;
      if (entry.isDirectory()) visit(full, depth + 1);
      else if (filter(entry.name, full)) out.push(full);
    }
  };
  visit(dir, 0);
  return out;
}
