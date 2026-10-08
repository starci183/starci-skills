import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { writeContract } from '../../engine/db/ledger.mjs';
import { configRoot } from '../../engine/config.mjs';
import { tempRoot } from '../../engine/temp-root.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { ensureJobScratch } from '../../scripts/kernel/op-prompt.mjs';
import { scratchOf, removeScratch } from '../../scripts/kernel/verbs/shared/report-evidence.mjs';
import reportVerb from '../../scripts/kernel/verbs/report.mjs';
import { resolveJob, reportIdentityOf } from '../../scripts/kernel/verbs/shared/report-binding.mjs';

function fixture(t) {
  return withLedger(t, fx => {
    const previous = process.env.STARCI_TEMP_ROOT;
    delete process.env.STARCI_TEMP_ROOT;
    t.after(() => { if (previous === undefined) delete process.env.STARCI_TEMP_ROOT; else process.env.STARCI_TEMP_ROOT = previous; });
    // The owner config at the runtime root is simulated by the fs mocks below (nothing real is read), so the spec lifts the confinement that hides the real file from a spec.
    const confined = process.env.STARCI_OWNER_CONFIG_WITHIN;
    delete process.env.STARCI_OWNER_CONFIG_WITHIN;
    t.after(() => { if (confined !== undefined) process.env.STARCI_OWNER_CONFIG_WITHIN = confined; });
    const configFile = path.join(configRoot, 'config.yaml');
    const exists = fs.existsSync, read = fs.readFileSync;
    const example = parseYaml(read(path.join(configRoot, 'config.example.yaml'), 'utf8'));
    let root = path.join(fx.root, 'old-temp');
    t.mock.method(fs, 'existsSync', file => file === configFile || exists(file));
    t.mock.method(fs, 'readFileSync', (file, ...args) => file === configFile
      ? JSON.stringify({ ...example, roots: { ...example.roots, temp: root } }) : read(file, ...args));
    const workflowId = 'wf-scratch-root', jobId = 'op-scratch-root';
    const scratch = ensureJobScratch({ repo: fx.repoRoot, workflowId, jobId });
    seedWorkflow(fx.ledger, { id: workflowId, jobs: [{ jobId, opId: 'code.refactor', status: 'running' }] });
    const db = fx.ledger.db;
    db.prepare('UPDATE op_attempts SET scratch_dir=? WHERE job_id=?').run(scratch, jobId);
    const attempt = db.prepare('SELECT * FROM op_attempts WHERE job_id=?').get(jobId);
    writeContract(db, { attemptId: attempt.attempt_id, markdown: '# dispatched scratch fixture' });
    const report = path.join(scratch, 'report.json');
    fs.writeFileSync(report, JSON.stringify({ schema: 'starci/op-report@1', outcome: 'partial', summary: 'scratch report fixture', open: ['remaining work'] }));
    fs.writeFileSync(path.join(scratch, 'proof.txt'), 'old-root evidence');
    const emitted = [];
    const fileReport = (given = report) => reportVerb.run({ ledger: fx.ledger, repo: fx.repoRoot,
      args: { job: jobId, report: given, json: true }, emit: value => emitted.push(value),
      internals: { resolveJob, reportIdentityOf, reportOwnedPaths: () => [], skillRoot: configRoot, reportFiledWake: () => null } });
    const moved = path.join(fx.root, 'new-temp');
    root = moved;
    assert.equal(tempRoot(), moved, 'the owner roots.temp changed after dispatch');
    return { ...fx, attempt, scratch, report, fileReport, emitted, moved };
  });
}

test('report files the dispatch-bound old-root scratch after config roots.temp moves, then replays', async t => {
  const fx = fixture(t), argv = process.argv;
  process.argv = [...argv, '--attach', path.join(fx.scratch, 'proof.txt')];
  t.after(() => { process.argv = argv; });
  await fx.fileReport();
  const db = fx.ledger.db;
  assert.equal(db.prepare('SELECT count(*) n FROM reports').get().n, 1);
  assert.equal(db.prepare('SELECT name FROM job_artifacts').get().name, 'attachments/proof.txt');
  assert.equal(db.prepare('SELECT status FROM jobs WHERE job_id=?').get(fx.attempt.job_id).status, 'reported');
  assert.equal(fs.existsSync(fx.scratch), false, 'durable evidence permits deleting only the bound old scratch');
  await fx.fileReport();
  assert.equal(fx.emitted.at(-1).replayed, true);
  assert.equal(db.prepare('SELECT count(*) n FROM reports').get().n, 1);
});

test('a report from another job scratch refuses and preserves both directories', async t => {
  const fx = fixture(t);
  const foreign = ensureJobScratch({ repo: fx.repoRoot, workflowId: fx.attempt.workflow_id, jobId: 'foreign-job' });
  const file = path.join(foreign, 'report.json'); fs.copyFileSync(fx.report, file);
  await assert.rejects(fx.fileReport(file), error => error.code === 'report-outside-scratch');
  assert.ok(fs.existsSync(fx.scratch)); assert.ok(fs.existsSync(file));
  assert.equal(fx.ledger.db.prepare('SELECT count(*) n FROM reports').get().n, 0);
});

test('a foreign directory recorded as scratch refuses even under the current temp root', t => {
  const fx = fixture(t), foreign = path.join(fx.moved, 'foreign'); fs.mkdirSync(foreign, { recursive: true });
  assert.throws(() => scratchOf({ ...fx.attempt, scratch_dir: foreign }, fx.repoRoot), error => error.code === 'report-scratch-invalid');
  assert.equal(removeScratch(foreign, fx.attempt, fx.repoRoot), false);
  assert.ok(fs.existsSync(foreign));
});

test('another job, workflow or repository cannot claim the recorded scratch', t => {
  const fx = fixture(t);
  for (const attempt of [{ ...fx.attempt, job_id: 'foreign-job' }, { ...fx.attempt, workflow_id: 'foreign-workflow' }])
    assert.throws(() => scratchOf(attempt, fx.repoRoot), error => error.code === 'report-scratch-invalid');
  assert.throws(() => scratchOf(fx.attempt, path.join(fx.root, 'foreign-repo')), error => error.code === 'report-scratch-invalid');
  assert.equal(removeScratch(path.dirname(fx.scratch), fx.attempt, fx.repoRoot), false);
  assert.ok(fs.existsSync(fx.scratch));
});

test('missing and unbound scratch retain their typed refusals after roots.temp moves', t => {
  const fx = fixture(t);
  fs.rmSync(fx.scratch, { recursive: true });
  assert.throws(() => scratchOf(fx.attempt, fx.repoRoot), error => error.code === 'report-scratch-missing');
  assert.throws(() => scratchOf({ ...fx.attempt, scratch_dir: null }, fx.repoRoot), error => error.code === 'report-scratch-unbound');
});

test('a link replacing the bound scratch cannot admit or delete a foreign directory', t => {
  const fx = fixture(t), foreign = path.join(fx.root, 'foreign'); fs.mkdirSync(foreign);
  fs.rmSync(fx.scratch, { recursive: true });
  fs.symlinkSync(foreign, fx.scratch, process.platform === 'win32' ? 'junction' : 'dir');
  assert.throws(() => scratchOf(fx.attempt, fx.repoRoot), error => error.code === 'report-scratch-invalid');
  assert.equal(removeScratch(fx.scratch, fx.attempt, fx.repoRoot), false);
  assert.ok(fs.existsSync(foreign));
});
