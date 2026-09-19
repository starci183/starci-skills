// v8-4 scratch: set-diff the base gate's refusal/warn lines between two runs (lane concurrency discipline).
import fs from 'node:fs';

const [beforeFile, afterFile] = process.argv.slice(2);
const linesOf = file => fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => /^(REFUSED|WARN) /.test(l));
const count = file => {
  const tally = new Map();
  for (const line of linesOf(file)) tally.set(line, (tally.get(line) ?? 0) + 1);
  return tally;
};
const beforeTally = count(beforeFile);
const afterTally = count(afterFile);
const added = [...afterTally.keys()].filter(line => !beforeTally.has(line));
const removed = [...beforeTally.keys()].filter(line => !afterTally.has(line));
console.log(`before: ${[...beforeTally.values()].reduce((a, b) => a + b, 0)} finding line(s)`);
console.log(`after:  ${[...afterTally.values()].reduce((a, b) => a + b, 0)} finding line(s)`);
console.log(`added(${added.length}):`);
for (const line of added) console.log('  + ' + line);
console.log(`removed(${removed.length}):`);
for (const line of removed) console.log('  - ' + line);
console.log(`summary before: ${(fs.readFileSync(beforeFile, 'utf8').split(/\r?\n/).find(l => /record\(s\)/.test(l)) ?? '(none)').trim()}`);
console.log(`summary after:  ${(fs.readFileSync(afterFile, 'utf8').split(/\r?\n/).find(l => /record\(s\)/.test(l)) ?? '(none)').trim()}`);
