// Scratch explorer 3 for lane v8-6: settled runs vs their media, and declared sha256 vs disk bytes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseYaml} from '../../../core/yaml.mjs';

const HOST = path.resolve(import.meta.dirname, '..', '..', '..');
const walk = dir => fs.readdirSync(dir, {withFileTypes: true})
  .flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const trees = ['examples/todo-app-backend/.starciwork', 'examples/ecommerce-app-be/.starciwork'].map(p => path.join(HOST, p));
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

for (const workRoot of trees) {
  console.log(`\n########## ${path.basename(path.dirname(workRoot))}`);
  // (c) every uat record: state, settled run, run media presence
  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
    let doc; try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (doc?.schema !== 'work/uat-flow') continue;
    const dir = path.dirname(file);
    const evFile = path.join(dir, 'evidence.yaml');
    const ev = fs.existsSync(evFile) ? parseYaml(fs.readFileSync(evFile, 'utf8')) : null;
    const runDir = ev?.run ? path.join(dir, ev.run) : null;
    const vids = runDir && fs.existsSync(path.join(runDir, 'videos')) ? fs.readdirSync(path.join(runDir, 'videos')) : [];
    const scr = runDir && fs.existsSync(path.join(runDir, 'screens')) ? fs.readdirSync(path.join(runDir, 'screens')) : [];
    console.log(`uat ${doc.id}: state=${doc.state} run=${ev?.run ?? '(none)'} screens=${scr.length} videos=${vids.length} result=${runDir && fs.existsSync(path.join(runDir, 'result.md')) ? 'y' : 'n'}`);
    if (runDir) for (const [sub, list] of [['screens', scr], ['videos', vids]]) for (const m of list) {
      const p = path.join(runDir, sub, m);
      if (fs.statSync(p).size < 10_000) console.log(`   SMALL ${sub}/${m} ${fs.statSync(p).size}B`);
    }
  }
  // (d) every declared sha256 next to a path field, anywhere in the tree
  for (const file of walk(workRoot).filter(f => f.endsWith('.yaml'))) {
    const name = path.basename(file);
    // generation-receipts.yaml sits in <record>/assets/ but its artifact/prompt paths are record-relative
    const base = name === 'generation-receipts.yaml' ? path.dirname(path.dirname(file)) : path.dirname(file);
    const scan = node => {
      if (Array.isArray(node)) return node.forEach(scan);
      if (node && typeof node === 'object') {
        const p = typeof node.path === 'string' ? node.path : null;
        const digest = typeof node.sha256 === 'string' ? node.sha256 : null;
        if (p && digest) {
          const abs = path.isAbsolute(p) ? p : path.resolve(base, p);
          const alt = abs;
          const target = fs.existsSync(alt) ? alt : null;
          if (!target) console.log(`DECL-MISSING ${path.relative(workRoot, file).replaceAll('\\', '/')}: ${p}`);
          else if (sha(target) !== digest) console.log(`DECL-DIGEST  ${path.relative(workRoot, file).replaceAll('\\', '/')}: ${p} declared ${digest.slice(0, 12)} actual ${sha(target).slice(0, 12)}`);
        }
        const pp = typeof node.prompt === 'string' ? node.prompt : null;
        const pd = typeof node.promptSha256 === 'string' ? node.promptSha256 : null;
        if (pp && pd) {
          const abs = path.resolve(base, pp);
          if (!fs.existsSync(abs)) console.log(`DECL-MISSING ${path.relative(workRoot, file).replaceAll('\\', '/')}: ${pp}`);
          else if (sha(abs) !== pd) console.log(`DECL-DIGEST  ${path.relative(workRoot, file).replaceAll('\\', '/')}: ${pp} declared ${pd.slice(0, 12)} actual ${sha(abs).slice(0, 12)}`);
        }
        for (const v of Object.values(node)) scan(v);
      }
    };
    scan(doc0(file));
  }
}
function doc0(file) { try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; } }
