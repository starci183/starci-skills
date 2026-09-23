import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validateWork } from '../scripts/checks/work-validate.mjs';

// inc-16fe1a2895fd: `starci validate` went green on records an ajv 2020 compile of their own schema refused
// (closed objects, slug and timestamp patterns). `--strict` is that compile; the default stays lenient
// because live trees still carry records written before it, and ops run strict on what they write.

const root = path.resolve(import.meta.dirname, '..');
const exampleRule = fs.readFileSync(path.join(root, 'examples', 'todo-app-backend', '.starciwork', 'features', 'task', 'br', 'complete', 'once', 'index.yaml'), 'utf8');

function tree(t, files) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-strict-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  const work = path.join(repo, '.starciwork');
  const all = { 'index.yaml': 'schema: work/catalog@1\nid: fixture\nfeatures: []\n', ...files };
  for (const [rel, content] of Object.entries(all)) {
    const file = path.join(work, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, 'utf8');
  }
  return work;
}

const schemaLines = report => report.refused.filter(line => /\[SCHEMA_[A-Z_]+\]$/.test(line));
const recordDir = work => path.join(work, 'features', 'task', 'br', 'complete', 'once');

test('strict validate compiles a record against its named schema and passes a record the schema accepts', (t) => {
  const work = tree(t, { 'features/task/br/complete/once/index.yaml': exampleRule });
  const report = validateWork(recordDir(work), { strict: true });
  assert.equal(report.strict, true);
  assert.deepEqual(schemaLines(report), []);
  assert.equal(report.counts.schemaChecked, 1);
  assert.equal(report.counts.schemaRejected, 0);
});

test('a key the closed schema refuses is a strict refusal and stays invisible to the lenient default', (t) => {
  const work = tree(t, { 'features/task/br/complete/once/index.yaml': `${exampleRule.trimEnd()}\ncolour: blue\n` });
  const lenient = validateWork(recordDir(work));
  assert.equal(lenient.strict, false);
  assert.deepEqual(schemaLines(lenient), [], 'the default mode does not flood live workflows with schema refusals');
  const strict = validateWork(recordDir(work), { strict: true });
  assert.equal(strict.ok, false);
  const lines = schemaLines(strict);
  assert.ok(lines.some(line => /features\/task\/br\/complete\/once\/index\.yaml: \/ must NOT have additional properties \(colour\) under modules\/schemas\/work-business-rule\.schema\.yaml \[SCHEMA_VIOLATION\]$/.test(line)), lines.join('\n'));
  assert.equal(strict.counts.schemaRejected, 1);
});

test('a slug or timestamp outside its pattern is refused under strict', (t) => {
  const bad = exampleRule.replace('at: 2026-09-19T15:59:33.966Z', 'at: yesterday afternoon');
  assert.notEqual(bad, exampleRule, 'the fixture edit must land');
  const work = tree(t, { 'features/task/br/complete/once/index.yaml': bad });
  const lines = schemaLines(validateWork(recordDir(work), { strict: true }));
  assert.ok(lines.some(line => line.includes('/change/at ') && line.endsWith('[SCHEMA_VIOLATION]')), lines.join('\n'));
});

test('strict names a work family no catalogued schema defines, and skips kernel custody and payloads', (t) => {
  const work = tree(t, {
    'features/task/br/complete/once/index.yaml': exampleRule,
    'features/task/gap/odd/index.yaml': 'schema: work/not-a-family@1\nid: gap.task.odd\n',
    'kernel-evidence/run-1/index.yaml': 'schema: work/business-rule@1\nid: whatever\nunknownKey: 1\n',
    'features/task/br/complete/once/assets/receipt.yaml': 'schema: starci/generation-receipts@1\nanything: goes\n',
  });
  const report = validateWork(work, { strict: true });
  const lines = schemaLines(report);
  assert.ok(lines.some(line => /features\/task\/gap\/odd\/index\.yaml: names schema work\/not-a-family@1, .* \[SCHEMA_UNKNOWN\]$/.test(line)), lines.join('\n'));
  assert.ok(!lines.some(line => line.includes('kernel-evidence')), 'kernel custody has its own lifetime and validators');
  assert.ok(!lines.some(line => line.includes('receipt.yaml')), 'a foreign schema is an artifact payload, not a record');
});

test('the CLI takes --strict and reports it', (t) => {
  const work = tree(t, { 'features/task/br/complete/once/index.yaml': `${exampleRule.trimEnd()}\ncolour: blue\n` });
  const run = spawnSync(process.execPath, [path.join(root, 'bin', 'starci.mjs'), 'validate', recordDir(work), '--strict', '--json'], { encoding: 'utf8' });
  assert.equal(run.status, 1, run.stderr);
  const report = JSON.parse(run.stdout);
  assert.equal(report.strict, true);
  assert.ok(schemaLines(report).length > 0);
});
