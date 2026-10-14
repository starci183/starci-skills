// proves: STACKS_RELEASE_UNDECLARED@lite STACKS_RELEASE_UNDECLARED@full
// proves: BACKUP_UNDECLARED@lite BACKUP_UNDECLARED@full
// proves: BACKUP_PROOF_MISSING@lite BACKUP_PROOF_MISSING@full
// proves: STACKS_MODEL_UNAVAILABLE@lite STACKS_MODEL_UNAVAILABLE@full
// proves: HFS_SCHEDULE_UNDECLARED@lite HFS_SCHEDULE_UNDECLARED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { releaseBackupIssues, scheduleIssues, stacksReleaseFindings } from '../../scripts/hfs/rules/stacks-release.mjs';

const DECLARATION = '.starcistacks/application-stacks.yaml';
const STACK = '.starcistacks/production/infra/swarm/stack.yaml';
const COMMAND = 'node be/dist/apps/cli/main.js report';
const CRON = '0 3 * * *';
const PINNED = 'app/api@sha256:' + 'a'.repeat(64);

function writeTracked(value, file, content) {
  const target = path.join(value.repoRoot, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  if (!value.files.includes(file)) value.files.push(file);
}

function saveDeclaration(value) {
  writeTracked(value, DECLARATION, JSON.stringify(value.doc));
  writeTracked(value, STACK, JSON.stringify(value.model));
}

function withFixture(edition, run) {
  const base = path.resolve(os.tmpdir()), repoRoot = fs.mkdtempSync(path.join(base, 'hfs-release-'));
  const release = {
    imagesLock: 'evidence/images.lock', pointer: 'evidence/current.json',
    previous: 'evidence/previous.json', healthAssertions: ['api-ready', 'authenticated-smoke'],
  };
  const backup = ['automation', 'supabase'].map(component => ({
    component, target: 'encrypted-offsite', retention: '30d', owner: 'operations',
    restoreProof: 'evidence/' + component + '-restore.md',
  }));
  const spec = { runtime: 'docker-swarm', composeFiles: ['infra/swarm/stack.yaml'], components: { api: {}, automation: {} }, release, backup };
  const doc = {
    components: {
      api: { role: 'service', image: PINNED },
      automation: { role: 'sidecar', database: { provider: 'sqlite', volume: 'automation-data' }, volumes: ['automation-data'] },
      unused: { role: 'stateful' },
    },
    backing: { supabase: { provider: 'supabase', managed: true } },
    environments: { production: spec },
  };
  const model = { services: { api: { image: PINNED }, automation: { volumes: ['automation-data:/data'] } }, volumes: { 'automation-data': {} } };
  const value = { repoRoot, files: [], repo: { profile: 'app', edition }, doc, spec, model, environment: 'production' };
  try {
    for (const file of [release.imagesLock, release.pointer, release.previous, ...backup.map(entry => entry.restoreProof)])
      writeTracked(value, file, 'Public release or successful isolated restore evidence.');
    saveDeclaration(value);
    run(value);
  } finally {
    assert.ok(repoRoot.startsWith(base + path.sep));
    fs.rmSync(repoRoot, { recursive: true, force: true });
  }
}

const releaseCode = (value, code) => releaseBackupIssues(value).filter(issue => issue.code === code);
const findCode = (value, code) => stacksReleaseFindings(value).filter(finding => finding.code === code);

function jobFixture(value) {
  value.doc.components.report = { role: 'job', mode: 'replicated-job', schedule: CRON };
  value.spec.components.report = {};
  value.model.services.report = { deploy: { mode: 'replicated-job' }, command: ['node', 'dist/apps/cli/main.js', 'report'] };
  value.doc.jobs = { 'daily-report': { component: 'report', schedule: CRON, command: COMMAND } };
}

const finderMutations = [
  { code: 'STACKS_RELEASE_UNDECLARED', violate(value) { delete value.spec.release; } },
  { code: 'BACKUP_UNDECLARED', violate(value) { value.spec.backup = value.spec.backup.filter(entry => entry.component !== 'supabase'); } },
  { code: 'BACKUP_PROOF_MISSING', violate(value) { delete value.spec.backup[0].restoreProof; } },
];

for (const edition of ['lite', 'full']) {
  for (const { code, violate } of finderMutations) {
    test(`${code}@${edition}: tracked declared release and backup evidence passes the finder`, () => {
      withFixture(edition, value => {
        assert.deepEqual(stacksReleaseFindings(value).filter(finding => finding.code === code), []);
      });
    });

    test(`${code}@${edition}: tracked violating release or backup evidence fails the finder`, () => {
      withFixture(edition, value => {
        violate(value);
        saveDeclaration(value);
        assert.ok(stacksReleaseFindings(value).some(finding => finding.code === code));
      });
    });
  }

  test(`HFS_SCHEDULE_UNDECLARED@${edition}: tracked declared replicated CLI job passes the finder`, () => {
    withFixture(edition, value => {
      jobFixture(value);
      saveDeclaration(value);
      assert.deepEqual(stacksReleaseFindings(value).filter(finding => finding.code === 'HFS_SCHEDULE_UNDECLARED'), []);
    });
  });

  test(`HFS_SCHEDULE_UNDECLARED@${edition}: tracked missing job declaration fails the finder`, () => {
    withFixture(edition, value => {
      jobFixture(value);
      delete value.doc.jobs;
      saveDeclaration(value);
      assert.ok(stacksReleaseFindings(value).some(finding => finding.code === 'HFS_SCHEDULE_UNDECLARED'));
    });
  });

  test('STACKS_RELEASE_UNDECLARED@' + edition + ': tracked immutable records and health assertions pass', () => {
    withFixture(edition, value => assert.deepEqual(releaseCode(value, 'STACKS_RELEASE_UNDECLARED'), []));
  });

  test('STACKS_RELEASE_UNDECLARED@' + edition + ': missing records, untracked pointers and empty health assertions fail', () => {
    const mutations = [
      value => { delete value.spec.release; },
      ...['imagesLock', 'pointer', 'previous'].map(key => value => { delete value.spec.release[key]; }),
      value => { value.files = value.files.filter(file => file !== value.spec.release.pointer); },
      value => { value.spec.release.healthAssertions = []; },
      value => { value.spec.release.healthAssertions = ['']; },
      value => { value.spec.release.previous = '../previous.json'; },
    ];
    for (const mutate of mutations) withFixture(edition, value => {
      mutate(value);
      assert.equal(releaseCode(value, 'STACKS_RELEASE_UNDECLARED').length, 1);
    });
  });

  test('BACKUP_UNDECLARED@' + edition + ': SQLite volume and external managed database have separate backup owners', () => {
    withFixture(edition, value => assert.deepEqual(releaseBackupIssues(value), []));
  });

  test('BACKUP_UNDECLARED@' + edition + ': absent, incomplete and duplicate backup declarations fail', () => {
    const mutations = [
      value => { delete value.spec.backup; },
      value => { value.spec.backup = value.spec.backup.filter(entry => entry.component !== 'supabase'); },
      value => { value.spec.backup = value.spec.backup.filter(entry => entry.component !== 'automation'); },
      ...['target', 'retention', 'owner'].map(key => value => { value.spec.backup[0][key] = ' '; }),
      value => { value.spec.backup.push({ ...value.spec.backup[0] }); },
    ];
    for (const mutate of mutations) withFixture(edition, value => {
      mutate(value);
      assert.ok(releaseCode(value, 'BACKUP_UNDECLARED').length > 0);
    });
  });

  test('BACKUP_UNDECLARED@' + edition + ': selected state and rendered named volumes require backup, stateless binds do not', () => {
    const state = [
      { component: { role: 'stateful' }, service: {} },
      { component: { stateful: true }, service: {} },
      { component: { database: { provider: 'postgres' } }, service: {} },
      { component: { volumes: ['data'] }, service: {} },
      { component: {}, service: { volumes: [{ type: 'volume', source: 'data', target: '/data' }] } },
    ];
    for (const entry of state) withFixture(edition, value => {
      value.doc.components.extra = entry.component;
      value.model.services.extra = entry.service;
      assert.ok(releaseCode(value, 'BACKUP_UNDECLARED').some(issue => issue.at.endsWith('.extra')));
    });
    withFixture(edition, value => {
      value.model.services.extra = { volumes: ['./cache:/cache', '/anonymous'] };
      assert.deepEqual(releaseCode(value, 'BACKUP_UNDECLARED'), []);
    });
  });

  test('BACKUP_PROOF_MISSING@' + edition + ': tracked public evidence for local and external state passes', () => {
    withFixture(edition, value => assert.deepEqual(releaseCode(value, 'BACKUP_PROOF_MISSING'), []));
  });

  test('BACKUP_PROOF_MISSING@' + edition + ': absent, untracked and unsafe proof references fail', () => {
    const references = [undefined, '', 'missing.md', '../restore.md', '/restore.md', 'C:/restore.md',
      'evidence/../restore.md', 'evidence//restore.md', 'evidence/./restore.md',
      '.starcistacks/production/secrets/proof.enc', '.claude/proof.md', '.env', 'evidence/private.key',
      ['evidence', 'restore.md'].join(String.fromCodePoint(92))];
    for (const reference of references) withFixture(edition, value => {
      value.spec.backup[0].restoreProof = reference;
      assert.equal(releaseCode(value, 'BACKUP_PROOF_MISSING').length, 1);
    });
    withFixture(edition, value => {
      value.files = value.files.filter(file => file !== value.spec.backup[1].restoreProof);
      assert.equal(releaseCode(value, 'BACKUP_PROOF_MISSING').length, 1);
    });
  });

  test('BACKUP_PROOF_MISSING@' + edition + ': empty, oversized, directory and symlink evidence is refused', () => {
    for (const content of ['', Buffer.alloc(1024 * 1024 + 1)]) withFixture(edition, value => {
      writeTracked(value, value.spec.backup[0].restoreProof, content);
      assert.equal(releaseCode(value, 'BACKUP_PROOF_MISSING').length, 1);
    });
    withFixture(edition, value => {
      const directory = 'evidence/folder';
      fs.mkdirSync(path.join(value.repoRoot, directory));
      value.files.push(directory);
      value.spec.backup[0].restoreProof = directory;
      assert.equal(releaseCode(value, 'BACKUP_PROOF_MISSING').length, 1);
    });
    withFixture(edition, value => {
      fs.symlinkSync(path.join(value.repoRoot, 'evidence'), path.join(value.repoRoot, 'linked'), 'junction');
      value.spec.backup[0].restoreProof = 'linked/automation-restore.md';
      value.files.push(value.spec.backup[0].restoreProof);
      assert.equal(releaseCode(value, 'BACKUP_PROOF_MISSING').length, 1);
    });
  });

  test('STACKS_MODEL_UNAVAILABLE@' + edition + ': synchronous finder accepts a tracked rendered model', () => {
    withFixture(edition, value => {
      const findings = stacksReleaseFindings({ ...value, files: [], all: value.files });
      assert.ok(Array.isArray(findings));
      assert.deepEqual(findings, []);
    });
  });

  test('STACKS_MODEL_UNAVAILABLE@' + edition + ': missing, malformed, incomplete or unsafe rendered evidence is a finding', () => {
    const mutations = [
      value => { value.files = value.files.filter(file => file !== STACK); },
      value => { fs.unlinkSync(path.join(value.repoRoot, STACK)); },
      value => { writeTracked(value, STACK, '{ malformed'); },
      value => { writeTracked(value, STACK, JSON.stringify({ services: {} })); },
      value => { writeTracked(value, STACK, JSON.stringify({ ...value.model, include: ['other.yaml'] })); },
      value => { value.spec.composeFiles.push('infra/swarm/other.yaml'); saveDeclaration(value); },
      value => { value.spec.renderedModel = '../stack.yaml'; saveDeclaration(value); },
    ];
    for (const mutate of mutations) withFixture(edition, value => {
      mutate(value);
      const findings = findCode(value, 'STACKS_MODEL_UNAVAILABLE');
      assert.equal(findings.length, 1);
      assert.equal(findings[0].level, 'error');
      assert.ok(findings[0].path.startsWith('.starcistacks/production/'));
    });
  });

  test('STACKS_MODEL_UNAVAILABLE@' + edition + ': explicit rendered model binds multiple source files', () => {
    withFixture(edition, value => {
      value.spec.composeFiles.push('infra/swarm/override.yaml');
      value.spec.renderedModel = 'infra/swarm/rendered.json';
      writeTracked(value, '.starcistacks/production/infra/swarm/rendered.json', JSON.stringify(value.model));
      saveDeclaration(value);
      assert.deepEqual(findCode(value, 'STACKS_MODEL_UNAVAILABLE'), []);
    });
  });

  test('HFS_SCHEDULE_UNDECLARED@' + edition + ': replicated job binds its schedule and normalized app CLI command', () => {
    withFixture(edition, value => {
      jobFixture(value);
      assert.deepEqual(scheduleIssues(value), []);
      value.model.services.report.command = 'node dist/apps/cli/main.js report';
      assert.deepEqual(scheduleIssues(value), []);
    });
  });

  test('HFS_SCHEDULE_UNDECLARED@' + edition + ': undeclared jobs, cadence drift, wrong component and command drift fail', () => {
    const mutations = [
      value => { delete value.doc.jobs; },
      value => { value.doc.jobs['daily-report'].schedule = '0 4 * * *'; },
      value => { value.doc.jobs['daily-report'].component = 'api'; },
      value => { value.model.services.report.command = ['node', 'dist/apps/cli/main.js', 'backup']; },
      value => { delete value.model.services.report.command; },
      value => { value.doc.jobs['daily-report'].command = 'node -e inlineBusinessLogic'; },
    ];
    for (const mutate of mutations) withFixture(edition, value => {
      jobFixture(value);
      mutate(value);
      assert.ok(scheduleIssues(value).some(issue => issue.code === 'HFS_SCHEDULE_UNDECLARED'));
    });
  });

  test('HFS_SCHEDULE_UNDECLARED@' + edition + ': app-owned scheduled component also requires a matching manifest job', () => {
    withFixture(edition, value => {
      value.doc.components.api.schedule = CRON;
      assert.equal(scheduleIssues(value).length, 1);
      value.doc.jobs = { cleanup: { component: 'api', schedule: CRON, command: COMMAND } };
      assert.deepEqual(scheduleIssues(value), []);
      value.doc.jobs.cleanup.schedule = '0 4 * * *';
      assert.equal(scheduleIssues(value).length, 1);
    });
  });

  test('HFS_SCHEDULE_UNDECLARED@' + edition + ': declaration requires nonempty schedule and a named CLI action', () => {
    const bad = ['', 'node dist/apps/cli/main.js', 'node dist/apps/cli/main.js --eval work',
      'node dist/apps/cli/main.js --help', 'node dist/apps/cli/../worker/main.js report',
      'node dist/apps/worker/main.js report', 'node dist/apps/cli/main.js report && curl example.test',
      'node dist/apps/cli/main.js report; exit', 'node -e inlineLogic'];
    for (const command of bad) withFixture(edition, value => {
      value.doc.jobs = { report: { schedule: CRON, command } };
      assert.equal(scheduleIssues(value).length, 1);
    });
    withFixture(edition, value => {
      for (const entry of ['main.js', 'main.mjs', 'main.cjs']) {
        value.doc.jobs = { report: { schedule: CRON, command: 'node dist/apps/cli/' + entry + ' report' } };
        assert.deepEqual(scheduleIssues(value), []);
      }
      value.doc.jobs.report.schedule = ' ';
      assert.equal(scheduleIssues(value).length, 1);
    });
  });

  test('HFS_SCHEDULE_UNDECLARED@' + edition + ': app scheduler and Nest decorator observations match id and cadence', () => {
    const file = 'be/src/modules/jobs/report.scheduler.ts';
    const sources = [
      { cadence: CRON, text: "import { Cron as Daily } from '@nestjs/schedule'; const CADENCE = '0 3 * * *'; class Jobs { @Daily(CADENCE, {name: 'report'}) run() {} }" },
      { cadence: '60000ms', text: "import { Interval } from '@nestjs/schedule'; class Jobs { @Interval(60000) report() {} }" },
      { cadence: 'every:60000', text: "queue.upsertJobScheduler('report', {every: 60000}, {name: 'report'});" },
      { cadence: CRON, text: "queue.upsertJobScheduler('report', {pattern: '0 3 * * *'}, {name: 'report'});" },
      { cadence: '60000', text: "export const schedulers = [{id: 'report', everyMs: 60000}];" },
      { cadence: '60000', text: 'setInterval(report, 60000);' },
    ];
    for (const source of sources) withFixture(edition, value => {
      writeTracked(value, file, source.text);
      assert.ok(scheduleIssues(value).length > 0);
      value.doc.jobs = { report: { schedule: source.cadence, command: COMMAND } };
      assert.deepEqual(scheduleIssues(value), []);
      value.doc.jobs.report.schedule = 'different';
      assert.ok(scheduleIssues(value).length > 0);
    });
  });

  test('HFS_SCHEDULE_UNDECLARED@' + edition + ': pg_cron migrations and app SQL match declared jobs', () => {
    const schedules = [
      { file: 'supabase/migrations/202610150001_report.sql', text: "SELECT cron.schedule('report', '0 3 * * *', 'select 1');" },
      { file: 'supabase/migrations/202610150001_report.sql', text: "SELECT cron.schedule(job_name := 'report', schedule := '0 3 * * *', command := 'select 1');" },
      { file: 'supabase/migrations/202610150001_report.sql', text: "SELECT cron.schedule_in_database('report', '0 3 * * *', 'select 1', 'postgres');" },
      { file: 'supabase/migrations/202610150001_report.sql', text: "DO $$ BEGIN PERFORM cron.schedule('report', '0 3 * * *', 'select 1'); END $$;" },
      { file: 'supabase/migrations/202610150001_report.sql', text: "DO $$ DECLARE jobid integer; BEGIN jobid := cron.schedule('report', '0 3 * * *', 'select 1'); END $$;" },
      { file: 'be/src/modules/jobs/register.ts', text: "await db.query(\"SELECT cron.schedule('report', '0 3 * * *', 'select 1')\");" },
    ];
    for (const source of schedules) withFixture(edition, value => {
      writeTracked(value, source.file, source.text);
      assert.equal(scheduleIssues(value).length, 1);
      value.doc.jobs = { report: { schedule: CRON, command: COMMAND } };
      assert.deepEqual(scheduleIssues(value), []);
      value.doc.jobs.report.schedule = '0 4 * * *';
      assert.equal(scheduleIssues(value).length, 1);
    });
  });

  test('HFS_SCHEDULE_UNDECLARED@' + edition + ': later migrations replace and remove named pg_cron jobs', () => {
    withFixture(edition, value => {
      writeTracked(value, 'supabase/migrations/202610150001_report.sql', "SELECT cron.schedule('report', '0 4 * * *', 'select 1');");
      writeTracked(value, 'supabase/migrations/202610150002_report.sql', "SELECT cron.schedule('report', '0 3 * * *', 'select 1');");
      value.doc.jobs = { report: { schedule: CRON, command: COMMAND } };
      assert.deepEqual(scheduleIssues(value), []);
      delete value.doc.jobs;
      writeTracked(value, 'supabase/migrations/202610150003_report.sql', "SELECT cron.unschedule(job_name := 'report');");
      assert.deepEqual(scheduleIssues(value), []);
    });
  });

  test('HFS_SCHEDULE_UNDECLARED@' + edition + ': dynamic pg_cron ids and anonymous recurring callbacks cannot silently pass', () => {
    withFixture(edition, value => {
      writeTracked(value, 'be/src/modules/jobs/register.ts', 'db.query("SELECT cron.schedule($1, $2, $3)", args); setInterval(() => run(), 60000);');
      assert.equal(scheduleIssues(value).length, 2);
    });
    withFixture(edition, value => {
      const quote = String.fromCodePoint(96);
      const template = 'SELECT cron.schedule(' + '${job}' + ', ' + '${cadence}' + ", 'select 1')";
      writeTracked(value, 'be/src/modules/jobs/register.ts', 'db.query(' + quote + template + quote + ');');
      assert.equal(scheduleIssues(value).length, 1);
      writeTracked(value, 'be/src/modules/jobs/register.ts', 'sql' + quote + template + quote + ';');
      assert.equal(scheduleIssues(value).length, 1);
    });
  });

  test('HFS_SCHEDULE_UNDECLARED@' + edition + ': comments, inert literals, tests, archive and ordinary data do not declare schedules', () => {
    withFixture(edition, value => {
      writeTracked(value, 'be/src/modules/jobs/ordinary.ts', "// queue.upsertJobScheduler('report', {every: 1});\nconst text = \"cron.schedule('report', '* * * * *', 'select 1')\"; const record = {id: 'report', schedule: 'event-date'};");
      writeTracked(value, 'be/src/modules/jobs/report.spec.ts', "queue.upsertJobScheduler('report', {every: 1});");
      writeTracked(value, 'supabase/migrations/_archive/202001010001_report.sql', "SELECT cron.schedule('report', '* * * * *', 'select 1');");
      writeTracked(value, 'supabase/migrations/202610150001_noop.sql', "-- SELECT cron.schedule('report', '* * * * *', 'select 1');\nSELECT 'cron.schedule';");
      writeTracked(value, 'supabase/migrations/202610150002_function.sql', "CREATE FUNCTION register_later() RETURNS void LANGUAGE plpgsql AS $$ BEGIN PERFORM cron.schedule('report', '* * * * *', 'select 1'); END $$; DO $$ BEGIN PERFORM 1; END $$;");
      assert.deepEqual(scheduleIssues(value), []);
    });
  });

  test('R267/R268@' + edition + ': violating release, backup and schedule evidence fails with standard code, level and declaration/source paths', () => {
    withFixture(edition, value => {
      delete value.spec.release;
      delete value.spec.backup[0].restoreProof;
      value.spec.backup = value.spec.backup.filter(entry => entry.component !== 'supabase');
      const source = 'be/src/modules/jobs/report.ts';
      writeTracked(value, source, "queue.upsertJobScheduler('report', {every: 60000});");
      saveDeclaration(value);
      const findings = stacksReleaseFindings(value);
      assert.deepEqual(new Set(findings.map(finding => finding.code)), new Set([
        'STACKS_RELEASE_UNDECLARED', 'BACKUP_UNDECLARED', 'BACKUP_PROOF_MISSING', 'HFS_SCHEDULE_UNDECLARED',
      ]));
      for (const finding of findings) {
        assert.equal(finding.level, 'error');
        const expected = finding.code === 'HFS_SCHEDULE_UNDECLARED' ? source : DECLARATION;
        assert.equal(finding.path, expected);
        assert.ok(finding.message.startsWith(expected + ': '));
      }
    });
  });
}

test('R267/R268: finder respects root and profile boundaries; non-Swarm development keeps its contract', () => {
  withFixture('lite', value => {
    assert.deepEqual(stacksReleaseFindings({ ...value, isRoot: false }), []);
    assert.deepEqual(stacksReleaseFindings({ ...value, repo: { profile: 'runtime', edition: 'lite' } }), []);
    value.spec.runtime = 'docker-compose';
    delete value.spec.release;
    delete value.spec.backup;
    assert.deepEqual(releaseBackupIssues(value), []);
  });
});
