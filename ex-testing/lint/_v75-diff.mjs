// Diff two gate output files, ignoring the order of lines, to attribute deltas.
import fs from 'node:fs';
const [a, b] = process.argv.slice(2);
const read = f => fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(l => /^(REFUSED|WARN) /.test(l));
const A = new Map(); read(a).forEach(l => A.set(l, (A.get(l) ?? 0) + 1));
const B = new Map(); read(b).forEach(l => B.set(l, (B.get(l) ?? 0) + 1));
const only = (x, y) => [...x.keys()].filter(k => !y.has(k));
console.log(`lines in ${a}: ${read(a).length}; in ${b}: ${read(b).length}`);
console.log(`\n--- only in ${a} (cleared) ${only(A, B).length} ---`);
only(A, B).forEach(l => console.log('  ' + l.slice(0, 200)));
console.log(`\n--- only in ${b} (new) ${only(B, A).length} ---`);
only(B, A).forEach(l => console.log('  ' + l.slice(0, 200)));
