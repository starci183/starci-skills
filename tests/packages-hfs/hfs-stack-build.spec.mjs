import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
function shim({ dirty = '', tags = 'v0.1.0\nnot-a-release\n', remote = 'https://github.com/Starci183/nivo-lite.git', buildFails = null, noDigest = false, head = SHA, gitFails = null, emptyMetadata = false, silentFailure = false } = {}) {
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
    throw new Error(`unknown command ${command} ${args.join(' ')}`);
  };
  return { spawn, calls, builds: () => calls.filter((call) => call.command === 'docker') };
}

const run = (made, options, extra) => buildImages(made.ctx({ spawn: extra.spawn }), made.config, options);

test('a dry run prints the release, the Dockerfiles and the tags, and builds nothing', async () => {
  const made = app();
  const s = shim();
  const result = await run(made, {}, s);
  assert.equal(result.ok, true);
  assert.match(result.lines[0], /^release v0\.1\.0 at a1a1a1a1a1a1: 2 image\(s\)$/u);
  assert.ok(result.lines.includes(`  api: be/apps/api/Dockerfile -> ghcr.io/starci183/app-api:${SHA}`));
  assert.ok(result.lines.includes(`  web: fe/apps/web/Dockerfile -> ghcr.io/starci183/app-web:${SHA}`));
  assert.match(result.lines.at(-1), /dry run: would build \(local only/u);
  assert.equal(s.builds().length, 0);
  assert.equal((await run(made, { push: true }, s)).lines.at(-1), 'dry run: would build and push; nothing was built');
});

test('execute with push builds every image with buildx, the public build args, no provenance and linux/amd64, and prints the --image lines', async () => {
  const made = app();
  const s = shim();
  const result = await run(made, { push: true, execute: true }, s);
  assert.equal(result.ok, true);
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
  assert.ok(s.builds().every((call) => call.args.includes('--load') && !call.args.includes('--push')));
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
  const nodigest = await run(made, { push: true, execute: true }, shim({ noDigest: true }));
  assert.equal(nodigest.ok, false);
  assert.ok(nodigest.lines.some((line) => line.endsWith('was pushed but docker reported no digest')));
  const silent = await run(made, { execute: true }, shim({ noDigest: true }));
  assert.equal(silent.ok, true);
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
  const none = await run(made, { push: true, execute: true }, shim({ emptyMetadata: true }));
  assert.equal(none.ok, false);
  const silent = await run(made, { execute: true }, shim({ silentFailure: true }));
  assert.ok(silent.lines.includes('build of api FAILED: docker buildx failed'));
});
