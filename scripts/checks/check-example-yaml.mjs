import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../engine/yaml.mjs';
import { isMain } from '../lib/is-main.mjs'; import { walkFiles } from '../lib/walk.mjs'; import { containedPath } from '../lib/path-key.mjs';

/**
 * The example tree is the readable statement of the layout, so it is checked with the runtime's own loader
 * and not with whatever a convenience parser tolerates. A permissive parser accepted
 * `note: Opaque, assigned at sign-up` inside a flow mapping by silently inventing two extra keys with null
 * values; the runtime's loader refuses it. An example that only parses under the lenient reader teaches a
 * shape the product will reject.
 *
 * Only authored example source is read: a `node_modules` directory is never entered, and neither is any
 * symbolic link or junction (a lane worktree junctions its node_modules to the main checkout, so following a
 * link would read another tree's installed packages, not this example).
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Never entered: installed packages and every link (symlink or junction), whatever its name. */
const notAuthored = (name, _full, entry) => name === 'node_modules' || entry.isSymbolicLink();

/** Every *.yaml / *.yml under `dir`, skipping node_modules and links. */
export function exampleYamlFiles(dir) {
  return walkFiles(dir, {sorted: true, exclude: notAuthored, filter: name => name.endsWith('.yaml') || name.endsWith('.yml')});
}

/** Parse every example YAML under `dir` with the runtime loader; returns the scanned files and the refused ones. */
export function checkExampleYaml(dir, {base = root} = {}) {
  const files = exampleYamlFiles(dir);
  const refused = [];
  for (const file of files) {
    try { parseYaml(fs.readFileSync(file, 'utf8')); }
    catch (error) { refused.push({file: path.relative(base, file).replaceAll(path.sep, '/'), reason: String(error?.message ?? error)}); }
  }
  return {files, refused};
}

if (isMain(import.meta.url)) {
  const target = process.argv[2] ?? 'examples';
  let dir;
  try { dir = containedPath(root, target, {label: 'directory'}); } catch (error) { console.log(`REFUSED ${error.message}`); process.exit(1); }
  const {files, refused} = checkExampleYaml(dir);
  for (const item of refused) console.log(`REFUSED ${item.file}\n        ${item.reason}`);
  const verdict = refused.length ? `${refused.length} refused by the runtime loader` : 'all accepted';
  console.log(`${files.length} yaml file(s) under ${target}: ${verdict}`);
  process.exitCode = refused.length ? 1 : 0;
}
