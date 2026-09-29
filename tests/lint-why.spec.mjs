import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../engine/yaml.mjs';
import { LINT_WHY, whyOfLintRule } from '../scripts/checks/lint-why.mjs';
import { packageIdentity } from '../scripts/checks/check-scoped-lint.mjs';
import plugin, { recommended } from '../packages/eslint/be/index.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = parseYaml(fs.readFileSync(path.join(root, 'modules/kernel/failure-codes.yaml'), 'utf8'));
const profile = parseYaml(fs.readFileSync(path.join(root, 'modules/models/code-patterns.yaml'), 'utf8')).profiles.nest;

/** The rules that belong to HFS v2: every rule added or re-enabled by the back-end canon 1.3.0. */
const HFS_V2_RULES = [
  'catch-must-account', 'error-home', 'no-runtime-schema', 'sql-only-in-repository', 'no-entity-in-contract',
  'no-untyped-body', 'public-needs-reason', 'secret-compare-timing-safe', 'no-direct-env-read', 'no-secret-default',
  'global-module-allowlist', 'typed-module-definition', 'static-module-register', 'no-new-injectable', 'no-module-let',
  'one-module-per-file', 'no-inline-suppression', 'file-size-soft-limit', 'file-size-growth', 'spec-no-source-read',
  'spec-typed-doubles', 'must-deep-module-import', 'no-folder-reexport',
].map(name => `starci-be/${name}`);

test('every mapped lint rule exists in the canon plugin and every HFS v2 rule is mapped', () => {
  for (const ruleId of Object.keys(LINT_WHY)) assert.ok(ruleId.slice('starci-be/'.length) in plugin.rules, `${ruleId} is mapped but not published`);
  for (const ruleId of HFS_V2_RULES) {
    assert.ok(ruleId.slice('starci-be/'.length) in plugin.rules, `${ruleId} is not published`);
    assert.ok(LINT_WHY[ruleId], `${ruleId} has no why code`);
  }
  assert.deepEqual(Object.keys(LINT_WHY).sort(), [...HFS_V2_RULES].sort());
});

test('every mapped why code is catalogued with Vietnamese text and a next step', () => {
  for (const code of new Set(Object.values(LINT_WHY))) {
    const entry = catalog[code];
    assert.ok(entry, `${code} is not in the failure catalog`);
    for (const field of ['title', 'title_vi', 'meaning_vi', 'nextStep_vi']) assert.ok(typeof entry[field] === 'string' && entry[field].length > 0, `${code}.${field}`);
    assert.ok(/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(entry.meaning_vi), `${code}.meaning_vi is not Vietnamese`);
    assert.ok(Array.isArray(entry.causes_vi) && entry.causes_vi.length > 0, `${code}.causes_vi`);
  }
});

test('a lint rule without a why code has none, and a mapped one names its catalogued code', () => {
  assert.equal(whyOfLintRule('starci-be/no-double-cast'), undefined);
  assert.equal(whyOfLintRule(null), undefined);
  assert.equal(whyOfLintRule('starci-be/catch-must-account'), 'BE_LOGGER_REQUIRED');
});

test('the nest profile names only published rules, holds none off, and pins the canon package as it is', () => {
  const ids = new Set();
  const walk = node => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    if (node.check?.kind === 'eslint') {
      for (const id of node.check.ruleIds ?? []) ids.add(id);
      assert.notEqual(node.check.expected?.severity, 'off', `${node.id} guards a rule switched off`);
    }
    Object.values(node).forEach(walk);
  };
  walk(profile);
  for (const id of ids) {
    if (!id.startsWith('starci-be/')) continue;
    assert.ok(id.slice('starci-be/'.length) in plugin.rules, `${id} is in the profile but not in the canon`);
  }
  for (const ruleId of HFS_V2_RULES) {
    if (ruleId === 'starci-be/file-size-soft-limit') continue;
    assert.ok(ids.has(ruleId), `${ruleId} is not held by an obligation`);
  }
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'packages/eslint/be/package.json'), 'utf8'));
  assert.equal(profile.canon.version, pkg.version);
  const identity = packageIdentity(path.join(root, 'packages/eslint/be'), profile.canon.contentDigest);
  assert.equal(identity.digest, profile.canon.contentDigest.value);
  assert.equal(identity.files, profile.canon.contentDigest.files);
});

test('no published rule is off in the recommendation', () => {
  const off = Object.entries(recommended).filter(([, setting]) => (Array.isArray(setting) ? setting[0] : setting) === 'off');
  assert.deepEqual(off, []);
});
