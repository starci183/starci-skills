import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ADDITIVE_COLUMNS, JOB_ARTIFACT_SUBKINDS, hasLedgerColumn, inspectLedger, ledgerFileFor, openLedger } from '../engine/ledger-db.mjs';
import { clearManifestCache, manifestToolOf, subkindOf, subkindOfTool } from '../scripts/kernel/artifact-subkind.mjs';
import { backfillArtifactSubkind } from '../scripts/work/backfill-artifact-subkind.mjs';
import { collectJobFiles, listJobArtifacts } from '../scripts/kernel/job-artifacts.mjs';
import { RECORDINGS_ROOT_ENV, defaultRecordRoot, recordingsRootOf } from '../scripts/uat/playwright-recording.mjs';
import { LOG_TYPED_MISSING, openLogs, readLogs, rowsOfEvent, prepareLogRow, typedLogGaps, appendLog } from '../scripts/kernel/typed-logs.mjs';

// The harness data contract's runtime half: job_artifacts.subkind (what produced a file) derived from facts only, its
// additive migration and idempotent backfill, the Playwright recordings a job's uat-slots runs leave, the typed rows the
// runtime derives itself (cmd.run per check, file.edit per patch file, render/video/trace per artifact) and the
// LOG_TYPED_MISSING warning when an op logged nothing of its own.
const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da6360000002000154a24f5d0000000049454e44ae426082', 'hex');
const json = (v) => JSON.stringify(v ?? null);
const tmp = (t, prefix = 'starci-subkind-') => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };
const write = (root, rel, body) => { const abs = path.join(root, rel); fs.mkdirSync(path.dirname(abs), { recursive: true }); fs.writeFileSync(abs, body); return abs; };
const git = (cwd, ...args) => { const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true }); assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };

test('subkind rules: name conventions, op ids and paths; unknown stays null', () => {
  const sk = (kind, p, opId = null, origin = null) => subkindOf({ kind, path: p, opId, origin });
  assert.equal(sk('patch', '.starciwork/kernel-evidence/w/jobs/j/j.patch'), 'patch');
  assert.equal(sk('file', '.starciwork/kernel-evidence/w/jobs/j/j.patch.json'), 'patch-json');
  assert.equal(sk('diff', '.starciwork/features/f/impl/x/E/attempt-1/a.diff'), 'diff');
  assert.equal(sk('trace', '.starciwork/kernel-evidence/w/jobs/j/files/ab-trace.zip'), 'playwright-trace');
  assert.equal(sk('file', '.starciwork/features/f/ui/s/assets/directions/draw-loop/X--a/round-2/critique.json'), 'critique');
  assert.equal(sk('file', '.starciwork/features/f/ui/s/assets/directions/draw-loop/X--a/round-2/metrics.json'), 'metrics');
  assert.equal(sk('file', '.starciwork/features/f/ui/s/assets/directions/draw-loop/X--a/round-2/X--1440x900.score.json'), 'metrics');
  assert.equal(sk('file', '.starciwork/features/f/ui/s/assets/directions/draw-loop/X--a/round-2/source.html'), 'draw-render', 'every other file of a draw-loop round is the render');
  assert.equal(sk('image', '.starciwork/features/f/ui/s/assets/directions/draw-loop/X--a/round-2/X--1440x900--light.png'), 'draw-render');
  assert.equal(sk('file', '.starciwork/features/f/ui/s/grammar-proposal.yaml'), 'grammar-proposal');
  assert.equal(sk('file', '.starciwork/features/f/ui/s/asset-request.md'), 'asset-request');
  assert.equal(sk('image', '.starciwork/features/f/ui/s/assets/directions/token-20260927/x.png'), 'draw-render', 'a token-render directory');
  assert.equal(sk('image', '.starciwork/features/f/ui/s/assets/hero.png', 'interface.asset'), 'asset-gen');
  assert.equal(sk('image', '.starciwork/features/login/uat/pw/runs/run-1/screens/a.png', 'scope.define'), 'uat-capture', 'a UAT record path whatever the op');
  assert.equal(sk('image', '.starciwork/evidence/wf-a.e2e/renders/a.png', 'e2e.verify'), 'e2e-capture');
  assert.equal(sk('image', '.starciwork/features/f/impl/fe/view/E/screens/a-1440.png', 'interface.draw'), 'app-capture', 'a served-render capture under an impl record');
  assert.equal(sk('image', '.starciwork/features/f/operations/audit/E/live/a.png', 'work.author'), 'app-capture');
  assert.equal(sk('image', '.starciwork/kernel-evidence/w/interface-audit/E/calibration/a.png', 'interface.audit'), 'app-capture', 'an audit capture directory');
  assert.equal(sk('image', '.starciwork/features/f/impl/be/evidence/r1/coverage/lcov-report/sort.png', 'backend.implement'), null, 'a coverage report icon is no capture');
  assert.equal(sk('image', '.starciwork/features/f/impl/fe/view/assets/a.png', 'interface.implement'), null, 'an unproven asset stays null');
  assert.equal(sk('image', '.starciwork/brand/assets/mascot/a.png', 'brand.decide'), null);
  assert.equal(sk('video', '.starciwork/features/login/uat/pw/runs/run-1/videos/a.webm', 'uat.verify'), 'uat-video');
  assert.equal(sk('video', '.starciwork/kernel-evidence/w/jobs/j/files/ab-video.webm', 'e2e.verify', 'C:/tmp/starci-uat-recordings/j/playwright-x/video.webm'), 'e2e-video');
  assert.equal(sk('video', '.starciwork/x/a.webm', 'backend.implement'), null);
  assert.equal(sk('report', '.starciwork/kernel-evidence/w/jobs/j/report-3.json'), 'report');
  assert.equal(sk('log', '.starciwork/kernel-evidence/w/jobs/j/log.jsonl'), 'log');
  assert.equal(sk('file', '.starciwork/features/f/index.yaml'), null);
  assert.equal(subkindOfTool('draw-render'), 'draw-render');
  assert.equal(subkindOfTool('image_gen.imagegen'), 'asset-gen');
  assert.equal(subkindOfTool('photoshop'), null);
  for (const [kind, p, op] of [['image', 'a/b.png', 'interface.asset'], ['trace', 'x/trace.zip', null], ['report', 'r.json', null]]) assert.ok(JOB_ARTIFACT_SUBKINDS.includes(subkindOf({ kind, path: p, opId: op })));
});

test('manifests decide a drawing: index.yaml generation.tool, draws.yaml provenance.tool, a draw-render record beside the PNG', (t) => {
  const repo = tmp(t);
  clearManifestCache();
  const ui = '.starciwork/features/f/ui/s';
  write(repo, `${ui}/index.yaml`, [
    'schema: work/ui-screen@1', 'assets:',
    '  - path: assets/directions/home--page--desktop--light.png', '    generation:', '      tool: draw-render', '      promptPath: assets/directions/home.prompt.txt',
    '  - path: assets/old.png', '    generation:', '      tool: image_gen.imagegen', '      promptPath: assets/old.prompt.txt', ''].join('\n'));
  write(repo, `${ui}/evidence/round-3/draws.yaml`, ['schema: starci/ui-draws@1', 'draws:', '  - id: d1', '    part:', '      path: assets/directions/palette.content.png',
    '    prompt:', '      path: assets/directions/palette.prompt.txt', '    provenance:', '      tool: image_gen.imagegen', ''].join('\n'));
  write(repo, `${ui}/evidence/r/cap.png`, PNG);
  write(repo, `${ui}/evidence/r/cap.json`, json({ schema: 'starci/draw-render@1', ok: true }));
  assert.equal(manifestToolOf(repo, `${ui}/assets/directions/home--page--desktop--light.png`), 'draw-render');
  assert.equal(subkindOf({ kind: 'image', path: `${ui}/assets/directions/home--page--desktop--light.png`, opId: 'interface.draw', repo }), 'draw-render');
  assert.equal(subkindOf({ kind: 'file', path: `${ui}/assets/directions/home.prompt.txt`, opId: 'interface.draw', repo }), 'draw-render', 'the prompt of a render');
  assert.equal(subkindOf({ kind: 'image', path: `${ui}/assets/old.png`, opId: 'interface.draw', repo }), 'asset-gen');
  assert.equal(subkindOf({ kind: 'file', path: `${ui}/assets/old.prompt.txt`, opId: 'interface.draw', repo }), 'asset-gen');
  assert.equal(subkindOf({ kind: 'image', path: `${ui}/assets/directions/palette.content.png`, opId: 'interface.draw', repo }), 'asset-gen', 'a draws.yaml elsewhere in the record names it');
  assert.equal(subkindOf({ kind: 'image', path: `${ui}/evidence/r/cap.png`, opId: 'interface.draw', repo }), 'draw-render', 'a starci/draw-render@1 record beside it');
  assert.equal(subkindOf({ kind: 'image', path: `${ui}/assets/unnamed.png`, opId: 'interface.draw', repo }), null, 'nothing names it: null');
});

test('migration: an existing ledger gains job_artifacts.subkind once, nothing else changes', (t) => {
  const repo = tmp(t);
  const file = ledgerFileFor(repo);
  let ledger = openLedger({ file });
  ledger.ensureWorkflow({ workflowId: 'wf-m' });
  ledger.db.prepare('INSERT INTO job_artifacts(workflow_id,job_id,op_id,attempt,kind,path,sha256,bytes,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run('wf-m', 'op-a-1', 'e2e.verify', 1, 'trace', 'x/trace.zip', 'a'.repeat(64), 3, 1);
  // A ledger made before the column: drop it, as an old file lacks it.
  ledger.db.exec('ALTER TABLE job_artifacts DROP COLUMN subkind');
  assert.equal(hasLedgerColumn(ledger.db, 'job_artifacts', 'subkind'), false);
  ledger.close();
  const old = inspectLedger({ file });
  assert.deepEqual(listJobArtifacts(old.db, { workflowId: 'wf-m' }).jobs[0].artifacts[0].subkind, null, 'a read-only handle on an old ledger reads null');
  assert.equal(listJobArtifacts(old.db, { workflowId: 'wf-m', subkind: 'playwright-trace' }).total, 0);
  old.close();
  ledger = openLedger({ file });
  assert.ok(ADDITIVE_COLUMNS.some(([table, column]) => table === 'job_artifacts' && column === 'subkind'));
  assert.equal(hasLedgerColumn(ledger.db, 'job_artifacts', 'subkind'), true);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM job_artifacts').get().n, 1, 'rows kept');
  ledger.close();
  openLedger({ file }).close();
  const ro = inspectLedger({ file });
  try { assert.throws(() => listJobArtifacts(ro.db, { workflowId: 'wf-m', subkind: 'nope' }), /artifact subkind must be/); } finally { ro.close(); }
});

test('backfill: dry-run writes nothing, apply derives every row, a second apply changes nothing, a stored value is never cleared', (t) => {
  const repo = tmp(t);
  const file = ledgerFileFor(repo);
  const ledger = openLedger({ file });
  ledger.ensureWorkflow({ workflowId: 'wf-b' });
  const add = (job, op, kind, p, subkind = null) => ledger.db.prepare('INSERT INTO job_artifacts(workflow_id,job_id,op_id,attempt,kind,path,sha256,bytes,created_at,subkind) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run('wf-b', job, op, 1, kind, p, 'b'.repeat(64), 1, 1, subkind);
  add('op-u-1', 'uat.verify', 'video', '.starciwork/features/f/uat/r/runs/run-1/videos/a.webm');
  add('op-u-1', 'uat.verify', 'image', '.starciwork/features/f/uat/r/runs/run-1/screens/a.png');
  add('op-u-1', 'uat.verify', 'patch', '.starciwork/kernel-evidence/wf-b/jobs/op-u-1/op-u-1.patch');
  add('op-u-1', 'uat.verify', 'file', '.starciwork/features/f/index.yaml');
  add('op-d-1', 'interface.draw', 'image', '.starciwork/features/f/ui/s/assets/kept.png', 'draw-render');
  ledger.close();
  const dry = backfillArtifactSubkind({ repo, apply: false });
  assert.equal(dry.mode, 'dry-run');
  assert.equal(dry.counts.changed, 3);
  assert.deepEqual(dry.byKindSubkind.video, { 'uat-video': 1 });
  const peek = inspectLedger({ file });
  assert.equal(peek.db.prepare('SELECT count(*) n FROM job_artifacts WHERE subkind IS NOT NULL').get().n, 1, 'the dry run wrote nothing');
  peek.close();
  const first = backfillArtifactSubkind({ repo, apply: true });
  assert.equal(first.counts.changed, 3);
  assert.equal(first.counts.unknown, 1, 'index.yaml is not proven');
  const second = backfillArtifactSubkind({ repo, apply: true });
  assert.equal(second.counts.changed, 0, 'idempotent');
  const after = inspectLedger({ file });
  const rows = Object.fromEntries(after.db.prepare('SELECT path, subkind FROM job_artifacts').all().map((r) => [r.path.split('/').pop(), r.subkind]));
  after.close();
  assert.deepEqual(rows, { 'a.webm': 'uat-video', 'a.png': 'uat-capture', 'op-u-1.patch': 'patch', 'index.yaml': null, 'kept.png': 'draw-render' });
});

test('a job\'s Playwright recordings (uat-slots default folder) are its proof: collected, video/trace with their subkinds', (t) => {
  const repo = tmp(t);
  const rec = tmp(t, 'starci-recordings-');
  const env = { [RECORDINGS_ROOT_ENV]: rec, STARCI_OP_JOB: 'op-e2e.verify-1' };
  assert.equal(defaultRecordRoot(env), recordingsRootOf('op-e2e.verify-1', env));
  assert.equal(defaultRecordRoot({ [RECORDINGS_ROOT_ENV]: rec }), rec, 'no op: the shared root');
  const saved = process.env[RECORDINGS_ROOT_ENV];
  process.env[RECORDINGS_ROOT_ENV] = rec;
  t.after(() => { if (saved === undefined) delete process.env[RECORDINGS_ROOT_ENV]; else process.env[RECORDINGS_ROOT_ENV] = saved; });
  const run = path.join(recordingsRootOf('op-e2e.verify-1'), 'playwright-2026-09-27-101500-42', 'login-chromium');
  write(run, 'video.webm', 'webm');
  write(run, 'trace.zip', 'zip');
  write(run, 'test-finished-1.png', PNG);
  write(run, 'stdout.js', 'source never counts');
  const { files } = collectJobFiles({ repo, jobId: 'op-e2e.verify-1' });
  const names = files.map((f) => path.basename(f.abs)).sort();
  assert.deepEqual(names, ['test-finished-1.png', 'trace.zip', 'video.webm']);
  assert.equal(collectJobFiles({ repo }).files.length, 0, 'without the job id nothing is read');
  const origin = (n) => files.find((f) => path.basename(f.abs) === n).abs;
  assert.equal(subkindOf({ kind: 'video', path: '.starciwork/kernel-evidence/w/jobs/op-e2e.verify-1/files/ab-video.webm', opId: 'e2e.verify', origin: origin('video.webm') }), 'e2e-video');
  assert.equal(subkindOf({ kind: 'trace', path: '.starciwork/kernel-evidence/w/jobs/op-e2e.verify-1/files/ab-trace.zip', opId: 'e2e.verify', origin: origin('trace.zip') }), 'playwright-trace');
});

test('runtime-derived rows: a cmd.run per recorded check, a file.edit per patch file, render/video/trace per artifact - all valid, deduped by src', () => {
  const ev = (seq, kind, payload) => ({ seq, kind, entity_type: 'job', entity_id: 'op-x-1', workflow_id: 'wf-r', created_at: 9000 + seq, payload_json: JSON.stringify(payload) });
  const ctx = {
    ledgerKey: 'k',
    jobOf: () => ({ op_id: 'e2e.verify', attempt: 1, result_json: null }),
    checksOf: () => [{ name: 'e2e', command: 'npx playwright test', exitCode: 1, evidence: '.starciwork/evidence/wf-r.e2e/run.log', durationMs: 41200 }, { name: 'lint', exitCode: 0 }],
    artifactOf: (job, p) => ({ 'a.png': { kind: 'image', subkind: 'e2e-capture', label: 'home@desktop', bytes: 70, mime: 'image/png' }, 'v.webm': { kind: 'video', subkind: 'e2e-video', bytes: 4 }, 't.zip': { kind: 'trace', subkind: 'playwright-trace', bytes: 3 }, 'r.json': { kind: 'report' } })[p.split('/').pop()] ?? null,
    patchJsonOf: () => ({ files: [{ path: 'src/a.ts', status: 'M', added: 3, removed: 1 }, { path: 'src/new.ts', status: 'A', added: 10, removed: 0 }] }),
  };
  const checks = rowsOfEvent(ev(1, 'checks-recorded', { op: 'e2e.verify', attempt: 1 }), ctx);
  const cmds = checks.filter((r) => r.kind === 'cmd.run');
  assert.equal(cmds.length, 1, 'a check without a command has no cmd.run');
  assert.deepEqual([cmds[0].actor, cmds[0].data.cmd, cmds[0].data.exit, cmds[0].data.durationMs, cmds[0].data.evidenceRef, cmds[0].data.checkName], ['check', 'npx playwright test', 1, 41200, '.starciwork/evidence/wf-r.e2e/run.log', 'e2e']);
  assert.deepEqual(cmds[0].refs, ['.starciwork/evidence/wf-r.e2e/run.log']);
  const indexed = rowsOfEvent(ev(2, 'artifacts-indexed', { jobId: 'op-x-1', patch: { path: '.starciwork/kernel-evidence/wf-r/jobs/op-x-1/op-x-1.patch' },
    artifacts: [{ path: 'e/a.png', sha256: 'a' }, { path: 'e/v.webm', sha256: 'b' }, { path: 'e/t.zip', sha256: 'c' }, { path: 'e/r.json', sha256: 'd' }] }), ctx);
  assert.deepEqual(indexed.map((r) => r.kind), ['file.edit', 'file.edit', 'render', 'video', 'trace']);
  const edit = indexed[0];
  assert.deepEqual([edit.data.path, edit.data.added, edit.data.removed, edit.data.status, edit.data.diffRef], ['src/a.ts', 3, 1, 'M', '.starciwork/kernel-evidence/wf-r/jobs/op-x-1/op-x-1.patch.json#src/a.ts']);
  assert.deepEqual([indexed[2].data.subkind, indexed[2].data.label, indexed[2].refs[0]], ['e2e-capture', 'home@desktop', 'e/a.png']);
  for (const row of [...checks, ...indexed]) assert.equal(prepareLogRow(row).error, undefined, `${row.kind} is valid`);
  const again = rowsOfEvent(ev(7, 'artifacts-indexed', { jobId: 'op-x-1', patch: { path: '.starciwork/kernel-evidence/wf-r/jobs/op-x-1/op-x-1.patch' }, artifacts: [{ path: 'e/a.png', sha256: 'a' }] }), ctx);
  assert.equal(again.find((r) => r.kind === 'render').src, indexed[2].src, 'a re-announced artifact derives the same src: stored once');
  assert.equal(again[0].src, edit.src);
});

test('typedLogGaps: step.start, step.end and a cmd.run per reported check are owed; the op\'s own rows only', (t) => {
  const repo = tmp(t);
  const logs = openLogs(repo);
  try {
  const checks = [{ name: 'unit', command: 'npm test', exitCode: 0 }, { name: 'lint', command: 'npm run lint', exitCode: 0 }];
  const none = typedLogGaps(logs, { jobId: 'op-a-1', checks });
  assert.deepEqual(none.missing, ['step.start', 'step.end', 'cmd.run unit', 'cmd.run lint']);
  appendLog(logs, { workflowId: 'wf', jobId: 'op-a-1', actor: 'runtime', kind: 'cmd.run', msg: 'r', data: { cmd: 'npm test', exit: 0 } });
  assert.equal(typedLogGaps(logs, { jobId: 'op-a-1', checks }).missing.length, 4, 'a runtime row is not the op logging');
  appendLog(logs, { workflowId: 'wf', jobId: 'op-a-1', actor: 'op', kind: 'step.start', msg: 's', data: { name: 'build' } });
  appendLog(logs, { workflowId: 'wf', jobId: 'op-a-1', actor: 'op', kind: 'step.end', msg: 'e', data: { name: 'build', durationMs: 5 } });
  appendLog(logs, { workflowId: 'wf', jobId: 'op-a-1', actor: 'op', kind: 'cmd.run', msg: 'c', data: { cmd: 'npm  test', exit: 0 } });
  assert.deepEqual(typedLogGaps(logs, { jobId: 'op-a-1', checks }).missing, ['cmd.run lint']);
  appendLog(logs, { workflowId: 'wf', jobId: 'op-a-1', actor: 'op', kind: 'cmd.run', msg: 'c', data: { cmd: 'npm run lint', exit: 0 } });
  assert.deepEqual(typedLogGaps(logs, { jobId: 'op-a-1', checks }).missing, []);
  } finally { logs.close(); }
});

// --------------------------------------------------------------------------------- settle, end to end
const checkout = (t) => {
  const dir = tmp(t, 'starci-subkind-settle-');
  const origin = path.join(dir, 'origin.git'), repo = path.join(dir, 'work');
  git(dir, 'init', '--quiet', '--bare', origin);
  git(dir, 'clone', '--quiet', origin, repo);
  git(repo, 'config', 'user.email', 'lane@starci.test'); git(repo, 'config', 'user.name', 'lane'); git(repo, 'config', 'core.autocrlf', 'false');
  git(repo, 'checkout', '--quiet', '-b', 'main');
  write(repo, 'src/a.ts', 'export const a = 1;\n');
  write(repo, '.gitignore', '.starciwork/\n');
  git(repo, 'add', '.'); git(repo, 'commit', '--quiet', '-m', 'init');
  write(repo, 'src/a.ts', 'export const a = 2;\n');
  git(repo, 'add', 'src/a.ts'); git(repo, 'commit', '--quiet', '-m', 'edit');
  return { repo, head: git(repo, 'rev-parse', 'HEAD') };
};
const seedJob = (repo, { jobId, op = 'backend.implement', wf = 'wf-s', report }) => {
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    ledger.ensureWorkflow({ workflowId: wf, title: 'subkind' });
    ledger.enqueueJob({ jobId, workflowId: wf, opId: op, kind: 'op', payload: { opId: op, owned_paths: ['src/'], orca: { dispatchId: `ctx-${jobId}`, agentTerminalHandle: `term-${jobId}` } } });
    ledger.db.prepare('UPDATE jobs SET status=? WHERE job_id=?').run('running', jobId);
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)').run(wf, op, 1, `ctx-${jobId}`, '# contract', json({ worktree: repo }), Date.now());
    ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(wf, `ctx-${jobId}`, op, 1, 0, 'done', json({ outcome: 'done', summary: 'subkind', ...report }), null, Date.now());
    ledger.db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)').run(wf, op, 1, json({ checks: report.checks }), Date.now());
  } finally { ledger.close(); }
};
const api = (...args) => { const r = spawnSync(process.execPath, [API, ...args, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 180000, env: { ...process.env, STARCI_ROLE: '', STARCI_OP_JOB: '' } }); let body = null; try { body = JSON.parse(r.stdout); } catch { body = null; } return { r, body }; };

test('settle: rows carry their subkind, the patch json is indexed, the timeline gets runtime rows, and an op that logged nothing gets LOG_TYPED_MISSING (warn, not a refusal)', (t) => {
  const { repo, head } = checkout(t);
  write(repo, '.starciwork/features/f/impl/fe/view/E/screens/home--desktop.png', PNG);
  write(repo, '.starciwork/features/f/impl/fe/view/E/run.log', 'ok\n');
  const checks = [{ name: 'unit', command: 'npm test', exitCode: 0, evidence: 'green' }];
  seedJob(repo, { jobId: 'op-quiet-1', report: { head, branch: 'main', files: ['.starciwork/features/f/impl/fe/view/E/screens/home--desktop.png', 'src/a.ts'], checks } });
  const { r, body } = api('settle', '--repo', repo, '--job', 'op-quiet-1', '--verdict', 'pass');
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.equal(body.verdict, 'pass', 'a warning never refuses');
  assert.equal(body.artifacts.logs.typedMissing.code, LOG_TYPED_MISSING);
  assert.deepEqual(body.artifacts.logs.typedMissing.missing, ['step.start', 'step.end', 'cmd.run unit']);
  const ledger = inspectLedger({ file: ledgerFileFor(repo) });
  const rows = Object.fromEntries(ledger.db.prepare('SELECT path, kind, subkind FROM job_artifacts WHERE job_id=?').all('op-quiet-1').map((row) => [row.path.split('/').pop(), [row.kind, row.subkind]]));
  const warned = ledger.db.prepare("SELECT payload_json FROM events WHERE kind='log-typed-missing' AND entity_id=?").all('op-quiet-1');
  ledger.close();
  assert.deepEqual(rows['home--desktop.png'], ['image', 'app-capture']);
  assert.deepEqual(rows['run.log'], ['log', 'log']);
  assert.deepEqual(rows['op-quiet-1.patch'], ['patch', 'patch']);
  assert.deepEqual(rows['op-quiet-1.patch.json'], ['file', 'patch-json']);
  assert.deepEqual(rows['report-1.json'], ['report', 'report']);
  assert.equal(warned.length, 1);
  const logs = openLogs(repo);
  const timeline = readLogs(logs, { workflowId: 'wf-s', jobIds: ['op-quiet-1'] }).rows;
  logs.close();
  const kinds = timeline.map((row) => row.kind);
  assert.ok(kinds.includes('file.edit'), 'the patch file is a file.edit row');
  assert.equal(timeline.find((row) => row.kind === 'file.edit').data.path, 'src/a.ts');
  assert.equal(timeline.find((row) => row.kind === 'render').data.subkind, 'app-capture');
  const warning = timeline.find((row) => row.kind === 'warning');
  assert.deepEqual([warning.actor, warning.level, warning.data.code], ['runtime', 'warn', LOG_TYPED_MISSING]);
  const status = api('status', '--repo', repo, '--workflow', 'wf-s');
  assert.equal(status.r.status, 0, status.r.stderr);
  assert.deepEqual(status.body.logTypedMissing.map((w) => [w.jobId, w.code]), [['op-quiet-1', LOG_TYPED_MISSING]]);
  const listed = api('artifacts', '--repo', repo, '--workflow', 'wf-s', '--subkind', 'app-capture');
  assert.equal(listed.r.status, 0, listed.r.stderr);
  assert.equal(listed.body.total, 1);
});

test('settle: an op that logged its steps and its check command owes nothing', (t) => {
  const { repo, head } = checkout(t);
  const checks = [{ name: 'unit', command: 'npm test', exitCode: 0 }];
  seedJob(repo, { jobId: 'op-loud-1', report: { head, branch: 'main', files: ['src/a.ts'], checks } });
  const sidecar = path.join(repo, '.starciwork', 'kernel-evidence', 'wf-s', 'jobs', 'op-loud-1', 'log.jsonl');
  write(repo, path.relative(repo, sidecar), [
    { kind: 'step.start', msg: 'Bắt đầu', data: { name: 'implement' } },
    { kind: 'cmd.run', msg: 'Chạy test', data: { cmd: 'npm test', exit: 0, durationMs: 1200 } },
    { kind: 'step.end', msg: 'Xong', data: { name: 'implement', durationMs: 5000, ok: true } },
  ].map((row) => JSON.stringify(row)).join('\n') + '\n');
  const { r, body } = api('settle', '--repo', repo, '--job', 'op-loud-1', '--verdict', 'pass');
  assert.equal(r.status, 0, r.stderr || r.stdout);
  assert.equal(body.artifacts.logs.typedMissing, undefined);
  assert.equal(body.artifacts.logs.sidecar.inserted, 3);
  const status = api('status', '--repo', repo, '--workflow', 'wf-s');
  assert.equal(status.body.logTypedMissing, undefined);
});

test('the typed-log rules reach every new dispatch and every kernel boot', async () => {
  const { buildOpPrompt } = await import('../scripts/kernel/op-prompt.mjs');
  const packet = { op: 'backend.implement', brief: 'modules/ops/ops/backend.implement.yaml', context: { records: [], owned_paths: [], attempt: 1, workflow: { id: 'wf-p' } }, constraints: { model: 'm' } };
  const prompt = buildOpPrompt({ skillRoot: ROOT, packet, jobId: 'op-p-1', repo: 'D:/r/p' });
  assert.match(prompt, /^logging: the owner reads your work as TYPED LOG ROWS/m);
  assert.match(prompt, /step\.start and a step\.end around each step/);
  assert.match(prompt, /LOG_TYPED_MISSING/);
  assert.match(prompt, /kernel-evidence[\\/]wf-p[\\/]jobs[\\/]op-p-1[\\/]log\.jsonl/, 'the op is told its own sidecar path');
  const api = fs.readFileSync(API, 'utf8');
  assert.match(api, /const prompt = buildOpPrompt\(\{ skillRoot, packet, jobId, repo/, 'api dispatch renders the op prompt with the logging block');
  const kernelPrompt = fs.readFileSync(path.join(ROOT, 'modules', 'kernel', 'kernel-prompt.md'), 'utf8');
  assert.match(kernelPrompt, /Log typed rows, not prose/);
  assert.match(kernelPrompt, /\[boundary\.typedLogs\]/);
  assert.match(fs.readFileSync(path.join(ROOT, 'modules', 'kernel', 'driver-loop.yaml'), 'utf8'), /^\s+typedLogs: >-/m);
  assert.match(fs.readFileSync(path.join(ROOT, 'scripts', 'kernel', 'start-workflow.mjs'), 'utf8'), /readFileSync\(path\.join\(skillRoot, 'modules', 'kernel', 'kernel-prompt\.md'\)/, 'every kernel boot reads kernel-prompt.md');
});
