/**
 * Lane v6-2 task 4: the two functions that refused must now answer.
 *   node ex-testing/lint/scratch/v6-2-verify.mjs
 * Checks the authored snapshot and the built `.dist` copy through the same readers the gate uses, and
 * reports the card classes against the markup the example captures actually kept.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../core/yaml.mjs';
import { grammarTokenNames, defaultGrammarRoot } from '../../../checks/brand.mjs';
import { cardClassesOf } from '../../../checks/render.mjs';
import { validateAgainstSchema } from '../../../scripts/knowledge-compile/schema.mjs';

const claude = 'D:/Repositories/starci-academy-backend/.claude';
const authoredRoot = path.join(claude, 'knowledge', 'grammars');
const builtRoot = path.join(claude, '.dist', 'knowledge', 'grammars');

// 1. schema conformance of the authored file.
const schema = parseYaml(fs.readFileSync(path.join(claude, 'schemas/knowledge-source.schema.yaml'), 'utf8'));
const doc = parseYaml(fs.readFileSync(path.join(authoredRoot, 'common/DNA.yaml'), 'utf8'));
const checked = validateAgainstSchema(doc, schema, {});
console.log(`schema starci/knowledge-source@1: ${checked.ok ? 'valid' : `INVALID ${JSON.stringify(checked.errors)}`}`);
console.log(`id=${doc.id} family=${doc.family} schema=${doc.schema}`);
console.log(`tokens=${doc.tokens.length} renderers=${doc.renderers.length} gaps=${doc.gaps.length} observations=${doc.observations.length}`);

// 2. the two readers the refusals came from, against both grammar roots.
for (const [label, root] of [['authored', authoredRoot], ['built (.dist)', builtRoot], ['default', defaultGrammarRoot()]]) {
  const names = grammarTokenNames({ family: 'common', grammarRoot: root });
  const cards = cardClassesOf({ family: 'common', grammarRoot: root });
  const ok = names.error === null && names.names.length > 0 && cards.error === null && cards.classes.length > 0;
  console.log(`\n[${label}] root=${path.relative(claude, root).replaceAll('\\', '/')}`);
  console.log(`  grammarTokenNames: error=${JSON.stringify(names.error)} names=${names.names.length} file=${names.file ? path.relative(claude, names.file).replaceAll('\\', '/') : null}`);
  console.log(`  cardClassesOf:     error=${JSON.stringify(cards.error)} classes=${JSON.stringify(cards.classes)} source=${cards.source}`);
  console.log(`  ${ok ? 'PASS' : 'NOT YET'} both return error:null with non-empty results`);
}

// 3. do the card classes the snapshot names actually appear in the kept markup?
const features = path.join(claude, 'examples/todo-app-backend/.starciwork/features');
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]);
const htmls = walk(features).filter(f => f.endsWith('.html'));
const cards = cardClassesOf({ family: 'common', grammarRoot: authoredRoot });
const hits = new Map(cards.classes.map(c => [c, 0]));
const stray = new Map();
for (const file of htmls) {
  const text = fs.readFileSync(file, 'utf8');
  const seen = new Set();
  for (const m of text.matchAll(/class="([^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (/^starci-core-[a-z0-9-]*surface(-card)?$/.test(c)) { seen.add(c); }
  for (const c of seen) {
    if (hits.has(c)) hits.set(c, hits.get(c) + 1);
    else stray.set(c, (stray.get(c) ?? 0) + 1);
  }
}
console.log(`\nkept markup: ${htmls.length} files under examples/todo-app-backend/.starciwork/features`);
for (const [c, n] of hits) console.log(`  snapshot card class ${c}: on ${n} capture(s)`);
for (const [c, n] of stray) console.log(`  NOT in the snapshot canon: ${c} (on ${n} capture(s))`);
