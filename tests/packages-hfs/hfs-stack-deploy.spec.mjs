import test, { after, afterEach, before } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { convergeStack } from '../../packages/hfs/stack/converge.mjs';
import { DEFAULT_DEPS, acceptRelease, deployRelease, importModule, lazy, rollbackRelease } from '../../packages/hfs/stack/deploy.mjs';
import { StackError } from '../../packages/hfs/stack/errors.mjs';
import { createReleaseStore } from '../../packages/hfs/stack/release-store.mjs';
import { fakeHost } from '../helpers/stack-fakes.mjs';
import { shellWords } from '../helpers/stack-remote-fakes.mjs';
import { psRunning, releaseSsh, testConfig } from '../helpers/stack-swarm-fakes.mjs';

const OLD = 'a'.repeat(64);
const NEW = 'b'.repeat(64);
const WEB = 'c'.repeat(64);
const CACHE = 'd'.repeat(64);
const stackText = (api) => `services:
  api:
    image: ghcr.io/o/app-api@sha256:${api}
  web:
    image: "ghcr.io/o/app-web@sha256:${WEB}"
  cache:
    image: redis@sha256:${CACHE}
  worker:
    image: ghcr.io/o/app-api@sha256:${api}
`;
const idOf = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);
const NEW_ID = idOf(stackText(NEW));
const OLD_ID = idOf(stackText(OLD));
const config = testConfig();
const KINDS = [['mv -Tf', 'accept'], ['cat >', 'upload'], ['cat "', 'fetch-file'], ['[ -L current ]', 'read-current'], ['[ -L previous ]', 'read-previous'], ['chmod 440', 'seal'], ['mkdir -p', 'mkdir']];
const kindOf = (command) => KINDS.find(([needle]) => command.includes(needle))?.[1] ?? 'other';
const rollbackUpdate = (host) => ({ State: 'rollback_started', StartedAt: new Date(host.state.time).toISOString(), Message: 'update rolled back' });

let work;
let remote;
const remotes = [];
before(() => { work = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-stack-deploy-')); });
after(() => fs.rmSync(work, { recursive: true, force: true }));
afterEach(() => { for (const each of remotes.splice(0)) each.dispose(); });

/**
 * A world: the docker shim, a remote release store, stub render/provision that write the release files, and a trace of what happened.
 *   build.stack(api)  the stack bytes the stub renders;  failSsh(needle)  makes remote commands containing it fail
 */
async function world({ previous = true, previousText = stackText(OLD), stackFor = () => stackText(NEW), spies = {}, overrides = {}, failSsh = [], hook } = {}) {
  const host = fakeHost({ overrides: { docker: { 'ps -q': psRunning, ...overrides } }, fileReader: (file) => fs.readFileSync(file, 'utf8') });
  remote = releaseSsh();
  remotes.push(remote);
  const trace = [];
  const calls = { render: [], provision: [], converge: [], verify: [], prune: [], sshFactory: [] };
  const spawn = (command, args, options) => {
    trace.push(`${command}:${args.slice(0, 2).join(' ')}`);
    return hook?.(command, args) ?? host.spawn(command, args, options);
  };
  const ssh = async (command, options) => {
    trace.push(`ssh:${kindOf(command)}`);
    if (command.startsWith("docker 'network' 'inspect'")) return host.spawn('docker', shellWords(command).slice(1));
    if (failSsh.some((needle) => command.includes(needle))) return { status: 1, stdout: '', stderr: 'ssh: simulated failure' };
    return remote.ssh(command, options);
  };
  const render = async (ctx, cfg, options) => {
    trace.push('render');
    calls.render.push(options);
    fs.mkdirSync(options.out, { recursive: true });
    fs.writeFileSync(path.join(options.out, 'stack.yaml'), stackFor(calls.render.length));
    fs.writeFileSync(path.join(options.out, 'release.json'), JSON.stringify({ secrets: [{ key: 'T', runtimeName: 'app-t-v2' }], configs: [] }));
    return { ok: true, lines: ['render: stub'] };
  };
  const provision = async (ctx, cfg, options) => {
    trace.push('provision');
    calls.provision.push(options);
    return spies.provision?.(options) ?? { ok: true, lines: ['provision: stub'] };
  };
  const wrap = (name, real) => async (ctx, cfg, options) => {
    trace.push(name);
    calls[name].push(options);
    return spies[name] ? spies[name](ctx, cfg, options) : real(ctx, cfg, options);
  };
  const deps = {
    renderRelease: render,
    provisionRelease: provision,
    convergeStack: wrap('converge', convergeStack),
    verifyStack: wrap('verify', async () => ({ ok: true, lines: ['verify: stub'], data: { checks: [] } })),
    pruneStack: wrap('prune', DEFAULT_DEPS.pruneStack),
    ssh: async (...args) => { calls.sshFactory.push(args[2]); return ssh; },
    releaseStore: createReleaseStore,
  };
  const ctx = host.ctx({ spawn });
  const out = path.join(work, `out-${Math.random().toString(16).slice(2)}`);
  const world_ = { host, ctx, deps, trace, calls, out, ssh };
  if (previous) await seedPrevious(world_, previousText);
  return world_;
}

/** An accepted previous release stored on the remote, whose services run the OLD image. */
async function seedPrevious(w, text = stackText(OLD)) {
  const dir = path.join(work, `prev-${Math.random().toString(16).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'stack.yaml'), text);
  fs.writeFileSync(path.join(dir, 'release.json'), JSON.stringify({ secrets: [{ key: 'T', runtimeName: 'app-t-v1' }], configs: [] }));
  const store = createReleaseStore(config, remote.ssh);
  await store.store(dir, OLD_ID);
  await store.accept(OLD_ID);
  remote.calls.length = 0;
  return w;
}

const base = (w, extra = {}) => ({ images: { api: 'x' }, sourceSha: 'abc123', execute: true, out: w.out, ...extra });
const currentPointer = () => createReleaseStore(config, remote.ssh).current();
const dockerWrites = (trace) => trace.filter((entry) => entry.startsWith('docker:') && !/^docker:(service|inspect)/u.test(entry));

test('the defaults load their collaborators lazily, so a missing sibling module never breaks the import', async () => {
  assert.deepEqual(Object.keys(DEFAULT_DEPS).sort(), ['convergeStack', 'provisionRelease', 'pruneStack', 'reconcileEdge', 'releaseStore', 'renderRelease', 'ssh', 'verifyStack']);
  const refusalOf = lazy('./errors.mjs', 'refusal');
  const error = await refusalOf('X_CODE', 'message');
  assert.ok(error instanceof StackError);
  assert.equal(error.code, 'X_CODE');
  assert.equal(typeof (await importModule('./errors.mjs')).EXIT, 'object');
});

test('a deploy needs the source sha and renders nothing without it', async () => {
  const w = await world({ previous: false });
  await assert.rejects(deployRelease(w.ctx, config, { images: {}, execute: true }, w.deps), { code: 'STACK_DEPLOY_SOURCE_SHA' });
  await assert.rejects(deployRelease(w.ctx, config), { code: 'STACK_DEPLOY_SOURCE_SHA' });
  assert.deepEqual(w.trace, []);
});

test('a dry run renders locally, prints the plan and makes no remote call at all', async () => {
  const w = await world();
  const result = await deployRelease(w.ctx, config, base(w, { execute: false }), w.deps);
  assert.equal(result.ok, true);
  assert.deepEqual(result.lines, ['render: stub', `dry run: release ${NEW_ID} would be provisioned, stored, pre-pulled, deployed, converged, verified, accepted`]);
  assert.deepEqual(result.data, { releaseId: NEW_ID, steps: [{ step: 'render', ok: true }], executed: false });
  assert.deepEqual(w.trace, ['render']);
  assert.equal(w.host.calls.length, 0);
  assert.equal(remote.calls.length, 0);
  assert.equal(w.calls.sshFactory.length, 0);
  assert.equal(w.calls.render[0].previous, null);
});

test('a dry run whose render returns no lines and no images still prints the plan', async () => {
  const w = await world({ previous: false });
  const quiet = { ...w.deps, renderRelease: async (ctx, cfg, options) => { await w.deps.renderRelease(ctx, cfg, options); return { ok: true }; } };
  const result = await deployRelease(w.ctx, config, { sourceSha: 'abc', out: w.out }, quiet);
  assert.deepEqual(result.lines, [`dry run: release ${NEW_ID} would be provisioned, stored, pre-pulled, deployed, converged, verified, accepted`]);
  assert.deepEqual(w.calls.render[0].images, {});
});

test('a dry run without --out renders into a temporary directory that is removed afterwards', async () => {
  const w = await world({ previous: false });
  const result = await deployRelease(w.ctx, config, { images: {}, sourceSha: 'abc' }, w.deps);
  assert.equal(result.ok, true);
  assert.equal(result.lines.length, 2);
  assert.ok(result.lines[1].startsWith('dry run: release '));
  assert.equal(fs.existsSync(w.calls.render[0].out), false);
});

test('a successful deploy runs every step in order and moves the pointers last', async () => {
  const w = await world();
  w.host.state.secrets.set('app-t-v0', { labels: ['app.managed=true'], value: '' });
  w.host.state.secrets.set('app-t-v1', { labels: ['app.managed=true'], value: '' });
  w.host.state.secrets.set('app-t-v2', { labels: ['app.managed=true'], value: '' });
  const result = await deployRelease(w.ctx, config, base(w, { timeoutSeconds: 900, retrySeconds: 240 }), w.deps);
  assert.equal(result.ok, true, result.lines.join('\n'));
  assert.deepEqual(w.trace.filter((entry) => !/^docker:(service|inspect)/u.test(entry)), [
    'render', 'ssh:read-current', 'render', 'provision', 'ssh:mkdir', 'ssh:upload', 'ssh:upload', 'ssh:seal',
    'docker:pull --quiet', 'docker:pull --quiet', 'docker:pull --quiet', 'docker:stack deploy', 'converge', 'verify', 'ssh:accept',
    'ssh:fetch-file', 'ssh:fetch-file', 'prune', 'docker:secret ls', 'docker:secret rm', 'docker:config ls', 'docker:image prune',
  ]);
  assert.deepEqual(w.host.state.pulled, [`ghcr.io/o/app-api@sha256:${NEW}`, `ghcr.io/o/app-web@sha256:${WEB}`, `redis@sha256:${CACHE}`]);
  const deploy = w.host.calls.find((call) => call.args[0] === 'stack' && call.args[1] === 'deploy');
  assert.deepEqual(deploy.args, ['stack', 'deploy', '--prune', '--with-registry-auth', '--resolve-image', 'always', '--detach=true', '-c', path.join(w.out, 'stack.yaml'), 'app']);
  assert.equal(w.calls.render[0].previous, null);
  assert.equal(w.calls.render[1].previous, OLD_ID);
  assert.deepEqual(w.calls.provision[0], { execute: true, out: w.out, releaseFile: path.join(w.out, 'release.json') });
  assert.deepEqual(w.calls.converge[0], { since: new Date(deploy.at - 60_000).toISOString(), timeoutSeconds: 900 });
  assert.deepEqual(w.calls.verify[0], { retrySeconds: 240, skipPublic: false, stackFile: path.join(w.out, 'stack.yaml') });
  assert.deepEqual(w.calls.prune[0], { keepFiles: [path.join(w.out, 'release.json'), path.join(w.out, 'previous', 'release.json')], execute: true });
  assert.deepEqual(w.host.state.removed, [{ kind: 'secret', name: 'app-t-v0' }]);
  assert.equal(await currentPointer(), NEW_ID);
  assert.equal(await createReleaseStore(config, remote.ssh).previous(), OLD_ID);
  assert.equal(result.data.rolledBack, false);
  assert.equal(result.data.releaseId, NEW_ID);
  assert.equal(result.data.previous, OLD_ID);
  assert.deepEqual(result.data.steps.map((entry) => entry.step), ['render', 'provision', 'store', 'pre-pull', 'deploy', 'edge', 'converge', 'verify', 'accept']);
  assert.ok(result.data.steps.every((entry) => entry.ok));
  assert.equal(result.lines.at(-1), `deployed release ${NEW_ID}`);
});

test('the first deploy has no previous release: nothing is fetched and only the new record is kept', async () => {
  const w = await world({ previous: false });
  const result = await deployRelease(w.ctx, config, { images: {}, sourceSha: 'abc', execute: true }, w.deps);
  assert.equal(result.ok, true, result.lines.join('\n'));
  assert.equal(result.data.previous, null);
  assert.equal(w.calls.render[1].previous, null);
  assert.equal(w.calls.prune[0].keepFiles.length, 1);
  assert.equal(w.trace.includes('ssh:fetch-file'), false);
  assert.equal(fs.existsSync(w.calls.render[0].out), false);
  assert.equal(await currentPointer(), NEW_ID);
});

test('render and provision results without lines are fine, a failed prune or image prune is not fatal', async () => {
  const w = await world({ previous: false, overrides: { 'image prune': () => ({ status: 1, stdout: '', stderr: 'busy' }) }, spies: { prune: async () => { throw new Error('docker secret ls failed'); } } });
  const bare = { ...w.deps, renderRelease: async (ctx, cfg, options) => { await w.deps.renderRelease(ctx, cfg, options); return { ok: true }; }, provisionRelease: async () => ({ ok: true }) };
  const result = await deployRelease(w.ctx, config, base(w), bare);
  assert.equal(result.ok, true);
  assert.ok(result.lines.includes('docker secret ls failed'));
  assert.ok(result.lines.includes('prune failed (non-fatal; superseded objects stay until the next release)'));
  assert.equal(await currentPointer(), NEW_ID);
});

test('a prune that reports not ok is not fatal either', async () => {
  const w = await world({ spies: { prune: async () => ({ ok: false, lines: ['prune: refused'] }) } });
  const result = await deployRelease(w.ctx, config, base(w), w.deps);
  assert.equal(result.ok, true);
  assert.deepEqual(result.lines.slice(-3), ['prune: refused', 'prune failed (non-fatal; superseded objects stay until the next release)', `deployed release ${NEW_ID}`]);
});

test('a placeholder digest in the rendered stack is refused before any effect, in a dry run and in a real run', async () => {
  const zero = stackText('0'.repeat(64));
  const w = await world({ stackFor: () => zero });
  await assert.rejects(deployRelease(w.ctx, config, base(w, { execute: false }), w.deps), { code: 'STACK_DEPLOY_PLACEHOLDER' });
  await assert.rejects(deployRelease(w.ctx, config, base(w), w.deps), { code: 'STACK_DEPLOY_PLACEHOLDER' });
  assert.equal(w.host.calls.length, 0);
  assert.equal(remote.calls.length, 0);
  assert.equal(w.calls.provision.length, 0);
});

test('a placeholder that only the second render (with the previous release) produces is refused before provisioning', async () => {
  const w = await world({ stackFor: (count) => (count === 1 ? stackText(NEW) : stackText('0'.repeat(64))) });
  await assert.rejects(deployRelease(w.ctx, config, base(w), w.deps), { code: 'STACK_DEPLOY_PLACEHOLDER' });
  assert.deepEqual(w.trace, ['render', 'ssh:read-current', 'render']);
  assert.equal(w.host.calls.length, 0);
});

test('an image that is not a plain reference is refused before any effect', async () => {
  const w = await world({ previous: false, stackFor: () => 'services:\n  api:\n    image: "-x"\n' });
  await assert.rejects(deployRelease(w.ctx, config, base(w), w.deps), { code: 'STACK_DEPLOY_IMAGE' });
  assert.equal(w.host.calls.length, 0);
});

test('a provisioning failure stops before the stack deploy: the services are untouched and nothing is rolled back', async () => {
  const w = await world({ spies: { provision: () => ({ ok: false, lines: ['provision: secret create failed'] }) } });
  const result = await deployRelease(w.ctx, config, base(w), w.deps);
  assert.equal(result.ok, false);
  assert.deepEqual(result.data.steps, [{ step: 'render', ok: true }, { step: 'provision', ok: false }]);
  assert.deepEqual(result.lines.slice(-2), ['provision: secret create failed', 'deploy not started; the services are untouched']);
  assert.equal(w.host.calls.length, 0);
  assert.equal(w.trace.includes('ssh:upload'), false);
});

test('a provisioning stub without lines still fails cleanly', async () => {
  const w = await world({ previous: false });
  const result = await deployRelease(w.ctx, config, base(w), { ...w.deps, provisionRelease: async () => ({ ok: false }) });
  assert.equal(result.ok, false);
  assert.equal(result.lines.at(-1), 'deploy not started; the services are untouched');
});

test('a failed pre-pull or release upload fails before the deploy and leaves the services alone', async () => {
  const pull = await world({ overrides: { 'pull --quiet': () => ({ status: 1, stdout: '', stderr: 'manifest unknown\nmore' }) } });
  await assert.rejects(deployRelease(pull.ctx, config, base(pull), pull.deps), (error) => error.code === 'STACK_DEPLOY_PULL' && error.message.endsWith('manifest unknown'));
  assert.equal(pull.host.calls.some((call) => call.args[0] === 'stack'), false);
  assert.equal(await currentPointer(), OLD_ID);
  const upload = await world({ failSsh: ['cat >'] });
  await assert.rejects(deployRelease(upload.ctx, config, base(upload), upload.deps), { code: 'STACK_RELEASE_SSH' });
  assert.equal(upload.host.calls.some((call) => call.args[0] === 'stack'), false);
});

test('a rolled back update redeploys the previous release from its stored bytes and reports failure', async () => {
  const w = await world();
  w.host.state.deployUpdate = (name, spec) => (spec.image.endsWith(NEW) ? rollbackUpdate(w.host) : { State: 'completed', StartedAt: new Date(w.host.state.time).toISOString() });
  const result = await deployRelease(w.ctx, config, base(w), w.deps);
  assert.equal(result.ok, false);
  assert.equal(result.data.rolledBack, true);
  assert.ok(result.lines.includes('deploy failed at converge'));
  assert.ok(result.lines.includes(`ROLLING BACK to the previous accepted release ${OLD_ID}`));
  assert.equal(result.lines.at(-1), `rolled back to ${OLD_ID}`);
  assert.deepEqual(result.data.steps.slice(-3), [{ step: 'rollback-deploy', ok: true }, { step: 'rollback-edge', ok: true }, { step: 'rollback-converge', ok: true }]);
  assert.equal(w.host.state.deployed.length, 2);
  assert.equal(w.host.state.deployed[1].file, path.join(w.out, 'previous', 'stack.yaml'));
  assert.equal(w.host.state.services.get('app_api').image, `ghcr.io/o/app-api@sha256:${OLD}`);
  const redeploy = w.host.calls.filter((call) => call.args[0] === 'stack' && call.args[1] === 'deploy')[1];
  assert.deepEqual(w.calls.converge[1], { since: new Date(redeploy.at - 30_000).toISOString(), timeoutSeconds: 600 });
  assert.equal(await currentPointer(), OLD_ID);
  assert.equal(w.trace.includes('verify'), false);
  assert.equal(dockerWrites(w.trace).includes('docker:image prune'), false);
});

test('a failed docker stack deploy also rolls back, with the deploy error in the lines', async () => {
  let first = true;
  const hook = (command, args) => {
    if (!(command === 'docker' && args[0] === 'stack' && args[1] === 'deploy' && first)) return undefined;
    first = false;
    return { status: 1, stdout: '', stderr: 'network not found\nmore' };
  };
  const w = await world({ hook });
  const result = await deployRelease(w.ctx, config, base(w), w.deps);
  assert.equal(result.ok, false);
  assert.ok(result.lines.includes('docker stack deploy failed: network not found'));
  assert.ok(result.lines.includes('deploy failed at deploy'));
  assert.equal(result.lines.at(-1), `rolled back to ${OLD_ID}`);
  assert.equal(result.data.steps.some((entry) => entry.step === 'converge'), false);
  assert.equal(w.host.state.deployed.length, 1);
});

test('an exception in a later step (convergence) counts as a failed step and triggers the rollback', async () => {
  const w = await world({ spies: {} });
  let first = true;
  const deps = { ...w.deps, convergeStack: async (ctx, cfg, options) => {
    if (first) { first = false; throw new Error('docker daemon went away'); }
    return convergeStack(ctx, cfg, options);
  } };
  const result = await deployRelease(w.ctx, config, base(w), deps);
  assert.equal(result.ok, false);
  assert.ok(result.lines.includes('docker daemon went away'));
  assert.equal(result.data.rolledBack, true);
});

test('a failing verification rolls back and the pointer stays on the previous release', async () => {
  const w = await world({ spies: { verify: () => ({ ok: false, lines: ['FAIL  live  HTTP 503'], data: { checks: [] } }) } });
  const result = await deployRelease(w.ctx, config, base(w), w.deps);
  assert.equal(result.ok, false);
  assert.ok(result.lines.includes('FAIL  live  HTTP 503'));
  assert.ok(result.lines.includes('deploy failed at verify'));
  assert.equal(result.data.rolledBack, true);
  assert.equal(await currentPointer(), OLD_ID);
});

test('a pointer move that fails after verification rolls back as well', async () => {
  const w = await world({ failSsh: ['mv -Tf'] });
  const result = await deployRelease(w.ctx, config, base(w), w.deps);
  assert.equal(result.ok, false);
  assert.ok(result.lines.includes('deploy failed at accept'));
  assert.equal(result.data.rolledBack, true);
  assert.equal(await currentPointer(), OLD_ID);
});

test('a failure with no previous release cannot roll back and says what Swarm did', async () => {
  const w = await world({ previous: false });
  w.host.state.deployUpdate = () => rollbackUpdate(w.host);
  const result = await deployRelease(w.ctx, config, base(w), w.deps);
  assert.equal(result.ok, false);
  assert.equal(result.data.rolledBack, false);
  assert.equal(result.data.previous, null);
  assert.equal(result.lines.at(-1), 'no previous accepted release; services were rolled back by update_config where they had a previous spec');
  assert.equal(w.host.state.deployed.length, 1);
  assert.equal(await currentPointer(), '');
});

test('a rollback that does not converge is reported loudly', async () => {
  const w = await world();
  w.host.state.deployUpdate = () => rollbackUpdate(w.host);
  const result = await deployRelease(w.ctx, config, base(w), w.deps);
  assert.equal(result.ok, false);
  assert.equal(result.data.rolledBack, false);
  assert.equal(result.lines.at(-1), 'ROLLBACK DID NOT CONVERGE: follow the stack runbook, Rollback');
  assert.equal(result.data.steps.at(-1).step, 'rollback-converge');
  assert.equal(result.data.steps.at(-1).ok, false);
});

test('a rollback whose stored record cannot be fetched does not converge', async () => {
  const w = await world({ failSsh: ['cat "'] });
  w.host.state.deployUpdate = () => rollbackUpdate(w.host);
  const result = await deployRelease(w.ctx, config, base(w), w.deps);
  assert.equal(result.data.rolledBack, false);
  assert.equal(result.data.steps.at(-1).step, 'rollback-fetch');
  assert.equal(result.lines.at(-1), 'ROLLBACK DID NOT CONVERGE: follow the stack runbook, Rollback');
});

test('the ssh runner is built once from the context, the config and the --ssh-cmd option', async () => {
  const w = await world({ previous: false });
  await deployRelease(w.ctx, config, base(w, { sshCmd: 'ssh -F cfg' }), w.deps);
  assert.deepEqual(w.calls.sshFactory, [{ sshCmd: 'ssh -F cfg' }]);
  const other = await world({ previous: false });
  await deployRelease(other.ctx, config, base(other), other.deps);
  assert.deepEqual(other.calls.sshFactory, [{ sshCmd: null }]);
});

test('rollback of the previous pointer: a dry run reads the pointer and changes nothing', async () => {
  const w = await world();
  const second = createReleaseStore(config, remote.ssh);
  const stored = path.join(work, 'second');
  fs.mkdirSync(stored, { recursive: true });
  fs.writeFileSync(path.join(stored, 'stack.yaml'), stackText(NEW));
  fs.writeFileSync(path.join(stored, 'release.json'), '{}');
  await second.store(stored, NEW_ID);
  await second.accept(NEW_ID);
  remote.calls.length = 0;
  const result = await rollbackRelease(w.ctx, config, { execute: false }, w.deps);
  assert.deepEqual(result, { ok: true, lines: [`dry run: would redeploy release ${OLD_ID}`], data: { release: OLD_ID, executed: false } });
  assert.equal(remote.calls.length, 1);
  assert.equal(kindOf(remote.calls[0].command), 'read-previous');
  assert.equal(w.host.calls.length, 0);
  assert.deepEqual(await rollbackRelease(w.ctx, config, undefined, w.deps), result);
});

test('rollback of an explicit release in a dry run needs no remote read', async () => {
  const w = await world();
  const result = await rollbackRelease(w.ctx, config, { release: NEW_ID }, w.deps);
  assert.equal(result.lines[0], `dry run: would redeploy release ${NEW_ID}`);
  assert.equal(remote.calls.length, 0);
});

test('rollback redeploys the stored bytes, converges, verifies and only then moves the pointer', async () => {
  const w = await world();
  w.ctx.env.RELEASE = '$(id)';
  const result = await rollbackRelease(w.ctx, config, { release: OLD_ID, execute: true }, w.deps);
  assert.equal(result.ok, true, result.lines.join('\n'));
  assert.deepEqual(result.data.steps.map((entry) => entry.step), ['fetch', 'deploy', 'edge', 'converge', 'verify', 'accept']);
  assert.equal(result.lines.at(-1), `rolled back to release ${OLD_ID}; a rollback cannot undo data effects`);
  const deployed = w.host.state.deployed[0];
  assert.equal(path.basename(deployed.file), 'stack.yaml');
  assert.equal(fs.existsSync(deployed.file), false);
  assert.equal(deployed.model.services.api.image, `ghcr.io/o/app-api@sha256:${OLD}`);
  assert.deepEqual(w.calls.converge[0].timeoutSeconds, 600);
  assert.deepEqual(w.calls.verify[0].retrySeconds, 180);
  assert.match(w.calls.verify[0].stackFile, /stack.yaml$/u);
  assert.equal(await currentPointer(), OLD_ID);
});

test('rollback with no release uses the previous pointer and honours --timeout', async () => {
  const w = await world();
  const store = createReleaseStore(config, remote.ssh);
  const dir = path.join(work, 'third');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'stack.yaml'), stackText(NEW));
  fs.writeFileSync(path.join(dir, 'release.json'), '{}');
  await store.store(dir, NEW_ID);
  await store.accept(NEW_ID);
  const result = await rollbackRelease(w.ctx, config, { execute: true, timeoutSeconds: 30, sshCmd: 'ssh -F cfg' }, w.deps);
  assert.equal(result.ok, true, result.lines.join('\n'));
  assert.equal(result.data.release, OLD_ID);
  assert.equal(w.calls.converge[0].timeoutSeconds, 30);
  assert.deepEqual(w.calls.sshFactory, [{ sshCmd: 'ssh -F cfg' }]);
  assert.equal(await currentPointer(), OLD_ID);
});

test('rollback without any target is refused', async () => {
  const w = await world({ previous: false });
  await assert.rejects(rollbackRelease(w.ctx, config, { execute: true }, w.deps), { code: 'STACK_ROLLBACK_NO_TARGET' });
  assert.equal(w.host.calls.length, 0);
});

test('a hostile or malformed release is refused before ssh is even prepared', async () => {
  const w = await world({ previous: false });
  const hostile = ['$(id)', '../x', '0123456789ABCDEF', `${OLD_ID}0`, '', 7];
  await Promise.all(hostile.map((release) => assert.rejects(rollbackRelease(w.ctx, config, { release, execute: true }, w.deps), { code: 'STACK_RELEASE_ID' })));
  assert.equal(w.calls.sshFactory.length, 0);
  assert.equal(w.host.calls.length, 0);
});

test('a rollback that fails to converge reports the failed step and leaves the pointer', async () => {
  const w = await world();
  w.host.state.deployUpdate = () => rollbackUpdate(w.host);
  const result = await rollbackRelease(w.ctx, config, { release: OLD_ID, execute: true }, w.deps);
  assert.equal(result.ok, false);
  assert.equal(result.lines.at(-1), `rollback to ${OLD_ID} failed at converge`);
  assert.equal(result.data.steps.at(-1).step, 'converge');
  assert.equal(await currentPointer(), OLD_ID);
  assert.equal(w.calls.verify.length, 0);
});

test('a rollback to a release that was never stored fails at the fetch', async () => {
  const w = await world();
  const result = await rollbackRelease(w.ctx, config, { release: NEW_ID, execute: true }, w.deps);
  assert.equal(result.ok, false);
  assert.equal(result.lines.at(-1), `rollback to ${NEW_ID} failed at fetch`);
  assert.equal(w.host.calls.some((call) => call.args[0] === 'stack'), false);
});

test('a first deploy into a shared ingress (--skip-public) verifies inside the stack only and leaves the release pending', async () => {
  const w = await world();
  const result = await deployRelease(w.ctx, config, base(w, { skipPublic: true, retrySeconds: 60 }), w.deps);
  assert.equal(result.ok, true, result.lines.join('\n'));
  assert.deepEqual(w.calls.verify[0], { retrySeconds: 60, skipPublic: true, stackFile: path.join(w.out, 'stack.yaml') });
  assert.equal(w.trace.includes('ssh:accept'), false, 'the pointer does not move');
  assert.equal(w.trace.includes('prune'), false, 'nothing is pruned before the accept');
  assert.equal(await currentPointer(), OLD_ID);
  assert.equal(result.data.pendingAccept, true);
  assert.deepEqual(result.data.steps.map((entry) => entry.step), ['render', 'provision', 'store', 'pre-pull', 'deploy', 'edge', 'converge', 'verify']);
  assert.match(result.lines.at(-2), /the public hosts were NOT checked and the release is NOT accepted yet/u);
  assert.equal(result.lines.at(-1), `next: starci app stack ingress publish, then starci app stack accept --release ${NEW_ID} --execute`);
});

test('a failing inside verification of a pending deploy still rolls back to the previous accepted release', async () => {
  const w = await world({ spies: { verify: async () => ({ ok: false, lines: ['FAIL internal'] }) } });
  const result = await deployRelease(w.ctx, config, base(w, { skipPublic: true }), w.deps);
  assert.equal(result.ok, false);
  assert.equal(result.data.rolledBack, true);
  assert.equal(await currentPointer(), OLD_ID);
});

test('the dry run of a --skip-public deploy says the release stays pending', async () => {
  const w = await world();
  const result = await deployRelease(w.ctx, config, base(w, { skipPublic: true, execute: false }), w.deps);
  assert.match(result.lines.at(-1), /public hosts skipped\); it would stay pending until ingress publish and stack accept/u);
});

test('accept needs a release id, a stored record and the FULL verification before the pointer moves', async () => {
  const w = await world();
  await deployRelease(w.ctx, config, base(w, { skipPublic: true }), w.deps);
  await assert.rejects(acceptRelease(w.ctx, config, { release: null }, w.deps), (error) => error.code === 'STACK_RELEASE_ID');
  await assert.rejects(acceptRelease(w.ctx, config, { release: '0000000000000001', execute: true }, w.deps), (error) => error.code === 'STACK_ACCEPT_UNKNOWN');
  const dry = await acceptRelease(w.ctx, config, { release: NEW_ID }, w.deps);
  assert.match(dry.lines[0], /^dry run: would run the full verification/u);
  assert.equal(await currentPointer(), OLD_ID);
  const calls = w.calls.verify.length;
  const done = await acceptRelease(w.ctx, config, { release: NEW_ID, execute: true, retrySeconds: 30 }, w.deps);
  assert.equal(done.ok, true, done.lines.join('\n'));
  assert.equal(w.calls.verify[calls].retrySeconds, 30);
  assert.match(w.calls.verify[calls].stackFile, /stack.yaml$/u);
  assert.equal(await currentPointer(), NEW_ID);
  assert.equal(await createReleaseStore(config, remote.ssh).previous(), OLD_ID);
  assert.ok(done.lines.includes(`accepted release ${NEW_ID}`));
  assert.equal(w.calls.prune.length, 1);
  const again = await acceptRelease(w.ctx, config, { release: NEW_ID, execute: true }, w.deps);
  assert.match(again.lines[0], /is already the accepted release/u);
});

test('accept does not move the pointer when the full verification fails', async () => {
  const w = await world({ spies: { verify: async (ctx, cfg, options) => (options.skipPublic ? { ok: true, lines: [] } : { ok: false, lines: ['FAIL public'] }) } });
  await deployRelease(w.ctx, config, base(w, { skipPublic: true }), w.deps);
  const result = await acceptRelease(w.ctx, config, { release: NEW_ID, execute: true }, w.deps);
  assert.equal(result.ok, false);
  assert.ok(result.lines.includes(`release ${NEW_ID} is NOT accepted: the full verification failed`));
  assert.equal(await currentPointer(), OLD_ID);
});

test('accept without a verification result lines and without a previous release still accepts', async () => {
  const w = await world({ previous: false, spies: { verify: async (ctx, cfg, options) => (options.skipPublic ? { ok: true, lines: [] } : { ok: true }) } });
  await deployRelease(w.ctx, config, base(w, { skipPublic: true }), w.deps);
  const result = await acceptRelease(w.ctx, config, { release: NEW_ID, execute: true }, w.deps);
  assert.equal(result.ok, true);
  assert.equal(await currentPointer(), NEW_ID);
});

const aliasStack = (alias) => `services:
  web:
    image: ghcr.io/o/app-web@sha256:${WEB}
    networks:
      edge:
        aliases: [${alias}]
  worker:
    image: ghcr.io/o/app-api@sha256:${NEW}
`;
const withUpstreams = (upstreams) => ({ ...config, ingress: { upstreams } });
const live = { name: 'shop-web', container: 'shop-web-web-1', hostAddress: null, aliases: ['shop-web'] };

test('a swarm service that claims the alias of a live upstream is refused before anything changes (the new web must not join the old route)', async () => {
  const w = await world();
  const refused = (error) => error.code === 'STACK_DEPLOY_ALIAS_SHARED' && /service web claims the network alias shop-web, which the live upstream shop-web .* shop-web-swarm/u.test(error.message);
  await assert.rejects(deployRelease(w.ctx, withUpstreams([live]), base(w, { out: w.out, execute: true }), { ...w.deps, renderRelease: async (ctx, cfg, options) => { fs.mkdirSync(options.out, { recursive: true }); fs.writeFileSync(path.join(options.out, 'stack.yaml'), aliasStack('shop-web')); fs.writeFileSync(path.join(options.out, 'release.json'), '{}'); return { ok: true, lines: [] }; } }), refused);
  assert.equal(w.trace.includes('provision'), false);
  assert.equal(w.trace.some((entry) => entry.startsWith('ssh:')), false, 'no remote call');
});

test('its own alias, a host-address upstream and a stack without networks are accepted', async () => {
  const render = (text) => async (ctx, cfg, options) => { fs.mkdirSync(options.out, { recursive: true }); fs.writeFileSync(path.join(options.out, 'stack.yaml'), text); fs.writeFileSync(path.join(options.out, 'release.json'), '{"secrets":[],"configs":[]}'); return { ok: true, lines: [] }; };
  const hostOnly = { name: 'shop-web', container: null, hostAddress: '10.0.0.1', aliases: ['shop-web'] };
  for (const [cfg, text] of [[withUpstreams([live]), aliasStack('shop-web-swarm')], [withUpstreams([hostOnly]), aliasStack('shop-web')], [config, aliasStack('shop-web')], [withUpstreams([live]), stackText(NEW)], [withUpstreams([live]), 'services:\n  a:\n    networks:\n      edge:\n  b:\n'], [withUpstreams([live]), '# no services\n']]) {
    const w = await world();
    const result = await deployRelease(w.ctx, cfg, base(w, { execute: false }), { ...w.deps, renderRelease: render(text) });
    assert.equal(result.ok, true);
  }
});

// ---- the shared edge network: the stack short name must never stay on it ----
const EDGE = 'shared-edge';
const edgeText = (api) => `services:
  api:
    image: ghcr.io/o/app-api@sha256:${api}
    networks:
      edge:
        aliases:
          - app-api
networks:
  edge:
    external: true
    name: ${EDGE}
`;
const aliasesOnEdge = (w) => w.host.state.services.get('app_api').networks.map((entry) => entry.aliases);
const withEdge = (w, names = ['tayson-web']) => { w.host.state.networks.set(EDGE, { containers: names, services: [] }); return w; };
const edgeWorld = async (extra = {}) => withEdge(await world({ stackFor: () => edgeText(NEW), previousText: edgeText(OLD), ...extra }), extra.names);

test('a service whose short name another tenant already resolves on the edge network is refused before anything is changed', async () => {
  const w = await edgeWorld({ names: ['tayson-web', 'api'] });
  const refused = (error) => error.code === 'STACK_DEPLOY_ALIAS_SHARED' && /app_api/u.test(error.message) && /alias api/u.test(error.message) && /shared-edge/u.test(error.message);
  await assert.rejects(deployRelease(w.ctx, config, base(w), w.deps), refused);
  assert.equal(w.trace.includes('provision'), false);
  assert.equal(w.trace.some((entry) => entry.startsWith('docker:stack deploy') || entry.startsWith('docker:pull')), false);
  assert.equal(w.host.state.deployed.length, 0);
});

test('an unreadable edge network refuses the deploy before provisioning', async () => {
  const w = await world({ stackFor: () => edgeText(NEW) });
  await assert.rejects(deployRelease(w.ctx, config, base(w), w.deps), (error) => error.code === 'STACK_DEPLOY_EDGE_UNREADABLE');
  assert.equal(w.trace.includes('provision'), false);
});

test('a deploy reconciles the edge attachment to the declared aliases before converge, verify and accept (docker stack deploy added the short name)', async () => {
  const w = await edgeWorld();
  const result = await deployRelease(w.ctx, config, base(w), w.deps);
  assert.equal(result.ok, true);
  assert.deepEqual(aliasesOnEdge(w), [['app-api']], 'only the declared alias remains: never api');
  assert.deepEqual(result.data.steps.map((entry) => entry.step).slice(-4), ['edge', 'converge', 'verify', 'accept']);
  assert.ok(result.lines.some((line) => line.includes('aliases [app-api, api] -> [app-api]')));
  assert.ok(w.trace.indexOf('converge') > w.trace.lastIndexOf('docker:service update'));
  assert.equal(w.trace.indexOf('ssh:accept') > w.trace.indexOf('verify'), true);
  assert.equal(await currentPointer(), idOf(edgeText(NEW)));
  const again = await deployRelease(w.ctx, config, base(w, { out: path.join(work, 'again') }), w.deps);
  assert.equal(again.ok, true);
  assert.deepEqual(aliasesOnEdge(w), [['app-api']]);
});

test('a --skip-public first deploy also reconciles the edge before the release is left pending', async () => {
  const w = await edgeWorld({ previous: false });
  const result = await deployRelease(w.ctx, config, base(w, { skipPublic: true }), w.deps);
  assert.equal(result.ok, true);
  assert.equal(result.data.pendingAccept, true);
  assert.deepEqual(aliasesOnEdge(w), [['app-api']]);
  assert.equal(await currentPointer(), '');
});

test('a reconcile that cannot reach the declared aliases fails the deploy with its code, before converge and accept', async () => {
  const w = await edgeWorld({ previous: false, overrides: { 'service update': () => ({ status: 0, stdout: '', stderr: '' }) } });
  const result = await deployRelease(w.ctx, config, base(w), w.deps);
  assert.equal(result.ok, false);
  assert.ok(result.lines.some((line) => line.includes('STACK_DEPLOY_EDGE_ALIAS')));
  assert.equal(result.data.steps.at(-1).step, 'edge');
  assert.equal(w.trace.includes('converge'), false);
  assert.equal(await currentPointer(), '');
});

test('a failed deploy rolls back to the stored release and reconciles its edge attachment too', async () => {
  const w = await edgeWorld({ spies: { verify: async () => ({ ok: false, lines: ['verify: FAIL'] }) } });
  const result = await deployRelease(w.ctx, config, base(w), w.deps);
  assert.equal(result.ok, false);
  assert.equal(result.data.rolledBack, true);
  assert.ok(result.data.steps.some((entry) => entry.step === 'rollback-edge' && entry.ok));
  assert.deepEqual(aliasesOnEdge(w), [['app-api']]);
});

test('rollback and accept pass the stored stack file to the edge reconcile and to the verification', async () => {
  const w = await edgeWorld();
  const rolled = await rollbackRelease(w.ctx, config, { execute: true, release: OLD_ID }, w.deps);
  assert.equal(rolled.ok, true);
  assert.deepEqual(aliasesOnEdge(w), [['app-api']]);
  assert.match(w.calls.verify.at(-1).stackFile, /stack.yaml$/u);
  const accepting = await edgeWorld({ previous: false });
  await accepting.deps.releaseStore(config, accepting.ssh).store(await (async () => { const dir = path.join(work, 'pend'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'stack.yaml'), edgeText(NEW)); fs.writeFileSync(path.join(dir, 'release.json'), '{"secrets":[],"configs":[]}'); return dir; })(), NEW_ID);
  const accepted = await acceptRelease(accepting.ctx, config, { release: NEW_ID, execute: true }, accepting.deps);
  assert.equal(accepted.ok, true);
  assert.match(accepting.calls.verify.at(-1).stackFile, /stack.yaml$/u);
});
