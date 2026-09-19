// Scratch explorer 2 for lane v8-6: bytes on disk behind the declared media/artifacts.
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../../../core/yaml.mjs';

const HOST = path.resolve(import.meta.dirname, '..', '..', '..');
const walk = dir => fs.readdirSync(dir, {withFileTypes: true})
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const trees = ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork'].map(p => path.join(HOST, p));
const magic = file => {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(16);
  const read = fs.readSync(fd, head, 0, 16, 0);
  fs.closeSync(fd);
  return head.subarray(0, read);
};
const describe = (label, file) => {
  if (!fs.existsSync(file)) return console.log(`${label}: MISSING ${file}`);
  const size = fs.statSync(file).size;
  console.log(`${label}: ${size}B ${path.basename(file)} head=${magic(file).subarray(0, 12).toString('hex')} | ${file.replaceAll('\\', '/').replaceAll(HOST.replaceAll('\\', '/') + '/', '')}`);
};

for (const workRoot of trees) {
  console.log(`\n########## ${path.basename(path.dirname(workRoot))}`);
  // every png/webm/mp4/jpg/gif under the tree, with size + first bytes
  for (const file of walk(workRoot)) {
    if (!/\.(png|webm|mp4|jpe?g|gif)$/i.test(file)) continue;
    const rel = path.relative(workRoot, file).replaceAll('\\', '/');
    describe(rel.includes('/assets/') ? 'asset' : 'run-media', file);
  }
  // run manifests: declared asset vs disk
  for (const file of walk(workRoot).filter(f => f.endsWith('manifest.yaml'))) {
    const doc = parseYaml(fs.readFileSync(file, 'utf8'));
    for (const a of doc?.assets ?? []) {
      const abs = path.join(path.dirname(file), String(a.path));
      if (!fs.existsSync(abs)) console.log(`MANIFEST-ORPHAN ${path.relative(workRoot, file)}: ${a.path}`);
      else if (fs.statSync(abs).size !== a.size) console.log(`MANIFEST-SIZE ${path.relative(workRoot, file)}: ${a.path} declared ${a.size} actual ${fs.statSync(abs).size}`);
    }
  }
  // prompt files
  for (const file of walk(workRoot).filter(f => f.endsWith('.prompt.txt'))) {
    const text = fs.readFileSync(file, 'utf8');
    const refs = [...text.matchAll(/(examples\/[\w./-]+|knowledge\/[\w./-]+)/g)].map(m => m[1]);
    const broken = refs.filter(r => !fs.existsSync(path.join(HOST, r)));
    if (!text.trim() || broken.length) console.log(`PROMPT ${path.relative(workRoot, file).replaceAll('\\', '/')}: ${text.length}B refs=${refs.length} broken=${broken.join(',')}`);
  }
}
console.log('\n########## ecommerce _resources');
const ec = path.join(HOST, 'examples/ecommerce-app-be/.starciwork');
for (const dir of ['_resources', 'brand']) {
  const abs = path.join(ec, dir);
  if (!fs.existsSync(abs)) { console.log(`(no ${dir}/)`); continue; }
  for (const f of walk(abs)) console.log(path.relative(ec, f).replaceAll('\\', '/'));
}
