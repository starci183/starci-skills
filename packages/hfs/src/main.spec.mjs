// The clean-install proof of @starci/hfs (scripts/gates/package-clean-test.mjs runs `npm test` in a copy of this folder with
// nothing installed): the CLI's whole static module graph loads from the published folders alone - hfs declares no
// dependency, so any bare import here would fail - and a call with no verb prints the usage and refuses with exit 2.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { main, VERBS } from './main.mjs';

test('the app implementation loads with no installed dependency and refuses a missing verb with its usage', async () => {
  let err = '';
  const code = await main([], { stdout: () => {}, stderr: (s) => { err += s; } });
  assert.equal(code, 2);
  assert.match(err, /^starci app check /m);
  assert.match(err, /^starci app scaffold <name>/m);
  assert.match(err, /^starci app secret list/m);
  assert.deepEqual(VERBS, ['scaffold', 'add', 'lint', 'sync', 'check', 'upgrade', 'stack', 'explain', 'emit', 'new', 'secret', 'hygiene']);
});

test('global options use cwd, accept only the full edition and keep the three exit classes', async (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-app-main-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const wanted = path.join(base, 'app');
  fs.mkdirSync(wanted);
  let call;
  const stackMain = async (argv, io) => { call = { argv, cwd: io.cwd }; return 0; };
  assert.equal(await main(['stack', 'status', '--cwd', 'app', '--edition', 'full'], { cwd: base, stackMain }), 0);
  assert.deepEqual(call, { argv: ['status'], cwd: wanted });
  let err = '';
  assert.equal(await main(['upgrade', '--edition', 'lite'], { stderr: (text) => { err += text; } }), 2);
  assert.match(err, /--edition accepts only full/);
  assert.equal(await main(['upgrade', '--edition', 'full'], { stdout: () => {} }), 0);
});

test('stack refuses with exit 2 and an install hint when the app has no test-world package', async (t) => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-app-stack-'));
  t.after(() => fs.rmSync(cwd, { recursive: true, force: true }));
  let err = '';
  const code = await main(['stack', 'status'], { cwd, stdout: () => {}, stderr: (text) => { err += text; } });
  assert.equal(code, 2);
  assert.match(err, /needs @starci\/test-world installed in the app/);
});
