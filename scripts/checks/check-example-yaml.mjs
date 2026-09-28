import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../engine/yaml.mjs';
import {isMain, walkFiles} from './common.mjs';

/**
 * The example tree is the readable statement of the layout, so it is checked with the runtime's own loader
 * and not with whatever a convenience parser tolerates. A permissive parser accepted
 * `note: Opaque, assigned at sign-up` inside a flow mapping by silently inventing two extra keys with null
 * values; the runtime's loader refuses it. An example that only parses under the lenient reader teaches a
 * shape the product will reject.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

if (isMain(import.meta.url)) {
  const target = process.argv[2] ?? 'examples';
  const files = walkFiles(path.join(root, target), {filter: name => name.endsWith('.yaml') || name.endsWith('.yml')});
  const refused = [];
  for (const file of files) {
    try { parseYaml(fs.readFileSync(file, 'utf8')); }
    catch (error) { refused.push({file: path.relative(root, file).replaceAll('\\', '/'), reason: String(error?.message ?? error)}); }
  }
  for (const item of refused) console.log(`REFUSED ${item.file}\n        ${item.reason}`);
  console.log(`${files.length} yaml file(s) under ${target}: ${refused.length ? `${refused.length} refused by the runtime loader` : 'all accepted'}`);
  process.exitCode = refused.length ? 1 : 0;
}
