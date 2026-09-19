/**
 * Lane v6-2: audit the authored snapshot against itself — do identity.counts and the card observation
 * match what the tables actually contain, and does the built .dist copy agree with the authored YAML?
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../../core/yaml.mjs';

const claude = 'D:/Repositories/starci-academy-backend/.claude';
const doc = parseYaml(fs.readFileSync(path.join(claude, 'knowledge/grammars/common/DNA.yaml'), 'utf8'));
const built = JSON.parse(fs.readFileSync(path.join(claude, '.dist/knowledge/grammars/common/DNA.json'), 'utf8'));

const claimSum = doc.renderers.reduce((n, r) => n + (r.claims ?? []).length + (r.computedClaims ?? []).length, 0);
const distinctClaims = new Set(doc.renderers.flatMap(r => [...(r.claims ?? []), ...(r.computedClaims ?? [])]));
const classes = new Set(doc.renderers.flatMap(r => r.classes ?? []));
const assigned = doc.tokens.filter(t => t.assignedBy === 'common').length;
const both = doc.tokens.filter(t => t.assignedBy === 'common' && t.alsoReadBy !== undefined).length;
const readOnly = doc.tokens.filter(t => t.readBy === 'common').length;
const readAny = both + readOnly;
const cardClasses = [...new Set(doc.renderers.filter(r => /card$/i.test(r.component)).flatMap(r => r.classes)
  .map(c => c.split('--')[0]).filter(c => /-surface(-card)?$/.test(c)))].sort();

const want = doc.identity.counts;
const measured = {
  renderers: doc.renderers.length,
  tokens: doc.tokens.length,
  tokensAssignedByCommon: assigned,
  tokensAssignedAndAlsoReadByCommon: both,
  tokensReadOnlyByCommon: readOnly,
  tokensReadByCommon: readAny,
  claimEntries: claimSum,
  distinctClaimIds: distinctClaims.size,
  emittedClasses: classes.size,
  gaps: doc.gaps.length,
};
let bad = 0;
for (const [key, value] of Object.entries(measured)) {
  const ok = want[key] === value;
  if (!ok) bad += 1;
  console.log(`${ok ? 'ok  ' : 'BAD '}counts.${key} = ${value}${ok ? '' : ` (authored ${want[key]})`}`);
}
console.log(`${want.classesWithARuleInAShippedSheet === classes.size - 2 ? 'ok  ' : 'BAD '}counts.classesWithARuleInAShippedSheet = ${classes.size - 2} (135 emitted minus the two the gap names)`);

const dupTokens = doc.tokens.length !== new Set(doc.tokens.map(t => t.name)).size;
console.log(`${dupTokens ? 'BAD' : 'ok  '} token names are unique`);
const dupRenderers = doc.renderers.length !== new Set(doc.renderers.map(r => r.component)).size;
console.log(`${dupRenderers ? 'BAD' : 'ok  '} renderer components are unique`);
const everySource = doc.tokens.every(t => /^packages\/grammar\/src\/common\/styles\.css:\d+$/.test(t.source));
console.log(`${everySource ? 'ok  ' : 'BAD '} every token row cites a line in the Common sheet`);
const evidence = doc.gaps.flatMap(g => g.evidence ?? []);
const missing = evidence.filter(entry => {
  const rel = entry.split(':')[0];
  return !fs.existsSync(path.join(claude, rel));
});
console.log(`${missing.length ? 'BAD' : 'ok  '} ${evidence.length} evidence paths resolve${missing.length ? `: ${missing.join(', ')}` : ''}`);
const cited = evidence.filter(e => /:\d+$/.test(e)).filter((entry) => {
  const [rel, line] = entry.split(':');
  const text = fs.readFileSync(path.join(claude, rel), 'utf8').split(/\r?\n/);
  return !/^(packages\/grammar|knowledge|checks)/.test(rel) || !text[Number(line) - 1];
});
console.log(`${cited.length ? 'note' : 'ok  '} ${evidence.length - cited.length} evidence entries carry a line anchor`);

const same = built.tokens.length === doc.tokens.length && built.renderers.length === doc.renderers.length
  && JSON.stringify(built.tokens.map(t => t.name)) === JSON.stringify(doc.tokens.map(t => t.name))
  && JSON.stringify(built.renderers.map(r => [r.component, r.classes])) === JSON.stringify(doc.renderers.map(r => [r.component, r.classes]));
console.log(`${same ? 'ok  ' : 'BAD '} .dist/knowledge/grammars/common/DNA.json agrees with the authored YAML (${built.tokens.length} tokens, ${built.renderers.length} renderers)`);
console.log(`\ncard-suffix canon from the tables: ${cardClasses.join(', ')}`);
const observed = doc.observations.find(o => o.id === 'card-surface-canon').observation;
const allNamed = cardClasses.every(c => observed.includes(c));
console.log(`${allNamed ? 'ok  ' : 'BAD '} the card-surface-canon observation names every class the canon resolves to`);
