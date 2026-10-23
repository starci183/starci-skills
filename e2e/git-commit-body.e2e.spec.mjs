// git-commit-body.e2e.spec.mjs - `starci git commit` keeps every line of a multi-line body. A command-shell launcher (the Windows
// cmd shim of starci) ends an argument at its first newline, so a `--body` that went
// through one kept only its first line. The body now also travels as `--body-file <file>` or `--body-file -` (stdin), and the verb hands the whole message
// to git on stdin, never as an argument. Each test commits in a fresh repository through the real CLI and reads the commit back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { mkdtemp } from './helpers/tmpdir.mjs';

const RUNTIME = path.resolve(import.meta.dirname, '..');
const CLI = path.join(RUNTIME, 'packages', 'cli', 'bin', 'starci.mjs');
const BODY = 'first line\nsecond line\n\nthird paragraph, # not a comment';
const env = () => ({ ...process.env, STARCI_RUNTIME: RUNTIME, STARCI_CO_AUTHOR: '' });

const git = (cwd, args) => {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(run.status, 0, `git ${args.join(' ')}: ${run.stderr}`);
  return run.stdout;
};

/** A repository with one commit and one staged file, so the next commit has something to hold. */
function repository(t) {
  const dir = mkdtemp(t, 'starci-git-commit-');
  git(dir, ['init', '-q', '-b', 'work']);
  git(dir, ['config', 'user.email', 'spec@example.invalid']);
  git(dir, ['config', 'user.name', 'spec']);
  git(dir, ['config', 'commit.gpgsign', 'false']);
  fs.writeFileSync(path.join(dir, 'base.txt'), 'base\n');
  git(dir, ['add', 'base.txt']);
  git(dir, ['commit', '-q', '-m', 'chore: base']);
  fs.writeFileSync(path.join(dir, 'change.txt'), 'change\n');
  git(dir, ['add', 'change.txt']);
  return dir;
}

const lastMessage = (dir) => git(dir, ['log', '-1', '--format=%B']).trimEnd();
const quote = (word) => (process.platform === 'win32' ? `"${word}"` : `'${word}'`);

test('a multi-line --body given as one argument is committed whole', (t) => {
  const dir = repository(t);
  const run = spawnSync(process.execPath, [CLI, 'git', 'commit', '--type', 'fix', '--summary', 'keep the body', '--body', BODY], { cwd: dir, env: env(), encoding: 'utf8', windowsHide: true });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(lastMessage(dir), `fix: keep the body\n\n${BODY}`);
});

test('--body-file - reads the body from stdin through a command shell, every line kept', (t) => {
  const dir = repository(t);
  // The platform's command shell (cmd.exe on Windows, /bin/sh elsewhere) runs the launcher line, as a shim does.
  const line = [process.execPath, CLI, 'git', 'commit', '--type', 'fix', '--summary', 'keep the body', '--body-file', '-'].map(quote).join(' ');
  const run = spawnSync(line, { cwd: dir, env: env(), encoding: 'utf8', windowsHide: true, shell: true, input: `${BODY}\n` });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(lastMessage(dir), `fix: keep the body\n\n${BODY}`);
});

test('--body-file <file> commits the file body with CRLF line ends folded to LF', (t) => {
  const dir = repository(t);
  const file = path.join(mkdtemp(t, 'starci-git-body-'), 'body.txt');
  fs.writeFileSync(file, `${BODY.replaceAll('\n', '\r\n')}\r\n`);
  const run = spawnSync(process.execPath, [CLI, 'git', 'commit', '--type', 'docs', '--summary', 'body from a file', '--body-file', file, '--co-author', 'Spec <spec@example.invalid>'], { cwd: dir, env: env(), encoding: 'utf8', windowsHide: true });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(lastMessage(dir), `docs: body from a file\n\n${BODY}\n\nCo-Authored-By: Spec <spec@example.invalid>`);
});

test('--body together with --body-file is refused and commits nothing', (t) => {
  const dir = repository(t);
  const before = git(dir, ['rev-parse', 'HEAD']).trim();
  const run = spawnSync(process.execPath, [CLI, 'git', 'commit', '--type', 'fix', '--summary', 'two bodies', '--body', 'one', '--body-file', '-'], { cwd: dir, env: env(), encoding: 'utf8', windowsHide: true, input: 'two\n' });
  assert.equal(run.status, 2);
  assert.match(`${run.stdout}${run.stderr}`, /--body or --body-file, not both/);
  assert.equal(git(dir, ['rev-parse', 'HEAD']).trim(), before);
});

test('a missing --body-file is refused and commits nothing', (t) => {
  const dir = repository(t);
  const before = git(dir, ['rev-parse', 'HEAD']).trim();
  const run = spawnSync(process.execPath, [CLI, 'git', 'commit', '--type', 'fix', '--summary', 'no body file', '--body-file', path.join(dir, 'absent.txt')], { cwd: dir, env: env(), encoding: 'utf8', windowsHide: true });
  assert.equal(run.status, 2);
  assert.match(`${run.stdout}${run.stderr}`, /cannot read --body-file/);
  assert.equal(git(dir, ['rev-parse', 'HEAD']).trim(), before);
});
