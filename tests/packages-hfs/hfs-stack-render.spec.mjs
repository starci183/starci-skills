// proves: render pins images, builds the override from the deploy block, runs docker with a minimal environment and writes the release record.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../packages/hfs/runtime/engine/yaml.mjs';
import { renderRelease } from '../../packages/hfs/stack/render.mjs';
import { IMAGE_API, IMAGE_WEB, SOURCE_SHA, ZERO, makeApp, secretValues } from '../helpers/stack-fakes-A.mjs';

const apps = [];
const outs = [];
const app = (options) => { const made = makeApp(options); apps.push(made); return made; };
const outDir = () => { const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'stack-out-')), 'nested', 'release'); outs.push(path.dirname(path.dirname(dir))); return dir; };
after(() => { apps.forEach((made) => made.dispose()); outs.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })); });

const images = { api: IMAGE_API, web: IMAGE_WEB };
const options = (extra = {}) => ({ images, sourceSha: SOURCE_SHA, previous: null, out: outDir(), allowUnpinned: false, extraCompose: [], ...extra });
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const dockerRenders = (made) => made.host.calls.filter((call) => call.command === 'docker' && call.args[0] === 'stack');

const HOST_ENV = {
  STARCI_SECRET_VERSION_KEY: 'fixture-version-key', SOPS_AGE_KEY: 'AGE-SECRET-KEY-FAKE', DOCKER_HOST: 'ssh://vps',
  PATH: '/usr/bin', HOME: '/home/u', USERPROFILE: 'C:/Users/u', SystemRoot: 'C:/Windows', TEMP: '/tmp', TMP: '/tmp', DOCKER_CONFIG: '/dc', CONTACT_EMAIL: 'ops@example.test', UNRELATED: 'x',
};

test('a render writes the override, the rendered stack and the release record, and reports names and counts', async () => {
  const made = app();
  const opts = options({ previous: '0123456789abcdef' });
  const result = await renderRelease(made.ctx({ env: HOST_ENV, now: () => Date.UTC(2026, 9, 15, 12, 0, 0) }), made.config, opts);
  const stackBytes = fs.readFileSync(path.join(opts.out, 'stack.yaml'));
  const digest = crypto.createHash('sha256').update(stackBytes).digest('hex');
  const release = readJson(path.join(opts.out, 'release.json'));
  assert.equal(result.ok, true);
  assert.deepEqual(result.lines, [`render: release ${digest.slice(0, 16)}: 5 secrets, 1 configs; images pinned`, `out: ${opts.out}`]);
  assert.deepEqual(result.data, { releaseDigest: digest, releaseId: digest.slice(0, 16), out: opts.out, secrets: 5, configs: 1 });
  assert.equal(release.schema, 'starci/stack-release@1');
  assert.equal(release.stack, 'app');
  assert.equal(release.releaseDigest, digest);
  assert.equal(release.sourceSha, SOURCE_SHA);
  assert.deepEqual(release.images, images);
  assert.match(release.configDigest, /^[0-9a-f]{64}$/u);
  assert.deepEqual(release.configs.map((item) => item.logical), ['routes']);
  assert.match(release.configs[0].name, /^app-routes-c[0-9a-f]{10}$/u);
  assert.deepEqual(release.secrets.map((item) => item.key), ['API_TOKEN', 'DATABASE_URL', 'PROVIDER_KEY', 'SESSION_KEY', 'TOKEN']);
  assert.match(release.secrets[0].runtimeName, /^app-api-token-v[0-9a-f]{10}$/u);
  assert.deepEqual(release.healthAssertions, ['api liveness', 'jobs check']);
  assert.equal(release.previousAccepted, '0123456789abcdef');
  assert.equal(release.renderedAt, '2026-10-15T12:00:00.000Z');
});

test('the override carries images, plain environment with doubled dollars, file pointers and secret grants', async () => {
  const made = app();
  const opts = options();
  await renderRelease(made.ctx({ env: HOST_ENV }), made.config, opts);
  const override = readJson(path.join(opts.out, 'stack.generated.yaml'));
  const api = override.services.api;
  assert.equal(api.image, IMAGE_API);
  assert.deepEqual(api.environment, {
    LOG_LEVEL: 'info', PORT: '8787', PRICE: '$$5', ALERT_LIMIT: '30', MODEL_NAME: 'model-x', FALLBACK: 'dflt',
    API_TOKEN_FILE: '/run/secrets/API_TOKEN', DATABASE_URL_FILE: '/run/secrets/DATABASE_URL', SESSION_KEY_FILE: '/run/secrets/SESSION_KEY', TOKEN_FILE: '/run/secrets/TOKEN',
  });
  assert.deepEqual(api.secrets[0], { source: 'API_TOKEN', target: 'API_TOKEN', mode: 0o444 });
  assert.deepEqual(override.services.web, { image: IMAGE_WEB });
  assert.deepEqual(override.services.worker.secrets.map((item) => item.source), ['PROVIDER_KEY', 'TOKEN']);
  assert.equal(override.services.worker.environment, undefined);
  assert.deepEqual(Object.keys(override.secrets), ['DATABASE_URL', 'API_TOKEN', 'SESSION_KEY', 'TOKEN', 'PROVIDER_KEY']);
  assert.deepEqual(override.secrets.TOKEN, { external: true, name: readJson(path.join(opts.out, 'release.json')).secrets.find((item) => item.key === 'TOKEN').runtimeName });
  const rendered = parseYaml(fs.readFileSync(path.join(opts.out, 'stack.yaml'), 'utf8'));
  assert.equal(rendered.services.api.environment.PRICE, '$5');
  assert.equal(rendered.configs.routes.name, readJson(path.join(opts.out, 'release.json')).configs[0].name);
});

test('docker stack config runs with a minimal environment: no age identity, no DOCKER_HOST', async () => {
  const made = app();
  await renderRelease(made.ctx({ env: HOST_ENV }), made.config, options());
  const [call] = dockerRenders(made);
  assert.deepEqual(Object.keys(call.env).sort(), ['DOCKER_CONFIG', 'HOME', 'PATH', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE', 'APP_CFG_ROUTES', 'CONTACT_EMAIL'].sort());
  assert.equal(call.env.CONTACT_EMAIL, 'ops@example.test');
  assert.match(call.env.APP_CFG_ROUTES, /^app-routes-c/u);
  assert.equal('SOPS_AGE_KEY' in call.env, false);
  assert.equal('DOCKER_HOST' in call.env, false);
  assert.equal('UNRELATED' in call.env, false);
});

test('the age identity doubles as the version key and still never reaches the child; an undefined pass-through name is empty', async () => {
  const made = app();
  await renderRelease(made.ctx({ env: { SOPS_AGE_KEY: 'AGE-SECRET-KEY-FAKE' } }), made.config, options());
  const [call] = dockerRenders(made);
  assert.deepEqual(Object.keys(call.env).sort(), ['APP_CFG_ROUTES', 'CONTACT_EMAIL']);
  assert.equal(call.env.CONTACT_EMAIL, '');
});

test('extra compose files are appended with -c and the stack source comes first', async () => {
  const made = app();
  const extra = path.join(made.root, 'extra.yaml');
  fs.writeFileSync(extra, 'services:\n  worker:\n    deploy:\n      replicas: 2\n');
  await renderRelease(made.ctx(), made.config, options({ extraCompose: [extra] }));
  const [call] = dockerRenders(made);
  assert.deepEqual(call.args.filter((arg, index) => call.args[index - 1] === '-c').map((file) => path.basename(file)), ['stack.yaml', 'stack.generated.yaml', 'extra.yaml']);
  assert.equal(call.args.at(-2), '-c');
});

test('without an out directory a fresh temporary directory is used and reported', async () => {
  const made = app();
  const result = await renderRelease(made.ctx(), made.config, options({ out: null }));
  outs.push(result.data.out);
  assert.ok(result.data.out.startsWith(os.tmpdir()));
  assert.equal(fs.existsSync(path.join(result.data.out, 'release.json')), true);
  assert.equal(result.lines[1], `out: ${result.data.out}`);
});

test('the secret values reach no file, line, data or argument', async () => {
  const made = app();
  const opts = options();
  const result = await renderRelease(made.ctx({ env: HOST_ENV }), made.config, opts);
  const everything = [JSON.stringify(result), JSON.stringify(made.host.calls.map((call) => call.args)), ...fs.readdirSync(opts.out).map((name) => fs.readFileSync(path.join(opts.out, name), 'utf8'))].join('\n');
  for (const value of secretValues().filter((item) => !['model-x', '30'].includes(item))) assert.ok(!everything.includes(value), 'a secret value leaked');
});

const refuses = (made, opts, code) => assert.rejects(renderRelease(made.ctx(), made.config, opts), (error) => error.code === code && error.exit === 2);

test('missing, unknown, unpinned and placeholder images are refused before anything is written', async () => {
  const made = app();
  await refuses(made, options({ images: { api: IMAGE_API } }), 'STACK_IMAGE_MISSING');
  await refuses(made, {}, 'STACK_IMAGE_MISSING');
  await refuses(made, options({ images: { ...images, extra: IMAGE_API } }), 'STACK_IMAGE_UNKNOWN');
  await refuses(made, options({ images: { ...images, web: 'registry.example/team/app-web:latest' } }), 'STACK_IMAGE_UNPINNED');
  await refuses(made, options({ images: { ...images, api: ZERO } }), 'STACK_PLACEHOLDER_DIGEST');
  await refuses(made, options({ images: { ...images, api: ZERO }, allowUnpinned: true }), 'STACK_PLACEHOLDER_DIGEST');
});

test('a local throwaway swarm may use unpinned stand-in images', async () => {
  const made = app();
  const result = await renderRelease(made.ctx(), made.config, options({ images: { api: 'app-api:dev', web: 'app-web:dev' }, allowUnpinned: true }));
  assert.equal(result.ok, true);
});

test('a bad source sha or previous release id is refused', async () => {
  const made = app();
  await refuses(made, options({ sourceSha: 'XYZ' }), 'STACK_SOURCE_SHA_INVALID');
  await refuses(made, options({ sourceSha: undefined }), 'STACK_SOURCE_SHA_INVALID');
  await refuses(made, options({ previous: 'not-sixteen-hex' }), 'STACK_PREVIOUS_INVALID');
  const result = await renderRelease(made.ctx(), made.config, { ...options(), previous: undefined, extraCompose: undefined });
  assert.equal(readJson(path.join(result.data.out, 'release.json')).previousAccepted, null);
});

test('a placeholder digest left in the rendered bytes is refused and nothing is written', async () => {
  const made = app({ mutate: (deploy, source) => { source.services.worker.image = ZERO; } });
  const opts = options();
  await assert.rejects(renderRelease(made.ctx(), made.config, opts), (error) => error.code === 'STACK_PLACEHOLDER_DIGEST' && error.message.includes('rendered stack'));
  assert.equal(fs.existsSync(opts.out), false);
});

test('a failing docker is a failure carrying the first six stderr lines', async () => {
  const stderr = Array.from({ length: 8 }, (_, index) => `line ${index + 1}`).join('\n');
  const made = app({ overrides: { docker: { 'stack config': () => ({ status: 1, stdout: '', stderr }) } } });
  const opts = options();
  await assert.rejects(renderRelease(made.ctx(), made.config, opts), (error) => {
    assert.equal(error.code, 'STACK_RENDER_FAILED');
    assert.equal(error.exit, 1);
    assert.ok(error.message.endsWith('line 1 | line 2 | line 3 | line 4 | line 5 | line 6'));
    return true;
  });
  assert.equal(fs.existsSync(opts.out), false);
});

test('a docker that cannot run is a failure', async () => {
  const made = app({ overrides: { docker: { 'stack config': () => ({ status: null, stdout: '', stderr: '', error: new Error('spawn docker ENOENT') }) } } });
  await assert.rejects(renderRelease(made.ctx(), made.config, options()), (error) => error.code === 'STACK_RENDER_FAILED' && error.message.includes('ENOENT'));
});
