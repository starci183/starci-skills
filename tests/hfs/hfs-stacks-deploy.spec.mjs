// proves: STACKS_DEPLOY_CONFIG_INVALID@lite
// proves: STACKS_DEPLOY_CONFIG_INVALID@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkRepo } from '../../scripts/hfs/check.mjs';
import { stacksDeployFindings } from '../../scripts/hfs/rules/stacks-deploy.mjs';
import { a15Findings } from '../../scripts/hfs/rules/a15-findings.mjs';

const CODE = 'STACKS_DEPLOY_CONFIG_INVALID';
const DECLARATION = '.starcistacks/application-stacks.yaml';
const base = path.resolve(os.tmpdir());
const roots = [];

test.after(() => {
  for (const root of roots) {
    assert.ok(root.startsWith(base + path.sep));
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const validDeploy = () => ({
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
  environment: { api: { files: ['infra/swarm/api-public.env'], values: { PORT: '8787' }, settings: { ALERT: { key: 'JOBS_ALERT', default: '20' } } } },
  configs: [{ name: 'routes', file: 'infra/swarm/routes.yml', env: 'SHOP_CFG_ROUTES' }],
  passEnv: ['ACME_EMAIL'],
  verify: {
    http: [
      { name: 'api liveness', url: 'https://api.example.com/healthz', status: 200, json: { status: 'ok' }, retry: true },
      { name: 'graphql', url: 'https://api.example.com/graphql', method: 'POST', body: '{}', status: 200, contains: 'data' },
    ],
    exec: [{ name: 'jobs watchdog', service: 'api', command: ['node', 'dist/cli.js', 'jobs', 'watchdog'], stdout: String.raw`^\d+$` }],
  },
  jobs: { service: 'api', command: ['node', 'dist/cli.js', 'jobs'] },
  backup: { image: `alpine:3.21@sha256:${'a'.repeat(64)}`, keepDays: 14, dir: '/var/backups/shop', volumes: [{ name: 'data', volume: 'shop-data' }] },
});

/** Builds a small app tree; `change(app)` may edit the declaration, the stack source and the extra files before they are written. */
function app(edition, change = () => {}) {
  const model = {
    hfs: { hfs: 3, kind: 'app', project: 'shop', edition },
    declaration: { environments: { production: { runtime: 'docker-swarm', composeFiles: ['infra/swarm/stack.yaml'], deploy: validDeploy() } } },
    stack: { services: { api: { image: 'app/api' }, web: { image: 'app/web' }, worker: { image: 'app/worker' } } },
    extra: { 'infra/swarm/routes.yml': 'routes: []\n', 'infra/swarm/api-public.env': 'PORT=1\n' },
    members: ['api', 'web', 'stack'],
  };
  change(model);
  const repoRoot = fs.mkdtempSync(path.join(base, 'stacks-deploy-'));
  roots.push(repoRoot);
  const write = (relative, content) => {
    const target = path.join(repoRoot, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof content === 'string' ? content : JSON.stringify(content));
  };
  if (model.hfs) write('hfs.json', model.hfs);
  if (model.declaration) write(DECLARATION, model.declaration);
  if (model.stack) write('.starcistacks/production/infra/swarm/stack.yaml', model.stack);
  for (const [relative, content] of Object.entries(model.extra)) write(`.starcistacks/production/${relative}`, content);
  for (const member of model.members) write(`.starcistacks/production/secrets/${member}.enc`, 'sealed');
  const files = [DECLARATION];
  return { repoRoot, files, all: files, repo: { kind: 'app', edition }, isRoot: true };
}

const production = (model) => model.declaration.environments.production;
const deployOf = (model) => production(model).deploy;
const byText = (a, b) => a.localeCompare(b);
const messages = (findings) => findings.map((finding) => finding.message);

const PROBLEMS = [
  ['an unknown field', (m) => { deployOf(m).extra = 1; }, 'environments.production.deploy.extra: is not a field of the deploy block'],
  ['a stack name that breaks its pattern', (m) => { deployOf(m).stack = 'Bad_Name'; }, 'environments.production.deploy.stack: must match'],
  ['a volume that breaks its pattern', (m) => { deployOf(m).volumes = ['-bad']; }, 'environments.production.deploy.volumes[0]: must match'],
  ['a config file that is missing', (m) => { deployOf(m).configs[0].file = 'infra/swarm/none.yml'; }, 'environments.production.deploy.configs[0].file: infra/swarm/none.yml does not exist'],
  ['a public env file that is missing', (m) => { deployOf(m).environment.api.files = ['infra/swarm/gone.env']; }, 'environments.production.deploy.environment.api.files[0]'],
  ['a config path that leaves the environment directory', (m) => { deployOf(m).configs[0].file = '../secrets/api.enc'; }, 'must be a relative path inside the environment directory'],
  ['an image for a service the stack does not run', (m) => { deployOf(m).images.ghost = { app: 'ghost' }; }, 'environments.production.deploy.images.ghost: ghost is not a service of the stack source'],
  ['a grant for an unknown service', (m) => { deployOf(m).secrets.grants[1].service = 'ghost'; }, 'environments.production.deploy.secrets.grants[1].service: ghost is not a service'],
  ['a verify exec check on an unknown service', (m) => { deployOf(m).verify.exec[0].service = 'ghost'; }, 'environments.production.deploy.verify.exec[0].service: ghost is not a service'],
  ['a sealed member without a secrets file', (m) => { deployOf(m).secrets.grants[0].from[0].member = 'missing'; }, 'sealed member missing has no .starcistacks/<env>/secrets/missing.enc'],
  ['a build argument from an unknown sealed member', (m) => { deployOf(m).images.web.buildArgs.sealed.member = 'nowhere'; }, 'sealed member nowhere has no'],
  ['an all-zero placeholder backup image', (m) => { deployOf(m).backup.image = `alpine:3.21@sha256:${'0'.repeat(64)}`; }, 'environments.production.deploy.backup.image: must be a digest-pinned image reference'],
  ['an unpinned backup image', (m) => { deployOf(m).backup.image = 'alpine:3.21'; }, 'environments.production.deploy.backup.image'],
  ['a duplicate config name', (m) => { deployOf(m).configs.push({ ...deployOf(m).configs[0], env: 'SHOP_CFG_OTHER' }); }, 'environments.production.deploy.configs: config name routes is declared twice'],
  ['a verify entry with a bad url', (m) => { deployOf(m).verify.http[0].url = 'ftp://example.com'; }, 'environments.production.deploy.verify.http[0].url: must be an http(s) URL'],
  ['a verify entry with a bad status', (m) => { deployOf(m).verify.http[0].status = 99; }, 'environments.production.deploy.verify.http[0].status'],
  ['a verify exec check with a bad pattern', (m) => { deployOf(m).verify.exec[0].stdout = '('; }, 'environments.production.deploy.verify.exec[0].stdout: must be a valid regular expression'],
];

for (const edition of ['lite', 'full']) {
  test(`${CODE}: ${edition} accepts a valid deploy block`, () => {
    assert.deepEqual(stacksDeployFindings(app(edition)), []);
  });

  for (const [title, change, expected] of PROBLEMS) {
    test(`${CODE}: ${edition} rejects ${title}`, () => {
      const findings = stacksDeployFindings(app(edition, change));
      assert.ok(findings.length >= 1);
      assert.equal(findings[0].code, CODE);
      assert.equal(findings[0].level, 'error');
      assert.equal(findings[0].path, DECLARATION);
      assert.ok(messages(findings).some((message) => message.includes(expected)), messages(findings).join(' | '));
    });
  }

  test(`${CODE}: ${edition} reports one finding per problem`, () => {
    const findings = stacksDeployFindings(app(edition, (m) => {
      deployOf(m).extra = 1;
      deployOf(m).volumes = ['-bad'];
      deployOf(m).backup.image = 'alpine:3.21';
    }));
    assert.deepEqual(messages(findings).map((message) => message.split(':')[0]).sort(byText), [
      'environments.production.deploy.backup.image', 'environments.production.deploy.extra', 'environments.production.deploy.volumes[0]',
    ]);
    assert.ok(findings.every((finding) => finding.code === CODE));
  });

  test(`${CODE}: ${edition} accepts an environment without a deploy block and a non-swarm environment`, () => {
    const withoutBlock = app(edition, (m) => { delete production(m).deploy; });
    assert.deepEqual(stacksDeployFindings(withoutBlock), []);
    const compose = app(edition, (m) => {
      m.declaration.environments.local = { runtime: 'docker-compose', deploy: { unknown: true } };
      m.declaration.environments['bad env'] = { runtime: 'docker-swarm', deploy: { unknown: true } };
      m.declaration.environments.notes = 'text';
    });
    assert.deepEqual(stacksDeployFindings(compose), []);
  });

  test(`${CODE}: ${edition} judges every swarm environment under its own name`, () => {
    const findings = stacksDeployFindings(app(edition, (m) => {
      m.declaration.environments.staging = { runtime: 'docker-swarm', composeFiles: ['infra/swarm/stack.yaml'], deploy: { stack: 'shop', bogus: true } };
      deployOf(m).extra = 1;
    }));
    assert.deepEqual(messages(findings).map((message) => message.split(':')[0]).sort(byText), [
      'environments.production.deploy.extra', 'environments.staging.deploy.bogus',
    ]);
  });
}

test(`${CODE}: an unreadable stack source or secrets directory means unknown services and members`, () => {
  const unknown = (change) => app('full', (m) => {
    change(m);
    deployOf(m).images.ghost = { app: 'ghost' };
    deployOf(m).secrets.grants[0].from[0].member = 'missing';
  });
  const noStack = stacksDeployFindings(unknown((m) => { m.stack = null; }));
  assert.deepEqual(messages(noStack).filter((message) => message.includes('ghost is not a service')), []);
  assert.ok(messages(noStack).some((message) => message.includes('sealed member missing')));
  const noMembers = stacksDeployFindings(unknown((m) => { m.members = []; }));
  assert.deepEqual(messages(noMembers).filter((message) => message.includes('sealed member')), []);
  assert.ok(messages(noMembers).some((message) => message.includes('ghost is not a service')));
  for (const compose of [undefined, [], ['../escape.yaml'], [String.raw`..\escape.yaml`], ['/etc/stack.yaml'], [7], 'infra/swarm/stack.yaml']) {
    const findings = stacksDeployFindings(unknown((m) => { production(m).composeFiles = compose; }));
    assert.deepEqual(messages(findings).filter((message) => message.includes('ghost is not a service')), []);
  }
  const notMapping = stacksDeployFindings(unknown((m) => { m.stack = 'just text'; }));
  assert.deepEqual(messages(notMapping).filter((message) => message.includes('ghost is not a service')), []);
  const noServices = stacksDeployFindings(unknown((m) => { m.stack = { services: 'none' }; }));
  assert.deepEqual(messages(noServices).filter((message) => message.includes('ghost is not a service')), []);
});

test(`${CODE}: a missing declaration, a missing hfs.json and a non-mapping declaration are handled`, () => {
  assert.deepEqual(stacksDeployFindings(app('lite', (m) => { m.declaration = null; })), []);
  assert.deepEqual(stacksDeployFindings(app('lite', (m) => { m.declaration = 'plain text'; })), []);
  assert.deepEqual(stacksDeployFindings(app('lite', (m) => { m.declaration = { environments: 'none' }; })), []);
  const noProject = app('lite', (m) => { m.hfs = null; delete deployOf(m).stack; });
  assert.deepEqual(stacksDeployFindings(noProject), []);
  const badProject = app('lite', (m) => { m.hfs = { project: 'Bad_Project' }; delete deployOf(m).stack; });
  assert.deepEqual(messages(stacksDeployFindings(badProject)), ['environments.production.deploy.stack: the stack name Bad_Project must match /^[a-z][a-z0-9-]*$/u']);
});

test(`${CODE}: only an app root of the lite or full edition is judged`, () => {
  const change = (m) => { deployOf(m).extra = 1; };
  assert.equal(stacksDeployFindings(app('full', change)).length, 1);
  for (const repo of [{ kind: 'be', edition: 'full' }, { kind: 'app', edition: 'other' }, { kind: 'app' }, undefined]) {
    assert.deepEqual(stacksDeployFindings({ ...app('full', change), repo }), []);
  }
  assert.deepEqual(stacksDeployFindings({ ...app('lite', change), isRoot: false }), []);
  assert.equal(stacksDeployFindings({ ...app('lite', change), isRoot: undefined }).length, 1);
});

test(`${CODE}: the app check wires the finder, reports the declaration path and ships the catalog explanation`, () => {
  for (const edition of ['lite', 'full']) {
    const context = app(edition, (m) => { deployOf(m).extra = 1; });
    const wired = a15Findings(context).filter((finding) => finding.code === CODE);
    assert.deepEqual(messages(wired), ['environments.production.deploy.extra: is not a field of the deploy block']);
    const declaration = {
      hfs: 3, kind: 'app', project: 'shop', edition,
      sides: { be: { apps: [{ name: 'core', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } },
    };
    const result = checkRepo({ repoRoot: context.repoRoot, declaration, files: context.files, tree: false });
    const findings = result.findings.filter((finding) => finding.code === CODE);
    assert.deepEqual(findings.map((finding) => finding.path), [DECLARATION]);
    assert.ok(findings.every((finding) => finding.title && finding.titleVi && finding.whyVi && finding.nextStepVi));
    const clean = checkRepo({ repoRoot: app(edition).repoRoot, declaration, files: [DECLARATION], tree: false });
    assert.deepEqual(clean.findings.filter((finding) => finding.code === CODE), []);
  }
});
