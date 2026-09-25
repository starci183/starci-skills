// deps-guard.mjs — dependency installs in a checkout several workflows share.
//
// nivo-backend/node_modules was deleted and recreated at 20:28:43 on
// 2026-09-23 while Collab's cut collab-be-identity-r2 ran jest and tsc in the
// same checkout; its ordinal 4 worker saw "node_modules disappeared mid-run"
// and every check in that window had to be re-run (nivo inc-7faca0d4d632,
// inc-3de1d5efdea6). The rule (modules/kernel/api.yaml conventions.sharedCheckout):
//  - every install-family npm command in a repository runs under ONE
//    repository-level lock (<git common dir>/starci-deps.lock), so two
//    installs never interleave;
//  - a command that deletes node_modules (npm ci and its aliases) is refused
//    while a job of ANOTHER workflow of the same ledger is leased, because that
//    job's checks read node_modules right now. The shim reads the leases under
//    the lock, so no other install interleaves; a peer dispatched in that window
//    is not held by the lock (the ledger and the lock file are separate stores).
// scripts/guards/shim.mjs applies it in front of npm for op workers.
import fs from 'node:fs';
import path from 'node:path';

const INSTALL = new Set(['install', 'i', 'in', 'ins', 'inst', 'insta', 'instal', 'isnt', 'isnta', 'isntal', 'isntall', 'add',
  'uninstall', 'un', 'unlink', 'remove', 'rm', 'r', 'update', 'up', 'upgrade', 'udpate', 'prune', 'dedupe', 'ddp', 'rebuild', 'rb', 'link', 'ln',
  'it', 'install-test']);
const CLEAN_INSTALL = new Set(['ci', 'clean-install', 'ic', 'install-clean', 'isntall-clean', 'cit', 'install-ci-test', 'clean-install-test', 'sit']);
// npm options that consume the next word.
const NPM_VALUE_OPTIONS = new Set(['--prefix', '-C', '--workspace', '-w', '--userconfig', '--cache', '--registry', '--loglevel', '--tag', '--omit', '--include', '--install-strategy']);

/** classifyNpm(argv) -> {kind: 'pass'|'install'|'clean-install', sub} */
export function classifyNpm(argv) {
  const args = argv.map(String);
  let sub = null;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (NPM_VALUE_OPTIONS.has(a)) { i += 1; continue; }
    if (a.startsWith('-')) continue;
    sub = a;
    break;
  }
  const global = args.some((a) => a === '-g' || a === '--global' || a === '--location=global');
  const dry = args.some((a) => a === '--dry-run');
  if (!sub || global || dry) return { kind: 'pass', sub };
  if (CLEAN_INSTALL.has(sub)) return { kind: 'clean-install', sub };
  if (INSTALL.has(sub)) return { kind: 'install', sub };
  return { kind: 'pass', sub };
}

/** Jobs of OTHER workflows of this ledger that hold a lease right now (read-only). */
export async function peerLeasedJobs({ ledgerRepo, workflowId, now = Date.now() }) {
  if (!ledgerRepo) return { known: false, jobs: [] };
  const file = path.join(ledgerRepo, '.starciwork', 'runtime.sqlite');
  if (!fs.existsSync(file)) return { known: false, jobs: [] };
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    db.exec('PRAGMA busy_timeout=5000');
    const rows = db.prepare(`SELECT j.job_id, j.workflow_id, j.op_id, j.status FROM jobs j
      WHERE j.kind<>'kernel' AND j.status IN ('leased','running','answering') AND j.workflow_id<>?`).all(workflowId ?? '');
    return { known: true, jobs: rows.map((r) => ({ jobId: r.job_id, workflowId: r.workflow_id, opId: r.op_id, status: r.status })) };
  } finally { db.close(); }
}

const alive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e?.code === 'EPERM'; }
};
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/**
 * acquireDepsLock({lockFile, holder, waitMs, staleMs, onWait}) -> {ok, release()} | {ok:false, holder}
 * An exclusive create of the lock file. A lock whose holder process is gone is taken over; so is one older
 * than staleMs (a reused pid), far past any real install. release() removes the lock only while it is still
 * this holder's own.
 */
export function acquireDepsLock({ lockFile, holder, waitMs = 20 * 60_000, staleMs = 3 * 3600_000, pollMs = 2000, onWait = null, now = () => Date.now() }) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const started = now();
  let announced = false;
  for (;;) {
    try {
      const fd = fs.openSync(lockFile, 'wx');
      const mine = JSON.stringify({ ...holder, pid: process.pid, at: new Date(now()).toISOString() });
      fs.writeSync(fd, mine);
      fs.closeSync(fd);
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        try { if (fs.readFileSync(lockFile, 'utf8') === mine) fs.rmSync(lockFile, { force: true }); } catch { /* gone already */ }
      };
      return { ok: true, release };
    } catch (e) {
      if (e?.code !== 'EEXIST') throw e;
    }
    let current = null;
    try { current = JSON.parse(fs.readFileSync(lockFile, 'utf8')); } catch { current = null; }
    const age = current?.at ? now() - Date.parse(current.at) : Infinity;
    if (!current || !alive(current.pid) || age > staleMs) {
      try { fs.rmSync(lockFile, { force: true }); } catch { /* raced */ }
      continue;
    }
    if (now() - started >= waitMs) return { ok: false, holder: current };
    if (!announced && onWait) { onWait(current); announced = true; }
    sleep(pollMs);
  }
}
