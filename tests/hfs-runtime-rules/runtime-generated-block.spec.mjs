// runtime-generated-block.spec.mjs - RT_GENERATED_BLOCK_STALE (scripts/hfs/runtime-rules/generated-block.mjs): the generated
// blocks of knowledge/hfs/README.md equal what scripts/hfs/readme-blocks.mjs renders from slots.yaml and rules.yaml.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BLOCKS, README, renderBlock, staleBlocks, writeBlocks } from '../../scripts/hfs/readme-blocks.mjs';
import { generatedBlockFindings } from '../../scripts/hfs/runtime-rules/generated-block.mjs';
import { loadRuleCatalog, loadSlotManifest } from '../../scripts/hfs/slots.mjs';

const manifest = loadSlotManifest();
const catalog = loadRuleCatalog();
const readme = fs.readFileSync(README, 'utf8');
const ctxOf = (text) => ({ root: process.cwd(), read: (file) => (file === README ? text : null) });

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
  assert.deepEqual(generatedBlockFindings({ root: process.cwd(), read: () => null }), []);
});
