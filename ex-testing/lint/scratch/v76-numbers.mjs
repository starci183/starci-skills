import fs from 'node:fs';

const read = f => fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(l => /^REFUSED /.test(l));
const isDigest = l => /\[CODE_DIGEST_STALE\]/.test(l) || /recordDigest .*no longer matches/.test(l);
const file = l => l.slice(8).split(':')[0];
const mine = l => file(l).startsWith('examples/todo-app-backend/.starciwork/features/')
  && !/\/(ui|uat)\//.test(file(l));
const run = JSON.parse(fs.readFileSync('ex-testing/lint/scratch/v76-run.json', 'utf8'));

for (const label of ['pre', 'post']) {
  const ls = read(`ex-testing/lint/scratch/v76-gate-${label}write.txt`);
  const d = ls.filter(l => mine(l) && isDigest(l));
  console.log(`${label}: in-scope digest refusal lines=${d.length} files=${new Set(d.map(file)).size} (CODE=${d.filter(l => /\[CODE_DIGEST_STALE\]/.test(l)).length}, recordDigest=${d.filter(l => /recordDigest/.test(l)).length})`);
}
const pre = new Set(read('ex-testing/lint/scratch/v76-gate-prewrite.txt').filter(l => mine(l) && isDigest(l)).map(file));
const post = new Set(read('ex-testing/lint/scratch/v76-gate-postwrite.txt').filter(l => mine(l) && isDigest(l)).map(file));
const written = new Set(run.records.filter(r => r.written).map(r => `examples/todo-app-backend/.starciwork/${r.node}/evidence.yaml`.replaceAll('\\', '/')));
console.log(`writer: considered=${run.records.length} written=${written.size} skipped=${run.records.filter(r => r.skippedReason).length} restored=${run.records.filter(r => r.restored).length}`);
console.log(`written files that had a pre-write refusal: ${[...written].filter(f => pre.has(f)).length}`);
console.log(`pre-refused files NOT touched by this lane: ${[...pre].filter(f => !written.has(f)).join('\n   ') || '(none)'}`);
console.log(`post-refused files this lane did not write (expected unprovable): ${[...post].filter(f => !written.has(f)).length}`);
console.log(`ANY post-refused file that this lane DID write (would mean a late lane edit): ${[...post].filter(f => written.has(f)).join(', ') || '(none)'}`);

const nodes = run.records.filter(r => r.written).map(r => r.node);
const byFamily = {};
for (const n of nodes) { const f = n.split('/')[1]; byFamily[f] = (byFamily[f] ?? 0) + 1; }
console.log(`written by feature: ${JSON.stringify(byFamily)}`);
let asserts = 0;
for (const r of run.records.filter(x => x.written)) asserts += r.assertions.length;
console.log(`assertions re-executed by the writer: ${asserts}`);
