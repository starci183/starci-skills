import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { allowlistSprawlFindings, checkOneAllowlist, ALLOWLIST_SCHEMA_FILE, HISTORY_DIR } from '../../scripts/checks/check-one-allowlist.mjs';
import { ALLOWLIST_FILE } from '../../scripts/lib/allowlist.mjs';

const codes = (findings) => findings.map((f) => [f.code, f.path]);

test('the allowlist, its schema, the check and its spec are the only list-named files allowed', () => {
  assert.deepEqual(allowlistSprawlFindings([
    ALLOWLIST_FILE,
    ALLOWLIST_SCHEMA_FILE,
    'scripts/checks/check-one-allowlist.mjs',
    'scripts/lib/allowlist.mjs',
    'tests/checks/one-allowlist.spec.mjs',
  ]), []);
});

test('a file named like a retired list mechanism is sprawl wherever it lives', () => {
  assert.deepEqual(codes(allowlistSprawlFindings([
    'modules/kernel/failure-codes.not-codes',
    'modules/schemas/json-exceptions.yaml',
    'scripts/checks/dead-scripts.entries',
    'knowledge/hfs/audit.pending',
    'tools/lint-baseline.json',
    'docs/scan-baseline.txt',
    'modules/ops/allowlist.yaml',
  ])), [
    ['RT_ALLOWLIST_SPRAWL', 'modules/kernel/failure-codes.not-codes'],
    ['RT_ALLOWLIST_SPRAWL', 'modules/schemas/json-exceptions.yaml'],
    ['RT_ALLOWLIST_SPRAWL', 'scripts/checks/dead-scripts.entries'],
    ['RT_ALLOWLIST_SPRAWL', 'knowledge/hfs/audit.pending'],
    ['RT_ALLOWLIST_SPRAWL', 'tools/lint-baseline.json'],
    ['RT_ALLOWLIST_SPRAWL', 'docs/scan-baseline.txt'],
    ['RT_ALLOWLIST_SPRAWL', 'modules/ops/allowlist.yaml'],
  ]);
});

test('a bare non-.mjs file under scripts/checks/ is a list a check should not keep', () => {
  assert.deepEqual(codes(allowlistSprawlFindings([
    'scripts/checks/check-ok.mjs',
    'scripts/checks/known-hosts.allow',
    'scripts/checks/notes.txt',
  ])), [
    ['RT_ALLOWLIST_SPRAWL', 'scripts/checks/known-hosts.allow'],
    ['RT_ALLOWLIST_SPRAWL', 'scripts/checks/notes.txt'],
  ]);
});

test('the append-only contract history is outside the law: a change id may name the mechanism it changed', () => {
  assert.deepEqual(allowlistSprawlFindings([
    `${HISTORY_DIR}baseline-eslint-ignores-work.yaml`,
    `${HISTORY_DIR}json-exceptions-shape-slot-and-ui.yaml`,
    'modules/kernel/retired-paths.yaml',
  ]), []);
});

test('this runtime keeps exactly one allowlist', () => {
  assert.deepEqual(checkOneAllowlist(path.resolve(import.meta.dirname, '..', '..')), []);
});
