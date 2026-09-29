import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../engine/yaml.mjs';
import { STYLE_WHY, whyOfStyleRule } from '../scripts/checks/style-why.mjs';
// lib/why.mjs has no dependencies, so this spec does not need stylelint installed.
import { why } from '../packages/stylelint/lib/why.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ruleNames = Object.keys(why).map((name) => `starci/${name}`);
const catalog = parseYaml(fs.readFileSync(path.join(root, 'modules/kernel/failure-codes.yaml'), 'utf8'));

test('every rule of the stylelint canon is mapped, and only those', () => {
  const index = fs.readFileSync(path.join(root, 'packages/stylelint/index.mjs'), 'utf8');
  for (const ruleId of ruleNames) assert.ok(index.includes(`"${ruleId.slice('starci/'.length)}":`), `${ruleId} is not registered in the plugin`);
  assert.deepEqual(Object.keys(STYLE_WHY).sort(), [...ruleNames].sort());
});

test('the runtime map agrees with the plugin why on every rule', () => {
  for (const ruleId of ruleNames) assert.equal(STYLE_WHY[ruleId], why[ruleId.slice('starci/'.length)].code, ruleId);
});

test('every mapped code is catalogued with Vietnamese text and a next step', () => {
  for (const code of new Set(Object.values(STYLE_WHY))) {
    const entry = catalog[code];
    assert.ok(entry, `${code} is not in the failure catalog`);
    for (const field of ['title', 'title_vi', 'meaning_vi', 'nextStep_vi']) assert.ok(typeof entry[field] === 'string' && entry[field].length > 0, `${code}.${field}`);
    assert.ok(/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i.test(entry.meaning_vi), `${code}.meaning_vi is not Vietnamese`);
    assert.ok(Array.isArray(entry.causes_vi) && entry.causes_vi.length > 0, `${code}.causes_vi`);
  }
});

test('the catalog says stylelint-disable is an inline suppression', () => {
  assert.match(catalog.HFS_INLINE_SUPPRESSION.meaning_vi, /stylelint-disable/);
});

test('a rule without a code has none', () => {
  assert.equal(whyOfStyleRule('starci-be/catch-must-account'), undefined);
  assert.equal(whyOfStyleRule(null), undefined);
  assert.equal(whyOfStyleRule('starci/source-resolves'), 'FE_STYLE_SOURCE_UNRESOLVED');
});
