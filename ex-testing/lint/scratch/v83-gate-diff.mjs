// v8-3 scratch: set-diff two check-example-work.mjs runs so a lane can say what it moved and what it did not.
import fs from 'node:fs';

const [beforeFile, afterFile] = process.argv.slice(2);
const lines = file => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(line => /^(REFUSED|WARN) /.test(line));
const asorted = list => [...new Set(list)].sort();
const before = asorted(lines(beforeFile));
const after = asorted(lines(afterFile));
const added = after.filter(line => !before.includes(line));
const removed = before.filter(line => !after.includes(line));
const summary = file => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).at(-1);

console.log(`before run (${beforeFile}): ${before.length} refusal/warn lines`);
console.log(`  ${summary(beforeFile)}`);
console.log(`after run (${afterFile}): ${after.length} refusal/warn lines`);
console.log(`  ${summary(afterFile)}`);
console.log(`\nlines present only AFTER this lane wrote (${added.length}):`);
for (const line of added) console.log('  + ' + line.slice(0, 200));
console.log(`\nlines present only BEFORE this lane wrote (${removed.length}):`);
for (const line of removed) console.log('  - ' + line.slice(0, 200));
