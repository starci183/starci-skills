// deps-guard.mjs — dependency installs in a checkout several workflows share.
//
// nivo-backend/node_modules was deleted and recreated at 20:28:43 on
// 2026-09-23 while Collab's cut collab-be-identity-r2 ran jest and tsc in the
// same checkout; its ordinal 4 worker saw "node_modules disappeared mid-run"
// and every check in that window had to be re-run (nivo inc-7faca0d4d632,
// inc-3de1d5efdea6). The rule (modules/kernel/api.yaml conventions.sharedCheckout):
//  - a command that deletes node_modules (npm ci and its aliases) is refused
//    while a job of ANOTHER workflow of the same ledger is leased, because that
//    job's checks read node_modules right now;
//  - an install-family command through a linked node_modules is always refused:
//    it empties the live tree the link points to (node-modules-link-wipe).
// scripts/guards/command-guard.mjs (a PreToolUse hook) applies it to an op or
// [Worker] agent's npm command before it runs.
import fs from 'node:fs';
import path from 'node:path';

const INSTALL = new Set(['install', 'i', 'in', 'ins', 'inst', 'insta', 'instal', 'isnt', 'isnta', 'isntal', 'isntall', 'add',
  'uninstall', 'un', 'unlink', 'remove', 'rm', 'r', 'update', 'up', 'upgrade', 'udpate', 'prune', 'dedupe', 'ddp', 'rebuild', 'rb', 'link', 'ln',
  'it', 'install-test']);
const CLEAN_INSTALL = new Set(['ci', 'clean-install', 'ic', 'install-clean', 'isntall-clean', 'cit', 'install-ci-test', 'clean-install-test', 'sit']);
// npm options that consume the next word.
const NPM_VALUE_OPTIONS = new Set(['--prefix', '-C', '--workspace', '-w', '--userconfig', '--cache', '--registry', '--loglevel', '--tag', '--omit', '--include', '--install-strategy']);

/**
 * The node_modules an install in `cwd` would rewrite, when it is a LINK (junction/symlink) - or null. npm reifies
 * through a linked node_modules and empties its target: proven 2026-09-28 (npm 11.6, "Removing non-directory
 * node_modules" left the junction's target empty), which is how the runtime's live .claude/node_modules was wiped from
 * a checkout whose node_modules is a junction to it (land scratch, [Worker] staging, product worktree overlays).
 * The package root is --prefix/-C when given, else the nearest directory holding package.json. Never throws.
 */
export function linkedNodeModulesOf(argv, cwd = process.cwd()) {
  try {
    const args = argv.map(String);
    const at = args.findIndex((a) => a === '--prefix' || a === '-C');
    let root = at >= 0 && args[at + 1] ? path.resolve(cwd, args[at + 1]) : null;
    if (!root) { for (let d = path.resolve(cwd); ; d = path.dirname(d)) { if (fs.existsSync(path.join(d, 'package.json'))) { root = d; break; } if (path.dirname(d) === d) break; } }
    if (!root) return null;
    const nm = path.join(root, 'node_modules');
    let st; try { st = fs.lstatSync(nm); } catch { return null; }
    let linked = st.isSymbolicLink();
    if (!linked && st.isDirectory()) { try { linked = path.resolve(fs.realpathSync.native(nm)).toLowerCase() !== path.join(fs.realpathSync.native(root), 'node_modules').toLowerCase(); } catch { linked = true; } }
    if (!linked) return null;
    let target = null; try { target = fs.realpathSync.native(nm); } catch { /* dangling */ }
    return { nodeModules: nm, target };
  } catch { return null; }
}

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
export async function peerLeasedJobs({ ledgerRepo, workflowId, env = process.env, now = Date.now() }) {
  if (!ledgerRepo) return { known: false, jobs: [] };
  const { openLedgerReader, ledgerFileFor } = await import('../../engine/ledger-db.mjs');
  const { readMachine } = await import('../../engine/machine-db.mjs');
  // Decision Q1 (same as the owner digest): the repo's runtime ledger is the file machine.ledgers names for it —
  // never the pre-Q1 in-repo .starciwork/runtime.sqlite. That legacy store is opened only when the registry names
  // no ledger for the repo at all: a never-registered checkout's in-repo file is its only lease record, and a
  // guard errs toward reading a possible lease list rather than silently skipping it.
  let file = null;
  try {
    const resolved = ledgerFileFor(ledgerRepo, { env });
    if (fs.existsSync(resolved)) file = resolved;
    else if (!readMachine((m) => m.resolveLedger({ repoRoot: ledgerRepo }), null, { env })) {
      const legacy = path.join(ledgerRepo, '.starciwork', 'runtime.sqlite');
      if (fs.existsSync(legacy)) file = legacy;
    }
  } catch { file = null; }
  if (!file) return { known: false, jobs: [] };
  const db = openLedgerReader(file);
  try {
    db.exec('PRAGMA busy_timeout=5000');
    const rows = db.prepare(`SELECT j.job_id, j.workflow_id, j.op_id, j.status FROM jobs j
      WHERE j.kind<>'kernel' AND j.status IN ('leased','running','answering') AND j.workflow_id<>?`).all(workflowId ?? '');
    return { known: true, jobs: rows.map((r) => ({ jobId: r.job_id, workflowId: r.workflow_id, opId: r.op_id, status: r.status })) };
  } finally { db.close(); }
}

