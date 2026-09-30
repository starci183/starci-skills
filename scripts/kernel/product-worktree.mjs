#!/usr/bin/env node
// product-worktree.mjs — one git worktree per WORKFLOW and one per OP job in a product repository
// (DESIGN §16.7, FMEA #20; owner rulings 2026-09-28 "mỗi op 1 worktree, 1 workflow 1 worktree, chốt").
//
// Before: every parallel product job edited ONE working tree (fe-canon: 16 code.refactor slices in D:/Repositories/nivo-fe),
// so a slice moving apps/app/src/i18n/request.ts changed a sibling's checker inputs mid-run (INPUTS_CHANGED_DURING_CHECK)
// and 26 importers of the old `@/i18n` path broke where nobody owned them.
//
// Layout (scripts/lib/worktree-exclude.mjs; <wf>, <op> are 8-char short ids, branch descriptions hold the full ids):
//   <repo>/.starciwork/worktrees/<wf>/_wf    WORKFLOW integration worktree, branch wf/<wf>, off the product's main at the
//                                            workflow's first isolated job; dev servers, UAT and drawing run HERE on the
//                                            port portOf(path) allocates.
//   <repo>/.starciwork/worktrees/<wf>/<op>   OP worktree, branch op/<op>, off the CURRENT wf/<wf> tip at dispatch (a sibling
//                                            of _wf, never inside it). The op edits, checks and commits only here.
// The directory is git-excluded (.git/info/exclude) and core.longpaths is on for the product repo.
//
// node_modules: a plain junction to the root's node_modules is WRONG for a monorepo - node_modules/@nivo/ui links to the
// ROOT's packages/ui, so an op editing packages/ui would build against the stale root copy. Each worktree gets a REAL
// node_modules (one per workspace dir that has one in the root checkout) filled with junctions to every root entry,
// except workspace packages (entries whose real path is a source dir of the checkout), which are junctioned to the
// worktree's OWN copy. Hundreds of junctions, no copy, no install. Rebuilt when a root lockfile changes (marker hash).
// Removal unlinks every junction first and never recursive-deletes through one (safe-remove.mjs; nivo-fe inc-c8fbf76aa499).
//
// Lifecycle (job state machine: reported -> settled -> released -> worktree-removed):
//   dispatch        ensureOpWorktree (creates/reuses; a continuation of a job whose unlanded commits were archived
//                   starts from them); payload.productWorktree records {repoRoot, workflow:{..}, op:{..}, baseSha}
//   settle pass     integrateOp under the per-workflow lock: the land gate first - scripts/checks/gate.mjs on the op
//                   worktree against its merge-base with wf/<wf>, the same gate the op forced every round (exit 1
//                   land-gate-red, 2 land-gate-unavailable; wf/<wf> untouched) - then rebase op/<op> onto the latest wf/<wf> (merge-tree chain,
//                   conflict -> refusal with files+hunks), fast-forward wf/<wf>, post-merge verify ON the workflow branch
//                   (the op's re-runnable declared checks, paths moved to _wf, + an import check of its changed files);
//                   red -> wf/<wf> rolled back, refusal product-integrate-red carrying a continuation (not a failure)
//   released        removeOpWorktree right after the worker is released (api settle spawns `reap`; the settler's
//                   productWorktreeDuty is the backstop): evidence salvaged and asserted, junctions unlinked, tree removed,
//                   `git worktree prune`, removal verified; branch deleted, or archived (refs/starci/archive/op/<op>) when
//                   it holds commits the workflow branch lacks. SLA: <= opRemoveSlaMs (1 min) after settle.
//   workflow end    removeWorkflowWorktree once the workflow is finished/archived AND wf/<wf> landed in main (or the Kernel
//                   recorded it abandoned). Landing wf/<wf> -> main is scripts/kernel/product-land.mjs (per-repo serial).
//   leftovers       sweepLeftovers removes what the above missed and logs each one as a bug (product-worktree-leftover).
//
//   node scripts/kernel/product-worktree.mjs reap --repo <ledger repo> [--job <id>] [--json]   the duty for one ledger/job
//   node scripts/kernel/product-worktree.mjs status --repo <ledger repo> [--json]              live product worktrees
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { runGit } from '../lib/git.mjs';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { safeRemoveTree, isLinkLike, unlinkOnly } from '../lib/safe-remove.mjs';
import { claimManager } from '../connectors/lib.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { WORKTREES_REL, WORKFLOW_DIR_NAME, WORKTREES_EXCLUDE_LINE, isWorktreesPath } from '../lib/worktree-exclude.mjs';
import { brokenImports } from './import-scan.mjs';
import { checkVerdictOf } from '../reconcile/check-verdict.mjs';
import { launchFor } from '../uat/launch.mjs';
import { SETTLED_JOB_LIST } from '../../engine/admission.mjs';
import { realpathOr } from '../lib/fs-kind.mjs';

const selfFile = fileURLToPath(import.meta.url);
export const SKILL_ROOT = path.resolve(path.dirname(selfFile), '..', '..');
export const SETTINGS_FILE = path.join(SKILL_ROOT, 'modules', 'kernel', 'product-land.yaml');
export const EVENTS = Object.freeze({
  created: 'product-worktree-created',
  integrated: 'product-integrated',
  integrateRefused: 'product-integrate-refused',
  removed: 'job-worktree-removed',
  removeFailed: 'job-worktree-remove-failed',
  slaMissed: 'product-worktree-sla-missed',
  wfRemoved: 'workflow-worktree-removed',
  overlap: 'product-wf-overlap',
  synced: 'product-wf-synced',
  leftover: 'product-worktree-leftover',
});
const SETTLED = SETTLED_JOB_LIST;
const OVERLAY_MARKER = '.starci-overlay.json';
/** Written into a workflow worktree's node_modules by its deps unit: a real install, the overlay source of its ops. */
const INSTALL_MARKER = '.starci-install.json';
export const installedIn = (dir) => { try { return JSON.parse(fs.readFileSync(path.join(dir, 'node_modules', INSTALL_MARKER), 'utf8')); } catch { return null; } };
const ARCHIVE_PREFIX = 'refs/starci/archive';

/* ------------------------------------------------------------ settings */

const DEFAULTS = Object.freeze({
  defaultIsolation: 'shared',
  worktrees: { shortIdLength: 8, opRemoveSlaMs: 60_000, archiveTtlMs: 7 * 86_400_000, commandMs: 300_000,
    overlay: { lockfiles: ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'npm-shrinkwrap.json'], maxDepth: 3 },
    ports: { base: 43100, span: 800 } },
  integrate: { lockWaitMs: 600_000, gateTimeoutMs: 1_800_000, recheck: 'declared', recheckTimeoutMs: 300_000, importCheck: 'changed-files',
    depsFiles: ['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'npm-shrinkwrap.json', 'pnpm-workspace.yaml'] },
  land: { lockWaitMs: 1_800_000, checks: [], importScan: true, push: false, syncWorkflowAfterLand: true, maxMainRetries: 3 },
  invariant: { importsCacheMs: 300_000 },
  deps: { installTimeoutMs: 1_200_000,
    install: { 'package-lock.json': ['npm', 'ci'], 'pnpm-lock.yaml': ['pnpm', 'install', '--frozen-lockfile'], 'yarn.lock': ['yarn', 'install', '--frozen-lockfile'] } },
});
const merge = (a, b) => {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return b ?? a;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = a && typeof a[k] === 'object' && !Array.isArray(a[k]) ? merge(a[k], v) : v;
  return out;
};
/** modules/kernel/product-land.yaml over the defaults. */
export function productSettings(file = SETTINGS_FILE) {
  let doc = null;
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')); } catch { doc = null; }
  return merge(DEFAULTS, doc ?? {});
}

/* ------------------------------------------------------------ git */

/** git in `cwd`: {ok, status, stdout, stderr}. */
export function git(cwd, args, { env = null, timeout = 300_000, input = undefined } = {}) {
  const r = runGit(args, { cwd, timeout, input, env: env ? { ...process.env, ...env } : process.env, maxBuffer: 256 * 1024 * 1024 });
  return { ok: !r.error && r.status === 0, status: r.status, stdout: String(r.stdout ?? '').trim(), stderr: String(r.stderr ?? r.error?.message ?? '').trim() };
}
const revParse = (cwd, ref) => { const r = git(cwd, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]); return r.ok && r.stdout ? r.stdout : null; };
export const isAncestor = (cwd, a, b) => git(cwd, ['merge-base', '--is-ancestor', a, b]).ok;
const refExists = (cwd, ref) => git(cwd, ['show-ref', '--verify', '--quiet', ref]).ok;
const posix = (p) => String(p).replace(/\\/g, '/');
const samePath = (a, b) => { const k = (p) => { let r = path.resolve(p); try { r = fs.realpathSync.native(r); } catch { /* missing */ } return process.platform === 'win32' ? r.toLowerCase() : r; }; return k(a) === k(b); };
const insidePath = (child, parent) => { const rel = path.relative(path.resolve(parent), path.resolve(child)); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); };

/** {path, branch} of every registered worktree of the repository. */
export function worktreeList(repoRoot) {
  const r = git(repoRoot, ['worktree', 'list', '--porcelain']);
  const out = [];
  let cur = null;
  for (const line of r.stdout.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) { cur = { path: path.resolve(line.slice(9).trim()), branch: null, prunable: false }; out.push(cur); }
    else if (cur && line.startsWith('branch ')) cur.branch = line.slice(7).trim().replace(/^refs\/heads\//, '');
    else if (cur && line.startsWith('prunable')) cur.prunable = true;
  }
  return out;
}
const registeredAt = (repoRoot, dir) => worktreeList(repoRoot).find((w) => samePath(w.path, dir)) ?? null;

/* ------------------------------------------------------------ ids + paths */

/** An 8-char id: the id's own trailing token (wf-...-mujek980 -> mujek980, op-...-d704825abb -> d704825a), else a hash. */
export function shortIdOf(id, len = 8) {
  const tail = String(id ?? '').split('-').pop() ?? '';
  return /^[a-z0-9]+$/i.test(tail) && tail.length >= len ? tail.slice(0, len).toLowerCase() : hashIdOf(id, len);
}
export const hashIdOf = (id, len = 8) => crypto.createHash('sha1').update(String(id)).digest('hex').slice(0, len);
export const worktreesRootOf = (repoRoot) => path.join(repoRoot, ...WORKTREES_REL.split('/'));

const descriptionOf = (repoRoot, branch) => git(repoRoot, ['config', '--get', `branch.${branch}.description`]).stdout || null;
/**
 * The short id a kind ('wf' | 'op') of `id` uses in this repository: the natural short id unless its branch is
 * already another id's (branch description), then the hash id. Stable: the same id always gets the same answer.
 */
export function resolveShort(repoRoot, kind, id, len = 8) {
  for (const short of [...new Set([shortIdOf(id, len), hashIdOf(id, len)])]) {
    const branch = `${kind}/${short}`;
    if (!refExists(repoRoot, `refs/heads/${branch}`)) return short;
    const owner = descriptionOf(repoRoot, branch);
    if (!owner || owner === String(id)) return short;
  }
  return hashIdOf(`${kind}:${id}`, len);
}

/** The deterministic places of a workflow's and an op's worktree (nothing is created). */
export function layoutOf({ repoRoot, workflowId, jobId = null, settings = productSettings() }) {
  const len = settings.worktrees.shortIdLength;
  const wf = resolveShort(repoRoot, 'wf', workflowId, len);
  const wfDir = path.join(worktreesRootOf(repoRoot), wf);
  const out = { repoRoot: path.resolve(repoRoot), workflowId, workflow: { short: wf, branch: `wf/${wf}`, path: path.join(wfDir, WORKFLOW_DIR_NAME) }, wfDir };
  if (jobId) {
    const op = resolveShort(repoRoot, 'op', jobId, len);
    out.jobId = jobId;
    out.op = { short: op, branch: `op/${op}`, path: path.join(wfDir, op) };
  }
  return out;
}

/** The dev-server/UAT port of one worktree: stable per path, inside the configured span. */
export function portOf(worktreePath, settings = productSettings()) {
  const { base, span } = settings.worktrees.ports;
  return base + (parseInt(hashIdOf(posix(path.resolve(worktreePath)).toLowerCase(), 8), 16) % span);
}

/* ------------------------------------------------------------ repo setup */

/** core.longpaths on, and the worktrees dir in the common .git/info/exclude (shared by every worktree). */
export function ensureRepoSetup(repoRoot) {
  const out = { longpaths: false, excluded: false };
  if (git(repoRoot, ['config', '--get', 'core.longpaths']).stdout !== 'true') git(repoRoot, ['config', 'core.longpaths', 'true']);
  out.longpaths = git(repoRoot, ['config', '--get', 'core.longpaths']).stdout === 'true';
  const common = git(repoRoot, ['rev-parse', '--path-format=absolute', '--git-common-dir']).stdout;
  if (common) {
    const file = path.join(common, 'info', 'exclude');
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch { /* none yet */ }
    if (!text.split(/\r?\n/).some((l) => l.trim() === WORKTREES_EXCLUDE_LINE)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.appendFileSync(file, `${text && !text.endsWith('\n') ? '\n' : ''}# StarCi product worktrees (DESIGN §16.7)\n${WORKTREES_EXCLUDE_LINE}\n`);
    }
    out.excluded = true;
  }
  return out;
}

/* ------------------------------------------------------------ node_modules overlay */

const lockHashOf = (repoRoot, settings) => {
  const h = crypto.createHash('sha1');
  for (const name of settings.worktrees.overlay.lockfiles) {
    try { h.update(name).update(fs.readFileSync(path.join(repoRoot, name))); } catch { /* absent */ }
  }
  return h.digest('hex');
};

/** Relative dirs ('' = root) of the checkout that hold a node_modules, depth-bounded, never inside one or a dot dir. */
export function nodeModulesDirs(repoRoot, { maxDepth = 3 } = {}) {
  const out = [];
  const visit = (rel, depth) => {
    const abs = path.join(repoRoot, rel);
    let entries = [];
    try { entries = fs.readdirSync(abs, { withFileTypes: true }); } catch { return; }
    if (entries.some((e) => e.name === 'node_modules' && (e.isDirectory() || e.isSymbolicLink()))) out.push(rel);
    if (depth >= maxDepth) return;
    for (const e of entries) {
      if (!e.isDirectory() || e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const child = rel ? `${rel}/${e.name}` : e.name;
      if (isWorktreesPath(child)) continue;
      visit(child, depth + 1);
    }
  };
  visit('', 0);
  return out;
}

const junction = (target, link) => { fs.symlinkSync(target, link, 'junction'); };

/**
 * Fill <wt>/<dir>/node_modules for every dir of the root checkout that has one: a REAL directory whose entries are
 * junctions to the root's entries (scope dirs @x are real dirs of junctions), except workspace packages - entries
 * whose real path is inside the checkout and outside any node_modules - which are junctioned to the worktree's own
 * copy. Files (.package-lock.json) are copied. {ok, dirs, links, workspace: [{name, target}], lockHash}
 */
export function buildOverlay({ repoRoot, worktree, source = repoRoot, settings = productSettings() }) {
  // `source`: the install the overlay mirrors - the main checkout, or the workflow worktree once its deps unit installed
  // there (a package.json/lockfile change of the workflow, not yet in main).
  const rootReal = realpathOr(source) ?? path.resolve(source);
  const out = { ok: true, dirs: [], links: 0, copied: 0, workspace: [], lockHash: lockHashOf(source, settings), source: path.resolve(source), errors: [] };
  const mapTarget = (entryAbs) => {
    const real = realpathOr(entryAbs);
    if (!real) return null;
    const rel = path.relative(rootReal, real);
    const inside = rel && !rel.startsWith('..') && !path.isAbsolute(rel);
    if (inside && !posix(rel).split('/').includes('node_modules') && !isWorktreesPath(posix(rel))) {
      return { target: path.join(worktree, rel), workspace: posix(rel) };
    }
    return { target: real, workspace: null };
  };
  const fill = (srcDir, dstDir, label) => {
    fs.mkdirSync(dstDir, { recursive: true });
    for (const e of fs.readdirSync(srcDir, { withFileTypes: true })) {
      if (e.name === OVERLAY_MARKER || e.name === INSTALL_MARKER) continue;
      const src = path.join(srcDir, e.name), dst = path.join(dstDir, e.name);
      try { fs.lstatSync(dst); continue; } catch { /* not there yet */ }
      try {
        const st = fs.lstatSync(src);
        const linkLike = isLinkLike(src, { stat: st });
        if (!linkLike && st.isDirectory() && e.name.startsWith('@')) { fill(src, dst, `${label}${e.name}/`); continue; }
        if (!linkLike && st.isFile()) { fs.copyFileSync(src, dst); out.copied += 1; continue; }
        const m = mapTarget(src);
        if (!m) continue;
        if (!fs.existsSync(m.target) || !fs.statSync(m.target).isDirectory()) {
          if (m.workspace) { out.errors.push({ entry: `${label}${e.name}`, error: `workspace target ${m.target} missing in the worktree` }); continue; }
          if (fs.statSync(src).isFile()) { fs.copyFileSync(src, dst); out.copied += 1; }
          continue;
        }
        junction(m.target, dst);
        out.links += 1;
        if (m.workspace) out.workspace.push({ name: `${label}${e.name}`, target: posix(path.relative(worktree, m.target)) });
      } catch (error) { out.errors.push({ entry: `${label}${e.name}`, error: String(error?.message ?? error).slice(0, 200) }); }
    }
  };
  for (const dir of nodeModulesDirs(source, { maxDepth: settings.worktrees.overlay.maxDepth })) {
    const src = path.join(source, dir, 'node_modules');
    const wtDir = path.join(worktree, dir);
    if (!fs.existsSync(wtDir)) continue; // a workspace dir the worktree's commit does not have
    fill(realpathOr(src) ?? src, path.join(wtDir, 'node_modules'), dir ? `${dir}/node_modules/` : 'node_modules/');
    out.dirs.push(dir);
  }
  fs.mkdirSync(path.join(worktree, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(worktree, 'node_modules', OVERLAY_MARKER), JSON.stringify({ lockHash: out.lockHash, source: out.source, dirs: out.dirs, builtAt: new Date().toISOString(), links: out.links }));
  out.ok = out.errors.filter((e) => /workspace/.test(e.error)).length === 0;
  return out;
}

/**
 * Unlink every junction of the worktree's node_modules overlay(s), then remove the (now link-free) overlay dirs.
 * Never descends into a link. {ok, unlinked, stuck: [path]}
 */
export function removeOverlay(worktree, { settings = productSettings() } = {}) {
  const out = { ok: true, unlinked: 0, stuck: [] };
  const dirs = new Set(['']);
  try { for (const d of JSON.parse(fs.readFileSync(path.join(worktree, 'node_modules', OVERLAY_MARKER), 'utf8')).dirs ?? []) dirs.add(d); } catch { /* no marker */ }
  for (const d of nodeModulesDirs(worktree, { maxDepth: settings.worktrees.overlay.maxDepth })) dirs.add(d);
  const clear = (dir) => {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (isLinkLike(p)) { if (unlinkOnly(p)) out.unlinked += 1; else out.stuck.push(p); continue; }
      if (e.isDirectory() && e.name.startsWith('@')) { clear(p); try { fs.rmdirSync(p); } catch { /* not empty: a real tree, left to safeRemoveTree */ } }
    }
  };
  for (const d of dirs) {
    const nm = path.join(worktree, d, 'node_modules');
    if (!fs.existsSync(nm)) continue;
    if (isLinkLike(nm)) { if (unlinkOnly(nm)) out.unlinked += 1; else out.stuck.push(nm); continue; }
    clear(nm);
  }
  out.ok = out.stuck.length === 0;
  return out;
}

/**
 * Rebuild the overlay when missing, when its source's lockfile changed since it was built, or when its source changed
 * (the workflow's deps unit installed in _wf). A worktree holding a real install (the deps unit's) is left alone.
 */
export function ensureOverlay({ repoRoot, worktree, source = repoRoot, settings = productSettings() }) {
  if (installedIn(worktree)) return { ok: true, fresh: true, installed: true };
  let marker = null;
  try { marker = JSON.parse(fs.readFileSync(path.join(worktree, 'node_modules', OVERLAY_MARKER), 'utf8')); } catch { marker = null; }
  const lockHash = lockHashOf(source, settings);
  if (marker?.lockHash === lockHash && samePath(marker.source ?? repoRoot, source)) return { ok: true, fresh: true, lockHash };
  if (marker) { const rm = removeOverlay(worktree, { settings }); if (!rm.ok) return { ok: false, reason: 'overlay-link-stuck', stuck: rm.stuck }; }
  const built = buildOverlay({ repoRoot, worktree, source, settings });
  return { ...built, rebuilt: Boolean(marker) };
}

/**
 * The resolution check: every workspace package of the overlay resolves INSIDE the worktree (fs real path), and one
 * of them through Node itself (`require.resolve` from the worktree). {ok, checked, outside: [..], node}
 */
export function verifyResolution(worktree, overlay = null) {
  const workspace = overlay?.workspace ?? [];
  const outside = [];
  for (const w of workspace) {
    const real = realpathOr(path.join(worktree, ...w.name.split('/')));
    if (!real || !insidePath(real, realpathOr(worktree) ?? worktree)) outside.push({ name: w.name, real });
  }
  let node = null;
  const first = workspace.find((w) => w.name.startsWith('node_modules/'));
  if (first) {
    const pkg = first.name.slice('node_modules/'.length);
    const r = spawnSync(process.execPath, ['-e', `try{process.stdout.write(require('fs').realpathSync(require.resolve(${JSON.stringify(`${pkg}/package.json`)})))}catch(e){try{process.stdout.write(require.resolve(${JSON.stringify(pkg)}))}catch(f){process.stdout.write('!'+f.code)}}`],
      { cwd: worktree, encoding: 'utf8', windowsHide: true, timeout: 30_000 });
    const got = String(r.stdout ?? '').trim();
    node = { pkg, resolved: got, inside: !got.startsWith('!') && insidePath(got, realpathOr(worktree) ?? worktree) };
    if (!node.inside && !got.startsWith('!ERR_PACKAGE_PATH_NOT_EXPORTED')) outside.push({ name: pkg, real: got, via: 'require.resolve' });
  }
  return { ok: outside.length === 0, checked: workspace.length, outside, node };
}

/* ------------------------------------------------------------ locks */

/** Hold the named host lock around fn (poll until waitMs). {ok:false, holder} when it never frees. */
export function withLock(name, fn, { waitMs = 600_000, pollMs = 1000, env = process.env } = {}) {
  const end = Date.now() + waitMs;
  for (;;) {
    const held = claimManager(name, { env });
    if (held.ok) { try { return fn(); } finally { held.release(); } }
    if (Date.now() >= end) return { ok: false, reason: 'lock-busy', lock: name, holder: held.holder ?? null };
    sleepSync(pollMs);
  }
}
const repoKey = (repoRoot) => hashIdOf(posix(path.resolve(repoRoot)).toLowerCase(), 10);
export const workflowLockName = (repoRoot, wfShort) => `product-wf-${repoKey(repoRoot)}-${wfShort}`;

/* ------------------------------------------------------------ worktrees */

function addWorktree({ repoRoot, dir, branch, base = null, description = null }) {
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  git(repoRoot, ['worktree', 'prune']);
  const reg = registeredAt(repoRoot, dir);
  if (reg && fs.existsSync(dir)) return { ok: true, created: false };
  if (fs.existsSync(dir)) {
    let entries = [];
    try { entries = fs.readdirSync(dir); } catch { /* unreadable */ }
    if (entries.length) return { ok: false, reason: 'worktree-path-occupied', detail: `${dir} exists and is not a registered worktree` };
    try { fs.rmdirSync(dir); } catch { /* recreated by git */ }
  }
  const exists = refExists(repoRoot, `refs/heads/${branch}`);
  const r = exists ? git(repoRoot, ['worktree', 'add', dir, branch]) : git(repoRoot, ['worktree', 'add', '-b', branch, dir, base]);
  if (!r.ok) return { ok: false, reason: 'worktree-add-failed', detail: r.stderr.slice(0, 400) };
  if (description) git(repoRoot, ['config', `branch.${branch}.description`, description]);
  return { ok: true, created: true, branchExisted: exists };
}

/**
 * The workflow's integration worktree (created off `base`, default main, on first use). {ok, path, branch, short,
 * created, baseSha?, overlay, resolution}
 */
export function ensureWorkflowWorktree({ repoRoot, workflowId, base = 'main', settings = productSettings() }) {
  ensureRepoSetup(repoRoot);
  const lay = layoutOf({ repoRoot, workflowId, settings });
  const baseSha = refExists(repoRoot, `refs/heads/${lay.workflow.branch}`) ? null : revParse(repoRoot, base);
  if (!baseSha && !refExists(repoRoot, `refs/heads/${lay.workflow.branch}`)) return { ok: false, reason: 'base-unresolved', detail: `cannot resolve ${base} in ${repoRoot}` };
  const added = addWorktree({ repoRoot, dir: lay.workflow.path, branch: lay.workflow.branch, base: baseSha, description: workflowId });
  if (!added.ok) return { ...added, path: lay.workflow.path };
  const overlay = ensureOverlay({ repoRoot, worktree: lay.workflow.path, settings });
  const resolution = overlay.fresh ? null : verifyResolution(lay.workflow.path, overlay);
  return { ok: overlay.ok !== false && (resolution?.ok ?? true), ...lay.workflow, created: added.created, ...(baseSha ? { baseSha } : {}),
    port: portOf(lay.workflow.path, settings), overlay: summarizeOverlay(overlay), ...(resolution ? { resolution } : {}),
    ...(overlay.ok === false ? { reason: overlay.reason ?? 'overlay-failed' } : resolution && !resolution.ok ? { reason: 'resolution-outside-worktree' } : {}) };
}
const summarizeOverlay = (o) => ({ fresh: Boolean(o.fresh), links: o.links ?? null, dirs: o.dirs ?? null, workspace: (o.workspace ?? []).length || null, errors: (o.errors ?? []).slice(0, 5) });

/** An archived op branch of `jobId` (a partial commit a continuation reuses), or null. */
export function archivedOpRef(repoRoot, jobId, settings = productSettings()) {
  for (const short of [...new Set([shortIdOf(jobId, settings.worktrees.shortIdLength), hashIdOf(jobId, settings.worktrees.shortIdLength)])]) {
    const ref = `${ARCHIVE_PREFIX}/op/${short}`;
    const sha = revParse(repoRoot, ref);
    if (sha) return { ref, sha };
  }
  return null;
}

/**
 * Bring main into wf/<wf> when main moved (another workflow landed): a clean
 * merge-tree merges it in the _wf worktree; a conflicting one merges nothing and reports the overlap signal the
 * Fleet controller reads (Supervisor: cross-workflow). Call under the workflow lock. {ok, merged?, overlap?}
 */
export function syncWorkflowFromMain({ repoRoot, wf, main = 'main' }) {
  const M = revParse(repoRoot, main), W = revParse(repoRoot, wf.branch);
  if (!M || !W) return { ok: false, reason: 'ref-unresolved' };
  if (isAncestor(repoRoot, M, W)) return { ok: true, merged: false, upToDate: true };
  const base = git(repoRoot, ['merge-base', W, M]).stdout;
  const changed = (a, b) => new Set(git(repoRoot, ['diff', '--name-only', a, b]).stdout.split(/\r?\n/).filter(Boolean));
  const ours = changed(base, W), theirs = changed(base, M);
  const overlapPaths = [...ours].filter((p) => theirs.has(p));
  const probe = git(repoRoot, ['merge-tree', '--write-tree', W, M]);
  if (probe.status === 1) return { ok: false, reason: 'main-conflicts-workflow', overlap: { paths: overlapPaths.slice(0, 50), main: M, workflow: W, conflicts: conflictFilesOf(probe.stdout) } };
  if (!probe.ok) return { ok: false, reason: 'merge-tree-failed', detail: probe.stderr.slice(0, 200) };
  if (!fs.existsSync(wf.path)) {
    // No integration tree checked out (between ops): the merge commit is written without one.
    const tree = probe.stdout.split(/\r?\n/)[0].trim();
    const commit = git(repoRoot, ['commit-tree', tree, '-p', W, '-p', M, '-m', `sync ${main} into ${wf.branch}`]).stdout;
    if (!commit || !git(repoRoot, ['update-ref', `refs/heads/${wf.branch}`, commit, W]).ok) return { ok: false, reason: 'sync-update-failed' };
    return { ok: true, merged: true, head: commit, overlap: overlapPaths.length ? { paths: overlapPaths.slice(0, 50), main: M, workflow: W } : null };
  }
  if (git(wf.path, ['status', '--porcelain', '--untracked-files=no']).stdout) return { ok: false, reason: 'workflow-worktree-dirty' };
  const r = git(wf.path, ['merge', '--no-ff', '--no-edit', '-m', `sync ${main} into ${wf.branch}`, M]);
  if (!r.ok) { git(wf.path, ['merge', '--abort']); return { ok: false, reason: 'sync-merge-failed', detail: r.stderr.slice(0, 300) }; }
  return { ok: true, merged: true, head: revParse(wf.path, 'HEAD'), overlap: overlapPaths.length ? { paths: overlapPaths.slice(0, 50), main: M, workflow: W } : null };
}
const conflictFilesOf = (stdout) => [...new Set(String(stdout).split(/\r?\n\r?\n/)[0].split(/\r?\n/).slice(1).map((l) => l.split('\t')[1]).filter(Boolean))].slice(0, 20);

/**
 * The op's own worktree off the CURRENT workflow branch (reused when it exists: a requeued attempt of the same job
 * keeps its tree). A continuation (`handFrom`: the job ids it continues) whose predecessor archived unlanded commits
 * starts from them and consumes the archive ref. Returns {ok, record} - record is what payload.productWorktree keeps.
 */
export function ensureOpWorktree({ repoRoot, workflowId, jobId, handFrom = [], settings = productSettings(), onEvent = null }) {
  const wf = ensureWorkflowWorktree({ repoRoot, workflowId, settings });
  if (!wf.ok) return { ok: false, reason: wf.reason ?? 'workflow-worktree-unavailable', detail: wf.detail ?? wf.resolution ?? wf.overlay };
  const lay = layoutOf({ repoRoot, workflowId, jobId, settings });
  let sync = null;
  const locked = withLock(workflowLockName(repoRoot, lay.workflow.short), () => {
    sync = syncWorkflowFromMain({ repoRoot, wf: lay.workflow });
    if (sync?.overlap && onEvent) onEvent(EVENTS.overlap, { repoRoot, branch: lay.workflow.branch, ...sync.overlap, merged: Boolean(sync.merged) });
    else if (sync?.merged && onEvent) onEvent(EVENTS.synced, { repoRoot, branch: lay.workflow.branch, head: sync.head });
    const wfTip = revParse(repoRoot, lay.workflow.branch);
    let base = wfTip, handed = null;
    if (!refExists(repoRoot, `refs/heads/${lay.op.branch}`)) {
      for (const prior of handFrom.filter(Boolean)) {
        const arch = archivedOpRef(repoRoot, prior, settings);
        if (arch) { base = arch.sha; handed = { from: prior, ref: arch.ref, sha: arch.sha }; break; }
      }
    }
    const added = addWorktree({ repoRoot, dir: lay.op.path, branch: lay.op.branch, base, description: jobId });
    if (!added.ok) return added;
    if (handed && added.created) git(repoRoot, ['update-ref', '-d', handed.ref]);
    return { ok: true, created: added.created, wfTip, handed };
  }, { waitMs: settings.integrate.lockWaitMs });
  if (!locked.ok) return { ok: false, reason: locked.reason, detail: locked.detail ?? locked.holder };
  const overlay = ensureOverlay({ repoRoot, worktree: lay.op.path, source: installedIn(lay.workflow.path) ? lay.workflow.path : repoRoot, settings });
  const resolution = overlay.fresh ? null : verifyResolution(lay.op.path, overlay);
  if (overlay.ok === false || (resolution && !resolution.ok)) return { ok: false, reason: overlay.ok === false ? (overlay.reason ?? 'overlay-failed') : 'resolution-outside-worktree', detail: resolution ?? summarizeOverlay(overlay) };
  const record = {
    repoRoot: lay.repoRoot, workflowId, jobId,
    workflow: { ...lay.workflow, port: portOf(lay.workflow.path, settings) },
    op: { ...lay.op }, baseSha: locked.wfTip, createdAt: Date.now(),
    ...(locked.handed ? { handedFrom: locked.handed } : {}),
  };
  if (onEvent && locked.created) onEvent(EVENTS.created, { repoRoot: record.repoRoot, op: record.op, workflow: record.workflow, baseSha: record.baseSha, ...(locked.handed ? { handedFrom: locked.handed } : {}), overlay: summarizeOverlay(overlay), ...(resolution ? { resolution } : {}) });
  return { ok: true, created: locked.created, record, overlay: summarizeOverlay(overlay), ...(resolution ? { resolution } : {}), ...(sync ? { sync } : {}) };
}

/** payload.productWorktree of a job payload, or null. */
export const jobWorktreeOf = (jobOrPayload) => {
  const payload = typeof jobOrPayload?.payload_json === 'string' ? (() => { try { return JSON.parse(jobOrPayload.payload_json); } catch { return {}; } })() : (jobOrPayload?.payload ?? jobOrPayload);
  const rec = payload?.productWorktree;
  return rec && rec.repoRoot && rec.op?.path && rec.workflow?.branch ? rec : null;
};

/* ------------------------------------------------------------ isolation policy */

const commitsOf = (brief) => { const m = brief?.policy?.commitPolicy?.mode; return typeof m === 'string' && m.trim() !== '' && m !== 'none'; };
/**
 * The op's isolation: brief policy.isolation ('worktree' | 'shared') when set; else product-land.yaml defaultIsolation,
 * which applies only to an op whose commitPolicy commits - a worktree is removed right after the settle, so an op that
 * leaves its product writes uncommitted (the scaffolds) or writes nothing (the verify/UAT walks, which serve from the
 * WORKFLOW worktree through the environment pre-step) keeps the shared tree.
 */
export const isolationOf = (brief, settings = productSettings()) => String(brief?.policy?.isolation
  ?? (commitsOf(brief) ? settings.defaultIsolation ?? 'shared' : 'shared'));

/**
 * Whether a job gets a product worktree and in which repository: its op isolates, and its owned paths resolve into
 * the bound app repository. One op worktree serves both side folders and Work.
 * {isolate, reason, repoRoot?, role?}. `placements` are ownedPathPlacements with no
 * worktree (target-repo.mjs); `binding` its projectBinding.
 */
export function planIsolation({ brief, placements, binding, settings = productSettings() }) {
  if (isolationOf(brief, settings) !== 'worktree') return { isolate: false, reason: 'policy-shared' };
  if (!binding) return { isolate: false, reason: 'no-project-binding' };
  const roles = new Set((placements ?? []).filter((p) => !p.unresolved && p.role && p.via !== 'work-owner').map((p) => p.role));
  if (!roles.size) return { isolate: false, reason: 'work-only' };
  const role = roles.size === 1 ? [...roles][0] : null;
  const appRoot = binding.appRoot;
  if (!appRoot || !fs.existsSync(path.join(appRoot, '.git'))) return { isolate: false, reason: 'repo-not-a-checkout', role };
  // The runtime repository (a binding's grammar role is .claude itself) changes only through its own land gate.
  if (insidePath(appRoot, SKILL_ROOT) || samePath(appRoot, SKILL_ROOT)) return { isolate: false, reason: 'runtime-repo', role };
  return { isolate: true, repoRoot: path.resolve(appRoot), role };
}

/** The rules every isolated op's prompt carries (mitigation 5: the path is explicit to every tool). */
export function worktreePromptRules(rec, sideCwd = null) {
  if (!rec) return '';
  const op = posix(rec.op.path), wf = posix(rec.workflow.path);
  const cwd = sideCwd ? posix(sideCwd) : op;
  return [
    '',
    '## Your product worktree (DESIGN §16.7)',
    `- Edit, check and commit ONLY in ${op} (branch ${rec.op.branch}, off ${rec.workflow.branch} at ${String(rec.baseSha ?? '').slice(0, 12)}). Never edit ${posix(rec.repoRoot)} itself or a sibling worktree.`,
    `- Run role-specific checks and commands from ${cwd}; the app's package.json and .starciwork are at ${op}.`,
    `- Dev servers, UAT and drawing run against the WORKFLOW worktree ${wf} on port ${rec.workflow.port ?? portOf(rec.workflow.path)}; never start one in ${posix(rec.repoRoot)}.`,
    '- node_modules is a junction overlay of the main checkout: never run npm/pnpm install here. A package.json or lockfile change belongs to the workflow\'s serial deps unit.',
    '- Commit everything you produce under .starciwork/ in this worktree before you report; the runtime salvages and then deletes this worktree right after your settle.',
    `- Your commits reach ${rec.workflow.branch} at settle (rebased onto its tip and re-checked there); the Kernel lands ${rec.workflow.branch} into main.`,
  ].join('\n');
}

/* ------------------------------------------------------------ integration (settle pass) */

const authorEnvOf = (repoRoot, sha) => {
  const r = git(repoRoot, ['log', '-1', '--format=%an%x00%ae%x00%aI%x00%B', sha]);
  const [name, email, date, ...body] = r.stdout.split('\0');
  return { env: { GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_AUTHOR_DATE: date }, message: body.join('\0').trim() || `op commit ${sha}` };
};

/**
 * Rebase `commits` (oldest first) onto `onto` without a working tree: a merge-tree chain, each rebased commit keeping its
 * author and message. {ok, head, map: [{from, to}]} | {ok:false, conflicts: [{commit, file, hunks}]}
 */
/** The conflict-marker regions of a merged text (2 lines of context, capped) - land.mjs conflictHunks' shape. */
export function conflictHunksOf(text, { perFile = 4, maxLines = 40 } = {}) {
  const lines = String(text ?? '').split(/\r?\n/);
  const hunks = [];
  for (let i = 0; i < lines.length && hunks.length < perFile; i += 1) {
    if (!lines[i].startsWith('<<<<<<< ')) continue;
    let end = i + 1;
    while (end < lines.length && !lines[end].startsWith('>>>>>>> ')) end += 1;
    const body = lines.slice(Math.max(0, i - 2), Math.min(lines.length, end + 3)).map((l) => (l.length > 300 ? `${l.slice(0, 300)}...` : l));
    hunks.push({ line: i + 1, text: (body.length > maxLines ? [...body.slice(0, maxLines), `... (${body.length - maxLines} more lines)`] : body).join('\n') });
    i = end;
  }
  return hunks;
}

export function rebaseChain(repoRoot, commits, onto, { hunksOf = conflictHunksOf } = {}) {
  let cur = onto;
  const map = [];
  for (const c of commits) {
    const parent = revParse(repoRoot, `${c}^`);
    const r = git(repoRoot, ['merge-tree', '--write-tree', ...(parent ? ['--merge-base', parent] : []), cur, c]);
    const tree = r.stdout.split(/\r?\n/)[0]?.trim();
    if (r.status === 1 && /^[0-9a-f]{40,64}$/.test(tree ?? '')) {
      const files = conflictFilesOf(r.stdout);
      return { ok: false, conflicts: files.map((file) => ({ commit: c, file, hunks: hunksOf ? hunksOf(git(repoRoot, ['cat-file', '-p', `${tree}:${file}`]).stdout) : [] })), onto: cur };
    }
    if (!r.ok || !/^[0-9a-f]{40,64}$/.test(tree ?? '')) return { ok: false, reason: 'merge-tree-failed', detail: r.stderr.slice(0, 300) };
    const curTree = git(repoRoot, ['rev-parse', `${cur}^{tree}`]).stdout;
    if (tree === curTree) { map.push({ from: c, to: null, empty: true }); continue; }
    const a = authorEnvOf(repoRoot, c);
    const next = git(repoRoot, ['commit-tree', tree, '-p', cur], { env: a.env, input: a.message }).stdout;
    if (!next) return { ok: false, reason: 'commit-tree-failed' };
    map.push({ from: c, to: next });
    cur = next;
  }
  return { ok: true, head: cur, map };
}

/** Replace every spelling of `from` in a check's argv by `to` (the op worktree -> the workflow worktree). */
export const retargetArgv = (argv, from, to) => {
  const spellings = [...new Set([path.resolve(from), posix(path.resolve(from)), String(from)])].sort((a, b) => b.length - a.length);
  return argv.map((a) => spellings.reduce((acc, s) => acc.split(s).join(posix(path.resolve(to))), String(a)));
};

const GATE_SCRIPT = path.join(SKILL_ROOT, 'scripts', 'checks', 'gate.mjs');
/**
 * The land gate: scripts/checks/gate.mjs over the op worktree's whole delta since `base` (no --changed), the same gate the op
 * forced in its loop. Returns its starci/gate@1 report; a gate that printed none is exit 2 with the reason.
 */
export function runLandGate({ root, base, timeoutMs }) {
  if (!root || !fs.existsSync(root)) return { exit: 2, errors: [`the op worktree ${root ?? '(none)'} is gone: nothing to gate`], findings: [], counts: { new: 0 } };
  const run = spawnSync(process.execPath, [GATE_SCRIPT, '--root', root, '--base', base], { cwd: root, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 256 * 1024 * 1024, windowsHide: true });
  try { return JSON.parse(run.stdout); } catch { return { exit: 2, errors: [`gate.mjs printed no report (exit ${run.status ?? 'timeout'}): ${String(run.stderr || run.error?.message || '').trim().split(/\r?\n/).slice(-1)[0]}`], findings: [], counts: { new: 0 } }; }
}

/**
 * Integrate one op into its workflow branch (the settle-pass step): under the per-workflow lock, rebase op/<op>'s
 * commits up to `head` onto the latest wf/<wf>, fast-forward wf/<wf> (and its _wf tree), then verify ON the workflow
 * branch. The land gate runs first (runLandGate: the op branch against its merge-base with wf/<wf>), so a branch green in its
 * op is green here and a red one never touches wf/<wf>. Seams: gate({root, base, timeoutMs}) -> starci/gate@1 report,
 * recheck(checks, {cwd, from, to}) -> [{name, exitCode, tail}] (default: none), hunksOf.
 * Returns {ok, already?, before, after, map, changed, gate, verify} or a refusal {ok:false, reason, ...}:
 *   land-gate-red               the gate reports new findings on the op branch; `gate` carries them; wf/<wf> untouched
 *   land-gate-unavailable       a gate tool could not run (exit 2): never a land
 *   product-integrate-conflict  files + hunks; wf/<wf> untouched (the Kernel rebases the slice or re-cuts)
 *   product-integrate-red       the post-merge verify failed; wf/<wf> rolled back; `continuation` names the new base
 *   deps-unit-required          the op changes a dependency manifest and is not the workflow's deps unit
 */
export function integrateOp({ record, head = null, depsUnit = false, checks = [], recheck = null, hunksOf = conflictHunksOf, gate = runLandGate, settings = productSettings() }) {
  const { repoRoot } = record;
  const wf = record.workflow, op = record.op;
  return withLock(workflowLockName(repoRoot, wf.short), () => {
    const W = revParse(repoRoot, wf.branch);
    if (!W) return { ok: false, reason: 'workflow-branch-missing', branch: wf.branch };
    const opTip = revParse(repoRoot, op.branch);
    const tip = head ? revParse(repoRoot, head) : opTip;
    if (!tip) return { ok: false, reason: 'head-unresolved', head };
    if (opTip && tip !== opTip && !isAncestor(repoRoot, tip, opTip)) return { ok: false, reason: 'head-not-on-op-branch', head: tip, branch: op.branch };
    if (isAncestor(repoRoot, tip, W)) return { ok: true, already: true, before: W, after: W, map: [] };
    const commits = git(repoRoot, ['rev-list', '--reverse', '--no-merges', tip, `^${W}`]).stdout.split(/\r?\n/).filter(Boolean);
    const cherry = cherryOf(repoRoot, wf.branch, tip, W);
    const pending = commits.filter((c) => cherry.get(c) !== '-');
    if (!pending.length) return { ok: true, already: true, before: W, after: W, map: [], viaPatchId: true };
    const base = git(repoRoot, ['merge-base', W, tip]).stdout;
    const changed = git(repoRoot, ['diff', '--name-only', base, tip]).stdout.split(/\r?\n/).filter(Boolean);
    // A dependency manifest the op changes that the workflow branch does not carry yet (its deps unit applies it).
    const deps = changed.filter((f) => settings.integrate.depsFiles.includes(path.posix.basename(f)) && !git(repoRoot, ['diff', '--quiet', W, tip, '--', f]).ok);
    if (deps.length && !depsUnit) return { ok: false, reason: 'deps-unit-required', files: deps, depsUnit: { workflowId: record.workflowId, fromJob: record.jobId },
      hint: `a package.json/lockfile change goes through the workflow's serial deps unit: api product-deps --workflow ${record.workflowId} --from-job ${record.jobId} applies ${deps.join(', ')} on ${wf.branch}, installs in its _wf and rebuilds the op overlays; then settle this job again` };
    const gated = gate({ root: op.path, base, timeoutMs: settings.integrate.gateTimeoutMs });
    const gateSummary = { exit: gated.exit, base, head: gated.head ?? null, counts: gated.counts ?? null, findings: (gated.findings ?? []).slice(0, 40), errors: gated.errors ?? [] };
    if (gated.exit !== 0) return { ok: false, reason: gated.exit === 1 ? 'land-gate-red' : 'land-gate-unavailable', gate: gateSummary,
      hint: gated.exit === 1 ? `the op branch carries findings its base does not have: fix them in ${posix(op.path)} (node scripts/checks/gate.mjs --root ${posix(op.path)} --base ${base}), commit, report the new head`
        : `the land gate could not run a tool (${gateSummary.errors[0] ?? 'no report'}): fix the environment and settle again; a land without its gate never happens` };
    const chain = rebaseChain(repoRoot, pending, W, { hunksOf });
    if (!chain.ok) return { ok: false, reason: chain.conflicts ? 'product-integrate-conflict' : chain.reason, conflicts: chain.conflicts ?? [], onto: W, detail: chain.detail ?? null,
      hint: `rebase ${op.branch} onto ${wf.branch} (git rebase ${wf.branch} in ${posix(op.path)}), resolve the files, commit, report the new head; or re-cut the slice` };
    // Fast-forward the workflow branch and its checked-out integration tree.
    const wfTree = fs.existsSync(wf.path) ? wf.path : null;
    if (wfTree) {
      if (git(wfTree, ['status', '--porcelain', '--untracked-files=no']).stdout) return { ok: false, reason: 'workflow-worktree-dirty', path: wf.path };
      const ff = git(wfTree, ['merge', '--ff-only', chain.head]);
      if (!ff.ok) return { ok: false, reason: 'workflow-ff-failed', detail: ff.stderr.slice(0, 300) };
    } else if (!git(repoRoot, ['update-ref', `refs/heads/${wf.branch}`, chain.head, W]).ok) return { ok: false, reason: 'workflow-moved', branch: wf.branch };
    // Post-merge verify ON the workflow branch: cheap, scoped.
    const verify = { checks: [], imports: null };
    const failures = [];
    if (wfTree && settings.integrate.recheck === 'declared' && recheck && checks.length) {
      verify.checks = recheck(checks, { cwd: wfTree, from: op.path, to: wfTree, timeoutMs: settings.integrate.recheckTimeoutMs });
      // H7: only a RED re-run breaks the merge; a checker that could not run is tooling (verify.unavailable), never a rollback.
      const verdictOf = (c) => checkVerdictOf(c).verdict;
      verify.unavailable = verify.checks.filter((c) => verdictOf(c) === 'unavailable').map((c) => `${c.name}:${c.exitCode ?? '-'}${c.status ? ` ${c.status}` : ''}`);
      failures.push(...verify.checks.filter((c) => verdictOf(c) === 'red').map((c) => `${c.name}:${c.exitCode} ${c.tail ?? ''}`.trim()));
    }
    if (wfTree && settings.integrate.importCheck === 'changed-files') {
      const present = changed.filter((f) => fs.existsSync(path.join(wfTree, f)));
      try { verify.imports = present.length ? brokenImports(wfTree, { only: present, limit: 20 }) : { count: 0, files: 0, broken: [] }; }
      catch (error) { verify.imports = { error: String(error?.message ?? error).slice(0, 200) }; }
      if (verify.imports?.count) failures.push(`IMPORTS_BROKEN_AFTER_MOVE:${verify.imports.count} ${verify.imports.broken.slice(0, 3).map((b) => `${b.from} -> ${b.spec}`).join('; ')}`);
    }
    if (failures.length) {
      if (wfTree) git(wfTree, ['reset', '--hard', W]); else git(repoRoot, ['update-ref', `refs/heads/${wf.branch}`, W, chain.head]);
      return { ok: false, reason: 'product-integrate-red', failures, verify, rolledBack: W,
        continuation: { base: W, resumeFrom: tip, branch: op.branch, note: 'the op is green on its own base and breaks the workflow branch: a continuation on the new base, never a failure' } };
    }
    return { ok: true, before: W, after: chain.head, map: chain.map, changed, gate: gateSummary, verify };
  }, { waitMs: settings.integrate.lockWaitMs });
}

/** `git cherry <upstream> <head> <limit>` as Map<sha, '+'|'-'> ('-': an equivalent patch is already upstream). */
export function cherryOf(repoRoot, upstream, head, limit = null) {
  const r = git(repoRoot, ['cherry', upstream, head, ...(limit ? [limit] : [])]);
  const out = new Map();
  for (const line of r.stdout.split(/\r?\n/).filter(Boolean)) { const [mark, sha] = line.trim().split(/\s+/); if (sha) out.set(sha, mark); }
  return out;
}

/* ------------------------------------------------------------ the deps unit */

/** The install command for a checkout: the first configured lockfile present at its root. */
export function installCommandOf(dir, settings = productSettings()) {
  for (const [lock, argv] of Object.entries(settings.deps.install ?? {})) if (fs.existsSync(path.join(dir, lock))) return { lock, argv };
  return null;
}
const runInstall = (argv, cwd, timeoutMs) => {
  const { file, args } = launchFor(argv);
  const r = spawnSync(file, args, { cwd, encoding: 'utf8', windowsHide: true, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 });
  return { ok: !r.error && r.status === 0, exitCode: r.status, tail: String(r.stderr || r.stdout || r.error?.message || '').trim().split(/\r?\n/).slice(-4).join(' / ').slice(0, 500) };
};

/**
 * The workflow's SERIAL deps unit (DESIGN §16.7, mitigation 1): an op may not change package.json or a lockfile on its
 * own (integrateOp refuses deps-unit-required); this applies exactly the dependency manifests `fromJob` changed onto
 * wf/<wf> as one commit in the _wf worktree, replaces _wf's junction overlay with a REAL install (settings.deps.install,
 * e.g. npm ci), marks it (the overlay source of the workflow's ops from now on) and rebuilds the overlay of every live op
 * worktree of the workflow. Under the per-workflow lock; a failed install rolls wf/<wf> back and restores the overlay.
 * The job itself then settles again (its manifests now equal the workflow branch's). Seam: install(argv, cwd, timeoutMs).
 * {ok, commit, files, install, rebuilt: [op dir]} | {ok:false, reason}
 */
export function applyDepsUnit({ record, settings = productSettings(), install = runInstall }) {
  const { repoRoot } = record;
  const wf = record.workflow;
  return withLock(workflowLockName(repoRoot, wf.short), () => {
    if (!fs.existsSync(wf.path)) return { ok: false, reason: 'workflow-worktree-missing', path: wf.path };
    const W = revParse(repoRoot, wf.branch);
    const tip = revParse(repoRoot, record.op.branch) ?? archivedOpRef(repoRoot, record.jobId, settings)?.sha ?? null;
    if (!W || !tip) return { ok: false, reason: 'ref-unresolved', branch: record.op.branch };
    const base = git(repoRoot, ['merge-base', W, tip]).stdout;
    const files = git(repoRoot, ['diff', '--name-only', base, tip]).stdout.split(/\r?\n/).filter(Boolean)
      .filter((f) => settings.integrate.depsFiles.includes(path.posix.basename(f)) && !git(repoRoot, ['diff', '--quiet', W, tip, '--', f]).ok);
    if (!files.length) return { ok: true, nothing: true, files: [] };
    if (git(wf.path, ['status', '--porcelain', '--untracked-files=no']).stdout) return { ok: false, reason: 'workflow-worktree-dirty', path: wf.path };
    const co = git(wf.path, ['checkout', tip, '--', ...files]);
    if (!co.ok) return { ok: false, reason: 'deps-apply-failed', detail: co.stderr.slice(0, 300) };
    const c = git(wf.path, ['commit', '-q', '-m', `deps: ${files.join(', ')} (deps unit for ${record.jobId})`]);
    if (!c.ok) { git(wf.path, ['reset', '--hard', W]); return { ok: false, reason: 'deps-commit-failed', detail: c.stderr.slice(0, 300) }; }
    const commit = revParse(wf.path, 'HEAD');
    const cmd = installCommandOf(wf.path, settings);
    const out = { ok: true, commit, files, install: null, rebuilt: [] };
    if (cmd) {
      const rm = removeOverlay(wf.path, { settings });
      if (!rm.ok) { git(wf.path, ['reset', '--hard', W]); return { ok: false, reason: 'overlay-link-stuck', stuck: rm.stuck }; }
      try { safeRemoveTree(path.join(wf.path, 'node_modules')); } catch { /* the install recreates it */ }
      const r = install(cmd.argv, wf.path, settings.deps.installTimeoutMs);
      out.install = { lock: cmd.lock, argv: cmd.argv, ...r };
      if (!r.ok) {
        git(wf.path, ['reset', '--hard', W]);
        removeOverlay(wf.path, { settings });
        try { safeRemoveTree(path.join(wf.path, 'node_modules')); } catch { /* rebuilt below */ }
        ensureOverlay({ repoRoot, worktree: wf.path, settings });
        return { ok: false, reason: 'deps-install-failed', files, install: out.install, rolledBack: W };
      }
      fs.mkdirSync(path.join(wf.path, 'node_modules'), { recursive: true });
      fs.writeFileSync(path.join(wf.path, 'node_modules', INSTALL_MARKER), JSON.stringify({ lockHash: lockHashOf(wf.path, settings), commit, job: record.jobId, installedAt: new Date().toISOString() }));
    }
    let ops = [];
    try { ops = fs.readdirSync(path.dirname(wf.path)).filter((n) => n !== WORKFLOW_DIR_NAME); } catch { ops = []; }
    for (const name of ops) {
      const dir = path.join(path.dirname(wf.path), name);
      const r = ensureOverlay({ repoRoot, worktree: dir, source: installedIn(wf.path) ? wf.path : repoRoot, settings });
      out.rebuilt.push({ path: dir, ok: r.ok !== false });
    }
    return out;
  }, { waitMs: settings.integrate.lockWaitMs });
}

/* ------------------------------------------------------------ removal */

/**
 * Salvage what the worktree holds that no commit carries, before it is deleted (mitigation 4): every dirty or untracked
 * file under .starciwork/ is copied to `dest` and verified byte-equal; other uncommitted tracked changes are kept as
 * dest/uncommitted.patch. {ok, copied: [rel], patch: file|null, missing: [rel]} - ok only when every .starciwork file
 * was copied and verified.
 */
export function salvageEvidence(worktree, dest) {
  const out = { ok: true, copied: [], patch: null, missing: [] };
  if (!fs.existsSync(worktree)) return out;
  const st = git(worktree, ['status', '--porcelain', '-z', '--untracked-files=all']);
  if (!st.ok) return { ...out, ok: false, reason: 'status-failed', detail: st.stderr.slice(0, 200) };
  const recs = st.stdout.split('\0');
  const files = [];
  for (let i = 0; i < recs.length; i++) {
    if (!recs[i]) continue;
    const code = recs[i].slice(0, 2), rel = recs[i].slice(3);
    if (/[RC]/.test(code)) i++;
    if (isWorktreesPath(rel)) continue;
    files.push({ code, rel: posix(rel) });
  }
  const evidence = files.filter((f) => f.rel === '.starciwork' || f.rel.startsWith('.starciwork/'));
  for (const f of evidence) {
    const src = path.join(worktree, f.rel);
    const walk = (abs, rel) => {
      let s; try { s = fs.lstatSync(abs); } catch { return; }
      if (s.isDirectory() && !isLinkLike(abs, { stat: s })) { for (const n of fs.readdirSync(abs)) walk(path.join(abs, n), `${rel}/${n}`); return; }
      if (!s.isFile()) return;
      const to = path.join(dest, 'worktree-salvage', ...rel.split('/'));
      try {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.copyFileSync(abs, to);
        if (!fs.readFileSync(abs).equals(fs.readFileSync(to))) throw Error('copy differs');
        out.copied.push(rel);
      } catch { out.missing.push(rel); }
    };
    walk(src, f.rel.replace(/\/+$/, ''));
  }
  const tracked = files.filter((f) => f.code !== '??' && !(f.rel.startsWith('.starciwork/')));
  if (tracked.length) {
    const diff = git(worktree, ['diff', 'HEAD', '--binary']);
    if (diff.stdout) {
      const file = path.join(dest, 'worktree-salvage', 'uncommitted.patch');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `${diff.stdout}\n`);
      out.patch = file;
    }
  }
  out.ok = out.missing.length === 0;
  return out;
}

const removeDirIfEmpty = (dir) => { try { if (fs.existsSync(dir) && !fs.readdirSync(dir).length) fs.rmdirSync(dir); } catch { /* busy or not empty */ } return !fs.existsSync(dir); };

/**
 * Remove one worktree the runtime made: salvage + assert (when `salvageTo`), unlink the overlay junctions first, remove
 * the tree with safeRemoveTree (never `git worktree remove --force`, never through a link), `git worktree prune`, then
 * VERIFY: directory gone and no registration left. {ok, verified: {dirGone, pruned}, salvage, overlay} | {ok:false, reason}
 */
export function removeWorktreeVerified({ repoRoot, dir, salvageTo = null, settings = productSettings() }) {
  const out = { ok: false, path: dir, verified: { dirGone: false, pruned: false } };
  if (fs.existsSync(dir)) {
    if (salvageTo) {
      out.salvage = salvageEvidence(dir, salvageTo);
      if (!out.salvage.ok) return { ...out, reason: 'evidence-unsalvaged' };
    }
    out.overlay = removeOverlay(dir, { settings });
    if (!out.overlay.ok) return { ...out, reason: 'overlay-link-stuck' };
    const rm = safeRemoveTree(dir);
    if (!rm.ok) return { ...out, reason: 'remove-failed', errors: rm.errors.slice(0, 5) };
  }
  git(repoRoot, ['worktree', 'prune']);
  out.verified.dirGone = !fs.existsSync(dir);
  out.verified.pruned = !registeredAt(repoRoot, dir);
  out.ok = out.verified.dirGone && out.verified.pruned;
  if (!out.ok) out.reason = out.verified.dirGone ? 'prune-unverified' : 'dir-remains';
  return out;
}

/**
 * Remove a job's op worktree and branch (released -> worktree-removed). The branch is deleted, or - when it holds
 * commits the workflow branch lacks (a partial commit a continuation reuses) and keepUnmerged - archived as
 * refs/starci/archive/op/<op> first. The <wf> directory goes too once empty.
 */
export function removeOpWorktree({ record, salvageTo = null, keepUnmerged = true, settings = productSettings() }) {
  const { repoRoot } = record;
  const out = removeWorktreeVerified({ repoRoot, dir: record.op.path, salvageTo, settings });
  if (!out.ok) return out;
  const branch = record.op.branch;
  out.branch = { name: branch, deleted: false, archived: null };
  const tip = revParse(repoRoot, `refs/heads/${branch}`);
  if (tip) {
    const unmerged = [...cherryOf(repoRoot, record.workflow.branch, tip, record.baseSha ?? null)].filter(([, m]) => m === '+').map(([s]) => s);
    if (unmerged.length && keepUnmerged) {
      const ref = `${ARCHIVE_PREFIX}/op/${record.op.short}`;
      if (git(repoRoot, ['update-ref', ref, tip]).ok) out.branch.archived = { ref, sha: tip, commits: unmerged.length };
      else return { ...out, ok: false, reason: 'archive-failed' };
    }
    out.branch.deleted = git(repoRoot, ['branch', '-D', branch]).ok;
    if (!out.branch.deleted) return { ...out, ok: false, reason: 'branch-delete-failed' };
  } else out.branch.deleted = true;
  git(repoRoot, ['config', '--remove-section', `branch.${branch}`]);
  out.wfDirRemoved = removeDirIfEmpty(path.dirname(record.op.path));
  return out;
}

/** Whether wf/<wf> is fully in main: an ancestor, or every commit patch-equivalent (a cherry-picked land). */
export function workflowLanded(repoRoot, wfBranch, main = 'main') {
  const W = revParse(repoRoot, wfBranch), M = revParse(repoRoot, main);
  if (!W) return { landed: true, why: 'branch-gone' };
  if (!M) return { landed: false, why: 'main-unresolved' };
  if (isAncestor(repoRoot, W, M)) return { landed: true, why: 'ancestor' };
  const plus = [...cherryOf(repoRoot, main, W)].filter(([, m]) => m === '+');
  return plus.length ? { landed: false, why: 'unlanded-commits', commits: plus.length } : { landed: true, why: 'patch-equivalent' };
}

/** Remove the workflow's integration worktree (+ branch, archived when unlanded/abandoned) once no op dir is left. */
export function removeWorkflowWorktree({ repoRoot, workflowId, salvageTo = null, abandoned = false, settings = productSettings() }) {
  const lay = layoutOf({ repoRoot, workflowId, settings });
  let others = [];
  try { others = fs.readdirSync(lay.wfDir).filter((n) => n !== WORKFLOW_DIR_NAME); } catch { /* none */ }
  if (others.length) return { ok: false, reason: 'op-worktrees-remain', ops: others };
  const landed = workflowLanded(repoRoot, lay.workflow.branch);
  if (!landed.landed && !abandoned) return { ok: false, reason: 'workflow-unlanded', landed };
  const out = removeWorktreeVerified({ repoRoot, dir: lay.workflow.path, salvageTo, settings });
  if (!out.ok) return out;
  const tip = revParse(repoRoot, `refs/heads/${lay.workflow.branch}`);
  out.branch = { name: lay.workflow.branch, deleted: !tip, archived: null };
  if (tip) {
    if (!landed.landed) {
      const ref = `${ARCHIVE_PREFIX}/wf/${lay.workflow.short}`;
      if (!git(repoRoot, ['update-ref', ref, tip]).ok) return { ...out, ok: false, reason: 'archive-failed' };
      out.branch.archived = { ref, sha: tip };
    }
    out.branch.deleted = git(repoRoot, ['branch', '-D', lay.workflow.branch]).ok;
    git(repoRoot, ['config', '--remove-section', `branch.${lay.workflow.branch}`]);
  }
  out.wfDirRemoved = removeDirIfEmpty(lay.wfDir);
  out.landed = landed;
  return out;
}

/* ------------------------------------------------------------ the duty (settler backstop) + leftovers */

const parse = (t) => { try { return JSON.parse(t); } catch { return null; } };
const hasEvent = (db, jobId, kind) => Boolean(db.prepare('SELECT 1 FROM events WHERE entity_id=? AND kind=? LIMIT 1').get(jobId, kind));
const releasedOf = (db, row, payload) => hasEvent(db, row.job_id, 'job-settle-released')
  || payload?.terminalClosed?.verified?.ok === true || payload?.terminalClosed?.custody?.state === 'released'
  || payload?.workerReleased?.custody?.state === 'closed-verified' || payload?.managedWorker?.custody?.state === 'released'
  || (!row.worker_id && !payload?.orca?.agentTerminalHandle && !payload?.managed);

/**
 * A workflow's end as the ledger sees it: {ended, refused}. `refused` - archived: events_refuse_archived refuses every
 * event of it, so a write would throw on every pass. `ended` - archived or finished: its jobs' worktrees are still
 * removed and verified, but no job event is written for them (nothing reads it any more, and a refused write retried
 * each pass is a hot loop).
 */
export function workflowEndOf(db, workflowId) {
  const w = db.prepare('SELECT phase, archived_at FROM workflows WHERE workflow_id=?').get(workflowId);
  const refused = w?.phase === 'archived' || Boolean(w?.archived_at);
  return { ended: refused || w?.phase === 'finished', refused };
}

/** Where a job's worktree salvage goes: the ledger repo's durable evidence dir of the job. */
export const salvageDirOf = (ledgerRepo, workflowId, jobId) => path.join(ledgerRepo, '.starciwork', 'evidence', workflowId, jobId);

/**
 * Remove one settled job's op worktree now (api settle's detached `reap`, the settler's duty). Idempotent: a job with a
 * job-worktree-removed event is done. Records the transition released -> worktree-removed (or a typed failure).
 */
export function reapJobWorktree({ ledger, ledgerRepo, jobId, now = Date.now(), force = false, settings = productSettings() }) {
  const db = ledger.db;
  const row = db.prepare('SELECT job_id, workflow_id, status, worker_id, payload_json, updated_at FROM jobs WHERE job_id=?').get(jobId);
  if (!row) return { jobId, skipped: 'job-unknown' };
  const payload = parse(row.payload_json) ?? {};
  const record = jobWorktreeOf(payload);
  if (!record || (record.jobId && record.jobId !== jobId)) return { jobId, skipped: 'not-isolated' };
  if (!SETTLED.includes(row.status)) return { jobId, skipped: `job-${row.status}` };
  if (hasEvent(db, jobId, EVENTS.removed)) return { jobId, skipped: 'already-removed' };
  const { ended } = workflowEndOf(db, row.workflow_id);
  // An ended workflow's job records no event, so "done" is the disk: folder, registration and branch all gone.
  if (ended && !fs.existsSync(record.op.path) && !registeredAt(record.repoRoot, record.op.path) && !revParse(record.repoRoot, `refs/heads/${record.op.branch}`))
    return { jobId, skipped: 'workflow-ended' };
  const released = releasedOf(db, row, payload);
  const settledAgo = now - Number(row.updated_at ?? now);
  if (!released && !force && settledAgo < settings.worktrees.opRemoveSlaMs) return { jobId, skipped: 'awaiting-release' };
  const r = removeOpWorktree({ record, salvageTo: salvageDirOf(ledgerRepo, row.workflow_id, jobId), settings });
  if (ended) return r.ok ? { jobId, removed: true, workflowEnded: true, branch: r.branch, verified: r.verified, settledAgoMs: settledAgo }
    : { jobId, removed: false, workflowEnded: true, reason: r.reason, errors: r.errors ?? null };
  const ev = (kind, p) => ledger.transaction(() => ledger.appendEvent({ workflowId: row.workflow_id, entityType: 'job', entityId: jobId, kind, payload: p }));
  if (!r.ok) {
    const prior = db.prepare('SELECT payload_json FROM events WHERE entity_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(jobId, EVENTS.removeFailed);
    if (parse(prior?.payload_json)?.reason !== r.reason) ev(EVENTS.removeFailed, { path: record.op.path, reason: r.reason, errors: r.errors ?? null, salvage: r.salvage ?? null });
    return { jobId, removed: false, reason: r.reason };
  }
  ev(EVENTS.removed, { from: released ? 'released' : 'settled', to: 'worktree-removed', status: row.status, path: record.op.path, branch: r.branch,
    verified: r.verified, salvaged: r.salvage ? { copied: r.salvage.copied.length, patch: Boolean(r.salvage.patch) } : null, settledAgoMs: settledAgo, wfDirRemoved: r.wfDirRemoved });
  if (settledAgo > settings.worktrees.opRemoveSlaMs) ev(EVENTS.slaMissed, { path: record.op.path, settledAgoMs: settledAgo, slaMs: settings.worktrees.opRemoveSlaMs, released });
  return { jobId, removed: true, branch: r.branch, settledAgoMs: settledAgo };
}

/** Isolated jobs of one ledger: [{row, payload, record}] (status filter optional). */
export function isolatedJobs(db, { statuses = null, workflowId = null } = {}) {
  const where = ["json_extract(payload_json,'$.productWorktree.op.path') IS NOT NULL"];
  const args = [];
  if (statuses) { where.push(`status IN (${statuses.map(() => '?').join(',')})`); args.push(...statuses); }
  if (workflowId) { where.push('workflow_id=?'); args.push(workflowId); }
  return db.prepare(`SELECT job_id, workflow_id, status, worker_id, payload_json, updated_at FROM jobs WHERE ${where.join(' AND ')}`).all(...args)
    .map((row) => { const payload = parse(row.payload_json) ?? {}; return { row, payload, record: jobWorktreeOf(payload) }; })
    // A retry's payload may carry its predecessor's record: only a job's OWN record counts.
    .filter((j) => j.record && (!j.record.jobId || j.record.jobId === j.row.job_id));
}

/**
 * One pass for a ledger (the settler calls it every allocation.settler.everyMs): reap every released isolated op
 * worktree, remove every finished/archived workflow's integration worktree once landed (or abandoned), bring main into
 * running workflows' branches (overlap signal), then sweep leftovers (each one logged as a bug).
 */
export function productWorktreeDuty({ ledger, ledgerRepo, now = Date.now(), settings = productSettings(), sync = true } = {}) {
  const db = ledger.db;
  const out = { reaped: [], workflows: [], synced: [], leftovers: [], errors: [] };
  for (const { row, record } of isolatedJobs(db, { statuses: SETTLED })) {
    if (hasEvent(db, row.job_id, EVENTS.removed)) continue;
    // An ended workflow's job writes no event: its folder gone is its done mark (no git call per pass for history).
    if (!fs.existsSync(record.op.path) && workflowEndOf(db, row.workflow_id).ended) continue;
    try { const r = reapJobWorktree({ ledger, ledgerRepo, jobId: row.job_id, now, settings }); if (!r.skipped) out.reaped.push(r); }
    catch (error) { out.errors.push({ jobId: row.job_id, error: String(error?.message ?? error).slice(0, 300) }); }
  }
  const byWorkflow = new Map();
  for (const { row, record } of isolatedJobs(db)) {
    const key = `${row.workflow_id}\0${record.repoRoot}`;
    if (!byWorkflow.has(key)) byWorkflow.set(key, { workflowId: row.workflow_id, repoRoot: record.repoRoot, live: 0 });
    if (!SETTLED.includes(row.status)) byWorkflow.get(key).live += 1;
  }
  for (const w of byWorkflow.values()) {
    try {
      const wfRow = db.prepare('SELECT phase, archived_at FROM workflows WHERE workflow_id=?').get(w.workflowId);
      const lay = layoutOf({ repoRoot: w.repoRoot, workflowId: w.workflowId, settings });
      const done = wfRow?.phase === 'finished' || Boolean(wfRow?.archived_at);
      if (done && !w.live) {
        if (!fs.existsSync(lay.workflow.path) && !revParse(w.repoRoot, `refs/heads/${lay.workflow.branch}`)) continue;
        if (db.prepare('SELECT 1 FROM events WHERE entity_id=? AND kind=? AND json_extract(payload_json,\'$.repoRoot\')=? LIMIT 1').get(w.workflowId, EVENTS.wfRemoved, w.repoRoot)) continue;
        const abandoned = Boolean(db.prepare("SELECT 1 FROM events WHERE entity_id=? AND kind='workflow-branch-abandoned' LIMIT 1").get(w.workflowId));
        const r = removeWorkflowWorktree({ repoRoot: w.repoRoot, workflowId: w.workflowId, abandoned, salvageTo: salvageDirOf(ledgerRepo, w.workflowId, '_workflow'), settings });
        if (r.ok && !workflowEndOf(db, w.workflowId).refused) ledger.transaction(() => ledger.appendEvent({ workflowId: w.workflowId, entityType: 'workflow', entityId: w.workflowId, kind: EVENTS.wfRemoved,
          payload: { repoRoot: w.repoRoot, path: lay.workflow.path, branch: r.branch, verified: r.verified, landed: r.landed, abandoned } }));
        out.workflows.push({ workflowId: w.workflowId, repoRoot: w.repoRoot, removed: r.ok, reason: r.reason ?? null });
      } else if (!done && sync && revParse(w.repoRoot, `refs/heads/${lay.workflow.branch}`)) {
        const held = claimManager(workflowLockName(w.repoRoot, lay.workflow.short));
        if (!held.ok) continue;
        try {
          const s = syncWorkflowFromMain({ repoRoot: w.repoRoot, wf: lay.workflow });
          if (s.overlap || s.merged) {
            const kind = s.ok ? EVENTS.synced : EVENTS.overlap;
            const mainSha = s.overlap?.main ?? null;
            const seen = mainSha && db.prepare('SELECT 1 FROM events WHERE entity_id=? AND kind=? AND json_extract(payload_json,\'$.main\')=? LIMIT 1').get(w.workflowId, EVENTS.overlap, mainSha);
            if (!seen) ledger.transaction(() => ledger.appendEvent({ workflowId: w.workflowId, entityType: 'workflow', entityId: w.workflowId, kind,
              payload: { repoRoot: w.repoRoot, branch: lay.workflow.branch, merged: Boolean(s.merged), ...(s.overlap ?? {}), ...(s.head ? { head: s.head } : {}) } }));
          }
          out.synced.push({ workflowId: w.workflowId, ok: s.ok, merged: Boolean(s.merged), reason: s.reason ?? null });
        } finally { held.release(); }
      }
    } catch (error) { out.errors.push({ workflowId: w.workflowId, error: String(error?.message ?? error).slice(0, 300) }); }
  }
  for (const repoRoot of new Set([...byWorkflow.values()].map((w) => w.repoRoot))) {
    try { out.leftovers.push(...sweepLeftovers({ ledger, ledgerRepo, repoRoot, now, settings })); }
    catch (error) { out.errors.push({ repoRoot, error: String(error?.message ?? error).slice(0, 300) }); }
  }
  return out;
}

/**
 * The GC half: op dirs under <repo>/.starciwork/worktrees whose job (branch description) is settled and past the SLA,
 * or unknown to this ledger's settled set, are removed; each is a bug (event product-worktree-leftover). Empty <wf>
 * dirs are removed. Workflow dirs are left to the duty (they wait on landing). [{path, jobId, removed, reason}]
 */
export function sweepLeftovers({ ledger, ledgerRepo, repoRoot, now = Date.now(), settings = productSettings() }) {
  const db = ledger.db;
  const root = worktreesRootOf(repoRoot);
  const out = [];
  let wfDirs = [];
  try { wfDirs = fs.readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return out; }
  const registered = worktreeList(repoRoot);
  for (const wf of wfDirs) {
    const wfDir = path.join(root, wf);
    for (const name of fs.readdirSync(wfDir)) {
      if (name === WORKFLOW_DIR_NAME) continue;
      const dir = path.join(wfDir, name);
      const reg = registered.find((w) => samePath(w.path, dir));
      const jobId = reg?.branch ? descriptionOf(repoRoot, reg.branch) : null;
      const row = jobId ? db.prepare('SELECT job_id, workflow_id, status, updated_at, payload_json FROM jobs WHERE job_id=?').get(jobId) : null;
      if (!row) continue; // not this ledger's job (or not ours): never touched here
      if (!SETTLED.includes(row.status) || now - Number(row.updated_at ?? now) < settings.worktrees.opRemoveSlaMs * 5) continue;
      const record = jobWorktreeOf(parse(row.payload_json) ?? {});
      if (!record) continue;
      const r = removeOpWorktree({ record, salvageTo: salvageDirOf(ledgerRepo, row.workflow_id, jobId), settings });
      out.push({ path: dir, jobId, removed: r.ok, reason: r.reason ?? null });
      if (workflowEndOf(db, row.workflow_id).ended) continue; // no event for an ended workflow (reapJobWorktree)
      ledger.transaction(() => ledger.appendEvent({ workflowId: row.workflow_id, entityType: 'job', entityId: jobId, kind: EVENTS.leftover,
        payload: { bug: true, path: dir, status: row.status, settledAgoMs: now - Number(row.updated_at ?? now), removed: r.ok, reason: r.reason ?? null } }));
      if (r.ok && !hasEvent(db, jobId, EVENTS.removed)) ledger.transaction(() => ledger.appendEvent({ workflowId: row.workflow_id, entityType: 'job', entityId: jobId, kind: EVENTS.removed,
        payload: { from: 'leftover', to: 'worktree-removed', path: dir, branch: r.branch, verified: r.verified } }));
    }
    removeDirIfEmpty(wfDir);
  }
  return out;
}

/* ------------------------------------------------------------ cli */

async function main(argv) {
  const [verb, ...rest] = argv;
  const flag = (name) => { const at = rest.indexOf(`--${name}`); return at >= 0 ? rest[at + 1] : undefined; };
  const json = rest.includes('--json');
  const repo = flag('repo') ? path.resolve(flag('repo')) : null;
  if (!['reap', 'status'].includes(verb) || !repo) {
    console.error('use: product-worktree.mjs reap --repo <ledger repo> [--job <id>] [--json] | status --repo <ledger repo> [--json]');
    return 2;
  }
  const { openLedger, ledgerFileFor } = await import('../../engine/ledger-db.mjs');
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    if (verb === 'status') {
      const jobs = isolatedJobs(ledger.db).map(({ row, record }) => ({ jobId: row.job_id, workflowId: row.workflow_id, status: row.status, path: record.op.path,
        exists: fs.existsSync(record.op.path), removed: hasEvent(ledger.db, row.job_id, EVENTS.removed) }));
      const out = { ok: true, repo, jobs, live: jobs.filter((j) => j.exists).length };
      console.log(json ? JSON.stringify(out) : `${out.live} live product worktree(s)\n${jobs.filter((j) => j.exists).map((j) => `  ${j.jobId} ${j.status} ${j.path}`).join('\n')}`);
      return 0;
    }
    const out = flag('job') ? { reaped: [reapJobWorktree({ ledger, ledgerRepo: repo, jobId: flag('job'), force: rest.includes('--force') })] } : productWorktreeDuty({ ledger, ledgerRepo: repo });
    console.log(json ? JSON.stringify(out) : JSON.stringify(out, null, 2));
    return 0;
  } finally { ledger.close(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
