// runtime-generated-block.spec.mjs - RT_GENERATED_BLOCK_STALE (scripts/hfs/runtime-rules/generated-block.mjs): the generated
// blocks of knowledge/hfs/README.md equal what scripts/hfs/readme-blocks.mjs renders from slots.yaml and rules.yaml.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BLOCKS, README, renderBlock, staleBlocks, writeBlocks } from '../../scripts/hfs/readme-blocks.mjs';
import { generatedBlockFindings } from '../../scripts/hfs/runtime-rules/generated-block.mjs';
import { catalogIndex, deriveFilesSlots, derivePatternVerification, deriveWhyCodes, derivedFiles, WHY_FILES } from '../../scripts/hfs/derived-fields.mjs';
import { createProseResolver } from '../../scripts/hfs/runtime-rules/prose-path.mjs';
import { loadRuleCatalog, loadSlotManifest } from '../../scripts/hfs/slots.mjs';

const manifest = loadSlotManifest();
const catalog = loadRuleCatalog();
const readme = fs.readFileSync(README, 'utf8');
const ctxOf = (text) => ({ root: process.cwd(), files: [README], params: {}, read: (file) => (file === README ? text : null) });

test('RT_GENERATED_BLOCK_STALE: the shipped README holds every generated block current', () => {
  assert.deepEqual(staleBlocks(readme, manifest, catalog), []);
  assert.deepEqual(generatedBlockFindings(ctxOf(readme)), []);
  assert.equal(writeBlocks(readme, manifest, catalog), readme, 'writing a current README changes nothing');
});

test('RT_GENERATED_BLOCK_STALE: the blocks render every slot, every rule and every back-end tier', () => {
  assert.ok(manifest.slots.every((slot) => renderBlock('app-map', manifest, catalog).includes(`\`${slot.id}\``)));
  assert.ok(catalog.rules.every((rule) => renderBlock('rules', manifest, catalog).includes(`| ${rule.id} | \`${rule.code}\` |`)));
  for (const tier of Object.keys(manifest.tiers.be)) assert.match(renderBlock('be-tiers', manifest, catalog), new RegExp(`^\\| ${tier} \\|`, 'm'));
  assert.ok(manifest.slots.filter((slot) => slot.profiles.includes('be') && slot.presence !== 'forbidden').every((slot) => renderBlock('be-tree', manifest, catalog).includes(slot.id)));
});

test('RT_GENERATED_BLOCK_STALE: a hand-edited block and a block whose markers are gone are findings that name the block', () => {
  const edited = readme.replace('| R01 |', '| R01 edited |');
  assert.deepEqual(generatedBlockFindings(ctxOf(edited)).map((f) => f.code), ['RT_GENERATED_BLOCK_STALE']);
  assert.match(generatedBlockFindings(ctxOf(edited))[0].message, /block rules/);
  const unmarked = readme.replace('<!-- hfs:generated app-map -->', '');
  assert.deepEqual(staleBlocks(unmarked, manifest, catalog), ['app-map']);
  assert.deepEqual(staleBlocks('# no blocks\n', manifest, catalog), [...BLOCKS]);
});

test('RT_GENERATED_BLOCK_STALE: writing the blocks repairs a stale README, and a repo without the README is not judged', () => {
  const edited = readme.replace('| R01 |', '| R01 edited |');
  assert.equal(writeBlocks(edited, manifest, catalog), readme);
  assert.deepEqual(generatedBlockFindings({ root: process.cwd(), files: [], params: {}, read: () => null }), []);
});

// ------------------------------------------------------------------------------------------- derived fields

const index = catalogIndex(catalog);
const PATTERN = [
  'rules:',
  '  - id: BE-X-1',
  '    hfsRules: [R38]',
  '    verification:',
  '      automated:',
  '        - BE_ERROR_HOME',
  '        - BE_LOGGER_REQUIRED',
  '      manual: []',
  '',
].join('\n');

test('derived fields: automated is the failure codes of the cited rules; a typed code another rule owns adds that rule once', () => {
  const owner = index.byCode.get('BE_LOGGER_REQUIRED');
  const { text, unowned } = derivePatternVerification(PATTERN, index, ['eslint-be']);
  assert.deepEqual(unowned, []);
  assert.match(text, new RegExp(`hfsRules: \\[R38, ${owner}\\]`));
  for (const code of [...index.codesOf.get('R38'), ...index.codesOf.get(owner)]) assert.ok(text.includes(`- ${code}`), code);
  assert.equal(derivePatternVerification(text, index, ['eslint-be']).text, text, 'a derived text is a fixed point');
});

test('derived fields: an item no catalog rule owns is reported and left out; an enforcer id maps to its rule', () => {
  const { text, unowned } = derivePatternVerification(PATTERN.replace('BE_LOGGER_REQUIRED', 'made-up-check'), index, ['eslint-be']);
  assert.deepEqual(unowned, [{ rule: 'BE-X-1', item: 'made-up-check' }]);
  assert.ok(!text.includes('made-up-check'));
  const enforcer = catalog.rules.find((rule) => rule.enforcers.some((e) => e.kind === 'eslint-be'));
  const id = enforcer.enforcers.find((e) => e.kind === 'eslint-be').id;
  assert.ok(derivePatternVerification(PATTERN.replace('BE_LOGGER_REQUIRED', id), index, ['eslint-be']).text.includes(`${enforcer.id}`));
});

test('derived fields: a files: entry takes the slot that owns its path; a path no slot owns is a problem', () => {
  const text = 'files:\n  - path: src/a.ts\n    slot: wrong.slot\n    role: x\n  - path: src/b.ts\n    slot: wrong.slot\n';
  const { text: out, problems } = deriveFilesSlots(text, (p) => (p === 'src/a.ts' ? 'be.feature' : null));
  assert.match(out, /path: src\/a\.ts\n {4}slot: be\.feature/);
  assert.deepEqual(problems, ['src/b.ts is owned by no slot']);
});

test('derived fields: a why-map code is the code of the rule that lists the lint rule', () => {
  const entry = catalog.rules.flatMap((rule) => rule.enforcers.filter((e) => e.kind === 'eslint-fe').map((e) => ({ id: e.id, code: rule.failureCodes[0] })))[0];
  const text = `export const why = {\n  "${entry.id}": {\n    code: "WRONG_CODE",\n    en: "x",\n  },\n  "unknown-rule": {\n    code: "X",\n  },\n};\n`;
  const { text: out, problems } = deriveWhyCodes(text, index, 'eslint-fe');
  assert.ok(out.includes(`code: "${entry.code}"`));
  assert.deepEqual(problems, ['unknown-rule is the enforcer of no catalog rule']);
});

test('derived fields: the shipped knowledge, files: trees and why maps equal their derivation', () => {
  const resolver = createProseResolver({ files: ['examples/ecommerce-app/hfs.json'], read: (f) => fs.readFileSync(f, 'utf8') }, manifest);
  const classify = (p) => resolver.classify(`be/${resolver.sample(p.replace(/<kind>/g, 'api'))}`).slot ?? null;
  const files = fs.readdirSync('knowledge/patterns/be').map((name) => `knowledge/patterns/be/${name}`);
  const read = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
  const items = derivedFiles({ files: [...files, ...WHY_FILES.map((w) => w.file)], read, catalog, classify });
  assert.ok(items.length > 10);
  assert.deepEqual(items.filter((item) => item.after !== item.before).map((item) => item.file), []);
  assert.deepEqual(items.flatMap((item) => item.problems), []);
});
