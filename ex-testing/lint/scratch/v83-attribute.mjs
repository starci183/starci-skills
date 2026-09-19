// v8-3 scratch: attribute CHANGE_UNRECORDED refusals to their transition side (in-flight vs committed).
import fs from 'node:fs';

const lines = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(line => line.startsWith('REFUSE '));
const bucket = {uncommitted: [], committed: []};
const fields = new Map();
for (const line of lines) {
  const code = /\[([A-Z_]+)\]$/.exec(line)?.[1];
  if (code !== 'CHANGE_UNRECORDED') continue;
  const transition = /: (.*?) -> (.*?):/.exec(line);
  const moved = /\(([^)]*)\) while/.exec(line)?.[1] ?? '(?)';
  for (const field of moved.split(', ')) fields.set(field, (fields.get(field) ?? 0) + 1);
  (transition?.[2] === 'uncommitted' ? bucket.uncommitted : bucket.committed).push(line);
}
console.log(`CHANGE_UNRECORDED refusals: ${lines.filter(l => l.includes('CHANGE_UNRECORDED')).length}`);
console.log(`  against an uncommitted (in-flight) edit: ${bucket.uncommitted.length}`);
console.log(`  between two committed revisions: ${bucket.committed.length}`);
console.log('\nfields that moved, by frequency:');
for (const [field, count] of [...fields.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(count).padStart(3)}  ${field}`);
console.log('\ncommitted-transition refusals (the ones that already passed review once):');
for (const line of bucket.committed) console.log('  ' + line);
