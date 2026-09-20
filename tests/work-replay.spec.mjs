import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {checkTree, planCommand, runAssertion, collectAssertions, analyzeAssertion} from '../scripts/checks/check-work-replay.mjs';

/**
 * Fixture trees for scripts/checks/check-work-replay.mjs - one per behavior the replay engine promises:
 * cwd resolution order, the REPLAYABLE/NOT_REPLAYABLE verdict, ASSERTION_NO_CWD severity
 * downgrade, redirect stripping and real --run execution. Fixtures live on the same drive as the
 * repo (never os.tmpdir(), matching tests/example-work-gate.spec.mjs's reasoning).
 */
const TMP_ROOT = path.join(path.parse(process.cwd()).root, 'starci-tmp');

let counter = 0;
function freshDir() {
  counter += 1;
  const dir = path.join(TMP_ROOT, `replay-fixture-${process.pid}-${counter}`);
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  return dir;
}

function write(rootDir, rel, content) {
  const file = path.join(rootDir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

const freshOut = () => ({refuse: [], suspect: [], info: [], replayable: 0, dead: 0, executed: 0, pass: 0, fail: 0});

/** A two-repository fixture: <parent>/app is the backend repo owning .starciwork, <parent>/app-fe
 * is the sibling `role: fe` repository. `extra` maps .starciwork-relative paths to YAML content;
 * `beFiles`/`feFiles` map repository-relative paths to file content. */
function tree(extra, {beFiles = {}, feFiles = {}} = {}) {
  const parent = freshDir();
  const backendRoot = path.join(parent, 'app');
  const feRoot = path.join(parent, 'app-fe');
  const workRoot = path.join(backendRoot, '.starciwork');
  write(workRoot, 'index.yaml', 'schema: work/catalog@1\nid: fixture\nfeatures: []\n');
  write(workRoot, 'workspace.yaml', 'schema: work/workspace@1\nid: fixture\nrepositories: [{role: be, name: app}, {role: fe, name: app-fe}]\n');
  for (const [rel, content] of Object.entries(extra)) write(workRoot, rel, content);
  for (const [rel, content] of Object.entries(beFiles)) write(backendRoot, rel, content);
  for (const [rel, content] of Object.entries(feFiles)) write(feRoot, rel, content);
  return {workRoot, backendRoot, feRoot};
}

const IMPL = 'schema: work/implementation@1\nid: impl.f.x\ntitle: t\nstate: todo\nrepository: app-fe\n';
const evidence = assertions => `schema: work/evidence@1\nrecord: impl.f.x\noutcome: pass\nassertions:\n${assertions}`;

test('repository-stamped records resolve cwd to the bound sibling repo: `npm run build` is judged by the frontend package.json', () => {
  const {workRoot} = tree({
    'features/f/impl/x/index.yaml': IMPL,
    'features/f/impl/x/evidence.yaml': evidence('  - {id: a1, command: "npm run build", exit: 0, outcome: pass}\n'),
  }, {feFiles: {'package.json': '{"scripts":{"build":"next build"}}'}});
  const out = freshOut();
  checkTree(workRoot, out);
  assert.equal(out.replayable, 1, JSON.stringify(out, null, 2));
  assert.equal(out.dead, 0);
  assert.equal(out.suspect.filter(s => s.includes('ASSERTION_NO_CWD')).length, 0);
});

test('a dead npm script under a stamped cwd is REFUSE-tier NOT_REPLAYABLE', () => {
  const {workRoot} = tree({
    'features/f/impl/x/index.yaml': IMPL,
    'features/f/impl/x/evidence.yaml': evidence('  - {id: a1, command: "npm run ghost", exit: 0, outcome: pass}\n'),
  }, {feFiles: {'package.json': '{"scripts":{"build":"next build"}}'}});
  const out = freshOut();
  checkTree(workRoot, out);
  assert.equal(out.dead, 1);
  assert.ok(out.refuse.some(r => r.includes('npm script "ghost"') && r.includes('NOT_REPLAYABLE')), out.refuse.join('\n'));
});

test('no cwd stamp anywhere falls back to the backend root and downgrades the verdict to SUSPECT + ASSERTION_NO_CWD', () => {
  const beImpl = 'schema: work/implementation@1\nid: impl.f.x\ntitle: t\nstate: todo\n';
  const {workRoot, backendRoot} = tree({
    'features/f/impl/x/index.yaml': beImpl,
    'features/f/impl/x/evidence.yaml': evidence('  - {id: a1, command: "node ok.mjs", exit: 0, outcome: pass}\n'),
  }, {beFiles: {'ok.mjs': 'console.log(1);\n'}});
  const out = freshOut();
  checkTree(workRoot, out);
  assert.equal(out.replayable, 1, 'the file exists under the guessed backend root');
  assert.equal(out.refuse.length, 0);
  assert.ok(out.suspect.some(s => s.includes('ASSERTION_NO_CWD')), out.suspect.join('\n'));
  assert.ok(fs.existsSync(path.join(backendRoot, 'ok.mjs')));
});

test('a path dead under the resolved cwd but present under the evidence dir reports where it resolves', () => {
  const beImpl = 'schema: work/implementation@1\nid: impl.f.x\ntitle: t\nstate: todo\n';
  const {workRoot} = tree({
    'features/f/impl/x/index.yaml': beImpl,
    'features/f/impl/x/evidence.yaml': evidence('  - {id: a1, command: "cat assets/run.txt", exit: 0, outcome: pass}\n'),
    'features/f/impl/x/assets/run.txt': 'captured output\n',
  });
  const out = freshOut();
  checkTree(workRoot, out);
  assert.equal(out.dead, 1);
  assert.ok(out.suspect.some(s => s.includes('NOT_REPLAYABLE') && s.includes('resolves under')), out.suspect.join('\n'));
});

test('assertion.cwd stamps win over evidence.cwd, which wins over the record repository', () => {
  const {workRoot, feRoot} = tree({
    'features/f/impl/x/index.yaml': IMPL,
    'features/f/impl/x/evidence.yaml':
      'schema: work/evidence@1\nrecord: impl.f.x\ncwd: .\noutcome: pass\nassertions:\n  - {id: a1, command: "npm run build", cwd: deep, exit: 0, outcome: pass}\n',
  }, {feFiles: {'package.json': '{"scripts":{"build":"next build"}}', 'deep/keep.txt': 'x\n'}});
  const {assertions} = collectAssertions(workRoot);
  const spec = assertions[0].spec;
  assert.equal(spec.via, 'assertion.cwd');
  assert.equal(spec.cwd, path.join(feRoot, 'deep')); // relative stamp resolves against the record repo first
});

test('planCommand peels env assignments, strips redirects, and folds cd chains into cwd', () => {
  const plan = planCommand('API_URL=http://x:1 cd ../app-fe && node verify.mjs assets > capture.txt', '/base/app');
  assert.deepEqual(plan.env, {API_URL: 'http://x:1'});
  assert.deepEqual(plan.redirects, [{op: '>', target: 'capture.txt'}]);
  assert.equal(plan.steps.length, 1);
  assert.equal(plan.steps[0].cwd, path.resolve('/base/app-fe'));
  assert.deepEqual(plan.steps[0].argv, ['node', 'verify.mjs', 'assets']);
  assert.equal(plan.needsShell, false, 'cd folds away, one real step remains');
});

test('runAssertion executes for real: pass, fail and timeout are verdicts, and a stripped redirect writes no file', async () => {
  const {workRoot, backendRoot} = tree({
    'features/f/impl/x/index.yaml': 'schema: work/implementation@1\nid: impl.f.x\ntitle: t\nstate: todo\n',
    'features/f/impl/x/evidence.yaml': evidence('  - {id: a1, command: "node -e process.exit(0)", exit: 0, outcome: pass}\n'),
  });
  const {assertions} = collectAssertions(workRoot);
  const item = assertions[0];

  item.assertion.command = `node -e "console.log('hi')" > written.txt`;
  const pass = await runAssertion(item, 20000);
  assert.equal(pass.status, 'REPLAY_PASS');
  assert.equal(fs.existsSync(path.join(backendRoot, 'written.txt')), false, 'the stripped redirect must not rewrite the captured artifact');

  item.assertion.command = 'node -e "process.exit(3)"';
  assert.equal((await runAssertion(item, 20000)).status, 'REPLAY_FAIL');

  item.assertion.command = 'node -e "setInterval(()=>{},1000)"';
  assert.equal((await runAssertion(item, 500)).status, 'REPLAY_TIMEOUT');
});

test('analyzeAssertion: an assertion without a command is NOT_REPLAYABLE', () => {
  const verdict = analyzeAssertion({assertion: {id: 'a1'}, spec: {stamped: true}, dir: '.'});
  assert.equal(verdict.verdict, 'NOT_REPLAYABLE');
  assert.match(verdict.detail, /no command/);
});
