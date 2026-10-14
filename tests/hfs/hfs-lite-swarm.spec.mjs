import assert from 'node:assert/strict';
import test from 'node:test';
import { addScheduledJob, swarmFixture } from '../helpers/swarm-stack-fixture.mjs';

test('lite accepts the canonical Swarm production tree and managed Supabase backing', t => {
  const f = swarmFixture(t);
  assert.deepEqual(f.check(), []);
});

test('both editions run the Swarm runtime checks', t => {
  for (const edition of ['lite', 'full']) {
    const f = swarmFixture(t, edition);
    delete f.model.services.api.healthcheck;
    delete f.model.services.api.deploy.update_config;
    delete f.model.services.api.deploy.rollback_config;
    f.write();
    const findings = f.check();
    assert.ok(findings.every(item => item.code === 'HFS_STACKS_SHAPE'));
    for (const field of ['healthcheck', 'update_config', 'rollback_config'])
      assert.ok(findings.some(item => item.message.includes(field)), `${edition}: ${field}`);
  }
});

test('lite refuses compose, Kubernetes, terraform, runtime and seeds paths', t => {
  const f = swarmFixture(t);
  for (const area of ['infra/compose', 'infra/k8s', 'infra/terraform', 'runtime/config', 'seeds'])
    f.put(`.starcistacks/production/${area}/extra.yaml`, 'services: {}\n');
  assert.equal(f.check().filter(item => /not part of/.test(item.message)).length, 5);
});

test('lite refuses namespaced managed backing images in the inventory and stack', t => {
  for (const image of ['postgres:16', 'bitnami/postgresql:16', 'redis/redis-stack:latest', 'confluentinc/cp-kafka:latest',
    'quay.io/keycloak/keycloak:26', 'minio/minio:latest', 'rabbitmq:3', 'mysql:8', 'mongo:7']) {
    const f = swarmFixture(t);
    f.manifest.components.api.image = image;
    f.model.services.api.image = `${image}@sha256:${'d'.repeat(64)}`;
    f.write();
    assert.equal(f.check().filter(item => /duplicates|duplicate/.test(item.message)).length, 2, image);
  }
});

test('full Swarm may run a backing image while lite application image names are not mistaken for infrastructure', t => {
  const f = swarmFixture(t, 'full');
  f.model.services.api.image = `postgres:16@sha256:${'d'.repeat(64)}`;
  f.manifest.components.api.image = f.model.services.api.image;
  f.write();
  assert.deepEqual(f.check(), []);
  const lite = swarmFixture(t);
  lite.model.services.api.image = `registry.example.org/postgres-api@sha256:${'d'.repeat(64)}`;
  lite.write();
  assert.deepEqual(lite.check(), []);
});

test('host-crontab findings report file and line for every app automation location', t => {
  const f = swarmFixture(t);
  for (const [file, command] of [['.github/workflows/api-deploy.yml', 'cat jobs | crontab -'],
    ['deploy/install.sh', 'crontab -l'], ['scripts/env-sync.mjs', '/etc/cron.d/report'],
    ['.starcistacks/production/infra/swarm/cron.sh', 'cron.d/report'], ['deploy/reboot.sh', '@reboot report']]) {
    f.put(file, `#!/bin/sh\n${command}\n`);
    const finding = f.check().find(item => item.path === file && item.line === 2);
    assert.ok(finding, file);
    assert.ok(finding.message.includes(`${file}:2`));
  }
  f.put('deploy/timer.sh', 'systemctl enable report.timer\n');
  assert.ok(!f.check().some(item => item.path === 'deploy/timer.sh'));
});

test('Swarm requires real healthchecks, restart policy, digests and ingress-only ports', t => {
  const f = swarmFixture(t);
  f.model.services.api.image = 'registry.example.org/app:latest';
  f.model.services.api.healthcheck = { test: [], disable: true };
  f.model.services.api.deploy.update_config.failure_action = 'continue';
  f.model.services.api.deploy.restart_policy = {};
  f.model.services.api.ports = ['3000:3000'];
  f.write();
  const messages = f.check().map(item => item.message).join('\n');
  for (const expected of ['digest', 'healthcheck', 'failure_action', 'restart_policy', 'only a component with role ingress'])
    assert.ok(messages.includes(expected), expected);
});

test('Swarm secrets must be externally provisioned, versioned and declared', t => {
  const f = swarmFixture(t);
  f.model.secrets['database-url'] = { file: './secret.env' };
  f.model.services.api.secrets.push('missing');
  f.write();
  assert.equal(f.check().filter(item => /secret/.test(item.message)).length, 2);
});

test('replicated jobs need a declared swarm-cronjob scheduler and exact runtime wiring', t => {
  const f = swarmFixture(t);
  addScheduledJob(f);
  assert.deepEqual(f.check(), []);
  delete f.manifest.components.report.scheduler;
  f.model.services.report.deploy.replicas = 1;
  f.model.services.report.deploy.restart_policy.condition = 'on-failure';
  delete f.model.services.report.deploy.labels;
  f.write();
  const messages = f.check().map(item => item.message).join('\n');
  for (const expected of ['declared service component', 'replicas: 0', 'condition: none', 'swarm.cronjob.enable', 'swarm.cronjob.schedule'])
    assert.ok(messages.includes(expected), expected);
});

test('scheduler must be bound, deployed and use the scheduler image; label arrays are accepted', t => {
  const f = swarmFixture(t);
  addScheduledJob(f);
  f.model.services.report.deploy.labels = ['swarm.cronjob.enable=true', 'swarm.cronjob.schedule=0 3 * * *'];
  f.write();
  assert.deepEqual(f.check(), []);
  f.manifest.components.cron.image = f.model.services.api.image;
  f.model.services.cron.image = f.model.services.api.image;
  f.write();
  assert.equal(f.check().filter(item => /swarm-cronjob image/.test(item.message)).length, 2);
  delete f.model.services.cron;
  f.write();
  assert.ok(f.check().some(item => /bound and deployed/.test(item.message)));
});

test('lite Swarm sources cannot bypass runtime, managed backing or declared source checks', t => {
  const f = swarmFixture(t);
  delete f.manifest.backing;
  f.manifest.environments.production.runtime = 'docker-compose';
  f.write();
  const messages = f.check().map(item => item.message).join('\n');
  for (const expected of ['backing.supabase', 'runtime: docker-swarm', 'no declared docker-swarm environment'])
    assert.ok(messages.includes(expected), expected);
  f.manifest.environments.production.runtime = 'docker-swarm';
  f.manifest.backing = { supabase: { provider: 'supabase', managed: true } };
  f.put('.starcistacks/production/infra/swarm/forgotten.yaml', 'services: {worker: {}}\n');
  f.write();
  assert.ok(f.check().some(item => /not declared or reachable/.test(item.message)));
});

test('object includes and extensionless fragments receive the same Swarm checks', t => {
  const f = swarmFixture(t);
  f.model.include = [{ path: ['worker-fragment'] }];
  f.put('.starcistacks/production/infra/swarm/worker-fragment', JSON.stringify({ services: {
    worker: { image: `postgres:16@sha256:${'d'.repeat(64)}` },
  } }));
  f.write();
  const messages = f.check().map(item => item.message).join('\n');
  for (const expected of ['services.worker.healthcheck', 'services.worker.image', 'declared component id'])
    assert.ok(messages.includes(expected), expected);
  f.model.include = [{ unexpected: 'worker-fragment' }];
  f.write();
  assert.ok(f.check().some(item => /Compose include/.test(item.message)));
});

test('empty healthcheck commands, malformed ports and embedded secret content are refused', t => {
  const f = swarmFixture(t);
  for (const healthcheck of [{ test: [] }, { test: ['CMD'] }, { test: ['CMD-SHELL', ''] }]) {
    f.model.services.api.healthcheck = healthcheck;
    f.write();
    assert.ok(f.check().some(item => /healthcheck/.test(item.message)), JSON.stringify(healthcheck));
  }
  f.model.services.api.ports = { published: 3000 };
  f.model.secrets['database-url'].content = 'fixture-value';
  f.write();
  const messages = f.check().map(item => item.message).join('\n');
  assert.ok(messages.includes('ports must be an array'));
  assert.ok(messages.includes('no embedded value source'));
});
