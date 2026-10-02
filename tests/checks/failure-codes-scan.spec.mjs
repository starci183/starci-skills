// scripts/checks/check-failure-codes.mjs counts a bracketed UPPER_SNAKE name as an emitted code only in text (a message,
// a template, a comment), never where JavaScript code reads a constant: an element access, an array literal or a
// computed key holding one identifier.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emittedCodes } from '../../scripts/checks/check-failure-codes.mjs';

// Each fixture is removed when its test ends: under the suite's isolated-temp preload a leftover temp dir fails the spec file.
function fixture(t, source) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-failure-codes-scan-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true }); fs.writeFileSync(path.join(base, rel), text); };
  write('modules/kernel/allowlist.yaml', 'schema: starci/allowlist@1\nnot-codes: []\n');
  write('scripts/land.mjs', source);
  write('modules/models/kinds.yaml', 'vocabularies: {}\n');
  write('engine/db/migrations/runtime/0001-init.sql', '');
  return base;
}
const codes = (t, lines) => emittedCodes(fixture(t, lines.join('\n'))).map((e) => e.code);

test('a computed member access with a constant key is not an emitted code', (t) => {
  const found = codes(t, [
    "export const MIRROR_CHECK = 'scripts/hfs/sync-runtime.mjs';",
    'export function verdict(baseline, r) {',
    '  baseline[MIRROR_CHECK] = r;',
    '  return [baseline?.[MIRROR_CHECK], read()[MIRROR_CHECK], baseline[0][MIRROR_CHECK]];',
    '}',
  ]);
  assert.ok(!found.includes('MIRROR_CHECK'), found.join(', '));
});

test('an array literal or a computed key holding one constant is not an emitted code', (t) => {
  const found = codes(t, [
    "export const SKILL_ROOT = 'runtime';",
    'export const plan = { repos: [SKILL_ROOT], byRoot: { [SKILL_ROOT]: true } };',
  ]);
  assert.ok(!found.includes('SKILL_ROOT'), found.join(', '));
});

test('a bracketed code in a message, a multi-line template or a comment is still an emitted code', (t) => {
  const found = codes(t, [
    'export const fail = (detail) => { throw new Error(`[TARGET_MISSING] ${detail}`); };',
    'export const explain = (n) => `refused because',
    '  the record is ${n} days old [PLAN_STALE]`;',
    '/** A JSDoc line naming [DOC_CODE] is text. */',
  ]);
  for (const code of ['TARGET_MISSING', 'PLAN_STALE', 'DOC_CODE']) assert.ok(found.includes(code), `${code} in ${found.join(', ')}`);
});

// RT_CODE_SOLE_EMITTER: the rule catalog is not an emitter; a rule code needs a built lint or Sonar enforcer, or a literal in code.
import { catalogProblems } from '../../scripts/checks/check-failure-codes.mjs';
const ENTRY = (code) => `${code}:\n  title: "t"\n  title_vi: "t"\n  meaning_vi: "m"\n  causes_vi:\n    - "c"\n  nextStep_vi: "n"\n  owner: supervisor\n  kind: check-finding\n`;
function catalogFixture(t, { source, rules, catalogCodes }) {
  const base = fixture(t, source);
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true }); fs.writeFileSync(path.join(base, rel), text); };
  write('modules/ops/ops/x.yaml', 'schema: op\n');
  write('modules/kernel/failure-codes.yaml', catalogCodes.map(ENTRY).join('\n'));
  write('knowledge/hfs/rules.yaml', `rules:\n${rules}`);
  return base;
}
const RULE = (code, kind) => `  - id: R01\n    code: "${code}"\n    failureCodes: ["${code}"]\n    enforcers:\n      - {kind: ${kind}, id: x${kind === 'runtime' ? ', at: scripts/x.mjs' : ''}}\n`;

test('a rule code that only the rule catalog spells is a sole-emitter finding unless a lint plugin enforcer reports it', (t) => {
  const lint = catalogProblems(catalogFixture(t, { source: '// nothing\n', rules: RULE('BE_SAMPLE_RULE', 'eslint-be'), catalogCodes: ['BE_SAMPLE_RULE'] }));
  assert.deepEqual(lint.soleEmitter, []);
  const runtime = catalogProblems(catalogFixture(t, { source: '// nothing\n', rules: RULE('BE_SAMPLE_RULE', 'runtime'), catalogCodes: ['BE_SAMPLE_RULE'] }));
  assert.deepEqual(runtime.soleEmitter.map((e) => e.code), ['BE_SAMPLE_RULE']);
});

test('a code a check spells in code is emitted whatever the rule catalog says; an unlisted or unemitted code is missing or stale', (t) => {
  const spelled = catalogProblems(catalogFixture(t, { source: "export const A = 'RT_SAMPLE_CODE';\n", rules: RULE('RT_SAMPLE_CODE', 'runtime'), catalogCodes: ['RT_SAMPLE_CODE'] }));
  assert.deepEqual([spelled.soleEmitter, spelled.missing, spelled.stale], [[], [], []]);
  const drift = catalogProblems(catalogFixture(t, { source: "export const A = 'RT_NEW_CODE';\n", rules: RULE('BE_X_RULE', 'eslint-be'), catalogCodes: ['RT_OLD_CODE'] }));
  assert.deepEqual([drift.missing.map((e) => e.code), drift.stale], [['BE_X_RULE', 'RT_NEW_CODE'], ['RT_OLD_CODE']]);
});
