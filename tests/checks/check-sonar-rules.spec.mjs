import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { checkSonarRules, CODE_STALE } from '../../scripts/checks/check-sonar-rules.mjs';
import { readBaseline } from '../../scripts/gates/sonar-rules-baseline.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const SCRIPT = path.resolve(import.meta.dirname, '..', '..', 'scripts', 'checks', 'check-sonar-rules.mjs');
const PROPERTIES = 'sonar.sources=src\nsonar.inclusions=**/*.mjs\nsonar.exclusions=**/*.spec.mjs\n';
const SORTS = 'export const f = (list) => [...list].sort();\n';
const CLEAN = 'export const f = (list) => [...list].sort((a, b) => a - b);\n';

const put = (root, relative, text) => {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

const checkout = (t, files = {}) => {
  const root = mkdtemp(t, 'starci-sonar-check-');
  put(root, 'sonar-project.properties', PROPERTIES);
  for (const [file, text] of Object.entries(files)) put(root, file, text);
  return root;
};

const run = (root, ...args) => spawnSync(process.execPath, [SCRIPT, '--root', root, ...args], { encoding: 'utf8', windowsHide: true, timeout: 120_000 });

test('a checkout without sonar-project.properties is skipped with the reason, not failed', async (t) => {
  const root = mkdtemp(t, 'starci-sonar-check-');
  const result = await checkSonarRules({ root });
  assert.equal(result.ok, true);
  assert.match(result.skipped, /not a source checkout/);
});

test('a finding prints as `<Sonar id> <file>:<line> <message>` and exits 1', (t) => {
  const root = checkout(t, { 'src/a.mjs': `\n${SORTS}` });
  const result = run(root);
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.equal(result.stderr.trim(), 'S2871 src/a.mjs:2 Provide a compare function to avoid sorting elements alphabetically.');
});

test('files outside the Sonar scope are not judged', async (t) => {
  const root = checkout(t, { 'src/a.spec.mjs': SORTS, 'other/b.mjs': SORTS, 'src/c.txt': SORTS, 'src/ok.mjs': CLEAN });
  const result = await checkSonarRules({ root });
  assert.deepEqual([result.ok, result.checked], [true, 1]);
});

test('--init writes the baseline of today\'s findings; a listed finding is green, a new one red, a fixed one stale', async (t) => {
  const root = checkout(t, { 'src/old.mjs': SORTS });
  assert.equal(run(root, '--init').status, 0);
  assert.equal(readBaseline(root).entries.length, 1);
  assert.deepEqual((({ ok, listed }) => ({ ok, listed }))(await checkSonarRules({ root })), { ok: true, listed: 1 });

  put(root, 'src/new.mjs', SORTS);
  const added = await checkSonarRules({ root });
  assert.equal(added.ok, false);
  assert.deepEqual(added.findings.map((f) => f.code), ['S2871']);
  assert.match(added.findings[0].message, /^src\/new\.mjs:1 /);

  fs.rmSync(path.join(root, 'src', 'new.mjs'));
  put(root, 'src/old.mjs', CLEAN);
  const fixed = await checkSonarRules({ root });
  assert.equal(fixed.ok, false);
  assert.deepEqual(fixed.findings.map((f) => f.code), [CODE_STALE]);
  assert.match(fixed.findings[0].message, /src\/old\.mjs: the baseline lists S2871 .*--prune/);
});

test('--init never rewrites an existing section, and --prune only deletes entries (the section ends as [], which --init refuses to refill)', async (t) => {
  const root = checkout(t, { 'src/old.mjs': SORTS });
  run(root, '--init');
  put(root, 'src/new.mjs', SORTS);
  run(root, '--init');
  assert.equal(readBaseline(root).entries.length, 1, 'a new finding is not added to a baseline');
  fs.rmSync(path.join(root, 'src', 'new.mjs'));
  put(root, 'src/old.mjs', CLEAN);
  assert.equal(run(root, '--prune').status, 0);
  assert.deepEqual(readBaseline(root), { exists: true, entries: [] });
  assert.equal((await checkSonarRules({ root })).ok, true);
  put(root, 'src/again.mjs', SORTS);
  run(root, '--init');
  assert.equal(readBaseline(root).entries.length, 0, 'an emptied baseline is not regenerated from new findings');
  assert.equal((await checkSonarRules({ root })).ok, false);
});

test('--json prints the findings as data', (t) => {
  const root = checkout(t, { 'src/a.mjs': SORTS });
  const result = run(root, '--json');
  const doc = JSON.parse(result.stdout);
  assert.equal(doc.ok, false);
  assert.equal(doc.findings[0].code, 'S2871');
});

test('a source with a syntax error is a finding, not a crash', async (t) => {
  const root = checkout(t, { 'src/broken.mjs': 'export const = ;\n' });
  const result = await checkSonarRules({ root });
  assert.deepEqual(result.findings.map((f) => f.code), ['PARSE']);
});
