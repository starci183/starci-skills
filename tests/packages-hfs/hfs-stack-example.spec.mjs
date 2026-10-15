// examples/lite-app end to end: its deploy block is read by the real loadDeployConfig against its own stack source, and a release of it renders
// with the fake docker and sops seams (names, counts and digests only; no value leaves memory).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { byCodeUnit } from '../../packages/hfs/report/order.mjs';
import { loadDeployConfig } from '../../packages/hfs/stack/config.mjs';
import { fakeHost, fakeSops } from '../helpers/stack-fakes.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const EXAMPLE = path.join(ROOT, 'examples', 'lite-app');
const RENDER = path.join(ROOT, 'packages', 'hfs', 'stack', 'render.mjs');
const MEMBERS = {
  'primary-db-url': { PRIMARY_DB_URL: 'value-primary-3f9a1c' },
  'supabase-service-role-key': { SUPABASE_SERVICE_ROLE_KEY: 'value-service-77b2d0' },
  'calendar-webhook-secret': { CALENDAR_WEBHOOK_SECRET: 'value-webhook-c41e58' },
};
const SEALED_PLACEHOLDER = 'KEY=ENC[placeholder]\nsops_mac=ENC[placeholder]\n';
const digest = character => `sha256:${character.repeat(64)}`;
const IMAGES = { api: `ghcr.io/owner/lite-app-api@${digest('1')}`, web: `ghcr.io/owner/lite-app-web@${digest('2')}` };

/** A disposable copy of the example's stack tree and hfs.json; the public example tracks no sealed member, so placeholders stand in. */
function exampleCopy(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'stack-example-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.cpSync(path.join(EXAMPLE, '.starcistacks'), path.join(root, '.starcistacks'), { recursive: true });
  fs.copyFileSync(path.join(EXAMPLE, 'hfs.json'), path.join(root, 'hfs.json'));
  for (const member of Object.keys(MEMBERS)) fs.writeFileSync(path.join(root, '.starcistacks', 'production', 'secrets', `${member}.enc`), SEALED_PLACEHOLDER);
  return root;
}

test('the example deploy block is accepted by the real config loader against the example stack source', t => {
  const root = exampleCopy(t);
  const config = loadDeployConfig({ repoRoot: root, env: 'production' });
  assert.equal(config.stack, 'lite-app');
  assert.deepEqual(Object.entries(config.images).map(([service, image]) => [service, image.app]), [['api', 'api'], ['web', 'web']]);
  assert.deepEqual(config.images.web.buildArgs.values, { NEXT_PUBLIC_SITE_URL: 'https://lite-app.example' });
  assert.deepEqual(config.secrets.grants.map(grant => [grant.service, grant.filePointers, grant.from.map(source => source.member)]), [['api', true, Object.keys(MEMBERS)]]);
  assert.deepEqual(config.volumes, ['lite-app-production-caddy-data', 'lite-app-production-caddy-config', 'lite-app-production-n8n-data']);
});

test('the example deploy block names the volumes, hosts and secret pointers its own stack source and declaration use', t => {
  const root = exampleCopy(t);
  const config = loadDeployConfig({ repoRoot: root, env: 'production' });
  const declaration = parseYaml(fs.readFileSync(path.join(root, '.starcistacks', 'application-stacks.yaml'), 'utf8'));
  const stack = parseYaml(fs.readFileSync(config.stackFile, 'utf8'));
  assert.deepEqual([...config.volumes].sort(byCodeUnit), Object.values(stack.volumes).map(volume => volume.name).sort(byCodeUnit));
  const hosts = declaration.environments.production.ingress.hosts;
  for (const check of config.verify.http) assert.ok(hosts.includes(new URL(check.url).host), `${check.url} is on a declared ingress host`);
  for (const key of Object.values(MEMBERS).flatMap(map => Object.keys(map))) {
    assert.ok(stack.services.api.environment[`${key}_FILE`], `the api reads ${key} through ${key}_FILE`);
  }
  for (const service of Object.keys(config.images)) assert.ok(stack.services[service], `${service} is a service of the stack`);
});

test('a release of the example renders with the fake docker and sops and leaks no value', async t => {
  if (!fs.existsSync(RENDER)) {
    t.skip('packages/hfs/stack/render.mjs is not merged yet (task A); the lead removes this guard with the merge');
    return;
  }
  const { renderRelease } = await import(RENDER);
  const root = exampleCopy(t);
  const config = loadDeployConfig({ repoRoot: root, env: 'production' });
  const host = fakeHost({ fileReader: file => fs.readFileSync(file, 'utf8') });
  const out = path.join(root, 'out');
  const ctx = host.ctx({ cwd: root, env: { STARCI_SECRET_VERSION_KEY: 'fixture-version-key' }, sops: fakeSops({ members: MEMBERS }) });
  const result = await renderRelease(ctx, config, { images: IMAGES, sourceSha: 'a'.repeat(40), previous: null, out, allowUnpinned: false, extraCompose: [] });
  assert.equal(result.ok, true);
  assert.equal(result.data.secrets, 3);
  const release = JSON.parse(fs.readFileSync(path.join(out, 'release.json'), 'utf8'));
  assert.equal(release.stack, 'lite-app');
  assert.deepEqual(release.images, IMAGES);
  assert.deepEqual(release.secrets.map(entry => entry.key), ['CALENDAR_WEBHOOK_SECRET', 'PRIMARY_DB_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
  const rendered = fs.readFileSync(path.join(out, 'stack.yaml'), 'utf8');
  assert.match(rendered, new RegExp(IMAGES.api.replace(/[.]/g, String.raw`\.`)));
  assert.doesNotMatch(rendered, /sha256:0{64}/, 'the placeholder digests of the example stack are replaced');
  const everything = [JSON.stringify(result), JSON.stringify(host.calls.map(call => call.args)), ...fs.readdirSync(out).map(name => fs.readFileSync(path.join(out, name), 'utf8'))].join('\n');
  for (const map of Object.values(MEMBERS)) for (const value of Object.values(map)) assert.equal(everything.includes(value), false, 'no secret value appears in output, files or argv');
});
