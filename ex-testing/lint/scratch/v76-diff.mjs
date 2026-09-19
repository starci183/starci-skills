import fs from 'node:fs';

/**
 * v7-6 refusal set-diff: totals across the whole fleet are meaningless while other lanes edit the same
 * two trees, so the lane's own effect is measured as a set difference of refusal lines.
 * Usage: node v76-diff.mjs <before.log> <after.log> [scope-substring]
 */
const [beforeFile, afterFile, scope] = process.argv.slice(2);
const lines = f => fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(l => /^(REFUSED|WARN)/.test(l));
const split = line => {
  const at = line.indexOf(': ');
  return {file: at < 0 ? line : line.slice(0, at), rest: at < 0 ? '' : line.slice(at + 2), line};
};
const inScope = l => !scope || l.file.includes(scope);
const before = lines(beforeFile).map(split).filter(inScope);
const after = lines(afterFile).map(split).filter(inScope);
const key = l => `${l.line}`;
const B = new Map(before.map(l => [key(l), l]));
const A = new Map(after.map(l => [key(l), l]));
const gone = [...B.values()].filter(l => !A.has(key(l)));
const added = [...A.values()].filter(l => !B.has(key(l)));
const digest = l => /\[CODE_DIGEST_STALE\]|recordDigest .* no longer matches/.test(l.line);
const byFile = ls => {
  const m = new Map();
  for (const l of ls) {
    const cls = (l.rest.match(/\[([A-Z_]+)\]/) ?? [, 'recordDigest-staleness'])[1];
    m.set(cls, (m.get(cls) ?? 0) + 1);
  }
  return [...m.entries()].sort((x, y) => y[1] - x[1]);
};
console.log(`scope=${scope ?? '(whole gate)'}`);
console.log(`${beforeFile}: ${before.length} in-scope lines   ${afterFile}: ${after.length} in-scope lines`);
console.log(`resolved by this lane: ${gone.length}   added since baseline: ${added.length}`);
console.log(`digest refusals: before=${before.filter(digest).length} after=${after.filter(digest).length} resolved=${gone.filter(digest).length} added=${added.filter(digest).length}`);
console.log('resolved by class:', JSON.stringify(Object.fromEntries(byFile(gone))));
console.log('added by class:', JSON.stringify(Object.fromEntries(byFile(added))));
if (added.length) {
  console.log('\n--- ADDED (verbatim) ---');
  for (const l of added) console.log(l.line.slice(0, 220));
}
console.log('\n--- STILL REFUSED IN SCOPE (verbatim) ---');
for (const l of after.filter(digest)) console.log(l.line.slice(0, 260));
