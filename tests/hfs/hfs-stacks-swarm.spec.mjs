// proves: STACKS_SECRET_NOT_EXTERNAL@lite STACKS_SECRET_NOT_EXTERNAL@full
// proves: STACKS_SECRET_UNVERSIONED@lite STACKS_SECRET_UNVERSIONED@full
// proves: STACKS_SECRET_ENV_LITERAL@lite STACKS_SECRET_ENV_LITERAL@full
// proves: STACKS_PORT_PUBLISHED@lite STACKS_PORT_PUBLISHED@full
// proves: STACKS_SECOND_INGRESS@lite STACKS_SECOND_INGRESS@full
// proves: STACKS_DNS_UNDECLARED@lite STACKS_DNS_UNDECLARED@full
// proves: STACKS_HOST_UNROUTED@lite STACKS_HOST_UNROUTED@full
// proves: STACKS_TLS_UNDECLARED@lite STACKS_TLS_UNDECLARED@full
// proves: STACKS_PLACEMENT_MISSING@lite STACKS_PLACEMENT_MISSING@full
// proves: STACKS_HEALTHCHECK_MISSING@lite STACKS_HEALTHCHECK_MISSING@full
// proves: STACKS_UPDATE_POLICY_MISSING@lite STACKS_UPDATE_POLICY_MISSING@full
// proves: STACKS_REALTIME_SCALED@lite
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { swarmFixture, swarmService } from '../helpers/swarm-stack-fixture.mjs';
import { swarmHardeningIssues, stacksSwarmFindings } from '../../scripts/hfs/rules/stacks-swarm.mjs';
import { ingressIssues } from '../../scripts/hfs/rules/stacks-ingress.mjs';
import { ts } from '../../scripts/hfs/runtime-rules/source-ast.mjs';

const DECLARATION = '.starcistacks/application-stacks.yaml';
const ROUTE = 'traefik.http.routers.api.rule';
const REALTIME = 'be/src/features/realtime/chat/index.ts';
const pinned = image => `${image}@sha256:${'a'.repeat(64)}`;

function fixture(t, edition = 'lite') {
  const value = swarmFixture(t, edition);
  const spec = value.manifest.environments.production;
  value.manifest.components.ingress.image = pinned('traefik:v3.6');
  value.model.services.ingress.image = value.manifest.components.ingress.image;
  value.model.services.ingress.ports = [{ published: 443, target: 443, mode: 'ingress' }];
  spec.ingress = { component: 'ingress', hosts: ['app.example.test'] };
  spec.dns = [{ host: 'app.example.test', owner: 'application operator', receipt: 'docs/dns.md' }];
  spec.tls = { owner: 'application operator', receipt: 'docs/tls.md' };
  spec.secrets = [{ name: 'database-url', runtimeName: 'swarm-app-database-url-v1', version: 1 }];
  value.model.services.api.environment = { DATABASE_URL_FILE: '/run/secrets/database-url' };
  value.model.services.api.deploy.labels = { [ROUTE]: 'Host(`app.example.test`)' };
  value.write();
  return value;
}

const inputFor = value => ({ doc: value.manifest, spec: value.manifest.environments.production,
  model: value.model, environment: 'production', repo: value.declaration, repoRoot: value.root, files: [...value.files] });
const issuesFor = (value, code) => swarmHardeningIssues(inputFor(value)).filter(issue => issue.code === code);
const finderContext = value => ({ repoRoot: value.root, files: [...value.files], repo: value.declaration, isRoot: true });

const cases = [
  { code: 'STACKS_SECRET_NOT_EXTERNAL', violate(value) { value.model.secrets['database-url'].external = false; } },
  { code: 'STACKS_SECRET_UNVERSIONED', violate(value) { value.model.secrets['database-url'].name = 'swarm-app-database-url'; } },
  { code: 'STACKS_SECRET_ENV_LITERAL', violate(value) { value.model.services.api.environment = { API_TOKEN: 'synthetic-fixture-value' }; } },
  { code: 'STACKS_PORT_PUBLISHED', violate(value) { value.model.services.api.ports = ['3000:3000']; } },
  { code: 'STACKS_DNS_UNDECLARED', violate(value) { delete value.manifest.environments.production.dns; } },
  { code: 'STACKS_HOST_UNROUTED', violate(value) { delete value.model.services.api.deploy.labels; } },
  { code: 'STACKS_TLS_UNDECLARED', violate(value) { delete value.manifest.environments.production.tls; } },
  { code: 'STACKS_PLACEMENT_MISSING', violate(value) { value.model.services.api.volumes = ['data:/data']; } },
  { code: 'STACKS_HEALTHCHECK_MISSING', violate(value) { delete value.model.services.api.healthcheck; } },
  { code: 'STACKS_UPDATE_POLICY_MISSING', violate(value) { delete value.model.services.api.deploy.update_config; } },
];

for (const edition of ['lite', 'full']) {
  for (const { code, violate } of cases) {
    test(`${code}@${edition}: declared safe Swarm service passes`, t => {
      const value = fixture(t, edition);
      assert.deepEqual(swarmHardeningIssues(inputFor(value)), []);
      assert.deepEqual(issuesFor(value, code), []);
    });

    test(`${code}@${edition}: violating rendered evidence fails`, t => {
      const value = fixture(t, edition);
      violate(value);
      assert.ok(issuesFor(value, code).length > 0);
      value.write();
      assert.ok(stacksSwarmFindings(finderContext(value)).some(finding => finding.code === code));
    });
  }

  test(`STACKS_SECOND_INGRESS@${edition}: single ingress passes and a second rendered ingress fails`, t => {
    const value = fixture(t, edition);
    assert.deepEqual(ingressIssues(inputFor(value)), []);
    value.model.services.preview = swarmService(pinned('caddy:2.10.2'));
    assert.ok(ingressIssues(inputFor(value)).some(issue => issue.code === 'STACKS_SECOND_INGRESS'));
  });

  test(`STACKS_SECRET_NOT_EXTERNAL@${edition}: embedded sources, undeclared grants and absent secrets fail`, t => {
    const value = fixture(t, edition);
    for (const key of ['file', 'environment', 'content', 'value']) {
      value.model.secrets['database-url'][key] = 'synthetic-source';
      assert.ok(issuesFor(value, 'STACKS_SECRET_NOT_EXTERNAL').length > 0);
      delete value.model.secrets['database-url'][key];
    }
    value.model.services.api.secrets = ['undeclared'];
    assert.ok(issuesFor(value, 'STACKS_SECRET_NOT_EXTERNAL').length > 0);
    delete value.model.secrets['database-url'];
    assert.ok(issuesFor(value, 'STACKS_SECRET_NOT_EXTERNAL').length > 0);
  });

  test(`STACKS_SECRET_UNVERSIONED@${edition}: declared version must match the immutable runtime name`, t => {
    const value = fixture(t, edition), declaration = value.manifest.environments.production.secrets[0];
    for (const version of [undefined, 0, -1, '1.5', 2]) {
      declaration.version = version;
      assert.ok(issuesFor(value, 'STACKS_SECRET_UNVERSIONED').length > 0);
    }
    declaration.version = 1;
    declaration.runtimeName = 'different-v1';
    assert.ok(issuesFor(value, 'STACKS_SECRET_UNVERSIONED').length > 0);
    declaration.runtimeName = 'swarm-app-database-url-v1';
    assert.deepEqual(issuesFor(value, 'STACKS_SECRET_UNVERSIONED'), []);
    value.manifest.environments.production.secrets = [];
    assert.ok(issuesFor(value, 'STACKS_SECRET_UNVERSIONED').length > 0);
  });

  test(`STACKS_SECRET_ENV_LITERAL@${edition}: granted target works and another service's file fails`, t => {
    const value = fixture(t, edition);
    value.model.services.api.secrets = [{ source: 'database-url', target: 'db-uri' }];
    value.model.services.api.environment = ['DATABASE_URL_FILE=/run/secrets/db-uri', 'LOG_LEVEL=info'];
    assert.deepEqual(issuesFor(value, 'STACKS_SECRET_ENV_LITERAL'), []);
    value.model.services.ingress.environment = { DATABASE_URL_FILE: '/run/secrets/db-uri' };
    assert.ok(issuesFor(value, 'STACKS_SECRET_ENV_LITERAL').length > 0);
    delete value.model.services.ingress.environment;
    value.model.services.api.environment = { DATABASE_URL_FILE: '/run/secrets/database-url' };
    assert.ok(issuesFor(value, 'STACKS_SECRET_ENV_LITERAL').length > 0);
  });

  test(`STACKS_SECRET_ENV_LITERAL@${edition}: sensitive names, inline credentials and inherited bindings fail`, t => {
    const value = fixture(t, edition);
    const violations = [
      { OPENAI_API_KEY: 'synthetic-fixture-value' }, { SUPABASE_SERVICE_ROLE: 'synthetic-fixture-value' },
      { DATABASE_URL: 'postgres://fixture:synthetic@db.example.test/app' },
      { CONNECTION: 'redis://:synthetic@cache.example.test' },
      { DATABASE_URL_FILE: 'postgres://fixture:synthetic@db.example.test/app' },
      ['API_TOKEN'], { API_TOKEN_FILE: '/tmp/token' },
    ];
    for (const environment of violations) {
      value.model.services.api.environment = environment;
      assert.ok(issuesFor(value, 'STACKS_SECRET_ENV_LITERAL').length > 0);
    }
  });

  test(`STACKS_PORT_PUBLISHED@${edition}: ingress exposes only 80/443 and never host mode`, t => {
    const value = fixture(t, edition);
    value.model.services.ingress.ports = ['80:8080/tcp', '443:443/tcp'];
    assert.deepEqual(issuesFor(value, 'STACKS_PORT_PUBLISHED'), []);
    for (const ports of [[{ published: 443, target: 443, mode: 'host' }], ['8080:80'], ['443']]) {
      value.model.services.ingress.ports = ports;
      assert.ok(issuesFor(value, 'STACKS_PORT_PUBLISHED').length > 0);
    }
  });

  test(`STACKS_DNS_UNDECLARED@${edition}: each rendered route needs its own owner and receipt`, t => {
    const value = fixture(t, edition), spec = value.manifest.environments.production;
    value.model.services.api.deploy.labels[ROUTE] = 'Host(`app.example.test`, `admin.example.test`)';
    spec.ingress.hosts.push('admin.example.test');
    assert.ok(issuesFor(value, 'STACKS_DNS_UNDECLARED').length > 0);
    spec.dns.push({ host: 'admin.example.test', owner: 'operator', receipt: 'docs/admin-dns.md' });
    assert.deepEqual(issuesFor(value, 'STACKS_DNS_UNDECLARED'), []);
    delete spec.dns[1].receipt;
    assert.ok(issuesFor(value, 'STACKS_DNS_UNDECLARED').length > 0);
    spec.dns[1].receipt = 'docs/admin-dns.md';
    delete spec.dns[1].owner;
    assert.ok(issuesFor(value, 'STACKS_DNS_UNDECLARED').length > 0);
  });

  test(`STACKS_HOST_UNROUTED@${edition}: labels must bind declared hosts using the selected ingress`, t => {
    const value = fixture(t, edition);
    value.model.services.api.deploy.labels[ROUTE] = 'Host(`other.example.test`)';
    assert.ok(issuesFor(value, 'STACKS_HOST_UNROUTED').length > 0);
    for (const rule of ['!Host(`app.example.test`)', '!(Host(`app.example.test`))', 'Host(`https://app.example.test/path`)']) {
      value.model.services.api.deploy.labels = { [ROUTE]: rule };
      assert.ok(issuesFor(value, 'STACKS_HOST_UNROUTED').length > 0);
    }
    value.model.services.api.deploy.labels = { [ROUTE]: 'Host(`app.example.test`) && !Path(`/private`)' };
    assert.deepEqual(issuesFor(value, 'STACKS_HOST_UNROUTED'), []);
    value.model.services.api.deploy.labels = { caddy: 'app.example.test' };
    assert.ok(issuesFor(value, 'STACKS_HOST_UNROUTED').length > 0);
    value.model.services.api.deploy.labels = { [ROUTE]: 'Host(`app.example.test`)', 'traefik.enable': 'false' };
    assert.ok(issuesFor(value, 'STACKS_HOST_UNROUTED').length > 0);
  });

  test(`STACKS_TLS_UNDECLARED@${edition}: issuance receipt and owner are both required`, t => {
    const value = fixture(t, edition), spec = value.manifest.environments.production;
    for (const tls of [{ owner: 'operator' }, { receipt: 'docs/tls.md' }, { owner: '', receipt: 'docs/tls.md' }]) {
      spec.tls = tls;
      assert.ok(issuesFor(value, 'STACKS_TLS_UNDECLARED').length > 0);
    }
  });

  test(`STACKS_PLACEMENT_MISSING@${edition}: stateful components and persistent volumes pin a node`, t => {
    const value = fixture(t, edition), service = value.model.services.api;
    value.manifest.components.api.stateful = true;
    assert.ok(issuesFor(value, 'STACKS_PLACEMENT_MISSING').length > 0);
    service.deploy.placement = { constraints: ['node.labels.storage == app'] };
    assert.deepEqual(issuesFor(value, 'STACKS_PLACEMENT_MISSING'), []);
    delete value.manifest.components.api.stateful;
    service.volumes = [{ type: 'volume', source: 'app-data', target: '/data' }];
    assert.deepEqual(issuesFor(value, 'STACKS_PLACEMENT_MISSING'), []);
    service.deploy.placement.constraints = [''];
    assert.ok(issuesFor(value, 'STACKS_PLACEMENT_MISSING').length > 0);
  });

  test(`STACKS_HEALTHCHECK_MISSING@${edition}: disabled, empty and always successful probes fail`, t => {
    const value = fixture(t, edition), service = value.model.services.api;
    const healthchecks = [{ disable: true, test: ['CMD', 'curl', '-f', '/live'] }, { test: ['NONE'] },
      { test: [] }, { test: ['CMD-SHELL', 'true'] }, { test: ['CMD-SHELL', 'exit 0'] },
      { test: ['CMD-SHELL', 'curl -f http://localhost/live || true'] }, { test: ['CMD', 'echo', 'ok'] },
      { test: ['CMD-SHELL', 'false; exit 0'] }, { test: ['CMD-SHELL', 'curl -f http://localhost/live; true'] }];
    for (const healthcheck of healthchecks) {
      service.healthcheck = healthcheck;
      assert.ok(issuesFor(value, 'STACKS_HEALTHCHECK_MISSING').length > 0);
    }
    service.healthcheck = { test: ['CMD', 'curl', '-f', 'http://localhost/health/live'] };
    assert.deepEqual(issuesFor(value, 'STACKS_HEALTHCHECK_MISSING'), []);
  });

  test(`STACKS_UPDATE_POLICY_MISSING@${edition}: update, rollback and restart contracts are mandatory`, t => {
    const value = fixture(t, edition), deploy = value.model.services.api.deploy;
    const valid = structuredClone(deploy);
    for (const key of ['update_config', 'rollback_config', 'restart_policy']) {
      delete deploy[key];
      assert.ok(issuesFor(value, 'STACKS_UPDATE_POLICY_MISSING').length > 0);
      Object.assign(deploy, structuredClone(valid));
    }
    for (const monitor of ['0s', '30', '-1s', '30s garbage', 0, Number.POSITIVE_INFINITY]) {
      deploy.update_config.monitor = monitor;
      assert.ok(issuesFor(value, 'STACKS_UPDATE_POLICY_MISSING').length > 0);
    }
    deploy.update_config.monitor = '1m30s';
    assert.deepEqual(issuesFor(value, 'STACKS_UPDATE_POLICY_MISSING'), []);
    deploy.update_config.failure_action = 'pause';
    assert.ok(issuesFor(value, 'STACKS_UPDATE_POLICY_MISSING').length > 0);
  });
}

function addRealtime(value, composition = "import { ChatModule } from '@features/realtime/chat'; export const modules = [ChatModule];") {
  value.put('be/apps/api/src/main.ts', "import { AppModule } from './app.module'; export const entry = AppModule;");
  value.put('be/apps/api/src/app.module.ts', "import { modules } from './compose/streams'; export class AppModule { modules = modules; }");
  value.put('be/apps/api/src/compose/streams.ts', composition);
  value.put(REALTIME, 'export class ChatModule {}');
}

test('STACKS_REALTIME_SCALED@lite: a composed realtime API pins exactly one replica', t => {
  const value = fixture(t);
  addRealtime(value);
  for (const replicas of [undefined, 0, 2, '1']) {
    value.model.services.api.deploy.replicas = replicas;
    assert.ok(issuesFor(value, 'STACKS_REALTIME_SCALED').length > 0);
  }
  value.model.services.api.deploy.replicas = 1;
  assert.deepEqual(issuesFor(value, 'STACKS_REALTIME_SCALED'), []);
});

test('STACKS_REALTIME_SCALED@full: scaled realtime and absent replica pin remain allowed', t => {
  const value = fixture(t, 'full');
  addRealtime(value);
  for (const replicas of [undefined, 0, 2, 10]) {
    value.model.services.api.deploy.replicas = replicas;
    assert.deepEqual(issuesFor(value, 'STACKS_REALTIME_SCALED'), []);
  }
});

test('STACKS_REALTIME_SCALED@lite: reexports, dynamic import, require and import-equals reach realtime', t => {
  const value = fixture(t);
  const compositions = [
    "export { ChatModule as StreamModule } from '@features/realtime/chat';",
    "export const load = () => import('@features/realtime/chat');",
    "export const modules = [require('@features/realtime/chat').ChatModule];",
    "import Stream = require('@features/realtime/chat'); export const modules = [Stream.ChatModule];",
  ];
  for (const composition of compositions) {
    addRealtime(value, composition);
    assert.ok(issuesFor(value, 'STACKS_REALTIME_SCALED').length > 0);
  }
});

test('STACKS_REALTIME_SCALED@lite: type-only imports, comments and disconnected features do not compose', t => {
  const value = fixture(t);
  const compositions = [
    "import type { ChatModule } from '@features/realtime/chat'; export type Entry = ChatModule;",
    "import { type ChatModule } from '@features/realtime/chat'; export type Entry = ChatModule;",
    "export type { ChatModule } from '@features/realtime/chat';",
    "export { type ChatModule } from '@features/realtime/chat';",
    "// import { ChatModule } from '@features/realtime/chat';\nexport const modules = [];",
  ];
  for (const composition of compositions) {
    addRealtime(value, composition);
    assert.deepEqual(issuesFor(value, 'STACKS_REALTIME_SCALED'), []);
  }
});

test('STACKS_REALTIME_SCALED@lite: tracked tsconfig aliases and mapped API component names are respected', t => {
  const value = fixture(t);
  value.put('be/tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '.', paths: { '@stream/*': ['src/features/realtime/*'] } } }));
  addRealtime(value, "import { ChatModule } from '@stream/chat'; export const modules = [ChatModule];");
  value.manifest.components.backend = { ...value.manifest.components.api, app: 'api' };
  value.model.services.backend = value.model.services.api;
  delete value.manifest.components.api;
  delete value.model.services.api;
  assert.ok(issuesFor(value, 'STACKS_REALTIME_SCALED').length > 0);
  value.declaration.sides.be.apps[0].kind = 'worker';
  assert.deepEqual(issuesFor(value, 'STACKS_REALTIME_SCALED'), []);
});

test('STACKS_REALTIME_SCALED@lite: untracked composition evidence cannot enable a feature', t => {
  const value = fixture(t);
  addRealtime(value);
  value.files.delete(REALTIME);
  assert.deepEqual(issuesFor(value, 'STACKS_REALTIME_SCALED'), []);
});

test('STACKS_REALTIME_SCALED@lite: tracked config cannot read untracked or secret-path extensions', t => {
  const value = fixture(t), compiler = ts(), reads = [];
  addRealtime(value);
  const original = compiler.sys.readFile;
  compiler.sys.readFile = file => { reads.push(file); return original(file); };
  try {
    for (const extension of ['./untracked.json', '../secrets/config.json', '../../../outside.json']) {
      value.put('be/tsconfig.json', JSON.stringify({ extends: extension }));
      issuesFor(value, 'STACKS_REALTIME_SCALED');
    }
    assert.deepEqual(reads, []);
  } finally {
    compiler.sys.readFile = original;
  }
});

test('STACKS_REALTIME_SCALED@lite: tracked finder judges the composed API replica pin', t => {
  const value = fixture(t);
  addRealtime(value);
  value.model.services.api.deploy.replicas = 1;
  value.write();
  assert.deepEqual(stacksSwarmFindings(finderContext(value)), []);
  value.model.services.api.deploy.replicas = 2;
  value.write();
  assert.ok(stacksSwarmFindings(finderContext(value)).some(finding => finding.code === 'STACKS_REALTIME_SCALED'));
});

test('R266 tracked finder uses renderedModel and returns standard findings for both editions', t => {
  for (const edition of ['lite', 'full']) {
    const value = fixture(t, edition), renderedFile = '.starcistacks/production/infra/swarm/rendered.json';
    value.manifest.environments.production.renderedModel = 'infra/swarm/rendered.json';
    value.write();
    value.put(renderedFile, JSON.stringify(value.model));
    assert.deepEqual(stacksSwarmFindings(finderContext(value)), []);
    const rendered = structuredClone(value.model);
    delete rendered.services.api.healthcheck;
    value.put(renderedFile, JSON.stringify(rendered));
    const findings = stacksSwarmFindings(finderContext(value));
    assert.ok(findings.some(finding => finding.code === 'STACKS_HEALTHCHECK_MISSING'));
    for (const finding of findings) {
      assert.equal(finding.level, 'error');
      assert.equal(finding.path, renderedFile);
      assert.ok(finding.message.startsWith(`${renderedFile}: services.api.`));
    }
    value.files.delete(renderedFile);
    assert.deepEqual(stacksSwarmFindings(finderContext(value)), []);
  }
});

test('R266 tracked finder uses all files and runs at the app root only', t => {
  const value = fixture(t);
  delete value.model.services.api.healthcheck;
  value.write();
  const context = finderContext(value);
  assert.ok(stacksSwarmFindings({ ...context, files: [], all: [...value.files] }).length > 0);
  assert.deepEqual(stacksSwarmFindings({ ...context, isRoot: false }), []);
  assert.deepEqual(stacksSwarmFindings({ ...context, repo: { profile: 'runtime' } }), []);
  assert.deepEqual(stacksSwarmFindings({ ...context, files: [value.stackFile] }), []);
  assert.deepEqual(stacksSwarmFindings({ ...context, files: [DECLARATION] }), []);
});

test('R266 Caddy routes require a tracked config or matching docker-proxy labels', t => {
  for (const edition of ['lite', 'full']) {
    const value = fixture(t, edition), ingress = value.model.services.ingress;
    ingress.image = pinned('caddy:2.10.2');
    value.manifest.components.ingress.image = ingress.image;
    delete value.model.services.api.deploy.labels;
    ingress.configs = [{ source: 'routes', target: '/etc/caddy/Caddyfile' }];
    value.model.configs = { routes: { file: './Caddyfile' } };
    const config = '.starcistacks/production/infra/swarm/Caddyfile';
    value.put(config, 'app.example.test {\n  reverse_proxy api:3000\n}\n');
    assert.deepEqual(swarmHardeningIssues(inputFor(value)), []);
    value.files.delete(config);
    assert.ok(issuesFor(value, 'STACKS_HOST_UNROUTED').length > 0);
    ingress.image = pinned('lucaslorentz/caddy-docker-proxy:2.10.0');
    value.model.services.api.deploy.labels = { caddy: 'app.example.test', 'caddy.reverse_proxy': '{{upstreams 3000}}' };
    assert.deepEqual(issuesFor(value, 'STACKS_HOST_UNROUTED'), []);
  }
});

test('R266 config reads reject secret paths, parent traversal and symlinks', t => {
  const value = fixture(t), ingress = value.model.services.ingress;
  ingress.image = pinned('caddy:2.10.2');
  delete value.model.services.api.deploy.labels;
  ingress.configs = ['routes'];
  const config = '.starcistacks/production/infra/swarm/Caddyfile';
  value.put(config, 'app.example.test {\n  reverse_proxy api:3000\n}\n');
  for (const file of ['../../secrets/routes.enc', '../../../../routes', path.join(value.root, config)]) {
    value.model.configs = { routes: { file } };
    assert.ok(issuesFor(value, 'STACKS_HOST_UNROUTED').length > 0);
  }
  const alias = '.starcistacks/production/infra/swarm/Caddy-alias';
  try {
    fs.symlinkSync(path.join(value.root, config), path.join(value.root, alias));
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOSYS'].includes(error.code)) return;
    throw error;
  }
  value.files.add(alias);
  value.model.configs = { routes: { file: './Caddy-alias' } };
  assert.ok(issuesFor(value, 'STACKS_HOST_UNROUTED').length > 0);
});
