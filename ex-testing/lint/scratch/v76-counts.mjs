import fs from 'node:fs';

const files = process.argv.slice(2);
const parse = f => fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(l => /^REFUSED /.test(l));
const cls = l => /\[CODE_DIGEST_STALE\]/.test(l) ? 'CODE_DIGEST_STALE' : /recordDigest .*no longer matches/.test(l) ? 'RECORD_DIGEST_STALE' : null;
const scope = l => {
  const p = l.slice(8).split(':')[0];
  if (!p.startsWith('examples/todo-app-backend/')) return 'ec-tree';
  if (p.startsWith('examples/todo-app-backend/.starciwork/brand/')) return 'brand';
  if (p.includes('/ui/')) return 'ui(v7-9)';
  if (p.includes('/uat/')) return 'uat(v7-11)';
  return 'MINE';
};
for (const f of files) {
  const c = {};
  for (const l of parse(f)) { const k = scope(l); if (!cls(l)) continue; c[k] = (c[k] ?? 0) + 1; }
  const all = {};
  for (const l of parse(f)) { const k = scope(l); all[k] = (all[k] ?? 0) + 1; }
  console.log(`${f}\n   digest refusals by scope: ${JSON.stringify(c)}\n   all refusals by scope:   ${JSON.stringify(all)}`);
}
const post = parse(files[files.length - 1]);
const mine = post.filter(l => scope(l) === 'MINE');
const mineDigest = mine.filter(cls);
console.log(`\nfinal in-scope digest refusals: ${mineDigest.length} across ${new Set(mineDigest.map(l => l.slice(8).split(':')[0])).size} evidence files`);
const byClass = {};
for (const l of mineDigest) byClass[cls(l)] = (byClass[cls(l)] ?? 0) + 1;
console.log(`final in-scope digest classes: ${JSON.stringify(byClass)}`);
console.log(`final in-scope NON-digest refusals: ${mine.filter(l => !cls(l)).length}`);
for (const l of mine.filter(l => !cls(l))) console.log('   ' + l.slice(0, 200));
