import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildImages } from '../../packages/hfs/stack/build.mjs';
import { makeApp, MEMBERS } from '../helpers/stack-release-fakes.mjs';

const SHA = 'a1'.repeat(20);
const DIGEST = (name) => `sha256:${name === 'web' ? 'b2'.repeat(32) : 'c3'.repeat(32)}`;
const apps = [];
const app = (options) => {
  const made = makeApp(options);
  apps.push(made);
  fs.mkdirSync(path.join(made.root, 'be', 'apps', 'api'), { recursive: true });
  fs.mkdirSync(path.join(made.root, 'fe', 'apps', 'web'), { recursive: true });
  fs.writeFileSync(path.join(made.root, 'be', 'apps', 'api', 'Dockerfile'), 'FROM scratch\n');
  fs.writeFileSync(path.join(made.root, 'fe', 'apps', 'web', 'Dockerfile'), 'FROM scratch\n');
  return made;
};
after(() => apps.forEach((made) => made.dispose()));
const ok = (stdout = '') => ({ status: 0, stdout, stderr: '' });

/** A git and docker shim: answers by command, writes the buildx metadata file, records every call. */
function shim({ dirty = '', tags = 'v0.1.0\nnot-a-release\n', remote = 'https://github.com/Starci183/nivo-lite.git', buildFails = null, noDigest = false, head = SHA, gitFails = null, emptyMetadata = false, silentFailure = false, imageLeak = false, pushFails = false, pushNoDigest = false, scanBroken = false } = {}) {
  const calls = [];
  const spawn = (command, args, options = {}) => {
    calls.push({ command, args, cwd: options.cwd });
    if (command === 'git') {
      if (gitFails === args[0]) return { status: 1, stdout: '', stderr: 'git broke' };
      if (args[0] === 'status') return ok(dirty);
      if (args[0] === 'rev-parse') return ok(`${head}\n`);
      if (args[0] === 'tag') return ok(tags);
      if (args[0] === 'remote') return remote === null ? { status: 1, stdout: '', stderr: 'no remote' } : ok(`${remote}\n`);
    }
    if (command === 'docker' && args[0] === 'buildx') {
      const file = args[args.indexOf('--file') + 1];
      const service = file.includes('/web/') ? 'web' : 'api';
      if (buildFails === service) return { status: 1, stdout: '', stderr: `build ${service} failed\nsecond line` };
      if (silentFailure) return { status: 1, stdout: '', stderr: '' };
      const metadata = args[args.indexOf('--metadata-file') + 1];
      if (emptyMetadata) { fs.writeFileSync(metadata, '{}'); return ok(); }
      if (!noDigest) fs.writeFileSync(metadata, JSON.stringify({ 'containerimage.digest': DIGEST(service) }));
      else fs.writeFileSync(metadata, 'not json');
      return ok();
    }
    if (command === 'docker' && args[0] === 'push') {
      if (pushFails) return { status: 1, stdout: '', stderr: 'denied: push refused\nsecond' };
      return ok(pushNoDigest ? 'pushed\n' : `latest: digest: ${DIGEST(args[1].includes('-web:') ? 'web' : 'api')} size: 1\n`);
    }
    if (command === 'docker' && ['history', 'inspect', 'create', 'export', 'rm'].includes(args[0])) return scanAnswer(args, { imageLeak, scanBroken });
    throw new Error(`unknown command ${command} ${args.join(' ')}`);
  };
  return { spawn, calls, builds: () => calls.filter((call) => call.command === 'docker') };
}

/** The docker answers of the image scan: a clean image, or one whose build history carries a private key block. */
function scanAnswer(args, { imageLeak, scanBroken }) {
  if (scanBroken && args[0] === 'inspect') return { status: 1, stdout: '', stderr: 'inspect broke' };
  if (args[0] === 'history') return ok(imageLeak ? ['RUN echo -----BEGIN OPENSSH', 'PRIVATE KEY-----'].join(' ') : 'COPY dir:abc in /app');
  if (args[0] === 'inspect') return ok('["PATH=/usr/bin"]');
  if (args[0] === 'create') return ok('cid1\n');
  if (args[0] === 'export') { fs.writeFileSync(args[2], Buffer.alloc(1024)); return ok(); }
  return ok();
}

/** The anonymous registry: a token endpoint and a manifest endpoint; state is what the manifest fetch answers. */
const anonymousRegistry = (state) => async (url) => {
  if (state === 'offline') throw new Error('offline');
  if (String(url).includes('/token?')) return { ok: state !== 'no-token', json: async () => ({ token: 'anonymous-token' }) };
  return { status: state === 'private' ? 401 : 200 };
};
const registryOf = (made, visibility) => ({ ...made.config, registry: { ...made.config.registry, visibility } });
const run = (made, options, extra) => buildImages(made.ctx({ env: { STARCI_SECRET_VERSION_KEY: 'fixture-version-key', SOPS_AGE_KEY: 'AGE-SECRET-KEY-FAKE' }, spawn: extra.spawn, fetch: extra.fetch ?? anonymousRegistry('public') }), extra.config ?? made.config, options);

test('a dry run prints the release, the Dockerfiles and the tags, and builds nothing', async () => {
  const made = app();
  const s = shim();
  const result = await run(made, {}, s);
  assert.equal(result.ok, true);
  assert.match(result.lines[0], /^release v0\.1\.0 at a1a1a1a1a1a1: 2 image\(s\), registry ghcr\.io \(public\)$/u);
  assert.ok(result.lines.includes(`  api: be/apps/api/Dockerfile -> ghcr.io/starci183/app-api:${SHA}`));
  assert.ok(result.lines.includes(`  web: fe/apps/web/Dockerfile -> ghcr.io/starci183/app-web:${SHA}`));
  assert.match(result.lines.at(-1), /dry run: would build, scan for secret material \(local only/u);
  assert.equal(s.builds().length, 0);
  assert.equal((await run(made, { push: true }, s)).lines.at(-1), 'dry run: would build, scan for secret material and push; nothing was built');
  assert.equal((await run(made, { push: true }, { ...s, config: registryOf(made, 'private') })).lines.at(-1), 'dry run: would build and push; nothing was built');
});

test('private: execute with push builds and pushes every image with buildx, the public build args, no provenance and linux/amd64, and prints the --image lines', async () => {
  const made = app();
  const s = { ...shim(), config: registryOf(made, 'private'), fetch: anonymousRegistry('private') };
  const result = await run(made, { push: true, execute: true }, s);
  assert.equal(result.ok, true);
  assert.equal(s.calls.some((call) => ['history', 'push'].includes(call.args[0])), false, 'a private image is neither scanned nor pushed separately');
  const [api, web] = s.builds().map((call) => call.args);
  for (const argv of [api, web]) {
    assert.deepEqual(argv.slice(0, 2), ['buildx', 'build']);
    assert.ok(argv.includes('--push') && !argv.includes('--load'));
    assert.equal(argv[argv.indexOf('--platform') + 1], 'linux/amd64');
    assert.ok(argv.includes('--provenance=false'));
    assert.equal(argv.at(-1), '.');
  }
  assert.equal(api.includes('--build-arg'), false, 'api declares no build values');
  const pairs = web.flatMap((arg, i) => (web[i - 1] === '--build-arg' ? [arg] : []));
  assert.deepEqual(pairs, ['PUBLIC_URL=https://app.example.test', `PUBLIC_KEY=${MEMBERS.web.PUBLIC_KEY}`]);
  assert.equal(result.data.images.api, `ghcr.io/starci183/app-api@${DIGEST('api')}`);
  assert.equal(result.data.images.web, `ghcr.io/starci183/app-web@${DIGEST('web')}`);
  assert.equal(result.lines.at(-1), `--image api=${result.data.images.api} --image web=${result.data.images.web} --source-sha ${SHA}`);
  assert.equal(s.builds()[0].cwd, made.root);
  assert.equal(JSON.stringify(s.calls).includes('login'), false, 'registry credentials are never touched');
});

test('execute without push builds locally and gives no digest', async () => {
  const made = app();
  const s = shim();
  const result = await run(made, { execute: true }, s);
  assert.equal(result.ok, true);
  assert.ok(s.builds().filter((call) => call.args[0] === 'buildx').every((call) => call.args.includes('--load') && !call.args.includes('--push')));
  assert.deepEqual(result.data.images, {});
  assert.ok(result.lines.some((line) => line.startsWith('built api (local image')));
});

test('a dirty tree, an untagged HEAD and a broken git are refused before anything is built', async () => {
  const made = app();
  for (const [options, code] of [[{ dirty: ' M a.txt\n?? b.txt\n' }, 'STACK_BUILD_DIRTY'], [{ tags: 'not-a-release\n' }, 'STACK_BUILD_UNTAGGED'], [{ head: 'zz' }, 'STACK_BUILD_GIT'], [{ head: '' }, 'STACK_BUILD_GIT'], [{ gitFails: 'status' }, 'STACK_BUILD_GIT']]) {
    const s = shim(options);
    await assert.rejects(run(made, { push: true, execute: true }, s), (error) => error.code === code, code);
    assert.equal(s.builds().length, 0);
  }
  await assert.rejects(run(made, {}, shim({ dirty: ' M a.txt' + String.fromCodePoint(10) })), (error) => error.message.includes('1 path(s), first:  M a.txt'));
});

test('the image owner comes from a github origin; anything else is refused', async () => {
  const made = app();
  for (const remote of ['git@github.com:Org-One/repo.git', 'https://github.com/Org-One/repo']) {
    const result = await run(made, {}, shim({ remote }));
    assert.ok(result.lines.some((line) => line.includes('ghcr.io/org-one/app-api:')), remote);
  }
  for (const remote of ['https://gitlab.com/o/r.git', null]) await assert.rejects(run(made, {}, shim({ remote })), (error) => error.code === 'STACK_BUILD_OWNER');
});

test('a failing build stops the run and names the image; a push without a digest is a failure', async () => {
  const made = app();
  const failed = await run(made, { push: true, execute: true }, shim({ buildFails: 'web' }));
  assert.equal(failed.ok, false);
  assert.ok(failed.lines.includes('build of web FAILED: build web failed'));
  assert.deepEqual(Object.keys(failed.data.images), ['api'], 'what was pushed before the failure is reported');
  const nodigest = await run(made, { push: true, execute: true }, shim({ pushNoDigest: true }));
  assert.equal(nodigest.ok, false);
  assert.ok(nodigest.lines.some((line) => line.endsWith('was pushed but docker reported no digest')));
  const silent = await run(made, { execute: true }, shim({ noDigest: true }));
  assert.equal(silent.ok, true);
  const privateNoDigest = await run(made, { push: true, execute: true }, { ...shim({ noDigest: true }), config: registryOf(made, 'private') });
  assert.equal(privateNoDigest.ok, false);
  assert.ok(privateNoDigest.lines.some((line) => line.endsWith('was pushed but docker reported no digest')));
});

test('a missing, ambiguous Dockerfile and a deploy block without images are refused', async () => {
  const none = makeApp();
  apps.push(none);
  await assert.rejects(run(none, {}, shim()), (error) => error.code === 'STACK_BUILD_NO_DOCKERFILE');
  const both = app();
  fs.mkdirSync(path.join(both.root, 'fe', 'apps', 'api'), { recursive: true });
  fs.writeFileSync(path.join(both.root, 'fe', 'apps', 'api', 'Dockerfile'), 'FROM scratch\n');
  await assert.rejects(run(both, {}, shim()), (error) => error.code === 'STACK_BUILD_AMBIGUOUS');
  const empty = app();
  await assert.rejects(buildImages(empty.ctx({ spawn: shim().spawn }), { ...empty.config, images: {} }, {}), (error) => error.code === 'STACK_BUILD_NO_IMAGES');
});

test('a metadata file without a digest and a silent docker failure are handled', async () => {
  const made = app();
  const none = await run(made, { push: true, execute: true }, { ...shim({ emptyMetadata: true }), config: registryOf(made, 'private') });
  assert.equal(none.ok, false);
  const silent = await run(made, { execute: true }, shim({ silentFailure: true }));
  assert.ok(silent.lines.includes('build of api FAILED: docker buildx failed'));
});

test('public: every image is built locally, scanned, then pushed with docker push, and the anonymous visibility check passes', async () => {
  const made = app();
  const s = shim();
  const result = await run(made, { push: true, execute: true }, s);
  assert.equal(result.ok, true);
  assert.ok(s.builds().filter((call) => call.args[0] === 'buildx').every((call) => call.args.includes('--load') && !call.args.includes('--push')));
  const order = s.calls.filter((call) => call.command === 'docker').map((call) => call.args[0]);
  assert.ok(order.indexOf('history') < order.indexOf('push'), 'the scan precedes the push');
  assert.ok(result.lines.includes('scanned api: no secret material found') && result.lines.includes('scanned web: no secret material found'));
  assert.ok(result.lines.includes('visibility of app-api: public, as declared'));
  assert.deepEqual(result.data.visibility, { api: 'public', web: 'public' });
  assert.equal(result.data.images.api, `ghcr.io/starci183/app-api@${DIGEST('api')}`);
  const local = await run(made, { execute: true }, shim());
  assert.ok(local.lines.includes('scanned api: no secret material found'));
  assert.equal(local.lines.some((line) => line.startsWith('visibility of')), false, 'nothing was pushed, so nothing is checked');
});

test('public: a leaking image or a scan step that cannot run is refused before any push, naming the place and never the text', async () => {
  const made = app();
  for (const options of [{ imageLeak: true }, { scanBroken: true }]) {
    const s = shim(options);
    const result = await run(made, { push: true, execute: true }, s);
    assert.equal(result.ok, false);
    assert.ok(result.lines.some((line) => line.startsWith('REFUSED to push api: the image would be public')));
    assert.equal(s.calls.some((call) => call.args[0] === 'push'), false);
    assert.equal(result.lines.join(' ').includes('OPENSSH'), false);
  }
});

test('public: a failing docker push stops the run', async () => {
  const made = app();
  const result = await run(made, { push: true, execute: true }, shim({ pushFails: true }));
  assert.equal(result.ok, false);
  assert.ok(result.lines.includes('push of api FAILED: denied: push refused'));
});

test('visibility: a package that is still private fails a public declaration with the owner step; a network error only warns; a public package under a private declaration is a note', async () => {
  const made = app();
  const priv = await run(made, { push: true, execute: true }, { ...shim(), fetch: anonymousRegistry('private') });
  assert.equal(priv.ok, false);
  assert.ok(priv.lines.includes('visibility of app-api is PRIVATE but deploy.registry.visibility is public'));
  assert.ok(priv.lines.some((line) => line.startsWith('owner step: GitHub -> Packages -> app-api')));
  const anonymousWithoutToken = await run(made, { push: true, execute: true }, { ...shim(), fetch: anonymousRegistry('no-token') });
  assert.equal(anonymousWithoutToken.ok, true);
  const offline = await run(made, { push: true, execute: true }, { ...shim(), fetch: anonymousRegistry('offline') });
  assert.equal(offline.ok, true);
  assert.ok(offline.lines.includes('visibility of app-api could not be checked (network)'));
  const note = await run(made, { push: true, execute: true }, { ...shim(), config: registryOf(made, 'private'), fetch: anonymousRegistry('public') });
  assert.equal(note.ok, true);
  assert.ok(note.lines.some((line) => line.startsWith('note: app-api is public although')));
  const agree = await run(made, { push: true, execute: true }, { ...shim(), config: registryOf(made, 'private'), fetch: anonymousRegistry('private') });
  assert.ok(agree.lines.includes('visibility of app-api: private, as declared'));
});

test('build supports ghcr.io only', async () => {
  const made = app();
  await assert.rejects(run(made, {}, { ...shim(), config: { ...made.config, registry: { host: 'registry.example', visibility: 'public' } } }), (error) => error.code === 'STACK_BUILD_REGISTRY');
});

test('a build that opens the sealed build values refuses up front, naming the age identity, when none is available', async () => {
  const made = app();
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-home-'));
  const env = { USERPROFILE: home, HOME: home, APPDATA: path.join(home, 'AppData'), XDG_CONFIG_HOME: path.join(home, 'cfg') };
  const s = shim();
  try {
    await assert.rejects(buildImages(made.ctx({ env, spawn: s.spawn }), made.config, { push: true, execute: true }), (error) => error.code === 'STACK_AGE_IDENTITY_MISSING' && error.message.includes('load the age identity into SOPS_AGE_KEY'));
    assert.equal(s.builds().length, 0, 'nothing was built');
    assert.equal((await buildImages(made.ctx({ env, spawn: s.spawn }), made.config, {})).ok, true, 'a dry run opens nothing');
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});
