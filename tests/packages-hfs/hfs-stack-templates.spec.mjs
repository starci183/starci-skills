// The deploy block of the app templates and of the schema: the skeleton and skeleton-lite production environments declare a small deploy block
// that the one normaliser accepts against their own stack source, the schema accepts exactly what the normaliser accepts, and the production
// README names the starci app stack verbs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../../engine/yaml.mjs';
import { byCodeUnit } from '../../packages/hfs/report/order.mjs';
import { render, TEMPLATES_DIR } from '../../packages/hfs/sync/index.mjs';
import { loadDeployConfig } from '../../packages/hfs/stack/config.mjs';
import { ACTIONS } from '../../packages/hfs/stack/cli.mjs';
import { normalizeDeploy } from '../../scripts/hfs/stack-deploy-config.mjs';
import { schemaErrors } from '../../scripts/gates/starcistacks.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const require = createRequire(import.meta.url);
const Ajv2020 = (() => { const loaded = require('ajv/dist/2020.js'); return loaded?.default ?? loaded; })();
const SCHEMA = parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/application-stacks.schema.yaml'), 'utf8'));
const VARIABLES = { project: 'demo', sonarGate: 'starci-quality', registryVisibility: 'public' };
const SEALED_PLACEHOLDER = 'KEY=ENC[placeholder]\nsops_mac=ENC[placeholder]\n';
const TEMPLATES = {
  lite: { directory: 'skeleton-lite', members: ['primary-db-url', 'supabase-service-role-key'], services: ['api', 'web'], hosts: ['demo.example.invalid', 'api.demo.example.invalid'] },
  full: { directory: 'skeleton', members: [], services: ['core', 'app', 'landing'], hosts: ['demo.example.invalid', 'api.demo.example.invalid', 'www.demo.example.invalid'] },
};

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => (entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]));
}

/** The skeleton's .starcistacks tree rendered into a temp app root (the template variables filled), with placeholder sealed members. */
function renderedApp(t, edition) {
  const { directory, members } = TEMPLATES[edition];
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-stack-templates-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify({ project: 'demo' }));
  const source = path.join(TEMPLATES_DIR, 'app', directory, '.starcistacks');
  for (const file of walk(source)) {
    const target = path.join(root, '.starcistacks', path.relative(source, file));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, render(fs.readFileSync(file, 'utf8'), VARIABLES));
  }
  fs.mkdirSync(path.join(root, '.starcistacks', 'production', 'secrets'), { recursive: true });
  for (const member of members) fs.writeFileSync(path.join(root, '.starcistacks', 'production', 'secrets', `${member}.enc`), SEALED_PLACEHOLDER);
  return root;
}

const declarationOf = root => parseYaml(fs.readFileSync(path.join(root, '.starcistacks', 'application-stacks.yaml'), 'utf8'));

for (const edition of Object.keys(TEMPLATES)) {
  const { services, hosts, members } = TEMPLATES[edition];

  test(`${edition}: the production deploy block is valid against the template's own stack source`, t => {
    const root = renderedApp(t, edition);
    const config = loadDeployConfig({ repoRoot: root, env: 'production' });
    assert.equal(config.stack, 'demo-production');
    assert.deepEqual(Object.keys(config.images), services);
    const stack = parseYaml(fs.readFileSync(config.stackFile, 'utf8'));
    for (const [service, image] of Object.entries(config.images)) {
      assert.ok(stack.services[service], `${service} is a service of the stack`);
      assert.equal(image.app, service === 'web' ? 'web' : service, `${service} is built from the app of the same name`);
    }
    assert.deepEqual([...config.volumes].sort(byCodeUnit), Object.values(stack.volumes).map(volume => volume.name).sort(byCodeUnit));
    assert.deepEqual(config.secrets.grants.flatMap(grant => grant.from.map(source => source.member)), members);
    assert.ok(config.verify.http.length > 0);
    const caddy = fs.readFileSync(path.join(config.envDir, 'infra/swarm/Caddyfile'), 'utf8');
    for (const check of config.verify.http) {
      const { host } = new URL(check.url);
      assert.ok(hosts.includes(host), `${host} is a host of the template`);
      assert.ok(caddy.includes(host), `${host} is routed by the ingress`);
    }
  });

  test(`${edition}: the declaration with its deploy block passes the schema`, t => {
    const declaration = declarationOf(renderedApp(t, edition));
    assert.deepEqual(schemaErrors(declaration, SCHEMA, '$', SCHEMA), []);
    assert.equal(declaration.environments.dev.deploy, undefined, 'only the production environment deploys');
  });

  test(`${edition}: the production README keeps its seven rows, names the verbs and keeps the owner narrative`, t => {
    const readme = fs.readFileSync(path.join(renderedApp(t, edition), '.starcistacks/production/README.md'), 'utf8');
    const rows = Object.fromEntries(readme.split('\n').flatMap(line => {
      const match = /^\|\s*(prepare|doctor|up|status|logs|down|verification)\s*\|(.*)\|$/.exec(line);
      return match ? [[match[1], match[2]]] : [];
    }));
    assert.deepEqual(Object.keys(rows), ['prepare', 'doctor', 'up', 'status', 'logs', 'down', 'verification']);
    assert.match(rows.prepare, /starci app stack prepare --env production --execute/);
    assert.match(rows.doctor, /starci app stack doctor --env production/);
    assert.match(rows.up, /stack-deploy workflow[\s\S]*starci app stack deploy --env production/);
    assert.match(rows.status, /starci app stack doctor[\s\S]*starci app stack converge/);
    assert.match(rows.verification, /starci app stack verify --env production/);
    assert.match(rows.logs, /docker service logs/);
    assert.match(rows.down, /docker stack rm/);
    for (const [, verb] of readme.matchAll(/starci app stack ([a-z-]+)/g)) assert.ok(ACTIONS.includes(verb), `${verb} is a stack action`);
    assert.match(readme, /^## Owner actions before the first release$/m);
  });
}

// ---- the schema accepts exactly what the normaliser accepts ---------------------------------------------------------------------------

const validate = new Ajv2020({ strict: false, allErrors: true }).compile({ $defs: SCHEMA.$defs, $ref: '#/$defs/deploy' });
const PROBE = { exists: () => true };
const DIGEST = `alpine:3.21@sha256:${'a'.repeat(64)}`;
const COMPLETE = () => ({
  stack: 'shop',
  remote: { host: 'box', releasesBase: '/srv/shop', sealed: { ops: 'ops', sshKey: 'ssh-key', knownHosts: 'known-hosts' } },
  images: { api: { app: 'api' }, 'web-ui': { app: 'web', buildArgs: { values: { PUBLIC_URL: 'https://shop.example' }, sealed: { member: 'web', keys: ['PUBLIC_KEY'] } } } },
  volumes: ['shop_data', 'shop-cache'],
  secrets: {
    grants: [{ service: 'api', filePointers: true, from: [{ member: 'api' }, { member: 'core', keys: ['TOKEN_ONE'], fill: true }, { member: 'core', keys: ['TOKEN_TWO'], required: true }] }],
    settings: { member: 'core', keys: ['MODEL_NAME'] },
  },
  environment: { api: { files: ['infra/swarm/api-public.conf'], values: { PORT: '8787' }, settings: { LIMIT: { key: 'LIMIT_MAX', default: 20 } } } },
  configs: [{ name: 'routes', file: 'infra/swarm/routes.yml', env: 'CFG_ROUTES' }],
  passEnv: ['CONTACT_EMAIL'],
  verify: {
    http: [
      { name: 'api liveness', url: 'https://api.shop.example/healthz', status: 200, json: { status: 'ok' }, retry: true },
      { name: 'graphql', url: 'https://api.shop.example/graphql', method: 'POST', body: '{"query":"{__typename}"}', status: 200, contains: '__typename', retry: true },
    ],
    exec: [{ name: 'ping', service: 'api', command: ['node', 'cli.js', 'ping'], stdout: String.raw`^\d+$` }],
  },
  jobs: { service: 'api', command: ['node', 'cli.js', 'jobs'] },
  backup: { image: DIGEST, keepDays: 14, dir: '/var/backups/shop', volumes: [{ name: 'data', volume: 'shop_data' }] },
});

const MUTATIONS = {
  'an unknown field of the block': block => { block.extra = 1; },
  'an uppercase stack name': block => { block.stack = 'Shop'; },
  'a remote host with a space': block => { block.remote.host = 'my box'; },
  'a relative releases base': block => { block.remote.releasesBase = 'srv/shop'; },
  'a releases base with ..': block => { block.remote.releasesBase = '/srv/../etc'; },
  'a sealed session missing a member': block => { delete block.remote.sealed.ops; },
  'an image without an app': block => { block.images.api = {}; },
  'an image with an unknown field': block => { block.images.api.registry = 'x'; },
  'an image service in uppercase': block => { block.images.API = { app: 'api' }; },
  'a build value with a number': block => { block.images['web-ui'].buildArgs.values.PUBLIC_URL = 7; },
  'a lowercase build key': block => { block.images['web-ui'].buildArgs.values.public_url = 'x'; },
  'a sealed build source with no keys': block => { block.images['web-ui'].buildArgs.sealed.keys = []; },
  'a volume name with a slash': block => { block.volumes.push('a/b'); },
  'a grant without sources': block => { block.secrets.grants[0].from = []; },
  'a grant without a service': block => { delete block.secrets.grants[0].service; },
  'a required source without keys': block => { block.secrets.grants[0].from.push({ member: 'core', required: true }); },
  'a source with a lowercase key': block => { block.secrets.grants[0].from[1].keys = ['token']; },
  'a non-boolean fill': block => { block.secrets.grants[0].from[1].fill = 'yes'; },
  'a settings block with no keys': block => { delete block.secrets.settings.keys; },
  'a service environment value with a number': block => { block.environment.api.values.PORT = 8787; },
  'an environment setting without a key': block => { block.environment.api.settings.LIMIT = { default: 1 }; },
  'an environment file that leaves the tree': block => { block.environment.api.files = ['../escape']; },
  'a config without an env': block => { delete block.configs[0].env; },
  'a config name in uppercase': block => { block.configs[0].name = 'Routes'; },
  'a passEnv name in lowercase': block => { block.passEnv = ['contact']; },
  'an unknown verify section': block => { block.verify.dns = []; },
  'an http check without a url': block => { delete block.verify.http[0].url; },
  'an http check with a status below 100': block => { block.verify.http[0].status = 99; },
  'an http check with the PUT method': block => { block.verify.http[0].method = 'PUT'; },
  'an http check with a non-http url': block => { block.verify.http[0].url = 'ftp://shop.example'; },
  'an exec check with shell syntax': block => { block.verify.exec[0].command = ['sh', '-c', 'a;b']; },
  'an exec check with an empty command': block => { block.verify.exec[0].command = []; },
  'an exec check without a service': block => { delete block.verify.exec[0].service; },
  'jobs without a command': block => { delete block.jobs.command; },
  'a backup without volumes': block => { block.backup.volumes = []; },
  'a backup with the all-zero digest': block => { block.backup.image = `alpine:3.21@sha256:${'0'.repeat(64)}`; },
  'a backup image without a digest': block => { block.backup.image = 'alpine:3.21'; },
  'a backup keeping zero days': block => { block.backup.keepDays = 0; },
  'a backup directory with ..': block => { block.backup.dir = '/var/../backups'; },
  'a backup volume without a name': block => { delete block.backup.volumes[0].name; },
};

test('the complete example block is accepted by the normaliser and by the schema', () => {
  const block = COMPLETE();
  assert.deepEqual(normalizeDeploy(block, { project: 'shop', probe: PROBE }).problems, []);
  assert.equal(validate(block), true, JSON.stringify(validate.errors));
  assert.deepEqual(schemaErrors(block, SCHEMA.$defs.deploy, '$', SCHEMA), []);
  assert.equal(validate({}), true, 'every field is optional');
});

for (const [label, mutate] of Object.entries(MUTATIONS)) {
  test(`schema and normaliser agree: ${label} is refused by both`, () => {
    const block = COMPLETE();
    mutate(block);
    assert.equal(normalizeDeploy(block, { project: 'shop', probe: PROBE }).config, null, 'the normaliser refuses it');
    assert.equal(validate(block), false, 'the schema refuses it');
  });
}

test('an environment other than a mapping, and a deploy block that is not a mapping, are refused by both', () => {
  assert.equal(normalizeDeploy('x', { project: 'shop', probe: PROBE }).config, null);
  assert.equal(validate('x'), false);
  assert.equal(normalizeDeploy({ environment: [] }, { project: 'shop', probe: PROBE }).config, null);
  assert.equal(validate({ environment: [] }), false);
});
