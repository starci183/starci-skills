// proves: RT_FACT_FALSE@lite
// proves: RT_FACT_FALSE@full
// proves: RT_RULE_ID_UNKNOWN@lite
// proves: RT_RULE_ID_UNKNOWN@full
// proves: RT_RULE_UNCITED@lite
// proves: RT_RULE_UNCITED@full
// proves: RT_GENERATED_BLOCK_STALE@lite
// proves: RT_GENERATED_BLOCK_STALE@full
// proves: RT_PROSE_RESTATES_SLOTS@lite
// proves: RT_PROSE_RESTATES_SLOTS@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadRuleCatalog, loadSlotManifest } from '../../scripts/hfs/slots.mjs';
import { README, writeBlocks } from '../../scripts/hfs/readme-blocks.mjs';
import { factFindings } from '../../scripts/hfs/runtime-rules/facts.mjs';
import { ruleIdFindings } from '../../scripts/hfs/runtime-rules/rule-ids.mjs';
import { generatedBlockFindings } from '../../scripts/hfs/runtime-rules/generated-block.mjs';
import { proseRestateFindings } from '../../scripts/hfs/runtime-rules/prose-restates.mjs';

const catalog = loadRuleCatalog();
const manifest = loadSlotManifest();
const currentReadme = writeBlocks(fs.readFileSync(README, 'utf8'), manifest, catalog);
const productIds = catalog.rules.filter((rule) => rule.scope !== 'runtime').map((rule) => rule.id);
const citations = `hfsRules: [${productIds.join(', ')}]\n`;
const facts = [
  'schema: starci/facts@1',
  'facts:',
  '  - id: root-lockfile',
  '    claim: The root lockfile is required.',
  '    slot: {id: app.lockfile, presence: required}',
  '    contradicts:',
  '      - pattern: root lockfile is forbidden',
  '',
].join('\n');

// Runtime knowledge rules judge the same authored catalogs in both editions.
// Each context also supplies the real declaration of the edition's example app.
function context(edition, texts) {
  const app = edition === 'lite' ? 'lite-app' : 'ecommerce-app';
  const example = `examples/${app}/hfs.json`;
  const sources = { [example]: fs.readFileSync(example, 'utf8'), ...texts };
  return { root: process.cwd(), files: Object.keys(sources), params: {}, read: (file) => sources[file] ?? null };
}

for (const edition of ['lite', 'full']) {
  test(`${edition} facts reject a false slot claim and contradictory prose`, () => {
    assert.deepEqual(factFindings(context(edition, {
      'knowledge/hfs/facts.yaml': facts.replace('presence: required', 'presence: forbidden'),
    })).map((finding) => finding.code), ['RT_FACT_FALSE']);
    assert.deepEqual(factFindings(context(edition, {
      'knowledge/hfs/facts.yaml': facts,
      'docs/evidence.md': 'The root lockfile is forbidden.\n',
    })).map((finding) => finding.code), ['RT_FACT_FALSE']);
  });

  test(`${edition} facts accept a true claim and a fact reference`, () => {
    assert.deepEqual(factFindings(context(edition, {
      'knowledge/hfs/facts.yaml': facts,
      'docs/evidence.md': 'See fact root-lockfile.\n',
    })), []);
  });

  test(`${edition} rule ids reject an unknown catalog reference`, () => {
    assert.deepEqual(ruleIdFindings(context(edition, {
      'docs/evidence.md': 'See R999.\n',
    })).map((finding) => finding.code), ['RT_RULE_ID_UNKNOWN']);
  });

  test(`${edition} rule ids reject product rules without a pattern citation`, () => {
    assert.deepEqual([...new Set(ruleIdFindings(context(edition, {
      'knowledge/patterns/repo/evidence.yaml': 'hfsRules: [R192]\n',
    })).map((finding) => finding.code))], ['RT_RULE_UNCITED']);
  });

  test(`${edition} rule ids accept known references and citations for every product rule`, () => {
    assert.deepEqual(ruleIdFindings(context(edition, {
      'docs/evidence.md': 'See R192.\n',
      'knowledge/patterns/repo/evidence.yaml': citations,
    })), []);
  });

  test(`${edition} generated knowledge rejects a hand edited README block`, () => {
    assert.deepEqual(generatedBlockFindings(context(edition, {
      [README]: currentReadme.replace('| R01 |', '| R01 edited |'),
    })).map((finding) => finding.code), ['RT_GENERATED_BLOCK_STALE']);
  });

  test(`${edition} generated knowledge rejects stale derived verification`, () => {
    assert.deepEqual(generatedBlockFindings(context(edition, {
      'knowledge/patterns/repo/evidence.yaml': [
        'rules:',
        '  - id: REPO-EVIDENCE-1',
        '    hfsRules: [R192]',
        '    verification:',
        '      automated: []',
        '',
      ].join('\n'),
    })).map((finding) => finding.code), ['RT_GENERATED_BLOCK_STALE']);
  });

  test(`${edition} generated knowledge accepts freshly rendered blocks and derived verification`, () => {
    assert.deepEqual(generatedBlockFindings(context(edition, {
      [README]: currentReadme,
      'knowledge/patterns/repo/evidence.yaml': [
        'rules:',
        '  - id: REPO-EVIDENCE-1',
        '    hfsRules: [R192]',
        '    verification:',
        '      automated:',
        '        - RT_FACT_FALSE',
        '',
      ].join('\n'),
    })), []);
  });

  test(`${edition} prose rejects a repeated list of slot file names`, () => {
    assert.deepEqual(proseRestateFindings(context(edition, {
      'docs/evidence.md': 'The root holds `package.json`, `hfs.json` and `package-lock.json`.\n',
    })).map((finding) => finding.code), ['RT_PROSE_RESTATES_SLOTS']);
  });

  test(`${edition} prose accepts slot references and generated snapshots`, () => {
    assert.deepEqual(proseRestateFindings(context(edition, {
      'docs/evidence.md': [
        'Refer to slots app.package and app.lockfile.',
        '<!-- hfs:generated example -->',
        'The root holds `package.json`, `hfs.json` and `package-lock.json`.',
        '<!-- hfs:generated-end example -->',
        '',
      ].join('\n'),
    })), []);
  });
}
