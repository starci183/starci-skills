// The single normaliser of `environments.<env>.deploy` (R294): the stack verbs and `starci app check` judge the same block through it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEPLOY_CONFIG_CODE, KEY, NAME, normalizeDeploy } from '../../scripts/hfs/stack-deploy-config.mjs';

const FILES = new Set(['infra/swarm/routes.yml', 'infra/swarm/api-public.env']);
const SERVICES = ['api', 'web', 'worker'];
const probe = (overrides = {}) => ({ exists: (relative) => FILES.has(relative), services: new Set(SERVICES), members: new Set(['api', 'web', 'stack']), ...overrides });

const validBlock = () => ({
  stack: 'shop',
  remote: { host: 'vps', releasesBase: '/srv/shop', sealed: { ops: 'ops', sshKey: 'vps-ssh-key', knownHosts: 'vps-known-hosts' } },
  images: {
    api: { app: 'api' },
    web: { app: 'web', buildArgs: { values: { NEXT_PUBLIC_SITE_URL: 'https://example.com' }, sealed: { member: 'web', keys: ['NEXT_PUBLIC_KEY'] } } },
  },
  volumes: ['shop-data'],
  secrets: {
    grants: [
      { service: 'api', filePointers: true, from: [{ member: 'api' }, { member: 'stack', keys: ['TOKEN'], fill: true }] },
      { service: 'worker', from: [{ member: 'stack', keys: ['TOKEN'], required: true }] },
    ],
    settings: { member: 'stack', keys: ['JOBS_STALE'] },
  },
  environment: {
    api: { files: ['infra/swarm/api-public.env'], values: { PORT: '8787' }, settings: { ALERT: { key: 'JOBS_ALERT', default: 20 }, PLAIN: { key: 'JOBS_PLAIN' } } },
  },
  configs: [{ name: 'routes', file: 'infra/swarm/routes.yml', env: 'SHOP_CFG_ROUTES' }],
  passEnv: ['ACME_EMAIL'],
  verify: {
    http: [
      { name: 'api liveness', url: 'https://api.example.com/healthz', status: 200, json: { status: 'ok' }, retry: true },
      { name: 'graphql', url: 'http://api.example.com/graphql', method: 'POST', body: '{}', contains: 'data' },
    ],
    exec: [{ name: 'jobs watchdog', service: 'api', command: ['node', 'dist/cli.js', 'jobs', 'watchdog'], stdout: String.raw`^\d+$` }, { name: 'ping', service: 'web', command: ['true'] }],
  },
  jobs: { service: 'api', command: ['node', 'dist/cli.js', 'jobs'] },
  backup: { image: `alpine:3.21@sha256:${'a'.repeat(64)}`, keepDays: 7, dir: '/var/backups/shop', volumes: [{ name: 'data', volume: 'shop-data' }] },
});

const compare = (a, b) => a.localeCompare(b);
const run = (change, overrides) => {
  const block = validBlock();
  const replaced = change(block);
  return normalizeDeploy(replaced === undefined ? block : replaced, { project: 'shop', probe: probe(overrides) });
};
const expectProblem = (change, at, part, overrides) => {
  const { config, problems } = run(change, overrides);
  assert.equal(config, null, `${at} must not normalise`);
  assert.ok(problems.some((problem) => problem.at === at && problem.message.includes(part)), `${at} ${part}: ${JSON.stringify(problems)}`);
};

test('deploy config: exposes its finding code and the shared name patterns', () => {
  assert.equal(DEPLOY_CONFIG_CODE, 'STACKS_DEPLOY_CONFIG_INVALID');
  assert.ok(NAME.test('shop-api'));
  assert.ok(!NAME.test('Shop'));
  assert.ok(KEY.test('SHOP_KEY'));
  assert.ok(!KEY.test('shop'));
});

test('deploy config: a valid block normalises to the config the verbs consume', () => {
  const { config, problems } = run(() => {});
  assert.deepEqual(problems, []);
  assert.equal(config.stack, 'shop');
  assert.deepEqual(config.remote, { host: 'vps', releasesBase: '/srv/shop', sealed: { ops: 'ops', sshKey: 'vps-ssh-key', knownHosts: 'vps-known-hosts' } });
  assert.deepEqual(config.images.api, { app: 'api', buildArgs: { values: {}, sealed: null } });
  assert.deepEqual(config.images.web.buildArgs, { values: { NEXT_PUBLIC_SITE_URL: 'https://example.com' }, sealed: { member: 'web', keys: ['NEXT_PUBLIC_KEY'] } });
  assert.deepEqual(config.volumes, ['shop-data']);
  assert.deepEqual(config.secrets.grants[0], { service: 'api', filePointers: true, from: [{ member: 'api', keys: null, required: false, fill: false }, { member: 'stack', keys: ['TOKEN'], required: false, fill: true }] });
  assert.equal(config.secrets.grants[1].filePointers, false);
  assert.equal(config.secrets.grants[1].from[0].required, true);
  assert.deepEqual(config.secrets.settings, { member: 'stack', keys: ['JOBS_STALE'] });
  assert.deepEqual(config.environment.api.settings, { ALERT: { key: 'JOBS_ALERT', default: '20' }, PLAIN: { key: 'JOBS_PLAIN', default: null } });
  assert.deepEqual(config.environment.api.values, { PORT: '8787' });
  assert.deepEqual(config.configs, [{ name: 'routes', file: 'infra/swarm/routes.yml', env: 'SHOP_CFG_ROUTES' }]);
  assert.deepEqual(config.passEnv, ['ACME_EMAIL']);
  assert.deepEqual(config.verify.http[0], { name: 'api liveness', url: 'https://api.example.com/healthz', method: 'GET', body: null, status: 200, json: { status: 'ok' }, contains: null, retry: true });
  assert.deepEqual(config.verify.http[1], { name: 'graphql', url: 'http://api.example.com/graphql', method: 'POST', body: '{}', status: 200, json: null, contains: 'data', retry: false });
  assert.equal(config.verify.exec[1].stdout, null);
  assert.deepEqual(config.jobs, { service: 'api', command: ['node', 'dist/cli.js', 'jobs'] });
  assert.deepEqual(config.backup, { image: `alpine:3.21@sha256:${'a'.repeat(64)}`, keepDays: 7, dir: '/var/backups/shop', volumes: [{ name: 'data', volume: 'shop-data' }] });
});

test('deploy config: an empty block takes its defaults from the project', () => {
  const { config, problems } = normalizeDeploy({}, { project: 'shop', probe: { exists: () => false } });
  assert.deepEqual(problems, []);
  assert.deepEqual(config, {
    stack: 'shop', remote: { host: 'vps', releasesBase: null, sealed: null }, images: {}, volumes: [], secrets: { grants: [], settings: null },
    environment: {}, configs: [], passEnv: [], verify: { http: [], exec: [] }, jobs: null, backup: null, ingress: null,
  });
});

test('deploy config: optional pieces left out normalise to their defaults', () => {
  const { config, problems } = run((block) => {
    block.remote = { releasesBase: '/srv/shop' };
    block.secrets = { settings: undefined };
    block.environment = { api: {} };
    block.backup = { image: `alpine:3.21@sha256:${'b'.repeat(64)}`, volumes: [{ name: 'data', volume: 'shop-data' }] };
    block.verify = { http: [{ name: 'home', url: 'https://example.com/' }] };
    block.images = { web: { app: 'web', buildArgs: { sealed: { member: 'web', keys: ['PUBLIC_KEY'] } } } };
  });
  assert.deepEqual(problems, []);
  assert.deepEqual(config.remote, { host: 'vps', releasesBase: '/srv/shop', sealed: null });
  assert.deepEqual(run((b) => { b.remote = { host: 'edge' }; }).config.remote, { host: 'edge', releasesBase: null, sealed: null });
  assert.deepEqual(config.secrets, { grants: [], settings: null });
  assert.deepEqual(config.environment.api, { files: [], values: {}, settings: {} });
  assert.deepEqual(config.backup, { image: `alpine:3.21@sha256:${'b'.repeat(64)}`, keepDays: 14, dir: null, volumes: [{ name: 'data', volume: 'shop-data' }] });
  assert.equal(config.verify.http[0].status, 200);
  assert.deepEqual(config.images.web.buildArgs.values, {});
});

test('deploy config: a probe without services and members leaves references unchecked', () => {
  const { config, problems } = normalizeDeploy(validBlock(), { project: 'shop', probe: { exists: (relative) => FILES.has(relative) } });
  assert.deepEqual(problems, []);
  assert.equal(config.stack, 'shop');
  const ghost = validBlock();
  ghost.images.ghost = { app: 'ghost' };
  ghost.secrets.grants[0].from[0].member = 'nobody';
  assert.deepEqual(normalizeDeploy(ghost, { project: 'shop', probe: { exists: (relative) => FILES.has(relative) } }).problems, []);
});

test('deploy config: refuses a block that is not a mapping and unknown fields at every level', () => {
  for (const block of ['text', 7, null, [], undefined]) {
    const { config, problems } = normalizeDeploy(block, { project: 'shop', probe: probe() });
    assert.equal(config, null);
    assert.deepEqual(problems, [{ at: 'deploy', message: 'must be a mapping' }]);
  }
  expectProblem((b) => { b.extra = 1; }, 'deploy.extra', 'is not a field');
  expectProblem((b) => { b.remote.extra = 1; }, 'deploy.remote.extra', 'is not a field');
  expectProblem((b) => { b.remote.sealed.extra = 1; }, 'deploy.remote.sealed.extra', 'is not a field');
  expectProblem((b) => { b.images.api.extra = 1; }, 'deploy.images.api.extra', 'is not a field');
  expectProblem((b) => { b.images.web.buildArgs.extra = 1; }, 'deploy.images.web.buildArgs.extra', 'is not a field');
  expectProblem((b) => { b.secrets.extra = 1; }, 'deploy.secrets.extra', 'is not a field');
  expectProblem((b) => { b.secrets.grants[0].extra = 1; }, 'deploy.secrets.grants[0].extra', 'is not a field');
  expectProblem((b) => { b.secrets.grants[0].from[0].extra = 1; }, 'deploy.secrets.grants[0].from[0].extra', 'is not a field');
  expectProblem((b) => { b.secrets.settings.extra = 1; }, 'deploy.secrets.settings.extra', 'is not a field');
  expectProblem((b) => { b.environment.api.extra = 1; }, 'deploy.environment.api.extra', 'is not a field');
  expectProblem((b) => { b.environment.api.settings.ALERT.extra = 1; }, 'deploy.environment.api.settings.ALERT.extra', 'is not a field');
  expectProblem((b) => { b.configs[0].extra = 1; }, 'deploy.configs[0].extra', 'is not a field');
  expectProblem((b) => { b.verify.extra = 1; }, 'deploy.verify.extra', 'is not a field');
  expectProblem((b) => { b.verify.http[0].extra = 1; }, 'deploy.verify.http[0].extra', 'is not a field');
  expectProblem((b) => { b.verify.exec[0].extra = 1; }, 'deploy.verify.exec[0].extra', 'is not a field');
  expectProblem((b) => { b.jobs.extra = 1; }, 'deploy.jobs.extra', 'is not a field');
  expectProblem((b) => { b.backup.extra = 1; }, 'deploy.backup.extra', 'is not a field');
  expectProblem((b) => { b.backup.volumes[0].extra = 1; }, 'deploy.backup.volumes[0].extra', 'is not a field');
});

test('deploy config: refuses a nested block that is not a mapping', () => {
  expectProblem((b) => { b.remote = 'vps'; }, 'deploy.remote', 'must be a mapping');
  expectProblem((b) => { b.remote.sealed = 'ops'; }, 'deploy.remote.sealed', 'must be a mapping');
  expectProblem((b) => { b.images = ['api']; }, 'deploy.images', 'must be a mapping of service to image');
  expectProblem((b) => { b.images.api = 'api'; }, 'deploy.images.api', 'must be a mapping');
  expectProblem((b) => { b.images.web.buildArgs = 'none'; }, 'deploy.images.web.buildArgs', 'must be a mapping');
  expectProblem((b) => { b.images.web.buildArgs.sealed = 'web'; }, 'deploy.images.web.buildArgs.sealed', 'must be a mapping');
  expectProblem((b) => { b.secrets = 'none'; }, 'deploy.secrets', 'must be a mapping');
  expectProblem((b) => { b.secrets.grants = 'api'; }, 'deploy.secrets.grants', 'must be a list');
  expectProblem((b) => { b.secrets.grants[0] = 'api'; }, 'deploy.secrets.grants[0]', 'must be a mapping');
  expectProblem((b) => { b.secrets.grants[0].from[0] = 'api'; }, 'deploy.secrets.grants[0].from[0]', 'must be a mapping');
  expectProblem((b) => { b.secrets.settings = 'stack'; }, 'deploy.secrets.settings', 'must be a mapping');
  expectProblem((b) => { b.environment = ['api']; }, 'deploy.environment', 'must be a mapping of service to environment');
  expectProblem((b) => { b.environment.api = 'none'; }, 'deploy.environment.api', 'must be a mapping');
  expectProblem((b) => { b.environment.api.settings.ALERT = 'none'; }, 'deploy.environment.api.settings.ALERT', 'must be a mapping');
  expectProblem((b) => { b.configs[0] = 'routes'; }, 'deploy.configs[0]', 'must be a mapping');
  expectProblem((b) => { b.verify = 'none'; }, 'deploy.verify', 'must be a mapping');
  expectProblem((b) => { b.verify.http[0] = 'home'; }, 'deploy.verify.http[0]', 'must be a mapping');
  expectProblem((b) => { b.verify.exec[0] = 'ping'; }, 'deploy.verify.exec[0]', 'must be a mapping');
  expectProblem((b) => { b.jobs = 'api'; }, 'deploy.jobs', 'must be a mapping');
  expectProblem((b) => { b.backup = 'daily'; }, 'deploy.backup', 'must be a mapping');
  expectProblem((b) => { b.backup.volumes[0] = 'data'; }, 'deploy.backup.volumes[0]', 'must be a mapping');
});

test('deploy config: refuses names, keys and paths that break their patterns', () => {
  expectProblem((b) => { b.stack = 'Bad_Name'; }, 'deploy.stack', 'must match');
  expectProblem((b) => { b.stack = 7; }, 'deploy.stack', 'must match');
  expectProblem((b) => { b.remote.host = 'bad host'; }, 'deploy.remote.host', 'must match');
  expectProblem((b) => { b.remote.releasesBase = 'srv/shop'; }, 'deploy.remote.releasesBase', 'absolute path');
  expectProblem((b) => { b.remote.releasesBase = '/srv/../etc'; }, 'deploy.remote.releasesBase', 'absolute path');
  expectProblem((b) => { b.remote.sealed.ops = 'Ops'; }, 'deploy.remote.sealed.ops', 'must match');
  expectProblem((b) => { b.images.api.app = 'API'; }, 'deploy.images.api.app', 'must match');
  expectProblem((b) => { b.images.Bad = { app: 'api' }; }, 'deploy.images.Bad', 'must match');
  expectProblem((b) => { b.images.web.buildArgs.values.bad = 'x'; }, 'deploy.images.web.buildArgs.values.bad', 'KEY: "string"');
  expectProblem((b) => { b.images.web.buildArgs.values.GOOD = 7; }, 'deploy.images.web.buildArgs.values.GOOD', 'KEY: "string"');
  expectProblem((b) => { b.images.web.buildArgs.sealed.keys = ['bad']; }, 'deploy.images.web.buildArgs.sealed.keys[0]', 'must match');
  expectProblem((b) => { b.images.web.buildArgs.sealed.member = 'Web'; }, 'deploy.images.web.buildArgs.sealed.member', 'must match');
  expectProblem((b) => { b.volumes = ['-bad']; }, 'deploy.volumes[0]', 'must match');
  expectProblem((b) => { b.volumes = 'shop-data'; }, 'deploy.volumes', 'must be a list');
  expectProblem((b) => { b.volumes = [7]; }, 'deploy.volumes[0]', 'must match');
  expectProblem((b) => { b.passEnv = ['lower']; }, 'deploy.passEnv[0]', 'must match');
  expectProblem((b) => { b.secrets.grants[0].service = 'Api'; }, 'deploy.secrets.grants[0].service', 'must match');
  expectProblem((b) => { b.secrets.settings.keys = []; }, 'deploy.secrets.settings.keys', 'must be a list');
  expectProblem((b) => { b.secrets.settings.keys = ['bad']; }, 'deploy.secrets.settings.keys[0]', 'must match');
  expectProblem((b) => { b.environment.api.values.bad = 'x'; }, 'deploy.environment.api.values.bad', 'KEY: "string"');
  expectProblem((b) => { b.environment.api.values.PORT = 8787; }, 'deploy.environment.api.values.PORT', 'KEY: "string"');
  expectProblem((b) => { b.environment.api.settings.ALERT.key = 'lower'; }, 'deploy.environment.api.settings.ALERT.key', 'must match');
  expectProblem((b) => { b.configs[0].name = 'Routes'; }, 'deploy.configs[0].name', 'must match');
  expectProblem((b) => { b.configs[0].env = 'lower'; }, 'deploy.configs[0].env', 'must match');
  expectProblem((b) => { b.jobs.service = 'Api'; }, 'deploy.jobs.service', 'must match');
  expectProblem((b) => { b.jobs.command = []; }, 'deploy.jobs.command', 'must be a list');
  expectProblem((b) => { b.jobs.command = ['node', 'a b']; }, 'deploy.jobs.command[1]', 'must match');
  expectProblem((b) => { b.backup.volumes[0].name = 'Data'; }, 'deploy.backup.volumes[0].name', 'must match');
  expectProblem((b) => { b.backup.volumes[0].volume = '-bad'; }, 'deploy.backup.volumes[0].volume', 'must match');
});

test('deploy config: a setting under a lowercase variable name is refused', () => {
  expectProblem((b) => { b.environment.api.settings.bad = { key: 'JOBS' }; }, 'deploy.environment.api.settings.bad', 'the environment name must match');
});

test('deploy config: refuses files that are missing or leave the environment directory', () => {
  expectProblem((b) => { b.configs[0].file = 'infra/swarm/none.yml'; }, 'deploy.configs[0].file', 'does not exist');
  expectProblem((b) => { b.environment.api.files = ['infra/swarm/none.env']; }, 'deploy.environment.api.files[0]', 'does not exist');
  for (const file of ['/etc/passwd', String.raw`infra\routes.yml`, '../secrets/api.enc', 'infra/../../x', '', 7, undefined]) {
    expectProblem((b) => { b.configs[0].file = file; }, 'deploy.configs[0].file', 'relative path inside the environment directory');
  }
});

test('deploy config: refuses services and sealed members the tree does not have', () => {
  expectProblem((b) => { b.images.ghost = { app: 'ghost' }; }, 'deploy.images.ghost', 'is not a service of the stack source');
  expectProblem((b) => { b.secrets.grants[0].service = 'ghost'; }, 'deploy.secrets.grants[0].service', 'is not a service');
  expectProblem((b) => { b.environment.ghost = {}; }, 'deploy.environment.ghost', 'is not a service');
  expectProblem((b) => { b.verify.exec[0].service = 'ghost'; }, 'deploy.verify.exec[0].service', 'is not a service');
  expectProblem((b) => { b.jobs.service = 'ghost'; }, 'deploy.jobs.service', 'is not a service');
  expectProblem((b) => { b.secrets.grants[0].from[0].member = 'ghost'; }, 'deploy.secrets.grants[0].from[0].member', 'has no .starcistacks/<env>/secrets/ghost.enc');
  expectProblem((b) => { b.secrets.settings.member = 'ghost'; }, 'deploy.secrets.settings.member', 'has no .starcistacks');
  expectProblem((b) => { b.images.web.buildArgs.sealed.member = 'ghost'; }, 'deploy.images.web.buildArgs.sealed.member', 'has no .starcistacks');
});

test('deploy config: refuses malformed grants', () => {
  expectProblem((b) => { b.secrets.grants[0].from = []; }, 'deploy.secrets.grants[0].from', 'at least one sealed source');
  expectProblem((b) => { delete b.secrets.grants[1].from; }, 'deploy.secrets.grants[1].from', 'at least one sealed source');
  expectProblem((b) => { b.secrets.grants[0].filePointers = 'yes'; }, 'deploy.secrets.grants[0].filePointers', 'true or false');
  expectProblem((b) => { b.secrets.grants[0].from[1].fill = 'yes'; }, 'deploy.secrets.grants[0].from[1].fill', 'true or false');
  expectProblem((b) => { b.secrets.grants[0].from[0].required = 1; }, 'deploy.secrets.grants[0].from[0].required', 'true or false');
  expectProblem((b) => { b.secrets.grants[0].from[0].required = true; }, 'deploy.secrets.grants[0].from[0].required', 'explicit keys list');
  expectProblem((b) => { b.secrets.grants[0].from[1].keys = []; }, 'deploy.secrets.grants[0].from[1].keys', 'must be a list');
  expectProblem((b) => { b.secrets.grants[0].from[0].member = 7; }, 'deploy.secrets.grants[0].from[0].member', 'must match');
});

test('deploy config: refuses duplicate config names', () => {
  expectProblem((b) => { b.configs.push({ name: 'routes', file: 'infra/swarm/routes.yml', env: 'SHOP_CFG_OTHER' }); }, 'deploy.configs', 'config name routes is declared twice');
});

test('deploy config: refuses malformed verify entries', () => {
  expectProblem((b) => { b.verify.http[0].name = ''; }, 'deploy.verify.http[0].name', 'non-empty string');
  expectProblem((b) => { b.verify.http[0].url = 'ftp://example.com'; }, 'deploy.verify.http[0].url', 'http(s) URL');
  expectProblem((b) => { delete b.verify.http[0].url; }, 'deploy.verify.http[0].url', 'http(s) URL');
  expectProblem((b) => { b.verify.http[0].method = 'DELETE'; }, 'deploy.verify.http[0].method', 'GET or POST');
  for (const status of [99, 600, 200.5, '200']) expectProblem((b) => { b.verify.http[0].status = status; }, 'deploy.verify.http[0].status', 'HTTP status code');
  expectProblem((b) => { b.verify.http[0].json = 'ok'; }, 'deploy.verify.http[0].json', 'mapping of expected fields');
  expectProblem((b) => { b.verify.exec[0].name = ''; }, 'deploy.verify.exec[0].name', 'non-empty string');
  expectProblem((b) => { b.verify.exec[0].stdout = '('; }, 'deploy.verify.exec[0].stdout', 'valid regular expression');
  expectProblem((b) => { b.verify.exec[0].command = 'node'; }, 'deploy.verify.exec[0].command', 'must be a list');
  expectProblem((b) => { b.verify.exec[0].service = 'Api'; }, 'deploy.verify.exec[0].service', 'must match');
});

test('deploy config: refuses a backup with an unpinned or placeholder image and bad settings', () => {
  for (const image of ['alpine:3.21', undefined, `alpine:3.21@sha256:${'0'.repeat(64)}`, `Alpine@sha256:${'a'.repeat(64)}`, 'alpine@sha256:abc']) {
    expectProblem((b) => { b.backup.image = image; }, 'deploy.backup.image', 'digest-pinned image reference');
  }
  for (const keepDays of [0, 3651, 1.5, '14']) expectProblem((b) => { b.backup.keepDays = keepDays; }, 'deploy.backup.keepDays', 'from 1 to 3650');
  for (const dir of ['var/backups', '/var/../etc', 7]) expectProblem((b) => { b.backup.dir = dir; }, 'deploy.backup.dir', 'absolute path without ..');
  expectProblem((b) => { b.backup.volumes = []; }, 'deploy.backup.volumes', 'at least one volume');
  expectProblem((b) => { delete b.backup.volumes; }, 'deploy.backup.volumes', 'at least one volume');
});

test('deploy config: every problem of a block is reported together and the config is withheld', () => {
  const { config, problems } = run((b) => { b.extra = 1; b.backup.image = 'alpine'; b.volumes = ['-bad']; });
  assert.equal(config, null);
  assert.deepEqual(problems.map((problem) => problem.at).sort(compare), ['deploy.backup.image', 'deploy.extra', 'deploy.volumes[0]']);
});

test('deploy config: a project name that breaks the stack pattern is refused when no stack is declared', () => {
  const { config, problems } = normalizeDeploy({}, { project: 'Bad_Project', probe: probe() });
  assert.equal(config, null);
  assert.deepEqual(problems.map((problem) => problem.at), ['deploy.stack']);
});

test('deploy.ingress is normalised by the ingress normaliser and its problems surface under the deploy block', () => {
  const ingress = { network: 'edge-shared', acmeVolume: 'edge_acme', legacy: { dir: '/home/deploy/edge', dynamicDir: '/home/deploy/edge/dynamic', container: 'edge-proxy' }, upstreams: [{ name: 'tool', hosts: ['tool.example'], hostAddress: '172.29.0.1', port: 5678 }] };
  const good = normalizeDeploy({ ...validBlock(), ingress }, { project: 'shop', probe: probe() });
  assert.deepEqual(good.problems, []);
  assert.equal(good.config.ingress.network, 'edge-shared');
  const bad = normalizeDeploy({ ...validBlock(), ingress: { ...ingress, network: 'Bad Network' } }, { project: 'shop', probe: probe() });
  assert.equal(bad.config, null);
  assert.ok(bad.problems.some((item) => item.at.includes('ingress')));
  assert.equal(normalizeDeploy(validBlock(), { project: 'shop', probe: probe() }).config.ingress, null);
});
