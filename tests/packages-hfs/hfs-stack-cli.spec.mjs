import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { ACTIONS, parseFlags, parseImages, stackMain } from '../../packages/hfs/stack/cli.mjs';
import { EXIT, StackError, approvalMissing, failure, refusal } from '../../packages/hfs/stack/errors.mjs';
import { buildApp, removeApps } from '../helpers/stack-app.mjs';

after(removeApps);

const DEPLOY = { images: { api: { app: 'api' } }, volumes: ['demo-data'] };
const IMAGE = `api=registry.example/team/app-api@sha256:${'c'.repeat(64)}`;

/** Runs stackMain over a fresh app with fake action modules; `results` maps an action module export to its return value. */
async function run(argv, { results = {}, deploy = DEPLOY } = {}) {
  const root = buildApp({ deploy });
  const out = [];
  const err = [];
  const seen = [];
  const importer = async (file) => new Proxy({}, {
    get: (_, name) => (name === 'then' ? undefined : async (_ctx, config, options) => {
      seen.push({ file, name, options, stack: config.stack });
      const value = results[name];
      if (value instanceof Error) throw value;
      return value ?? { ok: true, lines: [`${name} ran`], data: { name } };
    }),
  });
  const code = await stackMain(argv, { cwd: root, stdout: (text) => out.push(text), stderr: (text) => err.push(text), importer });
  return { code, out: out.join(''), err: err.join(''), seen, root };
}

test('parseFlags reads booleans, values, repeatable values and positionals', () => {
  const { flags, positional } = parseFlags(['--env', 'staging', '--execute', '--image', 'a=b', '--image', 'c=d', 'stats', '--json']);
  assert.deepEqual(flags, { env: 'staging', execute: true, image: ['a=b', 'c=d'], json: true });
  assert.deepEqual(positional, ['stats']);
});

test('parseFlags refuses an unknown flag and a flag without its value', () => {
  assert.throws(() => parseFlags(['--bogus']), (error) => error instanceof StackError && error.code === 'STACK_USAGE');
  assert.throws(() => parseFlags(['--env']), /--env needs a value/u);
  assert.throws(() => parseFlags(['--env', '--execute']), /--env needs a value/u);
});

test('parseImages accepts repeated and comma separated pairs and refuses malformed or duplicated ones', () => {
  assert.deepEqual(parseImages(['api=x@sha256:1,web=y@sha256:2', 'worker=z']), { api: 'x@sha256:1', web: 'y@sha256:2', worker: 'z' });
  assert.deepEqual(parseImages(), {});
  for (const bad of [['api'], ['=x'], ['api='], ['api=x', 'api=y']]) assert.throws(() => parseImages(bad), /--image takes <service>=<reference>/u);
});

test('an unknown action is a usage refusal listing the actions, exit 2', async () => {
  const { code, err } = await run(['teleport']);
  assert.equal(code, EXIT.refused);
  assert.match(err, /starci app stack takes prepare, doctor/u);
  assert.match(err, /up, down, status/u);
});

test('every action reaches its module with the options built from the flags', async () => {
  const expectations = {
    prepare: ['prepareHost', ['--execute', '--init-swarm'], { execute: true, initSwarm: true }],
    doctor: ['doctorHost', [], {}],
    connect: ['connectCi', ['--execute'], { execute: true }],
    disconnect: ['disconnectCi', [], { execute: false }],
    'build-args': ['buildArgs', ['--app', 'web'], { app: 'web' }],
    deploy: ['deployRelease', ['--image', IMAGE, '--source-sha', 'abc1234', '--out', 'rel', '--timeout', '30', '--retry', '5', '--skip-public', '--execute'], { execute: true, sourceSha: 'abc1234', timeoutSeconds: 30, retrySeconds: 5, skipPublic: true }],
    accept: ['acceptRelease', ['--release', '0123456789abcdef', '--retry', '20', '--execute'], { release: '0123456789abcdef', execute: true, retrySeconds: 20 }],
    converge: ['convergeStack', ['--since', '2026-10-15T00:00:00Z', '--timeout', '90'], { since: '2026-10-15T00:00:00Z', timeoutSeconds: 90 }],
    verify: ['verifyStack', ['--retry', '10', '--skip-public', '--skip-internal'], { retrySeconds: 10, skipPublic: true, skipInternal: true }],
    rollback: ['rollbackRelease', ['--release', '0123456789abcdef', '--execute', '--timeout', '60'], { release: '0123456789abcdef', execute: true, timeoutSeconds: 60 }],
    prune: ['pruneStack', ['--keep', 'a.json', '--keep', 'b.json', '--execute'], { execute: true }],
    backup: ['backupVolumes', ['--swarm-state', '--execute'], { swarmState: true, execute: true }],
    ingress: ['runIngress', ['takeover', '--execute'], { action: 'takeover', execute: true, args: [] }],
    retire: ['retireCompose', ['--project', 'a', '--project', 'b', '--execute'], { projects: ['a', 'b'], execute: true }],
    build: ['buildImages', ['--push', '--execute'], { push: true, execute: true }],
    jobs: ['runJobs', ['retry', '42', '--execute'], { action: 'retry', args: ['42'], execute: true }],
    task: ['runTask', ['seed-media', '--execute'], { name: 'seed-media', args: [], execute: true }],
  };
  for (const [action, [name, flags, expected]] of Object.entries(expectations)) {
    const { code, seen, out } = await run([action, ...flags]);
    assert.equal(code, EXIT.ok, action);
    assert.equal(seen.length, 1);
    assert.equal(seen[0].name, name);
    assert.equal(seen[0].stack, 'demo');
    assert.match(out, new RegExp(`${name} ran`, 'u'));
    for (const [key, value] of Object.entries(expected)) assert.deepEqual(seen[0].options[key], value, `${action}.${key}`);
  }
  assert.equal(ACTIONS.length, Object.keys(expectations).length + 1, 'render is covered separately');
});

test('render resolves --out and --extra-compose against the app root and passes images and the previous release', async () => {
  const { code, seen, root } = await run(['render', '--image', IMAGE, '--source-sha', 'abc1234', '--previous', '0123456789abcdef', '--out', 'rel', '--extra-compose', 'local.yaml', '--allow-unpinned']);
  assert.equal(code, EXIT.ok);
  const { options } = seen[0];
  assert.deepEqual(options.images, { api: IMAGE.slice(4) });
  assert.equal(options.previous, '0123456789abcdef');
  assert.equal(options.out, path.resolve(root, 'rel'));
  assert.deepEqual(options.extraCompose, [path.resolve(root, 'local.yaml')]);
  assert.equal(options.allowUnpinned, true);
  const defaults = (await run(['render'])).seen[0].options;
  assert.deepEqual([defaults.previous, defaults.out, defaults.allowUnpinned, defaults.extraCompose], [null, null, false, []]);
});

test('--ssh-cmd reaches the action and --env selects the environment', async () => {
  const { seen } = await run(['doctor', '--ssh-cmd', 'ssh vps']);
  assert.equal(seen[0].options.sshCmd, 'ssh vps');
  assert.equal((await run(['doctor'])).seen[0].options.sshCmd, null);
  const { code, err } = await run(['doctor', '--env', 'staging']);
  assert.equal(code, EXIT.refused);
  assert.match(err, /STACKS_DEPLOY_ENV_UNKNOWN/u);
});

test('--json prints one object with the verb, ok and the data; text mode prints the lines', async () => {
  const { out, code } = await run(['doctor', '--json'], { results: { doctorHost: { ok: true, lines: ['x'], data: { checks: 3 } } } });
  assert.equal(code, EXIT.ok);
  assert.deepEqual(JSON.parse(out), { verb: 'doctor', ok: true, checks: 3 });
  const plain = await run(['doctor'], { results: { doctorHost: { ok: true, data: {} } } });
  assert.equal(plain.out, '');
});

test('a failed result is exit 1 and a StackError is printed with its own exit code', async () => {
  assert.equal((await run(['verify'], { results: { verifyStack: { ok: false, lines: ['FAIL'], data: {} } } })).code, EXIT.failed);
  const refused = await run(['deploy'], { results: { deployRelease: refusal('STACK_X', 'no') } });
  assert.deepEqual([refused.code, refused.err], [EXIT.refused, 'starci app stack: STACK_X: no\n']);
  assert.equal((await run(['deploy'], { results: { deployRelease: failure('STACK_Y', 'bad') } })).code, EXIT.failed);
  assert.equal((await run(['prepare'], { results: { prepareHost: approvalMissing('STACK_Z', 'ask the owner') } })).code, EXIT.approval);
});

test('an error that is not a StackError is a bug and propagates', async () => {
  await assert.rejects(run(['deploy'], { results: { deployRelease: new TypeError('boom') } }), /boom/u);
});

test('a bad --timeout is refused', async () => {
  const { code, err } = await run(['converge', '--timeout', 'soon']);
  assert.equal(code, EXIT.refused);
  assert.match(err, /--timeout must be a number of seconds/u);
});

test('the default importer loads the action modules next to the dispatcher', async () => {
  const root = buildApp({ deploy: DEPLOY });
  const err = [];
  const code = await stackMain(['jobs', 'stats'], { cwd: root, stdout: () => {}, stderr: (text) => err.push(text) });
  assert.equal(code, EXIT.refused);
  assert.match(err.join(''), /STACK_JOBS_UNDECLARED/u);
});

test('the default importer loads the task module and refuses a missing name with STACK_TASK_UNDECLARED', async () => {
  const root = buildApp({ deploy: DEPLOY });
  const err = [];
  const code = await stackMain(['task'], { cwd: root, stdout: () => {}, stderr: (text) => err.push(text) });
  assert.equal(code, EXIT.refused);
  assert.match(err.join(''), /STACK_TASK_UNDECLARED/u);
});

test('rollback without --release targets the previous pointer and prune without --keep passes none', async () => {
  assert.equal((await run(['rollback'])).seen[0].options.release, null);
  assert.deepEqual((await run(['prune'])).seen[0].options.keepFiles, []);
  assert.deepEqual((await run(['retire'])).seen[0].options.projects, []);
  assert.equal((await run(['accept'])).seen[0].options.release, null);
  assert.deepEqual([(await run(['build'])).seen[0].options.push, (await run(['build'])).seen[0].options.execute], [false, false]);
});
