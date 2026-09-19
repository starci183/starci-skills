/**
 * v7-14: for every path+sha256 pin pair in the two trees, test whether the *current* bytes of some existing
 * file match the pin. A pin whose digest matches a file at a different path proves a pure move (the path
 * string is stale, the content claim is true) and can be retargeted mechanically. A pin that matches no
 * file is a dead reference: retargeting it would assert a false identity, so it is reported, not fixed.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseYaml} from '../../../../core/yaml.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const HOST = path.resolve(here, '../../../..');

const sha = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

/** Index first-party files (and only the @starci/grammar package inside node_modules) by sha256 -> [paths]. */
function buildIndex() {
  const byDigest = new Map();
  const roots = [path.join(HOST, 'examples'), path.join(HOST, 'knowledge')];
  const stack = [...roots];
  let n = 0;
  const skipDirs = new Set(['dist', '.next', 'coverage', '.git', 'playwright-report', 'test-results', 'node_modules.bak']);
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, {withFileTypes: true}); } catch { continue; }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules') {
          // Only the installed grammar package is ever named by a record pin; hashing the rest of the
          // dependency tree takes minutes and no record points into it.
          const grammar = path.join(abs, '@starci', 'grammar');
          if (fs.existsSync(grammar)) stack.push(grammar);
          continue;
        }
        if (skipDirs.has(e.name) && !(e.name === 'dist' && dir.includes(path.join('@starci')))) continue;
        stack.push(abs);
        continue;
      }
      if (!/\.(tsx?|jsx?|mjs|css|json|txt|ya?ml|md|html|png|sh)$/.test(e.name)) continue;
      n++;
      let d;
      try { d = sha(abs); } catch { continue; }
      const rel = path.relative(HOST, abs).replaceAll('\\', '/');
      if (!byDigest.has(d)) byDigest.set(d, []);
      byDigest.get(d).push(rel);
    }
  }
  console.log(`indexed ${n} file(s); ${byDigest.size} distinct digests`);
  return byDigest;
}

function* walkYaml(dir) {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '_local') yield* walkYaml(abs); }
    else if (e.name.endsWith('.yaml')) yield abs;
  }
}

const byDigest = buildIndex();
const rows = [];
for (const tree of ['todo-app-backend', 'ecommerce-app-be']) {
  const workRoot = path.join(HOST, 'examples', tree, '.starciwork');
  for (const file of walkYaml(workRoot)) {
    const rel = path.relative(HOST, file).replaceAll('\\', '/');
    let data;
    try { data = parseYaml(fs.readFileSync(file, 'utf8')); } catch { continue; }
    if (!data || typeof data !== 'object') continue;
    const recordDir = path.dirname(file);
    const bases = [recordDir, workRoot, path.dirname(workRoot), HOST];
    const stack = [[data, '']];
    while (stack.length) {
      const [node, trail] = stack.pop();
      if (Array.isArray(node)) { node.forEach((v, i) => stack.push([v, `${trail}[${i}]`])); continue; }
      if (!node || typeof node !== 'object') continue;
      const keys = Object.keys(node);
      if (typeof node.path === 'string' && typeof node.sha256 === 'string') {
        const exists = bases.map(b => path.join(b, node.path)).find(p => fs.existsSync(p));
        const current = exists ? sha(exists) : null;
        const hits = (byDigest.get(node.sha256) ?? []);
        rows.push({tree, file: rel, trail, path: node.path,
          verdict: exists && current === node.sha256 ? 'PIN_OK'
            : exists ? 'PIN_MISMATCH_FILE_EXISTS'
            : hits.length ? `MOVE_PROVEN:${hits.slice(0, 3).join(' ')}` : 'DEAD_PIN'});
      }
      for (const k of keys) {
        const v = node[k];
        if (v && typeof v === 'object') stack.push([v, trail ? `${trail}.${k}` : k]);
      }
    }
  }
}

const tally = {};
for (const r of rows) tally[r.verdict.split(':')[0]] = (tally[r.verdict.split(':')[0]] ?? 0) + 1;
console.log(JSON.stringify(tally, null, 2));
for (const r of rows.filter(r => r.verdict !== 'PIN_OK')) {
  console.log(`${r.tree}\t${r.verdict}\t${r.file}\t${r.trail}\t${r.path}`);
}
fs.writeFileSync(path.join(here, 'pins.json'), JSON.stringify(rows, null, 2));
