/**
 * Lane v6-2 scratch tool #3: diff the Common-entry class census (source-derived) against the existing
 * StarCi Core DNA snapshot's renderer table, so any disagreement is read in source before it is authored.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../core/yaml.mjs';

const census = fs.readFileSync(path.resolve(import.meta.dirname, 'v6-2-renderers.txt'), 'utf8').split('\n');
const dna = parseYaml(fs.readFileSync('D:/Repositories/starci-academy-backend/.claude/knowledge/grammars/starci/DNA.yaml', 'utf8'));
const dnaByComponent = new Map(dna.renderers.map(r => [r.component, (r.classes ?? []).slice().sort()]));

const rows = [];
let current = null;
for (const line of census) {
  const head = /^([A-Z][A-Za-z0-9]*)\s+\[([a-zA-Z]+)\]\s+(\S+)\s+propsType=(.*)$/.exec(line);
  if (head) { current = { component: head[1], kind: head[2], source: head[3], propsType: head[4].trim(), classes: [] }; rows.push(current); continue; }
  const cls = /^\s{4}([a-z][A-Za-z0-9-]+)/.exec(line);
  if (cls && current) current.classes.push(cls[1]);
}
console.log(`census components: ${rows.length}`);
let drift = 0;
for (const row of rows.sort((a, b) => a.component.localeCompare(b.component))) {
  const mine = [...new Set(row.classes)].sort();
  const theirs = dnaByComponent.get(row.component);
  if (!theirs) { drift++; console.log(`ABSENT FROM STARCI DNA: ${row.component} -> ${mine.join(' ')}`); continue; }
  const missing = theirs.filter(c => !mine.includes(c));
  const extra = mine.filter(c => !theirs.includes(c));
  if (missing.length || extra.length) { drift++; console.log(`DIFFER ${row.component}: snapshot-only=[${missing.join(' ')}] census-only=[${extra.join(' ')}]`); }
}
console.log(`\ncomponents whose class table differs or is absent from the starci snapshot: ${drift}`);
const dnaOnly = [...dnaByComponent.keys()].filter(k => !rows.some(r => r.component === k));
console.log(`starci DNA components absent from the Common census: ${dnaOnly.join(', ') || '(none)'}`);
console.log(`starci DNA renderer count: ${dna.renderers.length}`);
