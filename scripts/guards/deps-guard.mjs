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
//  - an install-family command of npm, pnpm or yarn through a linked node_modules is always refused, with or without
//    a guard file: it empties the live tree the link points to (node-modules-link-wipe, contract change
//    install-through-link).
// scripts/guards/command-guard.mjs (a PreToolUse hook) applies it to an agent's shell command before it runs.
import fs from 'node:fs';
import path from 'node:path';

/** The package managers whose install family rewrites node_modules. */
export const PACKAGE_MANAGERS = Object.freeze(['npm', 'pnpm', 'yarn']);
const NPM_INSTALL = new Set(['install', 'i', 'in', 'ins', 'inst', 'insta', 'instal', 'isnt', 'isnta', 'isntal', 'isntall', 'add',
  'uninstall', 'un', 'unlink', 'remove', 'rm', 'r', 'update', 'up', 'upgrade', 'udpate', 'prune', 'dedupe', 'ddp', 'rebuild', 'rb', 'link', 'ln',
  'it', 'install-test']);
const NPM_CLEAN_INSTALL = new Set(['ci', 'clean-install', 'ic', 'install-clean', 'isntall-clean', 'cit', 'install-ci-test', 'clean-install-test', 'sit']);
const PNPM_INSTALL = new Set(['install', 'i', 'add', 'remove', 'rm', 'uninstall', 'un', 'update', 'up', 'upgrade', 'prune', 'rebuild', 'rb',
  'link', 'ln', 'unlink', 'dedupe', 'import', 'install-test', 'it']);
const YARN_INSTALL = new Set(['install', 'add', 'remove', 'upgrade', 'up', 'upgrade-interactive', 'dedupe', 'link', 'unlink', 'import']);
// Options that consume the next word, per manager.
const VALUE_OPTIONS = {
  npm: new Set(['--prefix', '-C', '--dir', '--workspace', '-w', '--userconfig', '--cache', '--registry', '--loglevel', '--tag', '--omit', '--include', '--install-strategy']),
  pnpm: new Set(['-C', '--dir', '--prefix', '--filter', '-F', '--workspace-dir', '--store-dir', '--virtual-store-dir', '--reporter', '--loglevel', '--registry', '--config']),
  yarn: new Set(['--cwd', '--modules-folder', '--cache-folder', '--mutex', '--network-timeout', '--registry', '--global-folder', '--link-folder']),
};
// The options that name the package root an install works in.
const ROOT_OPTIONS = ['--prefix', '-C', '--dir', '--cwd'];

const optionValue = (args, names) => {
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (names.includes(a) && args[i + 1] != null) return args[i + 1];
    const eq = names.find((n) => n.startsWith('--') && a.startsWith(`${n}=`));
    if (eq) return a.slice(eq.length + 1);
  }
  return null;
};

/** The package root an install of `argv` works in: --prefix / -C / --dir / --cwd, else the nearest package.json above `cwd`. */
export function packageRootOf(argv, cwd = process.cwd()) {
  const given = optionValue(argv.map(String), ROOT_OPTIONS);
  if (given) return path.resolve(cwd, given);
  for (let d = path.resolve(cwd); ; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, 'package.json'))) return d;
    if (path.dirname(d) === d) return null;
  }
}

// `nm` when it is a link (a junction or symlink, or a directory whose real path is not its own place), else null.
function linkAt(nm) {
  let st; try { st = fs.lstatSync(nm); } catch { return null; }
  let linked = st.isSymbolicLink();
  if (!linked && st.isDirectory()) {
    try { linked = path.resolve(fs.realpathSync.native(nm)).toLowerCase() !== path.join(fs.realpathSync.native(path.dirname(nm)), path.basename(nm)).toLowerCase(); }
    catch { linked = true; }
  }
  if (!linked) return null;
  let target = null; try { target = fs.realpathSync.native(nm); } catch { /* dangling */ }
  return { nodeModules: nm, target };
}

// The workspace root above `root` (a package.json with "workspaces", or a pnpm-workspace.yaml), whose node_modules a
// workspace install also writes; null when there is none.
function workspaceRootAbove(root) {
  for (let d = path.dirname(root); path.dirname(d) !== d; d = path.dirname(d)) {
    if (fs.existsSync(path.join(d, 'pnpm-workspace.yaml'))) return d;
    try { if (JSON.parse(fs.readFileSync(path.join(d, 'package.json'), 'utf8'))?.workspaces) return d; } catch { /* none or unreadable */ }
  }
  return null;
}

/**
 * The node_modules an install of `program argv` in `cwd` would rewrite that is a LINK (junction/symlink), or null. npm
 * reifies through a linked node_modules and empties its target: proven 2026-09-28 (npm 11.6, "Removing non-directory
 * node_modules" left the junction's target empty), and the wipes kept coming (the runtime's live .claude/node_modules;
 * 2026-10-01 a lane's `npm ci` emptied main's packages/grammar/node_modules through its junction). Checked in order:
 * the package root's node_modules (yarn --modules-folder when given), every node_modules the root itself sits inside,
 * and the workspace root's node_modules. A node_modules that does not exist yet is no link. Never throws.
 */
export function linkedNodeModulesOf(program, argv, cwd = process.cwd()) {
  try {
    const args = argv.map(String);
    const root = packageRootOf(args, cwd);
    if (!root) return null;
    const modulesFolder = program === 'yarn' ? optionValue(args, ['--modules-folder']) : null;
    const candidates = [modulesFolder ? path.resolve(root, modulesFolder) : path.join(root, 'node_modules')];
    for (let d = root; path.dirname(d) !== d; d = path.dirname(d)) if (path.basename(d).toLowerCase() === 'node_modules') candidates.push(d);
    const ws = workspaceRootAbove(root);
    if (ws) candidates.push(path.join(ws, 'node_modules'));
    for (const nm of candidates) { const hit = linkAt(nm); if (hit) return hit; }
    return null;
  } catch { return null; }
}

/** classifyInstall(program, argv) -> {kind: 'pass'|'install'|'clean-install', sub}: whether the command rewrites node_modules. */
export function classifyInstall(program, argv) {
  if (!PACKAGE_MANAGERS.includes(program)) return { kind: 'pass', sub: null };
  const args = argv.map(String);
  const valued = VALUE_OPTIONS[program];
  let sub = null;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (valued.has(a)) { i += 1; continue; }
    if (a.startsWith('-')) continue;
    sub = a;
    break;
  }
  const global = args.some((a) => a === '-g' || a === '--global' || a === '--location=global') || (program === 'yarn' && sub === 'global');
  const dry = args.some((a) => a === '--dry-run' || a === '--lockfile-only');
  if (global || dry) return { kind: 'pass', sub };
  if (program === 'npm') {
    if (NPM_CLEAN_INSTALL.has(sub)) return { kind: 'clean-install', sub };
    return { kind: sub && NPM_INSTALL.has(sub) ? 'install' : 'pass', sub };
  }
  if (program === 'pnpm') return { kind: sub && PNPM_INSTALL.has(sub) ? 'install' : 'pass', sub };
  // yarn with no subcommand installs; any other word runs a script.
  return { kind: !sub || YARN_INSTALL.has(sub) ? 'install' : 'pass', sub };
}

/** Jobs of OTHER workflows of this ledger that hold a lease right now (read-only). */
export async function peerLeasedJobs({ ledgerRepo, workflowId, env = process.env, now = Date.now() }) {
  if (!ledgerRepo) return { known: false, jobs: [] };
  const { openLedgerReader, ledgerFileFor } = await import('../../engine/db/ledger.mjs');
  const { readMachine } = await import('../../engine/db/machine.mjs');
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

