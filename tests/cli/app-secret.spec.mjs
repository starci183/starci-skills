import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { CATALOG } from '../../packages/cli/src/catalog.generated.mjs';
import { main as cliMain } from '../../packages/cli/src/main.mjs';
import { main as hfsMain } from '../../packages/hfs/src/main.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const capture = () => {
  const value = { out: '', err: '' };
  return { value, stdout: text => { value.out += text; }, stderr: text => { value.err += text; } };
};

test('the app secret catalog exposes current verbs and both editions, with help describing private file output', async () => {
  const command = CATALOG.groups.app.verbs.secret;
  assert.deepEqual(command.positional[0].enum, ['init', 'set', 'get', 'materialize', 'list', 'verify']);
  assert.deepEqual(command.editions, ['full', 'lite']);
  assert.equal(command.json, 'none');
  const help = capture();
  assert.equal(await cliMain(['app', 'secret', '--help'], help), 0);
  for (const name of ['init', 'set', 'get', 'materialize', 'list', 'verify', '--generate', '--to-file', '--reveal']) assert.ok(help.value.out.includes(name), `secret help exposes ${name}`);
});

test('the package dispatcher accepts each secret verb in lite, forwards local flags, and preserves caller context', async t => {
  const cwd = mkdtemp(t, 'starci-secret-dispatch-');
  const env = { STARCI_ROLE: 'owner', FIXTURE_CONTEXT: 'kept' };
  const stdin = () => 'private-dispatch-input';
  await Promise.all([['init'], ['set', 'production', 'app-be-db', 'DB_PASSWORD', '--generate', '32'], ['get', 'production', 'app-be-db', 'DB_PASSWORD', '--to-file'], ['materialize', 'production'], ['list', 'production'], ['verify', 'production']].map(async args => {
    const output = capture(); let received;
    const code = await cliMain(['app', 'secret', ...args, '--edition', 'lite', '--cwd', cwd], {
      ...output, cwd, env, stdin,
      importHfs: async () => ({ main: (argv, io) => { received = { argv, io }; return 0; } }),
      locateRuntime: () => assert.fail('app secret does not locate the runtime'),
      spawn: () => assert.fail('app secret dispatch runs in process'),
    });
    assert.equal(code, 0);
    assert.equal(received.argv[0], 'secret');
    for (const arg of args) assert.ok(received.argv.includes(arg), 'all secret arguments reach HFS');
    assert.equal(received.io.cwd, cwd); assert.equal(received.io.env, env); assert.equal(received.io.stdin, stdin);
  }));
});

test('obsolete verbs, unknown flags, missing action and JSON refuse before HFS dispatch', async () => {
  await Promise.all([[], ['show', 'token'], ['gen', 'token'], ['list', 'dev', '--unknown'], ['list', 'dev', '--json']].map(async args => {
    const output = capture();
    const code = await cliMain(['app', 'secret', ...args], { ...output,
      importHfs: async () => assert.fail('invalid input must not load HFS'),
      spawn: () => assert.fail('invalid input must not spawn'),
    });
    assert.equal(code, 2);
    assert.ok(output.value.err.length > 0);
  }));
});

test('CLI set and get use caller stdin, sops and external local data paths without exposing values', async t => {
  const machine = mkdtemp(t, 'starci-secret-cli-');
  const root = path.join(machine, 'app'); fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify({ project: 'cli-custody-spec' }));
  const env = { ...process.env, LOCALAPPDATA: path.join(machine, 'local'), XDG_DATA_HOME: path.join(machine, 'local'), HOME: path.join(machine, 'home'), USERPROFILE: path.join(machine, 'home'), STARCI_LOCAL_ROOT: path.join(machine, 'machine-state') };
  const value = 'private-cli-custody-value'; let request;
  const enc = 'ENC[AES256_GCM,data:AA==,iv:AA==,tag:AA==,type:str]';
  const sops = {
    seal: received => { request = received; return `TOKEN=${enc}\nsops_mac=${enc}\n`; },
    decrypt: () => ({ TOKEN: value }),
  };
  const options = { cwd: root, env, sops, stdin: () => `${value}\n`, importHfs: async () => ({ main: hfsMain }) };
  const set = capture();
  assert.equal(await cliMain(['app', 'secret', 'set', 'dev', 'token', 'TOKEN', '--edition', 'lite'], { ...options, ...set }), 0);
  assert.ok(request.plaintext === `TOKEN=${value}\n`, 'CLI forwards the redirected stdin value to sealing');
  assert.equal(request.inputType, 'dotenv');
  assert.ok(!(set.value.out + set.value.err).includes(value), 'set output contains no private value');
  const get = capture();
  assert.equal(await cliMain(['app', 'secret', 'get', 'dev', 'token', 'TOKEN', '--to-file'], { ...options, ...get }), 0);
  assert.ok(!(get.value.out + get.value.err).includes(value), 'get output contains no private value');
  const base = process.platform === 'darwin' ? path.join(env.HOME, 'Library', 'Application Support') : env.LOCALAPPDATA;
  const file = path.join(base, 'StarCi', 'secrets', 'cli-custody-spec', 'dev', 'TOKEN');
  assert.equal(get.value.out, '');
  assert.equal(get.value.err, `TOKEN_FILE=${file}\n`);
  assert.ok(fs.readFileSync(file, 'utf8') === value, 'CLI materializes the private value in the caller local directory');
  assert.ok(!fs.existsSync(path.join(root, 'secrets.env')), 'CLI creates no root plaintext secret file');
});
