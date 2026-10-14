import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { recordedLines } from '../../scripts/api/git/recorded-lines.mjs';
import { runGit } from '../../scripts/api/git/lib.mjs';
import { withoutGitLocalEnv } from '../../scripts/lib/git.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const lines = (count) => 'export const value = 1;\n' + '// line\n'.repeat(count - 1);

function fixture(t, branch = 'main') {
  const dir = mkdtemp(t, 'starci-recorded-lines-');
  for (const key of ['STARCI_BASE_REF', 'GIT_INDEX_FILE']) {
    const previous = process.env[key];
    delete process.env[key];
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const git = (...args) => {
    const result = runGit(args, { dir, env: withoutGitLocalEnv(process.env), config: { 'user.email': 'fixture@example.invalid', 'user.name': 'fixture', 'commit.gpgsign': 'false' } });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '-q', '-b', branch);
  const file = path.join(dir, 'be', 'apps', 'api', 'src', 'large.ts');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const put = (count) => fs.writeFileSync(file, lines(count));
  const commit = (message) => { git('add', '-A'); git('commit', '-q', '-m', message); };
  put(6);
  commit('base');
  return { dir, file, git, put, commit };
}

test('recordedLines compares committed branch growth and new files with the merge base, preserving explicit revisions', (t) => {
  const { file, git, put, commit } = fixture(t);
  git('checkout', '-q', '-b', 'feature');
  put(9);
  commit('grown');
  assert.equal(recordedLines(file), 6);
  assert.equal(recordedLines(file, 'HEAD'), 9);
  const newFile = path.join(path.dirname(file), 'new.ts');
  fs.writeFileSync(newFile, lines(10));
  commit('new file');
  assert.equal(recordedLines(newFile), null);
  assert.equal(recordedLines(path.join(path.dirname(file), 'missing', 'new.ts')), null);
});

test('recordedLines chooses origin/main before main, then an explicit base without fallback', (t) => {
  const { file, git, put, commit } = fixture(t);
  git('checkout', '-q', '-b', 'feature');
  put(7);
  commit('remote base');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  git('branch', 'custom');
  put(8);
  commit('growth');
  assert.equal(recordedLines(file), 7);
  process.env.STARCI_BASE_REF = 'main';
  assert.equal(recordedLines(file), 6);
  process.env.STARCI_BASE_REF = 'custom';
  assert.equal(recordedLines(file), 7);
  process.env.STARCI_BASE_REF = 'missing-base';
  assert.equal(recordedLines(file), 'unavailable');
  assert.equal(recordedLines(file, 'missing-revision'), 'unavailable');
});

test('recordedLines surfaces missing repositories, missing bases and unrelated base histories as unavailable', (t) => {
  const { dir, file, git } = fixture(t, 'feature');
  assert.equal(recordedLines(file), 'unavailable');
  assert.equal(recordedLines(path.join(mkdtemp(t, 'starci-no-git-'), 'file.ts')), 'unavailable');
  const tree = git('mktree');
  const unrelated = git('commit-tree', tree, '-m', 'unrelated');
  git('update-ref', 'refs/heads/main', unrelated);
  assert.equal(recordedLines(file), 'unavailable');
  assert.equal(recordedLines(path.join(dir, 'new.ts')), 'unavailable');
});

test('recordedLines uses HEAD only for matching staged text in commit context, including nested cwd and relative index', (t) => {
  const { dir, file, git, put, commit } = fixture(t);
  git('checkout', '-q', '-b', 'feature');
  put(8);
  commit('branch growth');
  put(7);
  git('add', file);
  assert.equal(recordedLines(file, { source: lines(7) }), 6, 'ordinary lint retains the branch base even with staged changes');
  process.env.GIT_INDEX_FILE = '.git/index';
  assert.equal(recordedLines(file, { source: lines(7) }), 8);
  assert.equal(recordedLines(file, { source: lines(7).replaceAll('\n', '\r\n') }), 8);
  assert.equal(recordedLines(file, { source: lines(9) }), 6, 'unstaged lint text cannot select HEAD');
  assert.equal(recordedLines(file), 6, 'an index variable alone cannot select HEAD');
  const before = process.cwd();
  try {
    process.chdir(path.join(dir, 'be'));
    assert.equal(recordedLines(file, { source: lines(7) }), 8);
  } finally { process.chdir(before); }
  git('restore', '--staged', file);
  assert.equal(recordedLines(file, { source: lines(8) }), 6, 'unchanged index files cannot select HEAD');
});

test('recordedLines selects HEAD through an actual pre-commit hook and preserves the base for pre-push lint', (t) => {
  const { dir, file, git, put, commit } = fixture(t);
  git('checkout', '-q', '-b', 'feature');
  put(8);
  commit('branch growth');
  const output = path.join(dir, 'probe.json');
  const probe = path.join(dir, 'probe.mjs');
  const api = new URL('../../scripts/api/git/recorded-lines.mjs', import.meta.url).href;
  fs.writeFileSync(probe, `import fs from 'node:fs';\nimport { recordedLines } from ${JSON.stringify(api)};\nconst file = ${JSON.stringify(file)};\nfs.writeFileSync(${JSON.stringify(output)}, JSON.stringify({ recorded: recordedLines(file, { source: fs.readFileSync(file, 'utf8') }) }));\n`);
  const quote = (value) => `'${value.replaceAll('\\', '/').replaceAll("'", "'\\''")}'`;
  for (const hook of ['pre-commit', 'pre-push']) fs.writeFileSync(path.join(dir, '.git', 'hooks', hook), `#!/bin/sh\ncd be\n${quote(process.execPath)} ${quote(probe)}\n`, { mode: 0o755 });
  put(7);
  git('add', file);
  git('hook', 'run', 'pre-push');
  assert.equal(JSON.parse(fs.readFileSync(output)).recorded, 6);
  git('commit', '-q', '-m', 'staged shrink');
  assert.equal(JSON.parse(fs.readFileSync(output)).recorded, 8);
});
