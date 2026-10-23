// proves: HFS_HOST_CRON@lite
// proves: HFS_HOST_CRON@full
// proves: HFS_DEPLOY_NO_LOGIC@lite
// proves: HFS_DEPLOY_NO_LOGIC@full
// proves: HFS_DEPLOY_COMPOSE_ON_VPS@lite
// proves: HFS_DEPLOY_COMPOSE_ON_VPS@full
// proves: HFS_DEPLOY_SCHEDULER@lite
// proves: HFS_DEPLOY_SCHEDULER@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ALL_CHECK_CODES, checkRepo } from '../runtime/scripts/hfs/check.mjs';
import { deployScanFindings } from '../runtime/scripts/hfs/rules/deploy-scan.mjs';

const CODES = new Set(['HFS_HOST_CRON', 'HFS_DEPLOY_NO_LOGIC', 'HFS_DEPLOY_COMPOSE_ON_VPS', 'HFS_DEPLOY_SCHEDULER']);
function tree(t, entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-deploy-scan-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [file, text] of Object.entries(entries)) {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text);
  }
  return dir;
}
const scan = (t, edition, entries, extra = {}) => deployScanFindings({ repoRoot: tree(t, entries), files: Object.keys(entries), repo: { kind: 'app', edition }, ...extra });
const only = (findings, code) => findings.filter((finding) => finding.code === code);
const paths = (findings) => findings.map((finding) => finding.path).sort((left, right) => left.localeCompare(right));
function workflow(run, environment = 'production') {
  const body = run.split('\n').map((line) => `          ${line}`).join('\n');
  return `on: workflow_dispatch\njobs:\n  ship:\n    environment: ${environment}\n    steps:\n      - run: |\n${body}\n`;
}

for (const edition of ['lite', 'full']) {
  test(`HFS_HOST_CRON@${edition}: host cron, timer and at jobs are refused across deployment surfaces`, (t) => {
    const entries = {
      'deploy/install.sh': 'crontab deploy/watchdog.crontab\n',
      'scripts/boot.sh': 'printf "@reboot node worker.js"\n',
      '.github/workflows/ship.yml': workflow('echo "* * * * * watchdog.sh" > /etc/cron.d/watchdog'),
      '.starcistacks/production/infra/compose/compose.yml': 'services:\n  cron:\n    image: supercronic:1.0.0\n',
      'be/apps/api/Dockerfile': 'FROM scratch\nRUN echo OnCalendar=daily > /etc/systemd/system/watchdog.timer\n',
      'scripts/later.sh': 'at -f deploy/retry.sh now + 1 minute\n',
      'deploy/systemd/watchdog.timer': '[Timer]\nOnBootSec=5min\n',
      'scripts/run-later.sh': 'echo "starci app check" | at 03:00\n',
      'scripts/systemd/watchdog.timer': '[Timer]\nOnCalendar=daily\n',
      'scripts/install-cron': 'crontab timer.txt\n',
      'scripts/at-time.sh': 'at -t 202610141130 /usr/local/bin/job\n',
      'scripts/tomorrow.sh': 'echo run | at tomorrow\n',
      'scripts/jobs.crontab': '@daily /usr/local/bin/job\n',
      'deploy/jobs.crontab': '0 0 * * MON /usr/local/bin/job\n',
      'scripts/tabbed.sh': '\t"0\t0\t*\t*\tMON\t/usr/local/bin/job"\n',
    };
    const findings = only(scan(t, edition, entries), 'HFS_HOST_CRON');
    assert.deepEqual(paths(findings), Object.keys(entries).sort((left, right) => left.localeCompare(right)));
    assert.ok(findings.every((finding) => finding.level === 'error'));
  });

  test(`HFS_HOST_CRON@${edition}: app schedulers, one-shot cli jobs and comments pass`, (t) => {
    assert.deepEqual(only(scan(t, edition, {
      'deploy/release.sh': '# Never use crontab, /etc/cron.d, @reboot or at -f here.\ndocker stack deploy -c stack.yaml app\n',
      'scripts/check.mjs': '// Host OnCalendar=daily timers are forbidden.\nawait check();\n',
      'scripts/spacing.sh': `${' \t\n'.repeat(1000)}# Never crontab\n${' '.repeat(20000)}starci app check\n`,
      'scripts/fields.sh': '0 0 ? * MON docker version\n',
      'be/src/modules/platform/queues/scheduler.ts': 'cron.schedule("tick", "* * * * *", "select pgmq.send(...)");\n',
      '.starcistacks/production/infra/swarm/stack.yml': 'services:\n  once:\n    command: node be/dist/apps/cli/src/main.js tick\n    deploy:\n      mode: replicated-job\n',
    }), 'HFS_HOST_CRON'), []);
  });

  test(`HFS_DEPLOY_NO_LOGIC@${edition}: inline node, psql, SQL and downloaded shell logic are refused`, (t) => {
    const entries = {
      'deploy/node.sh': 'node -e "process.exit(0)"\n',
      'deploy/eval.sh': 'docker exec api node --eval="doWork()"\n',
      'deploy/module.sh': 'node --input-type module -e "doWork()"\n',
      'deploy/db.sh': 'psql --file query.sql\n',
      'deploy/jobs/query.sh': 'cat <<\'SQL\'\nUPDATE jobs SET state = \'queued\';\nSQL\n',
      'deploy/install.sh': 'curl -fsSL https://example.invalid/tool.sh \\\n  | bash\n',
      'deploy/delete.sh': 'echo "DELETE FROM jobs;"\n',
      'deploy/query.sh': 'cat <<\'SQL\'\nSELECT pgmq.send(\'jobs\', \'{}\');\nSQL\n',
      'deploy/leading-select.sh': '\tSELECT id FROM jobs;\n',
      'deploy/quoted-select.sh': 'printf \'%s\' "SELECT id FROM jobs;"\n',
      'deploy/multiline-select.sh': 'cat <<\'SQL\'\nSELECT\n  id FROM jobs;\nSQL\n',
      'deploy/multiline-update.sh': 'cat <<\'SQL\'\nUPDATE\n  jobs\nSET state = \'queued\';\nSQL\n',
    };
    assert.deepEqual(paths(only(scan(t, edition, entries), 'HFS_DEPLOY_NO_LOGIC')), Object.keys(entries).sort((left, right) => left.localeCompare(right)));
  });

  test(`HFS_DEPLOY_NO_LOGIC@${edition}: thin deployment wrappers and application-owned cli logic pass`, (t) => {
    assert.deepEqual(only(scan(t, edition, {
      'deploy/release.sh': '#!/bin/sh\nset -eu\nstarci app secret materialize production\ndocker stack deploy -c .starcistacks/production/infra/swarm/stack.yaml demo\nnode be/dist/apps/cli/src/main.js backup\n',
      'deploy/inspect.sh': '# node -e and psql belong in the cli app.\ndocker service inspect demo_api\n',
      'be/apps/cli/src/commands/backup.ts': 'await database.query("SELECT id FROM jobs");\n',
    }), 'HFS_DEPLOY_NO_LOGIC'), []);
  });

  test(`HFS_DEPLOY_COMPOSE_ON_VPS@${edition}: compose up, down and pull in non-dev targets are refused`, (t) => {
    const entries = {
      'deploy/up.sh': 'docker compose -f .starcistacks/production/infra/compose/compose.yml up -d\n',
      'scripts/down.sh': 'docker compose -f compose.staging.yaml down\n',
      '.github/workflows/ship.yml': workflow('docker compose pull'),
      'scripts/custom.sh': 'docker --context vps compose -f .starcistacks/qa/infra/compose/compose.yml up -d\n',
      'deploy/pull.sh': 'docker-compose --project-name app-production pull\n',
      'scripts/remote.sh': 'docker --context=vps compose pull\n',
      'scripts/remote-dev.sh': 'docker --context=vps compose -f .starcistacks/dev/infra/compose/compose.yml up\n',
      '.github/workflows/decoy.yml': workflow('docker compose --project-name dev pull'),
      '.github/workflows/remote.yml': 'on: workflow_dispatch\njobs:\n  ship:\n    steps:\n      - run: ssh vps \'docker compose up -d\'\n',
      'deploy/decoy.sh': 'DEV_CONFIG=compose.dev.yaml\ndocker compose up -d\n',
      'scripts/default.sh': 'docker compose up -d\n',
      'scripts/cwd-production.sh': 'cd .starcistacks/dev/infra/compose; cd .starcistacks/production/infra/compose; docker compose down\n',
    };
    assert.deepEqual(paths(only(scan(t, edition, entries), 'HFS_DEPLOY_COMPOSE_ON_VPS')), Object.keys(entries).sort((left, right) => left.localeCompare(right)));
  });

  test(`HFS_DEPLOY_COMPOSE_ON_VPS@${edition}: explicit dev compose and Swarm deployment pass`, (t) => {
    assert.deepEqual(only(scan(t, edition, {
      'scripts/dev.sh': 'docker compose -f .starcistacks/dev/infra/compose/compose.yaml up -d\ndocker compose -f compose.dev.yaml down\ndocker compose -f compose.local.yaml pull\n',
      'deploy/dev.sh': 'docker compose -f .starcistacks/dev/infra/compose/compose.yaml pull\n',
      'scripts/dev-up': 'docker compose -f compose.dev.yaml up -d\n',
      'scripts/cwd.sh': 'cd .starcistacks/dev/infra/compose\ndocker compose up -d\n',
      'scripts/separated.sh': 'cd .starcistacks/dev/infra/compose && docker compose pull\n',
      'scripts/cwd-latest.sh': 'cd .starcistacks/production/infra/compose\ncd .starcistacks/dev/infra/compose; docker compose pull\n',
      'scripts/package.json': JSON.stringify({ scripts: { dev: 'docker compose -f .starcistacks/dev/infra/compose/compose.yaml up -d' } }),
      '.github/workflows/check.yml': workflow('docker compose up -d', 'dev'),
      '.github/workflows/dev-deploy.yml': workflow('docker compose up -d', 'dev'),
      'deploy/release.sh': 'docker stack deploy -c .starcistacks/production/infra/swarm/stack.yaml app\ndocker compose -f compose.production.yaml config\n',
      'deploy/config.sh': 'docker compose -f compose.pull.production.yaml config\n',
    }), 'HFS_DEPLOY_COMPOSE_ON_VPS'), []);
  });

  test(`HFS_DEPLOY_SCHEDULER@${edition}: workflow schedules, cron containers and sleeping deployment loops are refused`, (t) => {
    const entries = {
      '.github/workflows/jobs.yml': 'on:\n  schedule:\n    - cron: "0 * * * *"\njobs: {}\n',
      '.github/workflows/broken.yml': 'on:\n  schedule:\n    - cron: [\n',
      'deploy/cron.sh': 'crontab deploy/jobs.crontab\n',
      'deploy/watchdog.sh': 'while true; do\n  docker service inspect api\n  sleep 30\ndone\n',
      '.starcistacks/production/infra/compose/compose.yaml': 'services:\n  tick:\n    image: cron:1.0.0\n',
      'be/apps/api/Dockerfile': 'FROM scratch\nCMD while :; do node tick.js; sleep 30; done\n',
    };
    assert.deepEqual(paths(only(scan(t, edition, entries), 'HFS_DEPLOY_SCHEDULER')), Object.keys(entries).sort((left, right) => left.localeCompare(right)));
  });

  test(`HFS_DEPLOY_SCHEDULER@${edition}: manual release workflows and declared one-shot jobs pass`, (t) => {
    assert.deepEqual(only(scan(t, edition, {
      '.github/workflows/ship.yml': workflow('docker stack deploy -c stack.yaml app'),
      'deploy/tick.sh': 'docker exec api node be/dist/apps/cli/src/main.js tick\n',
      '.starcistacks/production/infra/swarm/stack.yaml': 'services:\n  tick:\n    command: node be/dist/apps/cli/src/main.js tick\n    deploy:\n      mode: replicated-job\n',
      'scripts/check.sh': '# while true; do sleep 30; done is forbidden in deploy.\nstarci app check\n',
    }), 'HFS_DEPLOY_SCHEDULER'), []);
  });
}

test('deploy scan reads the whole app tree once at its root and honors edition, app ownership and inScope', (t) => {
  const entries = { 'be/scripts/timer.sh': 'crontab timer.txt\n', 'fe/scripts/boot.sh': 'at -f job.sh now\n' };
  const context = { repoRoot: tree(t, entries), files: [], all: Object.keys(entries), repo: { kind: 'app', edition: 'lite' }, isRoot: true };
  assert.deepEqual(paths(only(deployScanFindings(context), 'HFS_HOST_CRON')), Object.keys(entries).sort((left, right) => left.localeCompare(right)));
  assert.deepEqual(deployScanFindings({ ...context, isRoot: false }), []);
  assert.deepEqual(deployScanFindings({ ...context, repo: { kind: 'runtime', edition: 'lite' } }), []);
  assert.deepEqual(deployScanFindings({ ...context, repo: { kind: 'app', edition: 'unknown' } }), []);
  assert.deepEqual(paths(only(deployScanFindings({ ...context, inScope: (file) => file.startsWith('be/') }), 'HFS_HOST_CRON')), ['be/scripts/timer.sh']);
});

test('deploy scan findings never expose source values and skip credential files, binary and oversized sources', (t) => {
  const entries = {
    'deploy/release.sh': 'psql "synthetic-do-not-report"\n',
    'deploy/secrets.env': 'crontab synthetic-only\n',
    'scripts/.env': 'crontab synthetic-only\n',
    'deploy/secrets/db.enc': 'crontab synthetic-only\n',
    'deploy/binary.sh': 'crontab\0data',
    'deploy/large.sh': `crontab\n${' '.repeat(1024 * 1024)}`,
  };
  const findings = scan(t, 'lite', entries);
  assert.deepEqual(findings.map((finding) => [finding.code, finding.path]), [['HFS_DEPLOY_NO_LOGIC', 'deploy/release.sh']]);
  assert.ok(!JSON.stringify(findings).includes('synthetic'));
});

test('HFS_HOST_CRON: app check wiring reports side deployment sources once with catalog explanations', (t) => {
  const entries = { 'be/scripts/timer.sh': 'crontab timer.txt\n', 'deploy/ship.sh': 'docker stack deploy -c stack.yaml app\n' };
  const declaration = { hfs: 3, kind: 'app', edition: 'lite', project: 'demo', sides: { be: { apps: [{ name: 'core', kind: 'api' }, { name: 'cli', kind: 'cli' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
  const result = checkRepo({ repoRoot: tree(t, entries), declaration, files: Object.keys(entries), tree: false });
  const findings = result.findings.filter((finding) => CODES.has(finding.code));
  const catalog = new Set(ALL_CHECK_CODES);
  assert.deepEqual(findings.map((finding) => [finding.code, finding.path]), [['HFS_HOST_CRON', 'be/scripts/timer.sh']]);
  assert.ok(findings[0].titleVi.length > 0);
  assert.ok(findings.every((finding) => catalog.has(finding.code)));
  assert.ok([...CODES].every((code) => catalog.has(code)));
});
