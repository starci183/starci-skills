import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stringifyYaml } from '../../engine/yaml.mjs';
import { openHfs } from '../../scripts/hfs/slots.mjs';
import { stacksFindings } from '../../scripts/hfs/rules/stacks.mjs';

export const swarmService = (image = `registry.example.org/app@sha256:${'a'.repeat(64)}`) => ({
  image,
  healthcheck: { test: ['CMD-SHELL', 'test -r /proc/1/status'], interval: '30s' },
  deploy: {
    replicas: 2,
    update_config: { order: 'start-first', failure_action: 'rollback', monitor: '30s' },
    rollback_config: { order: 'stop-first', monitor: '30s' },
    restart_policy: { condition: 'on-failure' },
  },
});

const RUNBOOK = ['# Swarm runbook', '', '| command | purpose |', '|---|---|',
  ...['prepare', 'doctor', 'up', 'status', 'logs', 'down', 'verification'].map(command => `| ${command} | Release operation |`), ''].join('\n');

export function swarmFixture(t, edition = 'lite') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-lite-swarm-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = new Set(), stackFile = '.starcistacks/production/infra/swarm/stack.yaml';
  const declaration = { hfs: 3, kind: 'app', edition, project: 'swarm-app',
    sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
  const manifest = { schema: 'starci/application-stacks@1',
    components: { api: { role: 'service', image: swarmService().image, compose: 'infra/swarm/stack.yaml' },
      ingress: { role: 'ingress', image: `caddy:2@sha256:${'b'.repeat(64)}`, compose: 'infra/swarm/stack.yaml' } },
    backing: { supabase: { provider: 'supabase', managed: true } },
    environments: { production: { status: 'supported', runtime: 'docker-swarm', composeFiles: ['infra/swarm/stack.yaml'],
      components: { api: { replicas: 2 }, ingress: {} }, runbook: 'README.md',
      secrets: [{ name: 'database-url', runtimeName: 'swarm-app-database-url-v1', version: 1,
        where: 'secrets/database-url', recipientPolicy: 'policy:owner-age', keyCustody: 'custody:owner-password-manager' }],
      ingress: { component: 'ingress', hosts: ['app.example.test'] },
      dns: [{ host: 'app.example.test', owner: 'application operator', receipt: 'evidence/dns.md' }],
      tls: { owner: 'application operator', receipt: 'evidence/tls.md' },
      release: { imagesLock: 'evidence/images.lock', pointer: 'evidence/current.json',
        previous: 'evidence/previous.json', healthAssertions: ['api-ready'] },
      backup: [{ component: 'supabase', target: 'encrypted-offsite', retention: '30d', owner: 'application operator',
        restoreProof: 'evidence/supabase-restore.md' }] } },
    k8s: { status: 'deferred', reason: 'Swarm is the delivery runtime' },
    services: { sonar: { provider: 'sonarcloud', mode: 'disabled', reason: 'isolated checker fixture', ci: { wiring: 'not-used' }, ownerAction: 'none' } } };
  const model = { services: { api: swarmService(), ingress: { ...swarmService(manifest.components.ingress.image), ports: ['443:443'],
    configs: [{ source: 'ingress-config', target: '/etc/caddy/Caddyfile' }] } },
    secrets: { 'database-url': { external: true, name: 'swarm-app-database-url-v1' } },
    configs: { 'ingress-config': { file: './Caddyfile' } } };
  model.services.api.secrets = ['database-url'];
  model.services.api.environment = { DATABASE_URL_FILE: '/run/secrets/database-url' };
  const put = (relative, content) => {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    files.add(relative);
  };
  const write = () => {
    put('hfs.json', JSON.stringify(declaration));
    put('.starcistacks/application-stacks.yaml', stringifyYaml(manifest));
    put(stackFile, stringifyYaml(model));
    fs.writeFileSync(path.join(root, 'rendered.json'), JSON.stringify(model));
  };
  put('.gitignore', '.starcistacks/**\n!.starcistacks/**/\n!.starcistacks/*/README.md\n!.starcistacks/**/*.enc\n');
  put('.starcistacks/production/README.md', RUNBOOK);
  put('.starcistacks/production/environment.json', '{}\n');
  put('.starcistacks/production/secrets/.gitkeep', '');
  const encrypted = 'ENC[AES256_GCM,data:YWJj,iv:ZGVm,tag:Z2hp,type:str]';
  put('.starcistacks/production/secrets/database-url.enc', JSON.stringify({ data: encrypted, sops: { mac: encrypted, age: [] } }));
  put('.starcistacks/production/infra/swarm/Caddyfile', 'app.example.test {\n  reverse_proxy api:3000\n}\n');
  for (const record of ['images.lock', 'current.json', 'previous.json', 'supabase-restore.md', 'dns.md', 'tls.md'])
    put(`evidence/${record}`, 'Public fixture evidence for the declared release and recovery contract.\n');
  write();
  const check = () => stacksFindings({ repoRoot: root, files: [...files], resolver: openHfs({ declaration }) });
  return { root, files, stackFile, declaration, manifest, model, put, write, check, modelFile: path.join(root, 'rendered.json') };
}

export function addScheduledJob(fixture) {
  const { manifest, model } = fixture;
  manifest.components.cron = { role: 'scheduler', image: `crazymax/swarm-cronjob@sha256:${'c'.repeat(64)}`, compose: 'infra/swarm/stack.yaml' };
  manifest.components.report = { role: 'job', mode: 'replicated-job', scheduler: 'cron', schedule: '0 3 * * *',
    image: swarmService().image, compose: 'infra/swarm/stack.yaml' };
  manifest.environments.production.components.cron = {};
  manifest.environments.production.components.report = {};
  manifest.jobs = { report: { component: 'report', schedule: '0 3 * * *', command: 'node dist/apps/cli/main.js report' } };
  model.services.cron = swarmService(manifest.components.cron.image);
  model.services.report = swarmService();
  model.services.report.command = ['node', 'dist/apps/cli/main.js', 'report'];
  Object.assign(model.services.report.deploy, { mode: 'replicated-job', replicas: 0, restart_policy: { condition: 'none' },
    labels: { 'swarm.cronjob.enable': 'true', 'swarm.cronjob.schedule': '0 3 * * *' } });
  fixture.write();
}
