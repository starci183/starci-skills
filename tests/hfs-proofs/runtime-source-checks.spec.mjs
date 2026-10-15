// proves: RT_PORT_RESTATED@lite
// proves: RT_PORT_RESTATED@full
// proves: RT_CONFIG_DEFAULT_TWICE@lite
// proves: RT_CONFIG_DEFAULT_TWICE@full
// proves: RT_SLOT_ID_SHAPE@lite
// proves: RT_SLOT_ID_SHAPE@full
// proves: RT_SPEC_OVER_BUDGET@lite
// proves: RT_SPEC_OVER_BUDGET@full
// proves: RT_SPEC_BUDGET_STALE@lite
// proves: RT_SPEC_BUDGET_STALE@full
// proves: RT_IDENTIFIER_UNDECLARED@lite
// proves: RT_IDENTIFIER_UNDECLARED@full
// proves: RT_REMOVED_VOCABULARY@lite
// proves: RT_REMOVED_VOCABULARY@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';
import { checkPortOnce } from '../../scripts/checks/check-port-once.mjs';
import { checkDefaultOnce } from '../../scripts/checks/check-default-once.mjs';
import { checkSlotIdShape } from '../../scripts/checks/check-slot-id-shape.mjs';
import { checkSpecBudget } from '../../scripts/checks/check-spec-budget.mjs';
import { checkUndeclaredIdentifiers } from '../../scripts/checks/check-undeclared-identifiers.mjs';
import { checkRemovedVocabulary } from '../../scripts/checks/check-removed-vocabulary.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

function write(root, rel, text) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

function repository(t, edition, files, tracked = false) {
  const root = mkdtemp(t, `starci-runtime-source-${edition}-`);
  for (const [rel, text] of Object.entries(files)) write(root, rel, text);
  if (tracked) {
    for (const args of [['init', '-q'], ['add', '.']]) {
      const result = spawnSync('git', args, { cwd: root, env: withoutGitLocalEnv(process.env), encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    }
  }
  return root;
}

const portOwners = {
  'modules/models/runtimes.yaml': 'statusApp:\n  port: 4547\n  devPort: 4548\n',
  'scripts/gates/sonar-local.mjs': "const DEFAULT_HOST = 'http://localhost:9010';\nexport { DEFAULT_HOST };\n",
};
const defaultOwners = {
  'config.example.yaml': 'supervisor:\n  pollIntervalMs: 600000\n',
  'scripts/machine/home.mjs': 'export const DEFAULTS = Object.freeze({ pollIntervalMs: 600_000 });\n',
  'engine/config.mjs': "export const DEFAULT_OWNER_LANGUAGE = 'en';\n",
};
const manifest = (id, suffixes = ['service'], bannedSuffixes = ['helper']) => JSON.stringify({
  naming: { prefixes: ['be'] }, slots: [{ id }], ruleParams: { be: { suffixes, bannedSuffixes } },
});
const runtimeManifest = JSON.stringify({ profiles: ['runtime'], slots: [{ id: 'runtime.checks' }] });
const budgetRecord = (seconds, spec = 'tests/live.spec.mjs') =>
  `limitSeconds: 12\nrows:\n  - {spec: ${spec}, seconds: ${seconds}}\n`;

// These repository checks share one runtime standard for apps in either edition.
for (const edition of ['lite', 'full']) {
  test(`${edition}: port ownership rejects a tracked restatement`, (t) => {
    const root = repository(t, edition, {
      ...portOwners,
      'scripts/reader.mjs': "export const host = 'http://localhost:4547';\n",
    }, true);
    assert.deepEqual(checkPortOnce(root).map((finding) => [finding.code, finding.path]),
      [['RT_PORT_RESTATED', 'scripts/reader.mjs']]);
  });

  test(`${edition}: port ownership accepts a reference to its reader`, (t) => {
    const root = repository(t, edition, {
      ...portOwners,
      'scripts/reader.mjs': "import { UI_PORT } from '../ui/ports.mjs';\nexport const port = UI_PORT;\n",
      'ui/ports.mjs': 'export const UI_PORT = readStatusApp().port;\n',
    }, true);
    assert.deepEqual(checkPortOnce(root), []);
  });

  test(`${edition}: configuration ownership rejects a literal fallback`, (t) => {
    const root = repository(t, edition, {
      ...defaultOwners,
      'scripts/reader.mjs': 'export const interval = cfg.pollIntervalMs ?? 600_000;\n',
    }, true);
    assert.deepEqual(checkDefaultOnce(root).map((finding) => [finding.code, finding.path]),
      [['RT_CONFIG_DEFAULT_TWICE', 'scripts/reader.mjs']]);
  });

  test(`${edition}: configuration ownership accepts the owner constant`, (t) => {
    const root = repository(t, edition, {
      ...defaultOwners,
      'scripts/reader.mjs': "import { DEFAULTS } from './machine/home.mjs';\nexport const interval = cfg.pollIntervalMs ?? DEFAULTS.pollIntervalMs;\n",
    }, true);
    assert.deepEqual(checkDefaultOnce(root), []);
  });

  test(`${edition}: slot grammar rejects an invalid id and conflicting role suffix`, (t) => {
    const root = repository(t, edition, {
      'knowledge/hfs/slots.yaml': manifest('be.Bad_name', ['service'], ['service']),
      'knowledge/hfs/runtime-slots.yaml': runtimeManifest,
    });
    assert.deepEqual(checkSlotIdShape(root).map((finding) => finding.code),
      ['RT_SLOT_ID_SHAPE', 'RT_SLOT_ID_SHAPE']);
  });

  test(`${edition}: slot grammar accepts a declared prefix and disjoint suffix vocabulary`, (t) => {
    const root = repository(t, edition, {
      'knowledge/hfs/slots.yaml': manifest('be.feature'),
      'knowledge/hfs/runtime-slots.yaml': runtimeManifest,
    });
    assert.deepEqual(checkSlotIdShape(root), []);
  });

  test(`${edition}: spec budget reports an over-budget duration as advisory`, (t) => {
    const root = repository(t, edition, {
      'modules/kernel/spec-durations.yaml': budgetRecord(13),
      'tests/live.spec.mjs': 'export {};\n',
    });
    assert.deepEqual(checkSpecBudget(root).map((finding) => [finding.code, finding.level]),
      [['RT_SPEC_OVER_BUDGET', 'info']]);
  });

  test(`${edition}: spec budget rejects a stale recorded path`, (t) => {
    const root = repository(t, edition, { 'modules/kernel/spec-durations.yaml': budgetRecord(12) });
    assert.deepEqual(checkSpecBudget(root).map((finding) => [finding.code, finding.level]),
      [['RT_SPEC_BUDGET_STALE', 'error']]);
  });

  test(`${edition}: spec budget accepts a live spec at its exact limit`, (t) => {
    const root = repository(t, edition, {
      'modules/kernel/spec-durations.yaml': budgetRecord(12),
      'tests/live.spec.mjs': 'export {};\n',
    });
    assert.deepEqual(checkSpecBudget(root), []);
  });

  test(`${edition}: identifier scope rejects a reference left without its import`, (t) => {
    const root = repository(t, edition, {
      'scripts/reader.mjs': 'export const read = () => missingHelper();\n',
    });
    assert.deepEqual(checkUndeclaredIdentifiers(root).map((finding) => [finding.code, finding.path]),
      [['RT_IDENTIFIER_UNDECLARED', 'scripts/reader.mjs']]);
  });

  test(`${edition}: identifier scope accepts a real imported binding`, (t) => {
    const root = repository(t, edition, {
      'scripts/reader.mjs': "import { helper } from './helper.mjs';\nexport const read = () => helper();\n",
      'scripts/helper.mjs': 'export const helper = () => 1;\n',
    });
    assert.deepEqual(checkUndeclaredIdentifiers(root), []);
  });

  test(`${edition}: removed vocabulary rejects obsolete instructions`, (t) => {
    const root = repository(t, edition, { 'docs/setup.md': 'Set models.pools to choose agents.\n' }, true);
    assert.deepEqual(checkRemovedVocabulary(root).map((finding) => [finding.code, finding.path, finding.name]),
      [['RT_REMOVED_VOCABULARY', 'docs/setup.md', 'models.pools']]);
  });

  test(`${edition}: removed vocabulary accepts instructions using its replacement`, (t) => {
    const root = repository(t, edition, { 'docs/setup.md': 'Set models.tiers to choose agents.\n' }, true);
    assert.deepEqual(checkRemovedVocabulary(root), []);
  });
}
