// v8-3 scratch probe: group a check-work-history run by code and show samples per code.
import fs from 'node:fs';

const file = process.argv[2];
const lines = fs.readFileSync(file, 'utf8').split('\n').filter(line => /^(REFUSE|SUSPECT|INFO)\s/.test(line));
const groups = new Map();
for (const line of lines) {
  const severity = line.split(/\s+/)[0];
  const code = /\[([A-Z_]+)\]$/.exec(line)?.[1] ?? '(uncoded)';
  const key = `${severity} ${code}`;
  const list = groups.get(key) ?? [];
  list.push(line);
  groups.set(key, list);
}
for (const [key, list] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n===== ${key}  (${list.length}) =====`);
  for (const line of list.slice(0, Number(process.argv[3] ?? 3))) console.log('  ' + line.slice(0, 260));
}
