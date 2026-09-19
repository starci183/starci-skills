/** v7-14 report inputs: (1) my edit's digest fallout list, (2) distinct dead paths inside evidence payloads. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HOST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = f => fs.readFileSync(path.join(HOST, f), 'utf8').trim().split(/\r?\n/);

const mine = read('ex-testing/lint/scratch/v7-14/fix-apply.txt')
  .filter(l => l.startsWith('# ')).map(l => l.slice(2).split(' ')[0]);
const freshAtEdit = read('ex-testing/lint/scratch/v7-14/fix-apply.txt')
  .filter(l => l.startsWith('# ') && l.includes('FRESH')).map(l => l.slice(2).split(' ')[0]);

const gate = read('ex-testing/lint/scratch/v7-14/gate-final.txt');
const recordDigestRefused = new Set(gate.filter(l => /recordDigest /.test(l)).map(l => l.replace(/^REFUSED /, '').split(':')[0]));

console.log('### fallout: records I edited whose sibling evidence the gate now refuses on recordDigest');
let n = 0;
for (const f of freshAtEdit) {
  const ev = f.replace(/[^/]*\.yaml$/, 'evidence.yaml');
  if (ev === f || f.endsWith('workspace.yaml')) continue;
  if (recordDigestRefused.has(ev)) { console.log(`  ${++n}  ${f.replace('examples/todo-app-backend/.starciwork/', '')}`); }
}
console.log(`  (${n} of ${freshAtEdit.length} files that were fresh when I wrote them)`);

console.log('\n### still-fresh records I edited (a concurrent lane re-bound them after me, or none applied)');
for (const f of mine) {
  const ev = f.replace(/[^/]*\.yaml$/, 'evidence.yaml');
  if (f.endsWith('workspace.yaml') || ev === f) continue;
  if (!recordDigestRefused.has(ev) && !freshAtEdit.includes(f)) console.log(`  ok  ${f.replace('examples/todo-app-backend/.starciwork/', '')}`);
}

console.log('\n### distinct dead paths inside evidence payloads (regeneration input, not a record fix)');
const f = require_findings();
const dead = new Map();
for (const x of f.filter(y => y.check === 'PAYLOAD_PATH_UNRESOLVED')) {
  const k = `${x.value}`;
  if (!dead.has(k)) dead.set(k, {n: 0, where: x.file});
  dead.get(k).n++;
}
for (const [k, v] of [...dead.entries()].sort((a, b) => b[1].n - a[1].n)) console.log(`  ${String(v.n).padStart(3)}  ${k}   (e.g. ${v.where})`);

function require_findings() {
  return JSON.parse(fs.readFileSync(path.join(HOST, 'ex-testing/lint/scratch/v7-14/findings.json'), 'utf8'));
}
