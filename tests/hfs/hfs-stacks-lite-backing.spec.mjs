// proves: STACKS_LITE_SELFHOSTED_DB@lite
// proves: STACKS_SIDECAR_VOLUME_UNDECLARED@lite
// proves: STACKS_SIDECAR_DB_UNSUPPORTED@lite
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { liteBackingIssues, stacksLiteBackingFindings } from '../../scripts/hfs/rules/stacks-lite-backing.mjs';

const DECLARATION = '.starcistacks/application-stacks.yaml';
const STACK_FILE = '.starcistacks/production/infra/swarm/stack.yaml';
const SQLITE_DATA_DIR = path.posix.join(path.posix.sep, 'home', 'node', '.n8n');
const pinned = image => `${image}@sha256:${'b'.repeat(64)}`;
const CODES = ['STACKS_LITE_SELFHOSTED_DB', 'STACKS_SIDECAR_VOLUME_UNDECLARED', 'STACKS_SIDECAR_DB_UNSUPPORTED'];

function fixture(edition = 'lite') {
  const spec = { runtime: 'docker-swarm', composeFiles: ['infra/swarm/stack.yaml'], components: { api: {}, automation: {} } };
  const doc = {
    components: {
      api: { role: 'service', app: 'api', image: pinned('app/api:1.0.0') },
      automation: { role: 'sidecar', stateful: true, image: pinned('n8nio/n8n:1.64.3'), database: { provider: 'sqlite', volume: 'automation-data' }, volumes: ['automation-data'] },
    },
    environments: { production: spec }, backing: { supabase: { provider: 'supabase', managed: true } },
  };
  const model = {
    services: { api: { image: pinned('app/api:1.0.0') }, automation: { image: pinned('n8nio/n8n:1.64.3'), volumes: [`automation-data:${SQLITE_DATA_DIR}`] } },
    volumes: { 'automation-data': {} },
  };
  return { doc, spec, model, environment: 'production', repo: { edition } };
}

const issuesFor = (value, code) => liteBackingIssues(value).filter(issue => issue.code === code);

test('STACKS_LITE_SELFHOSTED_DB@lite: managed Supabase and SQLite sidecar pass', () => {
  assert.deepEqual(issuesFor(fixture(), 'STACKS_LITE_SELFHOSTED_DB'), []);
});

test('STACKS_LITE_SELFHOSTED_DB@lite: Postgres, Redis and Mongo images in inventory and rendered model fail', () => {
  for (const image of ['postgres:16.9', 'vendor/postgresql:16.9', 'redis:7.4.3', 'redis-stack-server:7.4.0', 'mongo:8.0.0', 'mongodb/mongodb-community-server:8.0.0']) {
    for (const source of ['inventory', 'rendered']) {
      const value = fixture();
      if (source === 'inventory') value.doc.components.database = { role: 'service', image: pinned(image) };
      else value.model.services.database = { image: pinned(image) };
      const issues = issuesFor(value, 'STACKS_LITE_SELFHOSTED_DB');
      assert.equal(issues.length, 1, `${source} ${image}`);
      assert.equal(issues[0].at, `${source === 'inventory' ? 'components' : 'services'}.database.image`);
    }
  }
});

test('STACKS_LITE_SELFHOSTED_DB@lite: image tags and application names do not masquerade as backing images', () => {
  const value = fixture();
  value.doc.components.api.image = pinned('app/redis-worker:1.0.0');
  value.model.services.api.image = pinned('app/api:postgres');
  assert.deepEqual(issuesFor(value, 'STACKS_LITE_SELFHOSTED_DB'), []);
});

test('STACKS_SIDECAR_DB_UNSUPPORTED@lite: declared SQLite sidecar passes', () => {
  assert.deepEqual(issuesFor(fixture(), 'STACKS_SIDECAR_DB_UNSUPPORTED'), []);
});

test('STACKS_SIDECAR_DB_UNSUPPORTED@lite: sidecar requiring Postgres, Redis or Mongo fails without a rendered database image', () => {
  for (const provider of ['postgres', 'redis', 'mongo', 'mysql', '', undefined]) {
    const value = fixture();
    value.doc.components.automation.database.provider = provider;
    assert.equal(issuesFor(value, 'STACKS_SIDECAR_DB_UNSUPPORTED').length, 1);
  }
});

test('STACKS_SIDECAR_DB_UNSUPPORTED@lite: rendered adapter settings cannot bypass or contradict the sidecar database declaration', () => {
  const environments = [
    { DB_TYPE: 'postgresdb' }, ['DB_TYPE=postgresdb'], { DATABASE_PROVIDER: 'redis' },
    { DATABASE_URL: 'postgres://database.example.test/automation' },
    { MONGO_URI: 'mongodb+srv://database.example.test/automation' },
  ];
  for (const environment of environments) {
    for (const declared of [false, true]) {
      const value = fixture();
      if (!declared) delete value.doc.components.automation.database;
      value.model.services.automation.environment = environment;
      assert.ok(issuesFor(value, 'STACKS_SIDECAR_DB_UNSUPPORTED').some(issue => issue.at === 'services.automation.environment'));
    }
  }
});

test('STACKS_SIDECAR_DB_UNSUPPORTED@lite: SQLite adapter configuration and app managed database connection pass', () => {
  const value = fixture();
  value.model.services.automation.environment = { DB_TYPE: 'sqlite' };
  value.model.services.api.environment = { DATABASE_URL: 'postgres://managed.example.test/application' };
  assert.deepEqual(issuesFor(value, 'STACKS_SIDECAR_DB_UNSUPPORTED'), []);
});

test('STACKS_SIDECAR_VOLUME_UNDECLARED@lite: declared named volume with short or long writable mount passes', () => {
  const value = fixture();
  assert.deepEqual(issuesFor(value, 'STACKS_SIDECAR_VOLUME_UNDECLARED'), []);
  value.model.services.automation.volumes = [{ type: 'volume', source: 'automation-data', target: SQLITE_DATA_DIR }];
  assert.deepEqual(issuesFor(value, 'STACKS_SIDECAR_VOLUME_UNDECLARED'), []);
  value.model.volumes['automation-data'] = null;
  assert.deepEqual(issuesFor(value, 'STACKS_SIDECAR_VOLUME_UNDECLARED'), []);
});

test('STACKS_SIDECAR_VOLUME_UNDECLARED@lite: absent volume metadata, component volume, rendered declaration or mount fails', () => {
  const mutations = [
    value => { delete value.doc.components.automation.database.volume; },
    value => { delete value.doc.components.automation.volumes; },
    value => { value.doc.components.automation.volumes = ['unrelated-data']; },
    value => { delete value.model.volumes; },
    value => { value.model.volumes = { unrelated: {} }; },
    value => { delete value.model.services.automation.volumes; },
    value => { value.model.services.automation.volumes = [`other-data:${SQLITE_DATA_DIR}`]; },
  ];
  for (const mutate of mutations) {
    const value = fixture();
    mutate(value);
    assert.equal(issuesFor(value, 'STACKS_SIDECAR_VOLUME_UNDECLARED').length, 1);
  }
});

test('STACKS_SIDECAR_VOLUME_UNDECLARED@lite: rendered SQLite configuration needs a declared persistent database volume', () => {
  for (const environment of [{ DB_TYPE: 'sqlite' }, ['DATABASE_CLIENT=sqlite3'], { DATABASE_URL: 'sqlite:/data/automation.db' }]) {
    const value = fixture();
    delete value.doc.components.automation.database;
    value.model.services.automation.environment = environment;
    assert.equal(issuesFor(value, 'STACKS_SIDECAR_VOLUME_UNDECLARED').length, 1);
  }
});

test('STACKS_SIDECAR_VOLUME_UNDECLARED@lite: path-like volume names cannot turn a bind mount into named-volume evidence', () => {
  for (const source of ['./automation-data', '/srv/automation-data']) {
    const value = fixture();
    value.doc.components.automation.database.volume = source;
    value.doc.components.automation.volumes = [source];
    value.model.volumes = { [source]: {} };
    value.model.services.automation.volumes = [`${source}:${SQLITE_DATA_DIR}`];
    assert.equal(issuesFor(value, 'STACKS_SIDECAR_VOLUME_UNDECLARED').length, 1);
  }
});

test('STACKS_SIDECAR_VOLUME_UNDECLARED@lite: bind mounts, anonymous volumes and read-only mounts do not persist writable SQLite', () => {
  for (const mount of [
    `./automation-data:${SQLITE_DATA_DIR}`, SQLITE_DATA_DIR, `automation-data:${SQLITE_DATA_DIR}:ro`,
    { type: 'bind', source: 'automation-data', target: SQLITE_DATA_DIR },
    { type: 'volume', source: 'automation-data', target: SQLITE_DATA_DIR, read_only: true },
  ]) {
    const value = fixture();
    value.model.services.automation.volumes = [mount];
    assert.equal(issuesFor(value, 'STACKS_SIDECAR_VOLUME_UNDECLARED').length, 1);
  }
});

for (const code of CODES) {
  test(`${code}@full: valid lite shape and full database choices remain unaffected`, () => {
    assert.deepEqual(issuesFor(fixture('full'), code), []);
    const value = fixture('full');
    value.doc.components.database = { role: 'stateful', image: pinned('postgres:16.9') };
    value.model.services.database = { image: pinned('redis:7.4.3') };
    value.doc.components.automation.database = { provider: 'postgres' };
    delete value.doc.components.automation.volumes;
    delete value.model.volumes;
    assert.deepEqual(issuesFor(value, code), []);
  });
}

test('R276: non-Swarm development environment retains its existing contract', () => {
  const value = fixture();
  value.spec.runtime = 'docker-compose';
  value.doc.components.database = { role: 'stateful', image: pinned('postgres:16.9') };
  assert.deepEqual(liteBackingIssues(value), []);
});

function trackedFixture(value, run) {
  const base = path.resolve(os.tmpdir());
  const repoRoot = fs.mkdtempSync(path.join(base, 'backing-spec-'));
  try {
    for (const [file, doc] of [[DECLARATION, value.doc], [STACK_FILE, value.model]]) {
      const target = path.join(repoRoot, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, JSON.stringify(doc));
    }
    run({ repoRoot, files: [DECLARATION, STACK_FILE], repo: value.repo });
  } finally {
    assert.ok(repoRoot.startsWith(`${base}${path.sep}`));
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

const finderMutations = [
  { code: 'STACKS_LITE_SELFHOSTED_DB', violate(value) { value.model.services.cache = { image: pinned('redis:7.4.3') }; } },
  { code: 'STACKS_SIDECAR_VOLUME_UNDECLARED', violate(value) { delete value.model.volumes; } },
  { code: 'STACKS_SIDECAR_DB_UNSUPPORTED', violate(value) { value.doc.components.automation.database.provider = 'postgres'; } },
];

for (const { code, violate } of finderMutations) {
  test(`${code}@lite: tracked managed backing and SQLite sidecar pass the finder`, () => {
    trackedFixture(fixture(), context => {
      assert.deepEqual(stacksLiteBackingFindings(context).filter(finding => finding.code === code), []);
    });
  });

  test(`${code}@lite: tracked violating backing evidence fails the finder`, () => {
    const value = fixture();
    violate(value);
    trackedFixture(value, context => {
      assert.ok(stacksLiteBackingFindings(context).some(finding => finding.code === code));
    });
  });
}

test('R276 HFS finder reads rendered services and reports standard lite findings', () => {
  const value = fixture();
  value.model.services.cache = { image: pinned('redis:7.4.3') };
  trackedFixture(value, context => {
    const findings = stacksLiteBackingFindings(context);
    assert.equal(findings.length, 1);
    assert.equal(findings[0].code, 'STACKS_LITE_SELFHOSTED_DB');
    assert.equal(findings[0].level, 'error');
    assert.equal(findings[0].path, STACK_FILE);
  });
});

test('R276 HFS finder leaves full edition and unavailable rendered evidence unaffected', () => {
  const value = fixture('full');
  value.model.services.cache = { image: pinned('redis:7.4.3') };
  trackedFixture(value, context => assert.deepEqual(stacksLiteBackingFindings(context), []));
  trackedFixture(fixture(), context => {
    context.files = [DECLARATION];
    assert.deepEqual(stacksLiteBackingFindings(context), []);
  });
});
