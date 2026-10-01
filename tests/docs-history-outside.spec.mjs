// docs/ is current knowledge: every document there is read by the doc checks (scripts/checks/check-doc-language.mjs
// RUNTIME_DOCUMENT_ROOTS) and shipped in the package. fable.md, a dated journal of findings that names removed
// mechanisms, is history: it lives in .experiments/, which no doc check reads and the package does not ship.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { RUNTIME_DOCUMENT_ROOTS } from '../scripts/checks/check-doc-language.mjs';
import { retiredPaths } from '../scripts/checks/check-contract-cites.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');

test('the fable journal is history outside docs/: no doc check reads it and the package does not ship it', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'docs', 'fable.md')), false, 'docs/ holds no dated journal');
  assert.equal(fs.existsSync(path.join(ROOT, '.experiments', 'fable.md')), true, 'the journal is kept as history');
  assert.ok(!RUNTIME_DOCUMENT_ROOTS.includes('.experiments'), 'the doc checks do not read .experiments/');
  const files = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).files;
  assert.ok(!files.some((entry) => entry.startsWith('.experiments')), 'the package does not ship .experiments/');
  assert.ok(retiredPaths(ROOT).has('docs/fable.md'), 'history that cites docs/fable.md stays a valid cite');
});
