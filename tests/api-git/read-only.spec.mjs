import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { gitExecutable } from '../../scripts/api/git/lib.mjs';
import { readOnly } from '../../scripts/api/git/read-only.mjs';
import { winPath } from '../fixtures/win-path.mjs';

const gitCmd = winPath('C', 'Program Files', 'Git', 'cmd', 'git.exe');
const winEnv = { Path: [winPath('C', 'Users', 'u', '.starci', 'bin'), 'relative', winPath('D', 'tools'), winPath('C', 'Program Files', 'Git', 'cmd')].join(';') };

test('gitExecutable returns the first absolute PATH git, never the StarCi shim directory', () => {
  const seen = [];
  const exists = (file) => { seen.push(file); return file === gitCmd; };
  assert.equal(gitExecutable({ env: winEnv, platform: 'win32', home: winPath('C', 'Users', 'U'), exists }), gitCmd);
  assert.ok(!seen.some((file) => /\.starci/i.test(file)) && !seen.some((file) => file.startsWith('relative')), seen.join(', '));
  assert.equal(gitExecutable({ env: { PATH: '/shim:/usr/bin' }, platform: 'linux', home: '/h', exists: (file) => file === '/usr/bin/git' }), '/usr/bin/git');
  assert.equal(gitExecutable({ env: { PATH: '/h/.starci/bin:/usr/bin' }, platform: 'linux', home: '/h', exists: (file) => file === '/h/.starci/bin/git' }), null);
  assert.equal(gitExecutable({ env: {}, platform: 'linux', home: '/h', exists: () => true }), null);
});

test('readOnly spawns the resolved absolute git and a host without git answers a failed read', async () => {
  const calls = [];
  const exec = (file, args, options, done) => { calls.push({ file, args }); done(null, Buffer.from('ok')); };
  const real = path.resolve('/fixed/git');
  const r = await readOnly('/repo', ['rev-parse', 'HEAD'], { exec, git: real });
  assert.equal(r.ok, true);
  assert.equal(String(r.out), 'ok');
  assert.ok(path.isAbsolute(calls[0].file));
  assert.deepEqual(calls[0].args, ['-c', 'core.quotepath=off', '-C', '/repo', 'rev-parse', 'HEAD']);
  const none = await readOnly('/repo', ['rev-parse'], { exec, git: null });
  assert.equal(none.ok, false);
  assert.equal(none.error.code, 'ENOENT');
  assert.equal(calls.length, 1);
});

test('readOnly really reads with the resolved git of this host', async () => {
  const git = gitExecutable();
  assert.ok(git && path.isAbsolute(git), 'this host has git on PATH');
  const r = await readOnly(process.cwd(), ['--version']);
  assert.equal(r.ok, true);
  assert.match(String(r.out), /^git version /);
});
