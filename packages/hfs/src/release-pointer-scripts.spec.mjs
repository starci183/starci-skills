// The remote release-pointer shell (stack prepare and the release store): an absent link or releases directory is an empty answer, a real failure is
// a failed script - there is no `|| true` to swallow it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkPointers } from '../stack/prepare.mjs';
import { releaseListScript, releasePointerScript, shellQuote } from '../stack/remote.mjs';

const sh = (script) => spawnSync('sh', ['-c', script], { encoding: 'utf8', windowsHide: true });
const posix = (file) => file.split(path.sep).join('/');

function releasesRoot(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-release-pointer-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('the scripts hold no `|| true`: nothing swallows a failure', () => {
  const scripts = [releasePointerScript("'/srv/app'", 'current'), releaseListScript("'/srv/app'")];
  for (const script of scripts) assert.doesNotMatch(script, /\|\|\s*true/);
});

test('a pointer script names the release its link points at, and answers an empty line for an absent link or an absent base', (t) => {
  const base = releasesRoot(t);
  fs.mkdirSync(path.join(base, 'releases', '20260101T000000Z'), { recursive: true });
  fs.symlinkSync(path.join(base, 'releases', '20260101T000000Z'), path.join(base, 'current'), 'junction');
  const quoted = shellQuote(posix(base));
  const present = sh(releasePointerScript(quoted, 'current'));
  assert.equal(present.status, 0, present.stderr);
  assert.equal(present.stdout, '20260101T000000Z\n');
  const absent = sh(releasePointerScript(quoted, 'previous'));
  assert.equal(absent.status, 0, absent.stderr);
  assert.equal(absent.stdout, '\n');
  const noBase = sh(releasePointerScript(shellQuote(posix(path.join(base, 'missing'))), 'current'));
  assert.equal(noBase.status, 0, noBase.stderr);
  assert.equal(noBase.stdout, '\n');
});

test('a list script prints the releases newest first, nothing for an absent releases directory, and fails when the listing itself fails', (t) => {
  const base = releasesRoot(t);
  const quoted = shellQuote(posix(base));
  const none = sh(releaseListScript(quoted));
  assert.equal(none.status, 0, none.stderr);
  assert.equal(none.stdout, '');
  fs.mkdirSync(path.join(base, 'releases', 'a'), { recursive: true });
  fs.mkdirSync(path.join(base, 'releases', 'b'), { recursive: true });
  fs.utimesSync(path.join(base, 'releases', 'a'), new Date(1000), new Date(1000));
  fs.utimesSync(path.join(base, 'releases', 'b'), new Date(2000), new Date(2000));
  const listed = sh(releaseListScript(quoted));
  assert.equal(listed.status, 0, listed.stderr);
  assert.equal(listed.stdout, 'b\na\n');
  // a listing that fails (permissions, a vanished directory) fails the script and so the caller, instead of reading as "no releases"
  const failing = sh(`ls() { return 3; }; ${releaseListScript(quoted)}`);
  assert.equal(failing.status, 3);
});

test('the doctor reports an unreadable release pointer as bad, an absent one as none and a named one as ok', () => {
  const noted = [];
  const report = { ok: (text) => noted.push(`ok ${text}`), bad: (text) => noted.push(`bad ${text}`) };
  const answers = { current: { status: 0, stdout: '0123456789abcdef\n', stderr: '' }, previous: { status: 1, stdout: '', stderr: 'readlink: permission denied\n' } };
  const run = (script) => answers[script.includes('/previous') ? 'previous' : 'current'];
  const pointers = checkPointers(run, report, { stack: 'demo', remote: {} });
  assert.deepEqual(pointers, { current: '0123456789abcdef', previous: null });
  assert.deepEqual(noted, ['ok release current: 0123456789abcdef', 'bad release previous could not be read: readlink: permission denied']);
  const none = checkPointers(() => ({ status: 0, stdout: '\n', stderr: '' }), { ok: (text) => noted.push(`ok ${text}`), bad: () => assert.fail('an absent link is not bad') }, { stack: 'demo', remote: {} });
  assert.deepEqual(none, { current: null, previous: null });
});
