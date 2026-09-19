/**
 * Lane v6-2 scratch tool #7: counting rules for the snapshot's identity.counts, plus the check that
 * every rule id the Common census found is an id the package's own generated rule catalog publishes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../core/yaml.mjs';

const claude = 'D:/Repositories/starci-academy-backend/.claude';
const blocks = fs.readFileSync(path.join(claude, 'ex-testing/lint/scratch/v6-2-dna-blocks.txt'), 'utf8');

// Re-measure the census through the generator's own table by parsing the emitted renderers block.
const renderers = [];
let current = null;
let mode = null;
for (const line of blocks.split('\n')) {
  if (line === 'renderers:') { mode = 'renderers'; continue; }
  if (mode !== 'renderers') continue;
  if (/^# ----/.test(line)) break;
  const comp = /^  - component: "([^"]+)"$/.exec(line);
  if (comp) { current = { component: comp[1], claims: [], computedClaims: [], classes: [] }; renderers.push(current); mode = 'renderers'; continue; }
  if (!current) continue;
  const arr = /^    (claims|computedClaims): \[(.*)\]$/.exec(line);
  if (arr) current[arr[1]] = arr[2] ? arr[2].split(', ').map(s => s.replace(/^"|"$/g, '')) : [];
  const cls = /^      - "([^"]+)"$/.exec(line);
  if (cls) current.classes.push(cls[1]);
}
const sum = renderers.reduce((n, r) => n + r.claims.length + r.computedClaims.length, 0);
const unique = [...new Set(renderers.flatMap(r => [...r.claims, ...r.computedClaims]))].sort();
console.log(`parsed renderers: ${renderers.length}`);
console.log(`claim entries (sum over components): ${sum}`);
console.log(`claim entries (distinct ids): ${unique.length}`);
console.log(`classes (sum): ${renderers.reduce((n, r) => n + r.classes.length, 0)}  distinct: ${new Set(renderers.flatMap(r => r.classes)).size}`);

const dna = parseYaml(fs.readFileSync(path.join(claude, 'knowledge/grammars/starci/DNA.yaml'), 'utf8'));
const starSum = dna.renderers.reduce((n, r) => n + (r.claims ?? []).length + (r.computedClaims ?? []).length, 0);
const starUnique = new Set(dna.renderers.flatMap(r => [...(r.claims ?? []), ...(r.computedClaims ?? [])]));
console.log(`\nstarci snapshot: counts field=${JSON.stringify(dna.identity?.counts)}`);
console.log(`starci sum=${starSum} distinct=${starUnique.size} renderers=${dna.renderers.length} tokens=${dna.tokens.length} classesSum=${dna.renderers.reduce((n, r) => n + (r.classes ?? []).length, 0)}`);

const catalogText = fs.readFileSync(path.join(claude, 'packages/grammar/src/common/rule-catalog.generated.ts'), 'utf8');
const catalog = new Set([...catalogText.matchAll(/"([A-Z][A-Z0-9]*-[A-Z0-9]+)"/g)].map(m => m[1]));
console.log(`\ngenerated catalog ids: ${catalog.size}`);
const outside = unique.filter(id => !catalog.has(id));
console.log(`census ids outside the generated catalog: ${outside.join(', ') || '(none)'}`);
const byFamily = new Map();
for (const id of unique) {
  const fam = id.replace(/-\d+$/, '').replace(/-[A-Z]+$/, m => (/[A-Z]{4,}/.test(m.slice(1)) ? m : ''));
  byFamily.set(id.split('-')[0], (byFamily.get(id.split('-')[0]) ?? 0) + 1);
}
console.log(`census ids by prefix: ${[...byFamily].map(([k, v]) => `${k}=${v}`).join(' ')}`);
console.log(`catalog prefixes not claimed by any Common renderer: ${[...new Set([...catalog].map(id => id.split('-')[0]))].filter(p => !byFamily.has(p)).join(' ')}`);
