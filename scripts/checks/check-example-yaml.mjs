import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../engine/yaml.mjs';

/**
 * The example tree is the readable statement of the layout, so it is checked with the runtime's own loader
 * and not with whatever a convenience parser tolerates. A permissive parser accepted
 * `note: Opaque, assigned at sign-up` inside a flow mapping by silently inventing two extra keys with null
 * values; the runtime's loader refuses it. An example that only parses under the lenient reader teaches a
 * shape the product will reject.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const walk = dir => fs.readdirSync(dir, {withFileTypes: true})
  .flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);

const target = process.argv[2] ?? 'examples';
const files = walk(path.join(root, target)).filter(file => file.endsWith('.yaml') || file.endsWith('.yml'));
const refused = [];
for (const file of files) {
  try { parseYaml(fs.readFileSync(file, 'utf8')); }
  catch (error) { refused.push({file: path.relative(root, file).replaceAll('\\', '/'), reason: String(error?.message ?? error)}); }
}
for (const item of refused) console.log(`REFUSED ${item.file}\n        ${item.reason}`);
console.log(`${files.length} yaml file(s) under ${target}: ${refused.length ? `${refused.length} refused by the runtime loader` : 'all accepted'}`);
process.exitCode = refused.length ? 1 : 0;
