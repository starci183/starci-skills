// A world for the status verb: a runtime root with two revisions, a product repo whose ledger holds a running workflow with two running
// draw legs and two owner gates, and the spawned api (`api`, `ok`, `status`) with the environment that keeps it off the host.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { FAKE_ORCA } from './fake-orca.mjs';
import { ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { KERNEL_REV_ACKED_EVENT } from '../../scripts/kernel/runtime-rev.mjs';
import { seedWorkflow } from './ledger-fixture.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const json = (text) => { try { return JSON.parse(text); } catch { return null; } };
const rm = (dir) => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
export const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim();
};
export const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const gitInit = (root) => {
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'spec@example.test'); git(root, 'config', 'user.name', 'spec'); git(root, 'config', 'commit.gpgsign', 'false');
};

// Every spawn the api process makes: spawnSync and execFile (status's parallel Orca prefetch), one JSON line each.
const TRACER = `import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import assert from 'node:assert/strict';
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

// A runtime root with revisions A and B (the actual draw brief moved), checked out at B; a
// product repo whose ledger holds a running workflow acked at A with two running draw legs admitted under A, each
// on its own worker terminal; and two owner gates waiting on the same uncommitted path of another repo.
export const statusWorld = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-status-perf-'));
  t.after(() => rm(dir));
  const rt = path.join(dir, 'runtime'); fs.mkdirSync(rt); gitInit(rt);
  write(rt, 'modules/kernel/kernel-prompt.md', 'prompt\n');
  write(rt, 'modules/kernel/driver-loop.yaml', 'loop: 1\n');
  write(rt, 'modules/ops/ops/interface.draw.yaml', 'id: interface.draw\n');
  write(rt, 'scripts/kernel/op-prompt.mjs', 'export {};\n');
  git(rt, 'add', '-A'); git(rt, 'commit', '-qm', 'A');
  const A = git(rt, 'rev-parse', 'HEAD');
  write(rt, 'modules/ops/ops/interface.draw.yaml', 'id: interface.draw\nnew: rule\n');
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
    STARCI_LOCAL_ROOT: path.join(dir,'localappdata'), STARCI_PROJECTS_ROOT: path.join(dir,'projects'), STARCI_TEST_MACHINE_FILE: path.join(dir,'machine.sqlite') };
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
  const gates = [1, 2].map(() => ok(['incident', '--workflow', wf, '--kind', 'owner-gate', '--op', 'brand.decide', '--until-commit', `${other}:app/layout.tsx`, '--cause', 'peer-dependency', '--no-workaround', 'peer-not-running', '--detail', 'FE app router']).incidentId);
  // The ledger as the fixture left it, restorable so each compared status reads the same state.
  const snapshot = path.join(dir, 'snapshot.sqlite');
  { const db = new DatabaseSync(ledgerFile); db.exec(`VACUUM INTO '${snapshot.replace(/'/g, "''")}'`); db.close(); }
  const restore = () => {
    for (const suffix of ['-wal', '-shm']) fs.rmSync(`${ledgerFile}${suffix}`, { force: true });
    fs.copyFileSync(snapshot, ledgerFile);
  };
  return { dir, rt, A, B, repo, other, memo, wf, gates, api, ok, status, seed, restore, baseEnv, ledgerFile };
};
