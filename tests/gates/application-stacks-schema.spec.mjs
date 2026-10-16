import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseYaml } from '../../engine/yaml.mjs';
import { schemaErrors } from '../../scripts/gates/starcistacks.mjs';

const schema = parseYaml(fs.readFileSync(new URL('../../modules/schemas/application-stacks.schema.yaml', import.meta.url), 'utf8'));
const olderDeclaration = () => ({
  schema: 'starci/application-stacks@1',
  components: { api: { role: 'service' }, metrics: { role: 'observability' } },
  environments: {
    dev: {
      status: 'supported', runtime: 'docker-compose', composeFiles: ['infra/compose/compose.yaml'],
      components: { api: {}, metrics: {} }, runbook: 'README.md', secrets: [],
    },
  },
  k8s: { status: 'deferred', reason: 'This application runs on Docker.' },
});
const errors = (doc) => schemaErrors(doc, schema, '$', schema);

test('older application stacks remain loadable with the service mode default and free-text roles', () => {
  const doc = olderDeclaration();
  doc.components.metrics.role = 'legacy-monitor';
  assert.deepEqual(errors(doc), []);
  assert.equal(schema.properties.components.additionalProperties.properties.mode.default, 'service');
  assert.equal(Object.hasOwn(doc.components.api, 'mode'), false);
});

test('a lite Swarm declaration admits managed backing, ingress, scheduler and scheduled replicated jobs', () => {
  const doc = olderDeclaration();
  doc.backing = { supabase: { provider: 'supabase', managed: true } };
  doc.components = {
    api: { role: 'service', mode: 'service' },
    ingress: { role: 'ingress' },
    cron: { role: 'scheduler' },
    report: { role: 'job', mode: 'replicated-job', scheduler: 'cron', schedule: '0 3 * * *' },
  };
  doc.environments.production = {
    status: 'supported', runtime: 'docker-swarm', composeFiles: ['infra/swarm/stack.yaml'],
    components: { api: { replicas: 2 }, ingress: {}, cron: {}, report: {} }, runbook: 'README.md', secrets: [],
  };
  assert.deepEqual(errors(doc), []);
});

test('the existing required Kubernetes posture is preserved for a Swarm-only application', () => {
  const doc = olderDeclaration();
  doc.environments.dev.runtime = 'docker-swarm';
  delete doc.k8s;
  assert.ok(errors(doc).some((issue) => issue.message === 'missing k8s'));
});

test('component mode is closed and scheduler and schedule remain nonempty strings', () => {
  const invalid = [
    { mode: 'cronjob' },
    { scheduler: '' },
    { scheduler: 1 },
    { schedule: '' },
    { schedule: ['0 3 * * *'] },
  ];
  for (const fields of invalid) {
    const doc = olderDeclaration();
    Object.assign(doc.components.api, fields);
    assert.ok(errors(doc).length > 0, JSON.stringify(fields));
  }
});

test('managed backing entries require a provider and managed true with no undeclared fields', () => {
  const invalid = [
    { provider: 'supabase' },
    { managed: true },
    { provider: '', managed: true },
    { provider: 'supabase', managed: false },
    { provider: 'supabase', managed: true, password: 'placeholder' },
  ];
  for (const entry of invalid) {
    const doc = olderDeclaration();
    doc.backing = { supabase: entry };
    assert.ok(errors(doc).length > 0, JSON.stringify(entry));
  }
});

test('an environment ingress shape admits a component or external.stack (rule R275 judges which); hosts are always required', () => {
  const doc = olderDeclaration();
  const swarm = doc.environments.dev;
  swarm.runtime = 'docker-swarm';
  delete doc.k8s;
  doc.k8s = { status: 'deferred', reason: 'This application runs on Docker.' };
  swarm.ingress = { component: 'api', hosts: ['app.example.test'] };
  assert.deepEqual(errors(doc), []);
  swarm.ingress = { external: { stack: 'ingress' }, hosts: ['app.example.test'] };
  assert.deepEqual(errors(doc), []);
  for (const bad of [{ external: {}, hosts: ['a.test'] }, { external: { stack: '' }, hosts: ['a.test'] }, { external: { stack: 'ingress', extra: 1 }, hosts: ['a.test'] }, { external: { stack: 'ingress' } }]) {
    swarm.ingress = bad;
    assert.ok(errors(doc).length > 0, JSON.stringify(bad));
  }
});
