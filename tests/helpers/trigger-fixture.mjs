import fs from 'node:fs';
import path from 'node:path';
import { stringifyYaml } from '../../engine/yaml.mjs';
import { checkRepository } from '../../scripts/hfs/check.mjs';
import { gitAdd, installTypeScript, writeCleanRepo } from './hfs-cli-fixture.mjs';
import { swarmService } from './swarm-stack-fixture.mjs';
import { mkdtemp } from './tmpdir.mjs';

export const STACKS_DECLARATION = '.starcistacks/application-stacks.yaml';
export const SWARM_STACK = '.starcistacks/production/infra/swarm/stack.yaml';
export const DEPLOY_SCRIPT = 'deploy/release.sh';
export const DEPLOY_WORKFLOW = '.github/workflows/api-deploy.yml';
const COMPOSE = '.starcistacks/production/infra/compose/compose.yaml';
const STACK_SOURCE = 'infra/swarm/stack.yaml';
const COMPOSE_COMMAND = 'docker --context vps compose -f .starcistacks/production/infra/compose/compose.yaml up -d';
const SWARM_COMMAND = 'docker --context vps stack deploy -c .starcistacks/production/infra/swarm/stack.yaml trigger';
const HOST_CRON = String.raw`printf '%s\n' '* * * * * docker --context vps compose -f .starcistacks/production/infra/compose/compose.yaml up -d' | crontab -`;

function workflow(commands) {
  return ['name: Deploy', 'on: workflow_dispatch', 'permissions:', '  contents: read', 'jobs:', '  ship:',
    '    environment: production', '    runs-on: ubuntu-latest', '    steps:', '      - run: |',
    ...commands.map(command => `          ${command}`), ''].join('\n');
}

function stackDeclaration() {
  return {
    schema: 'starci/application-stacks@1',
    components: {
      api: { role: 'service', image: swarmService().image, compose: STACK_SOURCE },
      ingress: { role: 'ingress', image: `traefik:v3.6@sha256:${'b'.repeat(64)}`, compose: STACK_SOURCE },
    },
    backing: { supabase: { provider: 'supabase', managed: true } },
    environments: { production: {
      status: 'supported', runtime: 'docker-swarm', composeFiles: [STACK_SOURCE],
      components: { api: { replicas: 2 }, ingress: {} }, runbook: 'README.md', secrets: [],
      ingress: { component: 'ingress', hosts: ['app.example.test'] },
      dns: [{ host: 'app.example.test', owner: 'application operator', receipt: 'deploy/evidence/dns.md' }],
      tls: { owner: 'application operator', receipt: 'deploy/evidence/tls.md' },
      release: { imagesLock: 'deploy/evidence/images.lock.json', pointer: 'deploy/evidence/current.json',
        previous: 'deploy/evidence/previous.json', healthAssertions: ['api-ready'] },
      backup: [{ component: 'supabase', target: 'encrypted-offsite', retention: '30d',
        owner: 'application operator', restoreProof: 'deploy/evidence/restore.md' }],
    } },
    k8s: { status: 'deferred', reason: 'This fixture deploys through Swarm' },
    services: { sonar: { provider: 'sonarcloud', mode: 'disabled', reason: 'isolated checker fixture',
      ci: { wiring: 'not-used' }, ownerAction: 'none' } },
  };
}

/** An offline app with a real Git index, checked through the same aggregate as starci app check. */
export function triggerFixture(t, edition) {
  const declaration = { hfs: 3, kind: 'app', edition, project: 'trigger-app',
    sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
  const root = writeCleanRepo(declaration, { into: mkdtemp(t, 'hfs-trigger-'), name: 'trigger-app' });
  installTypeScript(root);
  const manifest = stackDeclaration();
  const put = (file, content) => {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };
  const remove = file => fs.rmSync(path.join(root, file), { force: true });
  const writeManifest = () => put(STACKS_DECLARATION, stringifyYaml(manifest));
  const automation = commands => {
    put(DEPLOY_SCRIPT, ['#!/bin/sh', 'set -eu', ...commands, ''].join('\n'));
    put(DEPLOY_WORKFLOW, workflow(commands));
  };
  const incident = () => {
    manifest.environments.production.runtime = 'docker-compose';
    manifest.environments.production.composeFiles = ['infra/compose/compose.yaml'];
    for (const component of Object.values(manifest.components)) component.compose = 'infra/compose/compose.yaml';
    remove(SWARM_STACK);
    put(COMPOSE, stringifyYaml({ services: { api: { image: manifest.components.api.image } } }));
    automation([COMPOSE_COMMAND, HOST_CRON]);
    writeManifest();
  };
  const repair = () => {
    manifest.environments.production.runtime = 'docker-swarm';
    manifest.environments.production.composeFiles = [STACK_SOURCE];
    for (const component of Object.values(manifest.components)) component.compose = STACK_SOURCE;
    const api = swarmService(manifest.components.api.image);
    api.deploy.labels = { 'traefik.http.routers.api.rule': 'Host(`app.example.test`)' };
    const ingress = { ...swarmService(manifest.components.ingress.image), ports: ['80:80', '443:443'] };
    remove(COMPOSE);
    put(SWARM_STACK, stringifyYaml({ services: { api, ingress } }));
    automation([SWARM_COMMAND]);
    writeManifest();
  };
  const check = () => {
    gitAdd(root);
    return checkRepository({ repoRoot: root });
  };
  const commands = ['prepare', 'doctor', 'up', 'status', 'logs', 'down', 'verification'];
  put('.starcistacks/production/README.md', ['# Production', '| command | purpose |', '|---|---|',
    ...commands.map(command => `| ${command} | Release operation |`), ''].join('\n'));
  put('.starcistacks/production/environment.json', '{}\n');
  put('.starcistacks/production/secrets/.gitkeep', '');
  for (const file of ['dns.md', 'tls.md', 'restore.md']) put(`deploy/evidence/${file}`, 'Public fixture evidence.\n');
  for (const file of ['images.lock.json', 'current.json', 'previous.json']) put(`deploy/evidence/${file}`, '{}\n');
  incident();
  return { root, manifest, check, remove, writeManifest, repair };
}
