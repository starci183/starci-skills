import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdtemp} from './helpers/tmpdir.mjs';

const root = path.resolve(import.meta.dirname, '..');
const script = 'scripts/checks/check-evidence-binding.mjs';
const run = (...args) => spawnSync(process.execPath, [script, ...args], {cwd: root, encoding: 'utf8', windowsHide: true});
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const codes = stdout => stdout.split('\n').filter(Boolean).map(line => line.split('  ')[0]);

const SOURCE = {
  'service.ts': 'export class TaskService {}\n',
  'service.spec.ts': "it('keeps ownership', () => {});\n",
};

/**
 * One product repository holding one `.starciwork` with one done implementation leaf, its sibling
 * evidence.yaml, and the two source files the evidence hashes. `mutate` reshapes the tree for the
 * violation under test before the check is pointed at it. Built under the OS tmpdir, which is outside any
 * Git working tree, so the freshness rule falls back to the mtime clock deterministically.
 */
function buildTree(t, mutate = () => {}) {
  const base = mkdtemp(t, 'evidence-binding-');
  const repo = path.join(base, 'demo-app');
  const workRoot = path.join(repo, '.starciwork');
  const moduleDir = path.join(repo, 'src', 'task');
  const recordDir = path.join(workRoot, 'features', 'task', 'impl', 'demo-app', 'ownership');
  fs.mkdirSync(moduleDir, {recursive: true});
  fs.mkdirSync(recordDir, {recursive: true});
  for (const [name, body] of Object.entries(SOURCE)) fs.writeFileSync(path.join(moduleDir, name), body);

  const write = (file, body) => fs.writeFileSync(path.join(workRoot, file), body);
  write('index.yaml', 'schema: work/catalog@1\nid: catalog\nfeatures:\n  - task\n');
  write('workspace.yaml', 'schema: work/workspace@1\nid: workspace\nrepositories:\n  - {role: be, name: demo-app}\n');

  const tree = {
    base,
    repo,
    workRoot,
    moduleDir,
    record: {
      schema: 'work/implementation@1',
      id: 'impl.task.demo-app.ownership',
      title: 'The ownership module',
      state: 'done',
      repository: 'demo-app',
      owners: [{role: 'module', path: 'src/task'}],
      proves: ['br.task.ownership'],
    },
    evidence: {
      schema: 'work/evidence@1',
      record: 'impl.task.demo-app.ownership',
      recordDigest: 'f'.repeat(64),
      codeDigest: {
        algorithm: 'sha256',
        files: Object.entries(SOURCE).map(([name, body]) => ({path: `src/task/${name}`, sha256: sha256(body)})),
        digest: '0'.repeat(64),
      },
      outcome: 'pass',
      assertions: [{id: 'br.task.ownership', outcome: 'pass', observation: 'npx jest src/task exited 0'}],
      provenance: {actor: 'example-evidence', tool: 'harness', environment: 'local', capturedAt: '2099-01-01T00:00:00.000Z'},
    },
  };
  mutate(tree);
  fs.writeFileSync(path.join(recordDir, 'index.yaml'), JSON.stringify(tree.record, null, 2));
  fs.writeFileSync(path.join(recordDir, 'evidence.yaml'), JSON.stringify(tree.evidence, null, 2));
  return tree;
}

test('a tree whose proof still binds to its source is clean', (t) => {
  const tree = buildTree(t);
  const clean = run('--work', tree.workRoot);
  assert.equal(clean.status, 0, clean.stdout + clean.stderr);
  assert.equal(clean.stdout, '');

  const json = run('--work', tree.workRoot, '--json');
  assert.equal(json.status, 0, json.stderr);
  assert.deepEqual(JSON.parse(json.stdout), {findings: []});
});

test('EVIDENCE_PATH_MISSING: the proof hashes source that is not there', (t) => {
  const tree = buildTree(t, t => {
    t.evidence.codeDigest.files.push({path: 'src/task/deleted.ts', sha256: sha256('gone\n')});
  });
  const result = run('--work', tree.workRoot);
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(codes(result.stdout), ['EVIDENCE_PATH_MISSING']);
  assert.match(result.stdout, /src\/task\/deleted\.ts/);

  const json = JSON.parse(run('--work', tree.workRoot, '--json').stdout);
  assert.equal(json.findings.length, 1);
  assert.deepEqual(Object.keys(json.findings[0]).sort(), ['code', 'detail', 'node', 'path']);
  assert.equal(json.findings[0].node, 'impl.task.demo-app.ownership');
});

test('EVIDENCE_DIGEST_MISMATCH: the source moved under a recorded digest', (t) => {
  const tree = buildTree(t);
  fs.writeFileSync(path.join(tree.moduleDir, 'service.ts'), 'export class TaskService { renamed = true; }\n');
  const result = run('--work', tree.workRoot);
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(codes(result.stdout), ['EVIDENCE_DIGEST_MISMATCH']);
  assert.match(result.stdout, /src\/task\/service\.ts was hashed/);
});

test('EVIDENCE_DIGEST_MISMATCH is not raised against evidence that already declares itself stale', (t) => {
  const tree = buildTree(t, t => {
    t.evidence.stale = true;
    t.evidence.staleReason = 'The module was rewritten after this run; kept as history.';
  });
  fs.writeFileSync(path.join(tree.moduleDir, 'service.ts'), 'export class TaskService { renamed = true; }\n');
  const result = run('--work', tree.workRoot);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('EVIDENCE_OLDER_THAN_SOURCE: owned source the proof never hashed changed after the capture', (t) => {
  const tree = buildTree(t, t => {
    t.evidence.provenance.capturedAt = '2020-01-01T00:00:00.000Z';
  });
  fs.writeFileSync(path.join(tree.moduleDir, 'added-later.ts'), 'export const addedLater = true;\n');
  const result = run('--work', tree.workRoot);
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(codes(result.stdout), ['EVIDENCE_OLDER_THAN_SOURCE']);
  assert.match(result.stdout, /added-later\.ts/);
  assert.match(result.stdout, /file mtime/);
});

test('EVIDENCE_OLDER_THAN_SOURCE stays quiet when every owned file is pinned by a matching digest', (t) => {
  const tree = buildTree(t, t => {
    t.evidence.provenance.capturedAt = '2020-01-01T00:00:00.000Z';
  });
  const result = run('--work', tree.workRoot);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('EVIDENCE_ASSERTED_NOT_OBSERVED: a done leaf rests on an authored claim', (t) => {
  const tree = buildTree(t, t => {
    t.record.verificationSource = 'authored-claim';
    t.record.because = 'The module was read rather than run.';
  });
  const result = run('--work', tree.workRoot);
  assert.equal(result.status, 1, result.stderr);
  assert.ok(codes(result.stdout).includes('EVIDENCE_ASSERTED_NOT_OBSERVED'));
});

test('a kernel-observed done leaf is not reported as asserted', (t) => {
  const tree = buildTree(t, t => {
    t.record.verificationSource = 'kernel-observed';
  });
  const result = run('--work', tree.workRoot);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('the authored-by-nature schemas are exempt, because the layout declares them so', (t) => {
  const tree = buildTree(t, t => {
    t.record.schema = 'work/policy-decision@1';
    t.record.id = 'decision.task.erasure-method';
    t.record.verificationSource = 'authored-claim';
    t.evidence.record = 'decision.task.erasure-method';
  });
  const result = run('--work', tree.workRoot);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('a todo leaf is not judged at all - only done claims owe proof', (t) => {
  const tree = buildTree(t, t => {
    t.record.state = 'todo';
    t.record.verificationSource = 'authored-claim';
    t.evidence.codeDigest.files[0].sha256 = '1'.repeat(64);
  });
  const result = run('--work', tree.workRoot);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('usage and IO failures exit 2 without printing findings', (t) => {
  const missingWork = run('--json');
  assert.equal(missingWork.status, 2);
  assert.equal(missingWork.stdout, '');
  assert.match(missingWork.stderr, /--work is required/);

  const noValue = run('--work');
  assert.equal(noValue.status, 2);
  assert.match(noValue.stderr, /Missing value for --work/);

  const unknown = run('--work', '.', '--fix');
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /Unknown argument --fix/);

  const absent = run('--work', path.join(os.tmpdir(), 'evidence-binding-no-such-root'));
  assert.equal(absent.status, 2);
  assert.match(absent.stderr, /not a readable directory/);

  const notAWorkRoot = run('--work', os.tmpdir());
  assert.equal(notAWorkRoot.status, 2);
  assert.match(notAWorkRoot.stderr, /not a \.starciwork root/);

  const tree = buildTree(t);
  const badRepo = run('--work', tree.workRoot, '--repo', 'demo-app');
  assert.equal(badRepo.status, 2);
  assert.match(badRepo.stderr, /--repo must be <id>=<git root>/);
});

test('--help names the CLI surface and exits 0', () => {
  const help = run('--help');
  assert.equal(help.status, 0, help.stderr);
  for (const flag of ['--work', '--repo', '--json']) assert.ok(help.stdout.includes(flag), flag);
  for (const code of ['EVIDENCE_PATH_MISSING', 'EVIDENCE_DIGEST_MISMATCH', 'EVIDENCE_OLDER_THAN_SOURCE', 'EVIDENCE_ASSERTED_NOT_OBSERVED']) {
    assert.ok(help.stdout.includes(code), code);
  }
});

test('EVIDENCE_OLDER_THAN_SOURCE reads the commit clock against the record\'s own revision', (t) => {
  const tree = buildTree(t, t => {
    t.evidence.provenance.capturedAt = '2099-01-01T00:00:00.000Z';
  });
  const git = (...args) => spawnSync('git', ['-c', 'user.email=lane@example.invalid', '-c', 'user.name=lane', '-c', 'commit.gpgsign=false', ...args], {cwd: tree.repo, encoding: 'utf8', windowsHide: true});
  if (git('init', '-q').status !== 0) return; // no git on this machine: the mtime clock covers the rule

  git('add', '-A');
  assert.equal(git('commit', '-qm', 'the revision this record was true at').status, 0);
  const revision = git('rev-parse', 'HEAD').stdout.trim();
  fs.writeFileSync(path.join(tree.moduleDir, 'added-later.ts'), 'export const addedLater = true;\n');
  git('add', '-A');
  assert.equal(git('commit', '-qm', 'source that moved after the proof').status, 0);

  // Without the revision the capture is in 2099, so no clock can call the source newer.
  assert.equal(run('--work', tree.workRoot).status, 0);

  const record = JSON.parse(fs.readFileSync(path.join(tree.workRoot, 'features/task/impl/demo-app/ownership/index.yaml'), 'utf8'));
  fs.writeFileSync(path.join(tree.workRoot, 'features/task/impl/demo-app/ownership/index.yaml'), JSON.stringify({...record, revision}, null, 2));
  const result = run('--work', tree.workRoot);
  assert.equal(result.status, 1, result.stderr);
  assert.deepEqual(codes(result.stdout), ['EVIDENCE_OLDER_THAN_SOURCE']);
  assert.match(result.stdout, new RegExp(`git commit time, after the record's own revision ${revision.slice(0, 12)}`));
});

test('--repo points a repository name at an explicit root', (t) => {
  const tree = buildTree(t);
  const moved = mkdtemp(t, 'evidence-binding-repo-');
  fs.mkdirSync(path.join(moved, 'src', 'task'), {recursive: true});
  for (const [name, body] of Object.entries(SOURCE)) fs.writeFileSync(path.join(moved, 'src', 'task', name), body);
  fs.rmSync(path.join(tree.repo, 'src'), {recursive: true, force: true});

  const unmapped = run('--work', tree.workRoot);
  assert.equal(unmapped.status, 1, unmapped.stderr);
  assert.deepEqual(new Set(codes(unmapped.stdout)), new Set(['EVIDENCE_PATH_MISSING']));

  const mapped = run('--work', tree.workRoot, '--repo', `demo-app=${moved}`);
  assert.equal(mapped.status, 0, mapped.stdout + mapped.stderr);
});
