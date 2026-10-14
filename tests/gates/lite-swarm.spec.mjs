import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { checkApplicationStacks } from '../../scripts/gates/stacks-gate.mjs';
import { checkStarciStacks, checkStarciStacksMain } from '../../scripts/gates/starcistacks.mjs';
import { addScheduledJob, swarmFixture } from '../helpers/swarm-stack-fixture.mjs';

const checkRendered = f => checkApplicationStacks({ repoRoot: f.root, environment: 'production', deploymentModelFile: f.modelFile });
const shapeErrors = result => result.errors.filter(error => error.code === 'HFS_STACKS_SHAPE');

test('both stack gates accept canonical lite production, including retained dev custody metadata', async t => {
  const f = swarmFixture(t);
  f.put('.starcistacks/dev/environment.json', '{}\n');
  f.put('.starcistacks/dev/secrets/.gitkeep', '');
  const rendered = checkRendered(f);
  assert.equal(rendered.ok, true, JSON.stringify(rendered.errors));
  const services = checkStarciStacks(f.root);
  assert.equal(services.ok, true, JSON.stringify(services.findings));
  assert.equal((await checkStarciStacksMain([f.root, '--json'])).exitCode, 0);
});

test('lite custody-only dev allowance never hides an undeclared Swarm deployment', t => {
  const f = swarmFixture(t);
  f.put('.starcistacks/dev/environment.json', '{}\n');
  f.put('.starcistacks/dev/secrets/.gitkeep', '');
  f.put('.starcistacks/dev/infra/swarm/stack.yaml', 'services: {}\n');
  const result = checkRendered(f);
  assert.ok(result.errors.some(error => error.code === 'STACKS_UNDECLARED_ENVIRONMENT'));
  assert.ok(shapeErrors(result).some(error => /no declared docker-swarm environment/.test(error.message)));
});

test('full still refuses undeclared metadata-only environment directories', t => {
  const f = swarmFixture(t, 'full');
  f.put('.starcistacks/dev/environment.json', '{}\n');
  f.put('.starcistacks/dev/secrets/.gitkeep', '');
  assert.ok(checkRendered(f).errors.some(error => error.code === 'STACKS_UNDECLARED_ENVIRONMENT'));
});

test('starcistacks CLI refuses lite compose paths and host crontab, with file and line evidence', async t => {
  const f = swarmFixture(t);
  f.put('.starcistacks/production/infra/compose/compose.yaml', 'services: {}\n');
  f.put('.github/workflows/api-deploy.yml', 'jobs:\n  deploy:\n    run: crontab -l\n');
  const cli = await checkStarciStacksMain([f.root, '--json']);
  assert.equal(cli.exitCode, 1);
  const findings = JSON.parse(cli.text).findings.filter(item => item.code === 'HFS_STACKS_SHAPE');
  assert.ok(findings.some(item => item.file.includes('/infra/compose/')));
  assert.ok(findings.some(item => item.message.includes('.github/workflows/api-deploy.yml:3')));
});

test('rendered deployment gate validates Swarm safety and lite managed backing', t => {
  const f = swarmFixture(t);
  delete f.model.services.api.healthcheck;
  delete f.model.services.api.deploy.update_config;
  delete f.model.services.api.deploy.rollback_config;
  f.model.services.api.image = `postgres:16@sha256:${'d'.repeat(64)}`;
  f.write();
  const messages = shapeErrors(checkRendered(f)).map(error => error.message).join('\n');
  for (const expected of ['healthcheck', 'update_config', 'rollback_config', 'duplicates']) assert.ok(messages.includes(expected), expected);
  assert.equal(checkStarciStacks(f.root).ok, false);
});

test('both gates validate scheduled jobs and refuse a missing scheduler', t => {
  const f = swarmFixture(t);
  addScheduledJob(f);
  assert.equal(checkRendered(f).ok, true);
  assert.equal(checkStarciStacks(f.root).ok, true);
  delete f.manifest.components.report.scheduler;
  f.write();
  assert.ok(shapeErrors(checkRendered(f)).some(error => /declared service component/.test(error.message)));
  assert.ok(checkStarciStacks(f.root).findings.some(error => /declared service component/.test(error.message)));
});

test('starcistacks respects lite Sonar gate selection', t => {
  const f = swarmFixture(t);
  f.manifest.services.sonar = { provider: 'sonarcloud', mode: 'hosted', host: { public: 'https://sonarcloud.io' }, auth: 'none',
    projects: [{ repository: 'swarm-app', key: 'swarm-app' }], ci: { wiring: 'not-used' }, qualityGate: 'starci-quality-lite', ownerAction: 'none' };
  f.write();
  assert.ok(!checkStarciStacks(f.root).findings.some(error => error.code === 'STACKS_QUALITY_GATE_DRIFT'));
  f.manifest.services.sonar.qualityGate = 'starci-quality';
  f.write();
  assert.ok(checkStarciStacks(f.root).findings.some(error => error.code === 'STACKS_QUALITY_GATE_DRIFT'));
});

test('an existing lite app cannot omit its required application stacks declaration', t => {
  const f = swarmFixture(t);
  fs.unlinkSync(path.join(f.root, '.starcistacks/application-stacks.yaml'));
  const result = checkStarciStacks(f.root);
  assert.equal(result.ok, false);
  assert.ok(result.findings.some(item => item.code === 'HFS_STACKS_SHAPE' && /requires this declaration/.test(item.message)));
});
