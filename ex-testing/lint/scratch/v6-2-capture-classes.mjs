import fs from 'node:fs';
import path from 'node:path';

const root = 'D:/Repositories/starci-academy-backend/.claude/examples/todo-app-backend/.starciwork/features';
const filter = process.argv[2] ?? 'surface|card|list|grammar|section';
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const files = walk(root).filter(f => f.endsWith('.html'));
const re = new RegExp(filter);
const tally = new Map();
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const classes = new Set();
  for (const m of text.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (c && re.test(c)) classes.add(c);
  for (const c of classes) tally.set(c, (tally.get(c) ?? 0) + 1);
}
console.log(`html files: ${files.length}`);
for (const [c, n] of [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) console.log(`${n}\t${c}`);
