// Dead workers and settle debris (op-decide-reliability lane, 2026-09-28):
//   host-event.mjs      a death inside a host-wide terminal disconnect is the environment's
//   report-salvage.mjs  a report written but never filed is filed on the worker's behalf
//   resume-context.mjs  the retry of a no-report death resumes from what it left
//   settle-landed.mjs   debris older than the job's admission is neither its effect nor its unlanded write
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
import { landedProof, ownedPathEffects } from '../scripts/kernel/settle-landed.mjs';
import { OWNED_INLINE_MAX, ownedPathsFileOf, ownedPathsLine } from '../scripts/kernel/op-prompt.mjs';

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
  const plain = write(root, 'fr/e/E/report.json', report('done'), since + 5_000);
  const found = unfiledReportCandidates({ scratch: root, sinceMs: since, jobId: 'op-me-1', dispatchId: 'ctx_1' });
  assert.deepEqual(found.map((c) => c.file), [plain, mine]);
  const filed = [];
  const out = salvageUnfiledReport({ candidates: found, fileReport: (file) => { filed.push(file); return file === mine ? { ok: true } : { ok: false, error: 'report-invalid' }; } });
  assert.deepEqual(filed, [plain, mine]);
  assert.equal(out.salvaged.file, mine);
  assert.equal(out.salvaged.outcome, 'partial');
  assert.equal(out.tried[0].ok, false);
});

test('resume context: a retry of a failed-no-report attempt carries its evidence and op log tail; any other retry carries nothing', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE jobs(job_id TEXT, attempt INTEGER, result_json TEXT, workflow_id TEXT, payload_json TEXT);
    CREATE TABLE logs(seq INTEGER PRIMARY KEY AUTOINCREMENT, workflow_id TEXT, job_id TEXT, actor TEXT, kind TEXT, msg TEXT)`);
  db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?)').run('op-x-9', 9, JSON.stringify({ reason: 'failed-no-report', effectState: 'partial', environment: 'host-terminal-wipe',
    worker: { liveness: 'disconnected' }, evidence: ['dirty:.starciwork/features/collab/impl/x/E/build.txt', 'commit:abc123'] }), 'wf', '{}');
  db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?)').run('op-x-8', 8, JSON.stringify({ verdict: 'fail', reason: 'routed' }), 'wf', '{}');
  db.prepare('INSERT INTO logs(workflow_id,job_id,actor,kind,msg) VALUES(?,?,?,?,?)').run('wf', 'op-x-9', 'op', 'step.end', 'build green');
  db.prepare('INSERT INTO logs(workflow_id,job_id,actor,kind,msg) VALUES(?,?,?,?,?)').run('wf', 'op-x-9', 'runtime', 'error', 'died');
  const retry = { payload_json: JSON.stringify({ retry: { retryOf: 'op-x-9' } }) };
  const resume = resumeContextOf(db, retry);
  assert.equal(resume.of, 'op-x-9');
  assert.equal(resume.environment, 'host-terminal-wipe');
  assert.deepEqual(resume.log, [{ kind: 'step.end', msg: 'build green' }]);
  const lines = resumePromptLines(resume).join('\n');
  assert.match(lines, /resume_from: attempt 9/);
  assert.match(lines, /commit:abc123/);
  assert.equal(resumeContextOf(db, { payload_json: JSON.stringify({ retry: { retryOf: 'op-x-8' } }) }), null);
  assert.equal(resumeContextOf(db, { payload_json: '{}' }), null);
  assert.deepEqual(resumePromptLines(null), []);
});

test('settle debris: a file written before admission and not in the report never makes the job not-landed; its own file still does', (t) => {
  const repo = tmp(t, 'starci-debris-');
  git(repo, 'init', '-q', '-b', 'main');
  write(repo, 'README.md', 'x');
  git(repo, 'add', '-A'); git(repo, 'commit', '-q', '-m', 'init');
  const admitted = Date.now() - 60_000;
  write(repo, '.starciwork/features/wp/impl/E/manifest.yaml', 'old', admitted - 3_600_000);    // predecessor debris
  const base = { base: repo, ownedPaths: ['.starciwork/features/wp'], pushes: false, head: null };
  const clean = landedProof({ ...base, debris: { sinceMs: admitted, own: [] } });
  assert.equal(clean.ok, true, JSON.stringify(clean.detail));
  assert.equal(clean.detail.debrisCount, 1);
  assert.equal(landedProof(base).ok, false, 'without the debris rule the old refusal stands');
  const named = landedProof({ ...base, debris: { sinceMs: admitted, own: [path.join(repo, '.starciwork/features/wp/impl/E/manifest.yaml')] } });
  assert.equal(named.ok, false, 'a file the report names is the job\'s own');
  write(repo, '.starciwork/features/wp/fr/new/index.yaml', 'mine');                               // written after admission
  const fresh = landedProof({ ...base, debris: { sinceMs: admitted, own: [] } });
  assert.equal(fresh.ok, false);
  assert.deepEqual(fresh.detail.dirty, ['.starciwork/features/wp/fr/new/index.yaml']);
  const effects = ownedPathEffects({ base: repo, ownedPaths: ['.starciwork/features/wp'], sinceMs: admitted });
  assert.deepEqual(effects.dirty, ['.starciwork/features/wp/fr/new/index.yaml']);
  assert.deepEqual(effects.preexisting, ['.starciwork/features/wp/impl/E/manifest.yaml']);
});

test('a long owned-path list is written to owned-paths.txt and the prompt names the file, never the 993 paths', (t) => {
  const repo = tmp(t, 'starci-owned-');
  const short = ['.starciwork/features/a/fr/x', 'src/a.ts'];
  assert.equal(ownedPathsLine({ paths: short, repo, workflowId: 'wf', jobId: 'op-1' }), `owned_paths: ${short.join(', ')}`);
  const many = Array.from({ length: 993 }, (_, i) => `.starciwork/features/workspace-provision/operations/debt-${i}/evidence/file-${i}.json`);
  assert.ok(many.length > OWNED_INLINE_MAX);
  const line = ownedPathsLine({ paths: many, repo, workflowId: 'wf', jobId: 'op-1' });
  assert.ok(line.length < 3000, `line is ${line.length} chars`);
  const file = ownedPathsFileOf(repo, 'wf', 'op-1');
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

test('connector state writes retry a rename Windows refuses EPERM, and give up on anything else', async () => {
  const { renameRetrying } = await import('../scripts/connectors/lib.mjs');
  let calls = 0;
  renameRetrying('a', 'b', { sleep: () => {}, rename: () => { calls += 1; if (calls < 3) throw Object.assign(new Error('busy'), { code: 'EPERM' }); } });
  assert.equal(calls, 3);
  assert.throws(() => renameRetrying('a', 'b', { sleep: () => {}, rename: () => { throw Object.assign(new Error('gone'), { code: 'ENOENT' }); } }), /gone/);
  let tries = 0;
  assert.throws(() => renameRetrying('a', 'b', { attempts: 4, sleep: () => {}, rename: () => { tries += 1; throw Object.assign(new Error('locked'), { code: 'EACCES' }); } }), /locked/);
  assert.equal(tries, 4);
});
