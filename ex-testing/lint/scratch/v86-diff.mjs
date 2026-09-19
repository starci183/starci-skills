// Scratch set-differ for lane v8-6: which base-gate refusal lines moved across this lane's writes?
// Precedent: ex-testing/lint/_v75-diff.mjs (the v7-5 lane did the same for the same reason - with other
// lanes live-editing the same trees, a total is not evidence about this lane, only the line set is).
import fs from 'node:fs';

const [beforeFile, afterFile] = process.argv.slice(2);
const lines = file => new Set(fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => line.startsWith('REFUSED ') || line.startsWith('WARN ')));
const before = lines(beforeFile);
const after = lines(afterFile);
const added = [...after].filter(line => !before.has(line));
const removed = [...before].filter(line => !after.has(line));
const summary = file => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => /record\(s\)/.test(line)).join('\n');

console.log(`${beforeFile}: ${summary(beforeFile)}`);
console.log(`${afterFile}: ${summary(afterFile)}`);
console.log(`lines only in AFTER (${added.length}):`);
for (const line of added) console.log(`  + ${line}`);
console.log(`lines only in BEFORE (${removed.length}):`);
for (const line of removed) console.log(`  - ${line}`);
