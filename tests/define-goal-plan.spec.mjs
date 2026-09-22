import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFINE_GOAL = path.join(ROOT, 'scripts', 'goal', 'define-goal.mjs');

// A Source with a two-repository project binding, built in a tmp dir. The
// STARCI_SOURCE_ROOT seam points define-goal's registry lookup at it.
function projectSource(t) {
  const source = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-source-'));
  t.after(() => fs.rmSync(source, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const write = (rel, text) => {
    const file = path.join(source, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  write('.workspaces/projects/pair/work.json', JSON.stringify({
    schema: 'starci/workspace-binding@1',
    project: 'pair',
    repositories: { be: { pathFromSource: 'be' }, fe: { pathFromSource: 'fe' }, grammar: { pathFromSource: 'missing-grammar' } },
    work: { ownerRole: 'be', pathFromRepository: '.starciwork' },
  }));
  write('be/package.json', JSON.stringify({ name: 'be', devDependencies: { jest: '^29' } }));
  write('be/src/main.ts', 'export const a = 1;\nexport const b = 2;\nexport const c = 3;\n');
  write('fe/package.json', JSON.stringify({ name: 'fe', devDependencies: { vitest: '^3' } }));
  write('fe/src/page.tsx', 'export default function Page() { return null; }\n');
  write('fe/.starciwork/index.yaml', 'schema: work/catalog@1\n');
  return source;
}

const plan = (source, text, ...extra) => spawnSync(process.execPath,
  [DEFINE_GOAL, '--project', 'pair', '--text', text, '--plan', ...extra],
  { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...process.env, STARCI_SOURCE_ROOT: source } });

test('define-goal --plan STATE shows each role its own compact assess summary', t => {
  const source = projectSource(t);
  const r = plan(source, 'build the enrolment api endpoint');
  assert.equal(r.status, 0, r.stderr);
  const rows = Object.fromEntries(r.stdout.split('\n')
    .map(line => /^ {2}(be|fe|grammar) {2}(\S.*?) {2}— (.*)$/.exec(line))
    .filter(Boolean).map(m => [m[1], { repo: m[2], line: m[3] }]));
  assert.deepEqual(Object.keys(rows).sort(), ['be', 'fe', 'grammar']);
  assert.equal(path.resolve(rows.be.repo), path.join(source, 'be'));
  assert.match(rows.be.line, /^files 2, loc ~3, tests jest, starciwork absent$/);
  assert.match(rows.fe.line, /^files 3, loc ~1, tests vitest, starciwork present$/);
  assert.equal(rows.grammar.line, 'missing');
  for (const row of Object.values(rows)) assert.doesNotMatch(row.line, /[{}[\]]/, 'no JSON dump in a STATE row');
  assert.ok(!fs.existsSync(path.join(source, 'be', '.starciwork')), '--plan writes nothing to the owner repository');
});

test('an unmatched prompt prints the chain as underivable instead of a guessed leg list', t => {
  const source = projectSource(t);
  const r = plan(source, 'xin chào, hôm nay thế nào');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /OP CHAIN[^\n]*\n {2}underivable \(kernel will derive at boot\)\n {2}reason: needs-owner — /);
  assert.doesNotMatch(r.stdout, /^\s+1\. /m, 'no numbered leg is printed');
  const json = plan(source, 'xin chào, hôm nay thế nào', '--json');
  assert.equal(json.status, 0, json.stderr);
  const out = JSON.parse(json.stdout);
  assert.equal(out.opChain, null);
  assert.deepEqual(out.legs, []);
  assert.equal(out.underivable?.status, 'needs-owner');
});
