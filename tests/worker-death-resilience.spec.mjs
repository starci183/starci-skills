// Dead workers and settle debris (op-decide-reliability lane, 2026-09-28):
//   host-event.mjs      a death inside a host-wide terminal disconnect is the environment's
//   report-salvage.mjs  a report written but never filed is filed on the worker's behalf
//   resume-context.mjs  the retry of a no-report death resumes from what it left
//   op-prompt.mjs       a long owned-path list rides in a file, never the task-create argv
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { HOST_EVENT_MIN_WORKFLOWS, HOST_EVENT_WINDOW_MS, hostWideDisconnectOf } from '../scripts/kernel/host-event.mjs';
import { salvageUnfiledReport, unfiledReportCandidates } from '../scripts/kernel/report-salvage.mjs';
import { resumeContextOf, resumePromptLines } from '../scripts/kernel/resume-context.mjs';
import { ownedPathEffects } from '../scripts/kernel/settle-landed.mjs';
import { OWNED_INLINE_MAX, ownedPathsFileOf, ownedPathsLine } from '../scripts/kernel/op-prompt.mjs';
import { withLedger,seedWorkflow } from './_ledger-fixture.mjs';

const tmp = (t, prefix) => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 })); return dir; };
const git = (repo, ...args) => {
  const r = spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', windowsHide: true,
    env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const write = (root, rel, text, mtimeMs = null) => {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
  if (mtimeMs != null) fs.utimesSync(abs, new Date(mtimeMs), new Date(mtimeMs));
  return abs;
};

test('host-wide disconnect: Kernels of 3+ workflows cleared disconnected in the window; one Kernel alone, or old clears, are not', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE events(workflow_id TEXT, kind TEXT, payload_json TEXT, created_at INTEGER)');
  const now = Date.parse('2026-09-27T13:27:30Z');
  const clear = (wf, at, reason = 'terminal disconnected') => db.prepare('INSERT INTO events VALUES(?,?,?,?)').run(wf, 'kernel-stale-cleared', JSON.stringify({ reason }), at);
  clear('wf-a', now - 7 * 60_000);
  assert.equal(hostWideDisconnectOf(db, now), null, 'one Kernel is that Kernel');
  clear('wf-b', now - 5 * 60_000, 'terminal_handle_stale');
  clear('wf-old', now - HOST_EVENT_WINDOW_MS - 60_000);
  clear('wf-quiet', now - 60_000, 'kernel quiet 45m');
  assert.equal(hostWideDisconnectOf(db, now), null, `below ${HOST_EVENT_MIN_WORKFLOWS}`);
  clear('wf-c', now - 2 * 60_000, 'terminal disconnected (exited)');
  assert.deepEqual(hostWideDisconnectOf(db, now).sort(), ['wf-a', 'wf-b', 'wf-c']);
});

test('salvage: the newest op-report@1 written since dispatch and stamped for this job is filed first; another job\'s or an older one never', (t) => {
  const root = tmp(t, 'starci-salvage-');
  const since = Date.now() - 60_000;
  const report = (outcome, extra = {}) => JSON.stringify({ schema: 'starci/op-report@1', outcome, summary: 's', ...extra });
  write(root, 'fr/a/report.json', report('done'), since - 3_600_000);                         // before dispatch
  write(root, 'fr/a/report.op-other-1.json', report('done'), since + 1_000);                   // another job's
  write(root, 'fr/b/report.json', report('blocked', { from: 'op-other-2' }), since + 2_000);    // stamped for another
  write(root, 'fr/c/report.json', '{not json', since + 3_000);
  const mine = write(root, 'fr/d/report.op-me-1.json', report('partial'), since + 4_000);
  const plain = write(root, 'fr/e/evidence/report.json', report('done'), since + 5_000);
  const found = unfiledReportCandidates({ scratch: root, sinceMs: since, jobId: 'op-me-1', dispatchId: 'ctx_1' });
  assert.deepEqual(found.map((c) => c.file), [plain, mine]);
  const filed = [];
  const out = salvageUnfiledReport({ candidates: found, fileReport: (file) => { filed.push(file); return file === mine ? { ok: true } : { ok: false, error: 'report-invalid' }; } });
  assert.deepEqual(filed, [plain, mine]);
  assert.equal(out.salvaged.file, mine);
  assert.equal(out.salvaged.outcome, 'partial');
  assert.equal(out.tried[0].ok, false);
});

test('resume context: a retry of a failed-no-report attempt carries its evidence and op log tail; any other retry carries nothing', t => withLedger(t,({ledger})=>{
  seedWorkflow(ledger,{id:'wf',jobs:[
    {jobId:'op-x-9',opId:'x',status:'failed',result:{reason:'failed-no-report',effectState:'partial',environment:'host-terminal-wipe',
      worker:{liveness:'disconnected'},evidence:['dirty:.starciwork/features/collab/impl/x/evidence/build.txt','commit:abc123']}},
    {jobId:'op-x-8',opId:'x',status:'failed',result:{verdict:'fail',reason:'routed'}},
  ]});
  const db=ledger.db;
  db.prepare('INSERT INTO logs(at,workflow_id,job_id,actor,level,kind,msg) VALUES(?,?,?,?,?,?,?)').run(Date.now(),'wf','op-x-9','op','info','step.end','build green');
  db.prepare('INSERT INTO logs(at,workflow_id,job_id,actor,level,kind,msg) VALUES(?,?,?,?,?,?,?)').run(Date.now(),'wf','op-x-9','runtime','error','error','died');
  const retry = { retry_of:'op-x-9',payload_json:'{}' };
  const resume = resumeContextOf(db, retry);
  assert.equal(resume.of, 'op-x-9');
  assert.equal(resume.environment, 'host-terminal-wipe');
  assert.deepEqual(resume.log, [{ kind: 'step.end', msg: 'build green' }]);
  const lines = resumePromptLines(resume).join('\n');
  assert.match(lines, /resume_from: attempt 1/);
  assert.match(lines, /commit:abc123/);
  assert.equal(resumeContextOf(db, { retry_of:'op-x-8',payload_json:'{}' }), null);
  assert.equal(resumeContextOf(db, { payload_json: '{}' }), null);
  assert.deepEqual(resumePromptLines(null), []);
}));

test('a long owned-path list is written to owned-paths.txt and the prompt names the file, never the 993 paths', (t) => {
  const repo = tmp(t, 'starci-owned-');
  const scratchDir = path.join(repo, 'job-scratch');
  const short = ['.starciwork/features/a/fr/x', 'src/a.ts'];
  assert.equal(ownedPathsLine({ paths: short, repo, workflowId: 'wf', jobId: 'op-1', scratchDir }), `owned_paths: ${short.join(', ')}`);
  const many = Array.from({ length: 993 }, (_, i) => `.starciwork/features/workspace-provision/operations/debt-${i}/evidence/file-${i}.json`);
  assert.ok(many.length > OWNED_INLINE_MAX);
  const line = ownedPathsLine({ paths: many, repo, workflowId: 'wf', jobId: 'op-1', scratchDir });
  assert.ok(line.length < 3000, `line is ${line.length} chars`);
  const file = ownedPathsFileOf(repo, 'wf', 'op-1', scratchDir);
  assert.ok(line.includes(file));
  assert.deepEqual(fs.readFileSync(file, 'utf8').trim().split('\n'), many);
  assert.match(ownedPathsLine({ paths: many }), /993 paths/);
  assert.equal(ownedPathsLine({ paths: [] }), 'owned_paths: (per brief write-ceiling)');
});

test('watchdog: three wake misses on one terminal over 10+ minutes with no output since prove a dead kernel; output resets the count', async () => {
  const { WAKE_FAIL_REPLACE, WAKE_FAIL_WINDOW_MS, wakeFailuresProveDead } = await import('../scripts/kernel/watchdog.mjs');
  const now = Date.parse('2026-09-28T11:20:00Z');
  const at = (min) => now - min * 60_000;
  assert.equal(WAKE_FAIL_REPLACE, 3);
  assert.equal(wakeFailuresProveDead([at(12), at(6)], { now }).dead, false, 'two misses');
  assert.equal(wakeFailuresProveDead([at(4), at(2), at(1)], { now }).dead, false, 'inside the window');
  assert.deepEqual(wakeFailuresProveDead([at(15), at(9), at(3)], { now }), { dead: true, misses: 3, firstAt: at(15) });
  assert.equal(wakeFailuresProveDead([at(15), at(9), at(3)], { now, lastOutputAt: at(10) }).dead, false, 'output after the first miss');
  assert.ok(WAKE_FAIL_WINDOW_MS >= 10 * 60_000);
});
