// proves: RT_EXTERNAL_OWNER@lite
// proves: RT_EXTERNAL_OWNER@full
// proves: RT_TIER_DIRECTION@lite
// proves: RT_TIER_DIRECTION@full
// proves: RT_BASE_IMPURE@lite
// proves: RT_BASE_IMPURE@full
// proves: RT_API_SHAPE@lite
// proves: RT_API_SHAPE@full
// proves: RT_SPEC_PLACEMENT@lite
// proves: RT_SPEC_PLACEMENT@full
// proves: RT_SOURCE_NAME@lite
// proves: RT_SOURCE_NAME@full
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createSlotResolver, loadSlotManifest, resolveRepoDeclaration, RUNTIME_MANIFEST_FILE, ruleParams } from '../../scripts/hfs/slots.mjs';
import { parseSource } from '../../scripts/hfs/runtime-rules/source-ast.mjs';
import { externalOwnerFindings } from '../../scripts/hfs/runtime-rules/external-owner.mjs';
import { tierFindings } from '../../scripts/hfs/runtime-rules/tier-direction.mjs';
import { basePureFindings } from '../../scripts/hfs/runtime-rules/base-pure.mjs';
import { apiShapeFindings } from '../../scripts/hfs/runtime-rules/api-shape.mjs';
import { specPlacementFindings } from '../../scripts/hfs/runtime-rules/test-layout.mjs';
import { sourceNameFindings } from '../../scripts/hfs/runtime-rules/source-name.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const MANIFEST = loadSlotManifest({ root: ROOT, file: path.join(ROOT, RUNTIME_MANIFEST_FILE) });
const RESOLVER = createSlotResolver(MANIFEST, resolveRepoDeclaration(MANIFEST, { hfs: 1, kind: 'runtime', project: 'starci' }));
const PARAMS = ruleParams(MANIFEST, 'runtime');
const codesOf = (findings) => findings.map((finding) => finding.code);

// Both editions judge these runtime sources against the same runtime manifest.
function context(edition, texts) {
  const sources = Object.entries(texts).map(([file, text]) => ({ path: file, text }));
  const parsed = new Map(sources.map((source) => [source.path, parseSource(source.text, source.path)]));
  const files = sources.map((source) => source.path);
  return {
    edition, manifest: MANIFEST, resolver: RESOLVER, params: PARAMS, sources, files,
    fileSet: new Set(files), sourceSet: new Set(files), base: null,
    parsed: (file) => parsed.get(file), read: (file) => texts[file] ?? null,
  };
}

for (const edition of ['lite', 'full']) {
  test(`${edition} RT_EXTERNAL_OWNER rejects external module, program and global use outside its owner`, () => {
    const found = externalOwnerFindings(context(edition, {
      'scripts/kernel/external-run.mjs': "import { spawnSync } from 'node:child_process';\nspawnSync('git', ['status']);\nfetch('https://example.com');\n",
    }));
    assert.deepEqual(codesOf(found), ['RT_EXTERNAL_OWNER', 'RT_EXTERNAL_OWNER', 'RT_EXTERNAL_OWNER']);
    assert.ok(found.every((finding) => finding.path === 'scripts/kernel/external-run.mjs'));
  });

  test(`${edition} RT_EXTERNAL_OWNER accepts the program owner and a locally bound fetch`, () => {
    assert.deepEqual(externalOwnerFindings(context(edition, {
      'scripts/api/git/show.mjs': "import { spawnSync } from 'node:child_process';\nexport const show = () => spawnSync('git', ['status']);\n",
      'scripts/kernel/local-fetch.mjs': 'const fetch = (value) => value;\nexport const localFetch = () => fetch(1);\n',
    })), []);
  });

  test(`${edition} RT_TIER_DIRECTION rejects a base import of a kernel owner and a missing target`, () => {
    const found = tierFindings(context(edition, {
      'scripts/lib/lower-value.mjs': "import '../kernel/upper-value.mjs';\n",
      'scripts/kernel/upper-value.mjs': 'export const upperValue = 1;\n',
      'scripts/kernel/missing-value.mjs': "import '../lib/absent-value.mjs';\n",
    }));
    assert.deepEqual(codesOf(found), ['RT_TIER_DIRECTION', 'RT_TIER_DIRECTION']);
    assert.ok(found.some((finding) => /missing internal target/.test(finding.message)));
    assert.ok(found.some((finding) => finding.path === 'scripts/lib/lower-value.mjs'));
  });

  test(`${edition} RT_TIER_DIRECTION accepts kernel to api and base imports`, () => {
    assert.deepEqual(tierFindings(context(edition, {
      'scripts/kernel/read-value.mjs': "import '../lib/lower-value.mjs';\nimport '../api/git/show.mjs';\n",
      'scripts/api/git/show.mjs': "import '../../lib/lower-value.mjs';\nexport function show() {}\n",
      'scripts/lib/lower-value.mjs': 'export const lowerValue = 1;\n',
    })), []);
  });

  test(`${edition} RT_BASE_IMPURE rejects filesystem writes and environment reads in base modules`, () => {
    const found = basePureFindings(context(edition, {
      'scripts/lib/write-value.mjs': "import { writeFileSync as write } from 'node:fs';\nexport const writeValue = (file) => write(file, 'value');\n",
      'scripts/lib/read-setting.mjs': 'export const readSetting = () => process.env.STARCI_SETTING;\n',
    }));
    assert.deepEqual(codesOf(found), ['RT_BASE_IMPURE', 'RT_BASE_IMPURE']);
    assert.ok(found.some((finding) => /calls fs writeFileSync/.test(finding.message)));
    assert.ok(found.some((finding) => /reads process.env/.test(finding.message)));
  });

  test(`${edition} RT_BASE_IMPURE accepts file reads and an environment read in its declared seam`, () => {
    assert.deepEqual(basePureFindings(context(edition, {
      'scripts/lib/read-value.mjs': "import fs from 'node:fs';\nexport const readValue = (file) => fs.readFileSync(file, 'utf8');\n",
      'scripts/lib/sleep-sync.mjs': 'export const scale = () => Number(process.env.STARCI_SLEEP_SCALE ?? 1);\n',
    })), []);
  });

  test(`${edition} RT_API_SHAPE rejects extra call exports and imports across api systems`, () => {
    const found = apiShapeFindings(context(edition, {
      'scripts/api/git/show.mjs': "import '../fs/lib.mjs';\nexport const PAGE = 1;\nexport function show() {}\n",
      'scripts/api/fs/lib.mjs': 'export const run = () => null;\n',
    }));
    assert.deepEqual(codesOf(found), ['RT_API_SHAPE', 'RT_API_SHAPE']);
    assert.ok(found.some((finding) => /exports PAGE beside show/.test(finding.message)));
    assert.ok(found.some((finding) => /an api system never imports another/.test(finding.message)));
  });

  test(`${edition} RT_API_SHAPE accepts one camelCase call export and its own system runner`, () => {
    assert.deepEqual(apiShapeFindings(context(edition, {
      'scripts/api/git/worktree-add.mjs': "import { run } from './lib.mjs';\nexport const worktreeAdd = () => run();\n",
      'scripts/api/git/lib.mjs': 'export const run = () => null;\n',
      'scripts/kernel/read-worktree.mjs': "import '../api/git/worktree-add.mjs';\n",
    })), []);
  });

  test(`${edition} RT_SPEC_PLACEMENT rejects flat specs, source-adjacent runtime specs and package test suffixes`, () => {
    const found = specPlacementFindings(context(edition, {
      'tests/flat-value.spec.mjs': '',
      'scripts/kernel/read-value.spec.mjs': '',
      'packages/eslint/be/read-value.test.mjs': '',
    }));
    assert.deepEqual(codesOf(found), ['RT_SPEC_PLACEMENT', 'RT_SPEC_PLACEMENT', 'RT_SPEC_PLACEMENT']);
  });

  test(`${edition} RT_SPEC_PLACEMENT accepts area specs, support files, fixtures and package specs`, () => {
    assert.deepEqual(specPlacementFindings(context(edition, {
      'tests/kernel/read-value.retry.spec.mjs': '',
      'tests/helpers/value-fixture.mjs': '',
      'tests/setup/value-preload.mjs': '',
      'tests/fixtures/value/data.json': '{}\n',
      'packages/eslint/be/read-value.spec.mjs': '',
    })), []);
  });

  test(`${edition} RT_SOURCE_NAME rejects one-off names, camelCase and repeated tier basenames`, () => {
    const found = sourceNameFindings(context(edition, {
      'scripts/kernel/tmp-value.mjs': '',
      'scripts/kernel/camelCase.mjs': '',
      'scripts/agent/inspect-value.mjs': '',
      'scripts/guards/inspect-value.mjs': '',
    }));
    assert.deepEqual(codesOf(found), ['RT_SOURCE_NAME', 'RT_SOURCE_NAME', 'RT_SOURCE_NAME', 'RT_SOURCE_NAME']);
    assert.ok(found.some((finding) => /one-off name/.test(finding.message)));
    assert.ok(found.some((finding) => /not kebab-case/.test(finding.message)));
    assert.equal(found.filter((finding) => /repeats inside/.test(finding.message)).length, 2);
  });

  test(`${edition} RT_SOURCE_NAME accepts durable kebab names and shared api runner basenames`, () => {
    assert.deepEqual(sourceNameFindings(context(edition, {
      'scripts/kernel/workflow-checkpoint.mjs': '',
      'scripts/api/git/lib.mjs': '',
      'scripts/api/fs/lib.mjs': '',
      'scripts/lib/read-value.mjs': '',
      'scripts/kernel/read-value.mjs': '',
    })), []);
  });
}
