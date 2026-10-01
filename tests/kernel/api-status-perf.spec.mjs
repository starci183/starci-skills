import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { KERNEL_REV_ACKED_EVENT } from '../../scripts/kernel/runtime-rev.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';

// api status took 26-31 s per workflow under load (8 s idle) on the live nivo ledger: nearly all of it process
// starts. runtime-rev.mjs re-resolved the current runtime rev once per running job and re-diffed the same commit
// pair on every call, two typed waits naming the same --until-commit target ran the same git reads twice, and the
// Orca reads of every worker terminal ran one after another. Status now memoises read-only git reads (within the
// call; across calls when every revision is a full commit sha, HEAD pinned to its sha) and runs its Orca reads in
// parallel ahead of the projection - with the same output.
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };
const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const gitInit = (root) => {
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'spec@example.test'); git(root, 'config', 'user.name', 'spec'); git(root, 'config', 'commit.gpgsign', 'false');
};

// Every spawn the api process makes: spawnSync and execFile (status's parallel Orca prefetch), one JSON line each.
const TRACER = `import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import fs from 'node:fs';
for (const fn of ['spawnSync', 'execFile']) {
  const original = cp[fn];
  cp[fn] = function (command, argv, ...rest) {
    fs.appendFileSync(process.env.SPEC_SPAWN_LOG, JSON.stringify({ fn, command: String(command), argv: Array.isArray(argv) ? argv.map(String) : [] }) + '\\n');
    return original.call(this, command, argv, ...rest);
  };
}
syncBuiltinESMExports();
`;

// A runtime root with revisions A and B (the draw brief and the contract registry moved), checked out at B; a
// product repo whose ledger holds a running workflow acked at A with two running draw legs admitted under A, each
// on its own worker terminal; and two owner gates waiting on the same uncommitted path of another repo.
const fixture = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-status-perf-'));
  t.after(() => rm(dir));
  const rt = path.join(dir, 'runtime'); fs.mkdirSync(rt); gitInit(rt);
  write(rt, 'modules/kernel/kernel-prompt.md', 'prompt\n');
  write(rt, 'modules/kernel/driver-loop.yaml', 'loop: 1\n');
  write(rt, 'modules/kernel/contract-changes/seed.yaml', "id: seed\neffectiveAt: '2026-01-01T00:00:00Z'\nsummary: seed\n");
  write(rt, 'modules/ops/ops/interface.draw.yaml', 'id: interface.draw\n');
  write(rt, 'scripts/kernel/op-prompt.mjs', 'export {};\n');
  git(rt, 'add', '-A'); git(rt, 'commit', '-qm', 'A');
  const A = git(rt, 'rev-parse', 'HEAD');
  write(rt, 'modules/ops/ops/interface.draw.yaml', 'id: interface.draw\nnew: rule\n');
  write(rt, 'modules/kernel/contract-changes/draw-new-rule.yaml', "id: draw-new-rule\neffectiveAt: '2026-09-27T20:00:00+07:00'\nsummary: \"The draw brief gained a rule\"\nreach: new-legs\nops: [interface.draw]\n");
  git(rt, 'add', '-A'); git(rt, 'commit', '-qm', 'B');
  const B = git(rt, 'rev-parse', 'HEAD');

  const repo = path.join(dir, 'repo'); fs.mkdirSync(repo); gitInit(repo);
  write(repo, 'README.md', 'product\n'); git(repo, 'add', '-A'); git(repo, 'commit', '-qm', 'init');
  const other = path.join(dir, 'other'); fs.mkdirSync(other); gitInit(other);
  write(other, 'README.md', 'x\n'); git(other, 'add', '-A'); git(other, 'commit', '-qm', 'init');
  write(other, 'app/layout.tsx', 'export {};\n');

  const memo = path.join(dir, 'memo');
  const stub = path.join(dir, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const tracer = path.join(dir, 'tracer.mjs'); fs.writeFileSync(tracer, TRACER);
  const orcaLog = path.join(dir, 'orca.jsonl'), spawnLog = path.join(dir, 'spawns.jsonl'), orcaState = path.join(dir, 'state.json');
  const at = Date.now() - 5 * 60_000;
  fs.writeFileSync(orcaState, JSON.stringify({ terminals: { term_w1: { handle: 'term_w1', lastOutputAt: at }, term_w2: { handle: 'term_w2', lastOutputAt: at } } }));
  const baseEnv = { ...process.env, STARCI_KERNEL_REV_ROOT: rt, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: orcaLog, STARCI_FAKE_ORCA_STATE: orcaState, STARCI_GIT_MEMO_DIR: memo, SPEC_SPAWN_LOG: spawnLog,
    LOCALAPPDATA: path.join(dir,'localappdata'), STARCI_PROJECTS_ROOT: path.join(dir,'projects'), STARCI_TEST_MACHINE_FILE: path.join(dir,'machine.sqlite') };
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB', 'STARCI_STATUS_MEMO']) delete baseEnv[key];
  const wf = 'wf-status-perf';
  const api = (args, env = {}) => spawnSync(process.execPath, ['--import', pathToFileURL(tracer).href, API, ...args, '--repo', repo, '--json'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...baseEnv, ...env } });
  const ok = (args, env) => { const r = api(args, env); assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr || r.stdout}`); return json(r.stdout); };
  const readLog = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(json) : []);
  // One status call: its JSON and the spawns it made (git reads by argv, Orca calls by verb).
  const status = (env) => {
    fs.rmSync(spawnLog, { force: true }); fs.rmSync(orcaLog, { force: true });
    const out = ok(['status', '--workflow', wf], env);
    const spawns = readLog(spawnLog);
    return { out, spawns, git: spawns.filter((s) => /^git(\.exe)?$/i.test(path.basename(s.command))).map((s) => s.argv.join(' ')), orca: readLog(orcaLog) };
  };
  const now = Date.now();
  const ledgerFile=ledgerFileFor(repo,{env:baseEnv});
  const seed = (fn) => { const l = openLedger({ file: ledgerFile }); try { return fn(l); } finally { l.close(); } };
  seed((l) => {
    seedWorkflow(l,{id:wf,state:{phase:'running',job:wf},jobs:[
      {jobId:`kernel-${wf}`,kind:'kernel',status:'running',workerId:'term_k',createdAt:now},
      ...[1,2].map(n=>({jobId:`job-d${n}`,unitId:`unit-d${n}`,opId:'interface.draw',kind:'op',status:'running',
        workerId:`ctx-d${n}`,dispatchId:`ctx-d${n}`,createdAt:now+n,
        payload:{opId:'interface.draw',owned_paths:[`docs/d${n}`],managed:{dispatchId:`ctx-d${n}`,agentTerminalHandle:`term_w${n}`}}}))
    ]});
    l.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)').run(wf, 0, 'goal', '# goal', '{}', now);
    l.transaction(() => l.appendEvent({ workflowId: wf, entityType: 'kernel', entityId: wf, kind: KERNEL_REV_ACKED_EVENT,
      payload: { rev: A, files: [], source: 'ack' }, createdAt: now-31*60_000 }));
    for (const n of [1, 2]) {
      const attemptId=l.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(`job-d${n}`).attempt_id;
      l.write.writeContract({attemptId,markdown:'# contract',context:{contract:{schema:'starci/contract-version@1',op:'interface.draw',runtimeSha:A,admittedAt:now}}});
    }
  });
  const gates = [1, 2].map(() => ok(['incident', '--workflow', wf, '--kind', 'owner-gate', '--op', 'brand.decide', '--until-commit', `${other}:app/layout.tsx`, '--detail', 'FE app router']).incidentId);
  // The ledger as the fixture left it, restorable so each compared status reads the same state.
  const snapshot = path.join(dir, 'snapshot.sqlite');
  { const db = new DatabaseSync(ledgerFile); db.exec(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`); db.close(); }
  const restore = () => {
    for (const suffix of ['-wal', '-shm']) fs.rmSync(`${ledgerFile}${suffix}`, { force: true });
    fs.copyFileSync(snapshot, ledgerFile);
  };
  return { dir, rt, A, B, repo, other, memo, wf, gates, api, ok, status, seed, restore };
};

// The fields a status projection stamps from the clock (the autopilot budget's wallMs among them), from a live terminal's output
// time, or from the host's live RAM sample.
const VOLATILE = new Set(['observedAt', 'outputAgeMs', 'lastOutputAt', 'expires_at', 'expiresAt', 'generatedAt', 'heartbeatAgeMs', 'waitedMinutes', 'weight', 'now', 'at', 'ageMs', 'wallMs', 'ramThrottle']);
const stable = (value) => (Array.isArray(value) ? value.map(stable)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => !VOLATILE.has(key)).map(([key, v]) => [key, stable(v)]))
  : value);
const duplicates = (list) => [...new Set(list.filter((item, index) => list.indexOf(item) !== index))];
const pinnedGitReads = (reads) => reads.filter((argv) => /\b[0-9a-f]{40}\b/.test(argv) && /\b(rev-parse|diff|show)\b/.test(argv));

test('api status runs no git read twice in one call, and a repeat call runs none of its commit-pinned reads', (t) => {
  const fx = fixture(t);
  const cold = fx.status();
  assert.equal(cold.out.kernelRev.stale, true, 'the fixture is a stale Kernel: runtime-rev diffs A..B');
  assert.deepEqual(cold.out.runningOpRevDrift.map((w) => [w.jobId, w.from, w.to, w.files]),
    [['job-d1', fx.A, fx.B, ['modules/ops/ops/interface.draw.yaml']], ['job-d2', fx.A, fx.B, ['modules/ops/ops/interface.draw.yaml']]]);
  // Each cat-file --batch call has a different revision on stdin, which the spawn tracer cannot display.
  assert.deepEqual(duplicates(cold.git.filter((read)=>read!=='cat-file --batch')), [], `one status call repeated these git reads:\n${cold.git.join('\n')}`);
  assert.ok(pinnedGitReads(cold.git).length > 0, 'the cold call reads the commit pair from git');

  const warm = fx.status();
  assert.deepEqual(pinnedGitReads(warm.git), [], `a repeat status re-ran reads whose answer is fixed by commit shas:\n${warm.git.join('\n')}`);
  assert.deepEqual(stable(warm.out), stable(cold.out), 'the memo answers exactly what git answered');

  // Each worker terminal is shown and read once per call, in parallel ahead of the projection (execFile).
  const verbs = warm.orca.map((call) => call.argv.slice(0, 2).join(' ') + (call.argv.includes('--terminal') ? ` ${call.argv[call.argv.indexOf('--terminal') + 1]}` : ''));
  for (const handle of ['term_w1', 'term_w2']) {
    assert.equal(verbs.filter((v) => v === `terminal show ${handle}`).length, 1, verbs.join('\n'));
    assert.equal(verbs.filter((v) => v === `terminal read ${handle}`).length, 1, verbs.join('\n'));
  }
  assert.ok(warm.spawns.filter((s) => s.fn === 'execFile').length >= 4, 'the worker terminal reads ran through the parallel prefetch');
  assert.deepEqual(warm.out.workers.map((w) => [w.jobId, w.terminalHandle, w.connected]), [['job-d1', 'term_w1', true], ['job-d2', 'term_w2', true]]);
});

test('api status output is identical with the memo off, cold and warm', (t) => {
  const fx = fixture(t);
  fx.restore(); const off = fx.status({ STARCI_STATUS_MEMO: 'off' });
  fx.restore(); const cold = fx.status();
  fx.restore(); const warm = fx.status();
  assert.ok(off.git.length > cold.git.length, `the memo saves git reads within one call (${off.git.length} -> ${cold.git.length})`);
  assert.ok(cold.git.length > warm.git.length, `and across calls (${cold.git.length} -> ${warm.git.length})`);
  assert.deepEqual(stable(cold.out), stable(off.out));
  assert.deepEqual(stable(warm.out), stable(off.out));
  assert.deepEqual([off.out.kernelRev.acked, off.out.kernelRev.current, off.out.kernelRev.files], [fx.A, fx.B, ['modules/kernel/contract-changes/draw-new-rule.yaml', 'modules/ops/ops/interface.draw.yaml']]);
  assert.equal(off.out.nextActions[0].kind, 'reread');
});

test('the memo follows HEAD, and a revision git did not know is asked again, never remembered', (t) => {
  const fx = fixture(t);
  const open = fx.status();
  assert.deepEqual(open.out.frontier.gateConditions.map((g) => [g.incidentId, g.met]), fx.gates.map((id) => [id, false]));
  // Committing the awaited path moves the other repo's HEAD: the HEAD-pinned reads are new keys, read live.
  git(fx.other, 'add', '-A'); git(fx.other, 'commit', '-qm', 'app');
  fx.status();
  const states = fx.seed((l) => fx.gates.map((id) => l.db.prepare('SELECT status FROM incidents WHERE incident_id=?').get(id).status));
  assert.deepEqual(states, ['resolved', 'resolved'], 'the commit released both gates through a warm memo');

  // An acked rev the runtime root does not have yet reads unknown; once it lands, status diffs it.
  const clone = path.join(fx.dir, 'clone');
  git(fx.dir, 'clone', '-q', fx.rt, clone);
  git(clone, 'config', 'user.email', 'spec@example.test'); git(clone, 'config', 'user.name', 'spec'); git(clone, 'config', 'commit.gpgsign', 'false');
  write(clone, 'modules/kernel/driver-loop.yaml', 'loop: 2\n'); git(clone, 'add', '-A'); git(clone, 'commit', '-qm', 'D');
  const D = git(clone, 'rev-parse', 'HEAD');
  fx.seed((l) => l.transaction(() => l.appendEvent({ workflowId: fx.wf, entityType: 'kernel', entityId: fx.wf, kind: KERNEL_REV_ACKED_EVENT, payload: { rev: D, files: [], source: 'ack' } })));
  const unknown = fx.status();
  assert.deepEqual([unknown.out.kernelRev.acked, unknown.out.kernelRev.unknownDiff], [D, true]);
  git(fx.rt, 'fetch', '-q', clone, 'HEAD');
  const known = fx.status();
  assert.equal(known.out.kernelRev.unknownDiff, undefined, 'the failed resolve was not remembered');
  // D is B's child (the clone was taken at B): D..B is D's driver-loop edit alone.
  assert.deepEqual([known.out.kernelRev.stale, known.out.kernelRev.files], [true, ['modules/kernel/driver-loop.yaml']]);
});
