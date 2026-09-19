/**
 * Lane v6-2 scratch tool #8: two claims the snapshot makes about classes — (a) every grammar class the
 * renderers emit is also written as a selector by the Common sheet itself, (b) which vendor classes ride
 * along on the rendered markup. A class with no rule in the Common layer is a finding, not a table row.
 */
import fs from 'node:fs';
import path from 'node:path';

const claude = 'D:/Repositories/starci-academy-backend/.claude';
const css = fs.readFileSync(path.join(claude, 'packages/grammar/src/common/styles.css'), 'utf8');
const stripped = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
const defined = new Set([...stripped.matchAll(/\.((?:starci-core|grammar)-[A-Za-z0-9-]+)/g)].map(m => m[1]));
const coreCss = fs.readFileSync(path.join(claude, 'packages/grammar/src/core/styles.css'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, ' ');
const coreDefined = new Set([...coreCss.matchAll(/\.((?:starci-core|grammar)-[A-Za-z0-9-]+)/g)].map(m => m[1]));

const blocks = fs.readFileSync(path.join(claude, 'ex-testing/lint/scratch/v6-2-renderers-final.txt'), 'utf8').split('\n');
const emitted = new Set();
for (const line of blocks) {
  const cls = /^      - "([^"]+)"$/.exec(line);
  if (cls) emitted.add(cls[1]);
}
const missingCommon = [...emitted].filter(c => !defined.has(c) && !c.includes('--'));
const missingBoth = missingCommon.filter(c => !coreDefined.has(c.split('--')[0]));
console.log(`emitted grammar classes: ${emitted.size}  defined by common sheet: ${defined.size}  by core sheet: ${coreDefined.size}`);
console.log(`emitted but no rule in common/styles.css: ${missingCommon.join(' ') || '(none)'}`);
console.log(`...of those, no rule in core/styles.css either: ${missingBoth.join(' ') || '(none)'}`);

// The classes a browser actually put on the page in one real capture, minus the grammar's own.
const capture = fs.readFileSync(path.join(claude, 'examples/todo-app-backend/.starciwork/features/task/impl/todo-app-frontend/task-list/assets/list-many-tasks-desktop-1280.html'), 'utf8');
const vendor = new Map();
for (const m of capture.matchAll(/class="([^"]*)"/g)) {
  for (const c of m[1].split(/\s+/)) {
    if (!c || /^(starci-core|grammar)-/.test(c) || /\[|\/|:|,|\.|%|\(/.test(c)) continue;
    vendor.set(c, (vendor.get(c) ?? 0) + 1);
  }
}
console.log(`\nnon-grammar classes in that capture (${vendor.size}), most frequent:`);
for (const [c, n] of [...vendor].sort((a, b) => b[1] - a[1]).slice(0, 18)) console.log(`  ${n}\t${c}`);
