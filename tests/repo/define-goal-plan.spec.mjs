import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DEFINE_GOAL = path.join(ROOT, 'scripts', 'goal', 'define-goal.mjs');

// A Source with one app project binding, built in a tmp dir. The
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
    schema: 'starci/workspace-binding@2',
    project: 'pair',
    repository: { pathFromSource: 'app', gitRepository: 'https://example.test/pair.git' },
    sides: { be: 'be', fe: 'fe' },
    work: { pathFromRepository: '.starciwork' },
  }));
  write('app/package.json', JSON.stringify({ name: 'pair', devDependencies: { jest: '^29', vitest: '^3' } }));
  write('app/be/src/main.ts', 'export const a = 1;\nexport const b = 2;\nexport const c = 3;\n');
  write('app/fe/src/page.tsx', 'export default function Page() { return null; }\n');
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
  assert.deepEqual(Object.keys(rows).sort(), ['be', 'fe']);
  assert.equal(path.resolve(rows.be.repo), path.join(source, 'app', 'be'));
  assert.equal(path.resolve(rows.fe.repo), path.join(source, 'app', 'fe'));
  assert.match(rows.be.line, /^files 1, loc ~3, tests none, starciwork absent$/);
  assert.match(rows.fe.line, /^files 1, loc ~1, tests none, starciwork absent$/);
  for (const row of Object.values(rows)) assert.doesNotMatch(row.line, /[{}[\]]/, 'no JSON dump in a STATE row');
  assert.ok(!fs.existsSync(path.join(source, 'app', '.starciwork')), '--plan writes nothing to the app repository');
});

test('define-goal passes the owner Work root, so a settled brand record drops brand.decide', t => {
  const source = projectSource(t);
  const prompt = 'build Collab group chat end to end';
  const without = JSON.parse(plan(source, prompt, '--json').stdout);
  assert.ok(without.opChain.includes('brand.decide'), 'no brand record: brand.decide stays');
  fs.mkdirSync(path.join(source, 'app', '.starciwork', 'brand'), { recursive: true });
  fs.writeFileSync(path.join(source, 'app', '.starciwork', 'brand', 'index.yaml'), 'schema: work/brand@1\nid: pair.brand\nstate: done\n');
  const r = plan(source, prompt);
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /brand\.decide/);
  assert.match(r.stdout, /\n {2}assumed: brand: settled record brand\/index\.yaml state done — satisfied out-of-band, no chain leg\n/);
  assert.ok(!fs.existsSync(path.join(source, 'app', '.starciwork', 'runtime.sqlite')), '--plan writes nothing');
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

test('define-goal names the workflow: --display-name wins, else `<Product> · <goal clause>` from the text', t => {
  const source = projectSource(t);
  const derived = plan(source, 'Build the enrolment api endpoint. Then more.', '--json');
  assert.equal(derived.status, 0, derived.stderr);
  assert.equal(JSON.parse(derived.stdout).displayName, 'Pair · Build the enrolment api endpoint');
  const given = plan(source, 'build the enrolment api endpoint', '--display-name', 'Pair · Ghi danh', '--json');
  assert.equal(given.status, 0, given.stderr);
  assert.equal(JSON.parse(given.stdout).displayName, 'Pair · Ghi danh');
  const human = plan(source, 'build the enrolment api endpoint', '--display-name', 'Pair · Ghi danh');
  assert.match(human.stdout, /^ {2}name: Pair · Ghi danh$/m);
});
