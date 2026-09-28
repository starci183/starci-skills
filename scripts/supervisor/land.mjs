#!/usr/bin/env node
// land.mjs — the ONE land gate of the live runtime (modules/supervisor/supervise.yaml landGate, docs/supervisor.md).
// Serialized by a host lock; a change reaches live main only through all of it, or not at all.
//
//   node scripts/supervisor/land.mjs --job <jobId> [--specs <csv>] [--no-push] [--notify] [--json]
//   node scripts/supervisor/land.mjs --commit <sha>[,<sha>...] [--specs <csv|touching|all>] [--lane <name>] [--no-push] [--notify] [--json]
//   node scripts/supervisor/land.mjs --status [--json]
//
// 1. The land queue in machine.sqlite (engine/machine-db.mjs land_queue): each waiter files a ticket and only the
//    oldest live ticket enters the gate; a ticket whose process died is cancelled (waits up to --wait-ms, default
//    runtimes.yaml allocation.landGate.waitMs). Every run is a land_runs row (full output as blobs, G9/MB-10).
// 2. Rebase-free apply: a scratch worktree (detached) of current main under <lanesRoot>/land
//    (scripts/lib/hk-lanes.mjs lanesRoot: allocation.housekeeping.lanesRoot, default D:/starci-lanes), then
//    `git cherry-pick` of the commit(s). A conflict lands nothing; a pick with no diff against main is
//    already landed and moves nothing. Before a waiter even joins the queue, a lock-free preflight
//    (`git merge-tree` of each commit onto main, conflictPreflight) refuses a pick that cannot apply, so a lane
//    never waits an hour for a conflict. Either way a conflict names every file and its conflict hunks
//    (`conflicts`) and the one fix (rebase the lane onto main, resolve those hunks, land the new sha).
//    Append-only files (.gitattributes merge=union) never conflict.
// 3. Checks on the result, each red one refusing the land:
//      node --check of every changed .mjs; YAML/JSON parse of every changed .yaml/.yml/.json;
//      check-module-yaml, check-contract-cites, check-api-surface, check-db-openers (red only when red on the candidate and not
//        the same on main, so a lane's pre-existing breakage never blocks an unrelated land);
//      the specs named by the worker/--specs plus every spec that names a changed file (node --test,
//        --test-concurrency allocation.landGate.specConcurrency, timeout specsBaseMs + perSpecMs per spec) -
//        only while config.yaml `specs.harness` is true (the default). With `specs.harness: false` (owner, 2026-09-28) the gate
//        runs NO spec unless the land asks: --specs <csv> runs those, --specs touching the old set (named plus
//        every spec naming a changed file), --specs all every tests/*.spec.mjs (engine/config.mjs harnessSpecsEnabled);
//      contract-changes: every changed contract/schema/knowledge/op file (CONTRACT_PREFIXES) is covered by
//        `paths` of an entry the change itself adds or edits - an entry file modules/kernel/contract-changes/<id>.yaml,
//        or (transition) an item of the old modules/kernel/contract-changes.yaml list (contract-changes-store.mjs);
//      gate-stability (a REPORT, never a refusal): a land touching a frozen family's gatePaths, or adding/editing
//        a contract change that adds checks or codes for it (modules/kernel/contract-freeze.yaml), runs the family's
//        gates as main and as the candidate have them over the latest accepted leg of every live workflow
//        (scripts/supervisor/gate-stability.mjs, read-only) and reports how many would flip - so the Supervisor
//        decides when to api contract-release it.
// 4. Fast-forward live main: main must still be the scratch's base (else the whole gate reruns on the new main,
//    at most 3 times), the live checkout must be on main and clean for the changed paths; then
//    `git update-ref refs/heads/main <new> <base>` (compare-and-swap) and a working-tree + index update of just
//    those paths. A failed tree update rolls the ref and the paths back.
// 5. Push main (secret scan of origin/main..main first, hooks on) unless --no-push or config
//    supervisor.landGate.push is false. A push the remote refuses leaves the land in place and is reported.
// A worker job lands as `succeeded` and its staging checkout and temp branch are removed - so does a self job
// (workers.mjs stage --self) whose branch --commit landed in full (selfJobsLandedBy); a red gate records
// `land-failed` and, with --notify, tells the Supervisor through its inbox. Nothing half-lands.
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { lowerOwnPriority } from '../lib/low-priority.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { allocationMs, allocationSettings, harnessSpecsEnabled } from '../../engine/config.mjs';
import { git, normPath, unlinkNodeModulesLink } from './workers.mjs';
import { withMachine, readMachine } from '../../engine/machine-db.mjs';
import { lanesRoot } from '../lib/hk-lanes.mjs';
import { scanRange, scanHint } from './push-mains.mjs';
import { safeRemoveTree } from '../lib/safe-remove.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { hostThrottle } from '../lib/ram-throttle.mjs';
import { grammarDistStatus } from '../checks/grammar-dist.mjs';
import { CONTRACT_CHANGES_FILE, CONTRACT_CHANGES_DIR, isContractChangesPath, readContractChangesDocAt } from '../kernel/contract-changes-store.mjs';
import { SKILL_ROOT, landRoot, supervisorSettings } from './home.mjs';

const selfFile = fileURLToPath(import.meta.url);
/** The old single-file registry (transition: still read); new entries are files under CONTRACT_CHANGES_DIR. */
export const CONTRACT_CHANGES = CONTRACT_CHANGES_FILE;
export { CONTRACT_CHANGES_DIR };
export const CONTRACT_PREFIXES = Object.freeze(['knowledge/', 'modules/schemas/', 'modules/ops/', 'modules/kernel/', 'modules/supervisor/', 'modules/models/code-patterns.yaml']);
export const TREE_CHECKS = Object.freeze(['scripts/checks/check-module-yaml.mjs', 'scripts/checks/check-contract-cites.mjs', 'scripts/checks/check-api-surface.mjs', 'scripts/checks/check-db-openers.mjs']);
export const MAX_MAIN_RETRIES = 3;
export const LAND_WAIT_MS = allocationMs('landGate.waitMs');
/** The spec run's timeout: a base plus a share per spec, so a 70-spec engine change is not cut off under load. */
export const specConcurrency = () => { const n = Number(allocationSettings()?.landGate?.specConcurrency); if (!Number.isInteger(n) || n < 1) throw Error('modules/models/runtimes.yaml allocation.landGate.specConcurrency must be a positive integer'); return n; };
export const specTimeoutMs = (count) => allocationMs('landGate.specsBaseMs') + count * allocationMs('landGate.perSpecMs');

/**
 * The land gate's spec run under the RAM-aware throttle (scripts/lib/ram-throttle.mjs, owner ruling 2026-09-28):
 * while the host is `critical` (free RAM under allocation.resources.ramThrottle.landSpecPauseBelowPct, until it is
 * back above landSpecResumeAbovePct) the spec run waits, polling every pollMs up to waitMs; still critical after
 * that, it does not run and the land is refused (a retry lands it once there is room). While `heavy-paused` it runs
 * at half the declared specConcurrency. Returns {ok, concurrency, mode, waitedMs, why}. Seams: probe, sleep, now.
 */
export function specRunGate({ concurrency = specConcurrency(), waitMs = LAND_WAIT_MS, pollMs = 30_000, probe = () => hostThrottle({}), sleep = sleepSync, now = Date.now } = {}) {
  const start = now();
  let t = probe();
  while (t && !t.testContext && t.mode === 'critical' && now() - start < waitMs) { sleep(Math.min(pollMs, Math.max(1, waitMs - (now() - start)))); t = probe(); }
  const waitedMs = now() - start;
  if (!t || t.testContext) return { ok: true, concurrency, mode: t?.mode ?? null, waitedMs, why: null };
  if (t.mode === 'critical') return { ok: false, concurrency: 0, mode: t.mode, waitedMs, why: t.modeWhy };
  return { ok: true, concurrency: t.mode === 'heavy-paused' ? Math.max(1, Math.floor(concurrency / 2)) : concurrency, mode: t.mode, waitedMs, why: t.modeWhy };
}

/* ------------------------------------------------------------ pure pieces */

/** The changed files a contract-changes entry must cover. */
export const governedPaths = (changed) => changed.map(normPath)
  .filter((f) => !isContractChangesPath(f) && CONTRACT_PREFIXES.some((p) => (p.endsWith('/') ? f.startsWith(p) : f === p)));

const entryKey = (e) => JSON.stringify(e);
/**
 * Contract-change enforcement: the entries of `after` that are new or edited against `before` must cover, by
 * their `paths` (a directory covers what is inside it), every governed changed file. Returns {ok, governed,
 * uncovered, entries}.
 */
export function contractCoverage({ changed, before, after }) {
  const governed = governedPaths(changed);
  if (!governed.length) return { ok: true, governed, uncovered: [], entries: [] };
  const old = new Map((before?.changes ?? []).map((e) => [e?.id, entryKey(e)]));
  const touched = (after?.changes ?? []).filter((e) => e?.id && old.get(e.id) !== entryKey(e));
  const paths = touched.flatMap((e) => (Array.isArray(e.paths) ? e.paths : [])).map((p) => normPath(p));
  const covers = (file) => paths.some((p) => file === p || file.startsWith(`${p}/`));
  const uncovered = governed.filter((f) => !covers(f));
  return { ok: uncovered.length === 0, governed, uncovered, entries: touched.map((e) => e.id) };
}

/** Specs that name a changed file (its last two path segments, or its name for a top-level file) plus changed specs. */
export function specsTouching(changed, { specs }) {
  const needles = changed.map(normPath).filter((f) => !f.startsWith('tests/')).map((f) => f.split('/').slice(-2).join('/'));
  const own = changed.map(normPath).filter((f) => /^tests\/[^/]+\.spec\.mjs$/.test(f));
  const hits = specs.filter(({ file, text }) => needles.some((n) => text.includes(n)) && file).map((s) => s.file);
  return [...new Set([...own, ...hits])];
}

/** --specs keywords: `touching` = the named specs plus every spec naming a changed file; `all` = every spec. */
export const SPEC_KEYWORDS = Object.freeze(['touching', 'all']);
/**
 * The gate's spec plan. enabled (config.yaml `specs.harness`, default true): named specs plus every spec touching the
 * change, as before. Disabled: nothing unless the land itself asked (`asked`, the --specs of this land): a csv
 * runs just those, `touching` the enabled set, `all` every spec. Returns {mode: none|named|touching|all, named}.
 */
export function specPlan({ enabled = true, asked = [], named = [] } = {}) {
  const words = asked.filter((s) => SPEC_KEYWORDS.includes(s));
  const files = [...new Set([...asked.filter((s) => !SPEC_KEYWORDS.includes(s)), ...(enabled ? named : [])])];
  if (words.includes('all')) return { mode: 'all', named: files };
  if (enabled || words.includes('touching')) return { mode: 'touching', named: files };
  return files.length ? { mode: 'named', named: files } : { mode: 'none', named: [] };
}

/* ------------------------------------------------------------ conflicts */

const HUNK_LINES = 40, HUNKS_PER_FILE = 4, CONFLICT_FILES = 20;
/** The conflict-marker regions of a merged text, each with 2 lines of context, capped. */
export function conflictHunks(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const hunks = [];
  for (let i = 0; i < lines.length && hunks.length < HUNKS_PER_FILE; i += 1) {
    if (!lines[i].startsWith('<<<<<<< ')) continue;
    let end = i + 1;
    while (end < lines.length && !lines[end].startsWith('>>>>>>> ')) end += 1;
    const from = Math.max(0, i - 2), to = Math.min(lines.length, end + 3);
    const body = lines.slice(from, to).map((l) => (l.length > 300 ? `${l.slice(0, 300)}...` : l));
    hunks.push({ line: i + 1, text: (body.length > HUNK_LINES ? [...body.slice(0, HUNK_LINES), `... (${body.length - HUNK_LINES} more lines)`] : body).join('\n') });
    i = end;
  }
  return hunks;
}

/** What a lane does about a conflict: one instruction, never a blind retry. */
export const conflictHint = (conflicts, commit = null) => `rebase the lane onto current main (git rebase main in its worktree), resolve ${conflicts.map((c) => c.file).join(', ') || 'the conflicting files'}${commit ? ` in ${String(commit).slice(0, 9)}` : ''}, run its specs, then land the new sha; the same sha on the same main conflicts again`;

/**
 * Lock-free preflight: apply `commits` in order onto `onto` with `git merge-tree --write-tree` (no worktree, no
 * lock), chaining through throwaway commit objects. {ok, conflicts:[{commit, file, hunks[]}], onto}. A git that
 * cannot run merge-tree reads as ok (the gate's own cherry-pick still decides).
 */
export function conflictPreflight({ root = SKILL_ROOT, commits, onto = 'refs/heads/main' }) {
  let head = git(['rev-parse', onto], { cwd: root }).stdout;
  if (!head) return { ok: true, conflicts: [], skipped: 'no main' };
  for (const c of commits) {
    const parent = git(['rev-parse', '--verify', '--quiet', `${c}^`], { cwd: root }).stdout;
    if (!parent) return { ok: true, conflicts: [], skipped: `no parent of ${c}` };
    const r = git(['merge-tree', '--write-tree', '--merge-base', parent, head, c], { cwd: root });
    const tree = r.stdout.split(/\r?\n/)[0]?.trim();
    if (r.status === 1 && /^[0-9a-f]{40,64}$/.test(tree ?? '')) {
      const files = [...new Set(r.stdout.split(/\r?\n\r?\n/)[0].split(/\r?\n/).slice(1).map((l) => l.split('\t')[1]).filter(Boolean))].slice(0, CONFLICT_FILES);
      const conflicts = files.map((file) => ({ commit: c, file, hunks: conflictHunks(git(['cat-file', '-p', `${tree}:${file}`], { cwd: root }).stdout) }));
      return { ok: false, conflicts, onto: head };
    }
    if (!r.ok || !/^[0-9a-f]{40,64}$/.test(tree ?? '')) return { ok: true, conflicts: [], skipped: (r.stderr || 'merge-tree failed').slice(0, 200) };
    const next = git(['commit-tree', tree, '-p', head, '-m', `land preflight ${c}`], { cwd: root }).stdout;
    if (!next) return { ok: true, conflicts: [], skipped: 'commit-tree failed' };
    head = next;
  }
  return { ok: true, conflicts: [], onto: head };
}

/** The conflicts of a stopped cherry-pick in worktree `dir`: every unmerged file with its marker hunks. */
function pickConflicts(dir, commit = null) {
  const files = git(['diff', '--name-only', '--diff-filter=U'], { cwd: dir }).stdout.split(/\r?\n/).filter(Boolean).slice(0, CONFLICT_FILES);
  return files.map((file) => {
    let text = '';
    try { text = fs.readFileSync(path.join(dir, file), 'utf8'); } catch { /* deleted on one side */ }
    return { commit, file, hunks: conflictHunks(text) };
  });
}

/* ------------------------------------------------------------ scratch */

const run = (cmd, args, { cwd, timeout = 1_200_000, env = process.env } = {}) => {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', windowsHide: true, timeout, env, maxBuffer: 64 * 1024 * 1024 });
  return { ok: r.status === 0, status: r.status, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? ''), error: r.error?.message ?? null };
};
const tail = (text, n = 25) => String(text ?? '').trim().split(/\r?\n/).slice(-n).join('\n');

export function removeScratch(dir, { root }) {
  // Never remove a scratch whose node_modules link to the live tree is still there.
  if (!unlinkNodeModulesLink(dir)) return false;
  // Never `git worktree remove --force`: it follows junctions (nivo-fe inc-c8fbf76aa499). The tree goes
  // through safeRemoveTree, which never descends into a link; prune drops the registration.
  if (fs.existsSync(dir)) safeRemoveTree(dir);
  git(['worktree', 'prune'], { cwd: root });
  return !fs.existsSync(dir);
}

function makeScratch({ root, base, env }) {
  const dir = path.join(landRoot(env), `scratch-${process.pid}`);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  removeScratch(dir, { root });
  const added = git(['worktree', 'add', '--detach', dir, base], { cwd: root });
  if (!added.ok) return { ok: false, error: added.stderr || 'git worktree add failed' };
  const nm = path.join(root, 'node_modules');
  try { if (fs.existsSync(nm)) fs.symlinkSync(nm, path.join(dir, 'node_modules'), 'junction'); } catch { /* specs without deps */ }
  try { const cfg = path.join(root, 'config.yaml'); if (fs.existsSync(cfg)) fs.copyFileSync(cfg, path.join(dir, 'config.yaml')); } catch { /* optional */ }
  return { ok: true, dir };
}

/* ------------------------------------------------------------ checks */

function treeCheck(dir, script) {
  if (!fs.existsSync(path.join(dir, script))) return { ok: true, skipped: true };
  const r = run(process.execPath, [script], { cwd: dir, timeout: 600_000 });
  return { ok: r.ok, output: tail(r.stdout + r.stderr, 15) };
}

const readSpecs = (dir) => {
  const tests = path.join(dir, 'tests');
  let names = [];
  try { names = fs.readdirSync(tests).filter((n) => n.endsWith('.spec.mjs')); } catch { return []; }
  return names.map((n) => ({ file: `tests/${n}`, text: (() => { try { return fs.readFileSync(path.join(tests, n), 'utf8'); } catch { return ''; } })() }));
};

/** Every check of step 3 over the scratch `dir` at candidate `head` against `base`. Returns {ok, checks:[...]}. */
/**
 * The frozen families a land touches: a changed file under one of a family's gatePaths, or an added/edited contract
 * change that governs the family and adds checks or codes. [{family, why[]}]
 */
export function gateFamiliesTouched({ changed, freeze = [], before = null, after = null }) {
  const old = new Map((before?.changes ?? []).map((e) => [e?.id, entryKey(e)]));
  const touched = (after?.changes ?? []).filter((e) => e?.id && old.get(e.id) !== entryKey(e));
  const out = [];
  for (const f of freeze) {
    const files = changed.map(normPath).filter((file) => f.gatePaths.some((p) => file.startsWith(p)));
    const entries = touched.filter((e) => {
      const names = [...(Array.isArray(e.ops) ? e.ops : []), e.followUp?.op, ...(Array.isArray(e.followUp?.ops) ? e.followUp.ops : [])];
      return names.includes(f.family) && ((e.adds?.checks ?? []).length || (e.adds?.codes ?? []).length);
    }).map((e) => e.id);
    if (files.length || entries.length) out.push({ family: f.family, why: [...files, ...entries.map((id) => `contract change ${id}`)] });
  }
  return out;
}

export function runChecks({ dir, base, head, specs = [], specMode = 'touching', baseline = null, runSpecs = true, baseTree = null, gateStability = null, ramGate = specRunGate }) {
  const checks = [];
  const changedOut = git(['diff', '--name-status', `${base}..${head}`], { cwd: dir });
  const rows = changedOut.stdout.split(/\r?\n/).filter(Boolean).map((l) => l.split('\t'));
  const changed = rows.map((r) => normPath(r[r.length - 1]));
  const present = changed.filter((f) => fs.existsSync(path.join(dir, f)));
  for (const f of present.filter((x) => x.endsWith('.mjs'))) {
    const r = run(process.execPath, ['--check', f], { cwd: dir, timeout: 60_000 });
    checks.push({ name: `node --check ${f}`, ok: r.ok, ...(r.ok ? {} : { output: tail(r.stderr, 10) }) });
  }
  for (const f of present.filter((x) => /\.(ya?ml|json)$/i.test(x))) {
    let ok = true, error = null;
    try { const text = fs.readFileSync(path.join(dir, f), 'utf8'); if (/\.json$/i.test(f)) JSON.parse(text); else parseYaml(text); } catch (e) { ok = false; error = String(e?.message ?? e).slice(0, 300); }
    checks.push({ name: `parse ${f}`, ok, ...(error ? { output: error } : {}) });
  }
  for (const script of TREE_CHECKS) {
    const r = treeCheck(dir, script);
    if (r.skipped) continue;
    const pre = baseline?.[script];
    const ok = r.ok || (pre && !pre.ok && pre.output === r.output);
    checks.push({ name: path.basename(script), ok, ...(r.ok ? {} : { output: r.output, ...(ok ? { note: 'red on main too, unchanged by this land' } : {}) }) });
  }
  let coverage;
  try {
    const show = (rev) => readContractChangesDocAt(dir, rev)?.doc ?? null;
    coverage = contractCoverage({ changed, before: show(base), after: show(head) });
  } catch (e) { coverage = { ok: false, governed: [], uncovered: [], error: String(e?.message ?? e) }; }
  checks.push({ name: 'contract-changes paths', ok: coverage.ok, governed: coverage.governed, ...(coverage.ok ? { entries: coverage.entries } : { uncovered: coverage.uncovered, output: coverage.error ?? `no added/edited contract change (${CONTRACT_CHANGES_DIR}/<id>.yaml) names ${coverage.uncovered.join(', ')} in its paths` }) });
  // Gate stability: a report for the Supervisor's release decision, ok whatever it finds.
  try {
    const freezeFile = path.join(dir, 'modules', 'kernel', 'contract-freeze.yaml');
    const freeze = fs.existsSync(freezeFile) ? (parseYaml(fs.readFileSync(freezeFile, 'utf8'))?.families ?? []).map((f) => ({ family: f.family, gatePaths: (f.gatePaths ?? []).map(normPath) })) : [];
    const show = (rev) => readContractChangesDocAt(dir, rev)?.doc ?? null;
    const families = gateFamiliesTouched({ changed, freeze, before: show(base), after: show(head) });
    const runner = path.join(dir, 'scripts', 'supervisor', 'gate-stability.mjs');
    const baseHead = baseTree ? git(['rev-parse', 'HEAD'], { cwd: baseTree }).stdout : null;
    for (const { family, why } of families) {
      if (!baseTree || baseHead !== base || !fs.existsSync(runner)) { checks.push({ name: `gate-stability ${family}`, ok: true, advisory: true, why, skipped: !baseTree ? 'no base tree' : baseHead !== base ? `base tree is at ${baseHead}, not ${base}` : 'no gate-stability.mjs in the candidate' }); continue; }
      const report = (gateStability ?? ((opts) => spawnGateStability(opts)))({ runner, base: baseTree, head: dir, family });
      checks.push({ name: `gate-stability ${family}`, ok: true, advisory: true, why, ...(report.error ? { error: report.error } : { legs: report.legs, flips: report.flips, newlyFailing: report.newlyFailing,
        output: `${report.flips} of ${report.legs} accepted ${family} leg(s) of live workflows would newly fail; ${report.newlyFailing} get new findings - the Supervisor decides the release (api contract-release --family ${family})`,
        perLeg: report.perLeg.filter((l) => l.flipped || l.newFindings.length).map(({ repo, workflowId, jobId, flipped, newFindings }) => ({ repo, workflowId, jobId, flipped, codes: [...new Set(newFindings.map((f) => f.code))] })) }) });
    }
  } catch (e) { checks.push({ name: 'gate-stability', ok: true, advisory: true, error: String(e?.message ?? e).slice(0, 300) }); }
  const pool = specMode === 'touching' || specMode === 'all' ? readSpecs(dir) : [];
  const extra = specMode === 'all' ? pool.map((s) => s.file) : specMode === 'touching' ? specsTouching(changed, { specs: pool }) : [];
  const allSpecs = specMode === 'none' ? [] : [...new Set([...specs.map(normPath), ...extra])].filter((f) => fs.existsSync(path.join(dir, f)));
  if (specMode === 'none') checks.push({ name: 'specs skipped', ok: true, advisory: true, output: 'config.yaml specs.harness: false - no spec runs unless the land asks (--specs <csv|touching|all>)' });
  const missing = specs.map(normPath).filter((f) => !fs.existsSync(path.join(dir, f)));
  if (missing.length) checks.push({ name: 'named specs exist', ok: false, output: `missing: ${missing.join(', ')}` });
  const gate = runSpecs && allSpecs.length ? ramGate() : null;
  if (gate && !gate.ok) checks.push({ name: `specs (${allSpecs.length})`, ok: false, specs: allSpecs, output: `spec run paused: host RAM critical after waiting ${Math.round(gate.waitedMs / 1000)}s - ${gate.why}; land again once free RAM is back above allocation.resources.ramThrottle.landSpecResumeAbovePct` });
  if (runSpecs && allSpecs.length && gate?.ok !== false) {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    // The candidate's own test preload points the machine registry at a per-run temp file, so no spec it
    // runs enrols a ledger on this host's registry (a candidate from before the preload runs without it).
    const preload = path.join(dir, 'tests', 'setup', 'isolated-registry.mjs');
    const importArgs = fs.existsSync(preload) ? ['--import', pathToFileURL(preload).href] : [];
    const r = run(process.execPath, [...importArgs, '--test', `--test-concurrency=${gate?.concurrency || specConcurrency()}`, ...allSpecs], { cwd: dir, timeout: specTimeoutMs(allSpecs.length), env });
    checks.push({ name: `specs (${allSpecs.length})`, ok: r.ok, specs: allSpecs, output: tail(r.stdout + r.stderr, r.ok ? 6 : 40) });
  }
  return { ok: checks.every((c) => c.ok), checks, changed, rows, specs: allSpecs };
}

/** The gate-stability report run from the candidate's own script (scripts/supervisor/gate-stability.mjs --base --head). */
function spawnGateStability({ runner, base, head, family }) {
  const r = run(process.execPath, [runner, '--family', family, '--base', base, '--head', head, '--json'], { cwd: head, timeout: 600_000 });
  if (!r.ok) return { error: tail(r.stderr || r.stdout, 6) };
  try { return JSON.parse(r.stdout.trim().split(/\r?\n/).pop()); } catch { return { error: 'unparseable gate-stability output' }; }
}

/* ------------------------------------------------------------ fast-forward */

/**
 * Move live main from `base` to `head` and update the working tree and index of exactly `rows`
 * (name-status rows of base..head). Refuses when main moved, HEAD is not main, or a path is dirty.
 * Returns {ok, reason?, dirty?, moved?}.
 */
export function fastForwardLive({ root, base, head, rows }) {
  const branch = git(['symbolic-ref', '-q', 'HEAD'], { cwd: root }).stdout;
  if (branch !== 'refs/heads/main') return { ok: false, reason: 'live-not-on-main', detail: branch || 'detached' };
  const live = git(['rev-parse', 'refs/heads/main'], { cwd: root }).stdout;
  if (live !== base) return { ok: false, reason: 'main-moved', moved: live };
  const paths = [...new Set(rows.flatMap((r) => r.slice(1)).map(normPath))];
  // No paths, nothing to be dirty: `git status --` with an empty pathspec lists the whole tree.
  const dirty = paths.length ? git(['status', '--porcelain', '--untracked-files=all', '--', ...paths], { cwd: root }).stdout.split(/\r?\n/).filter(Boolean) : [];
  if (dirty.length) return { ok: false, reason: 'live-paths-dirty', dirty };
  const cas = git(['update-ref', '-m', 'supervisor land gate', 'refs/heads/main', head, base], { cwd: root });
  if (!cas.ok) return { ok: false, reason: 'main-moved', detail: cas.stderr };
  const deleted = rows.filter((r) => r[0].startsWith('D')).map((r) => normPath(r[1]));
  const renamedFrom = rows.filter((r) => r[0].startsWith('R')).map((r) => normPath(r[1]));
  const written = rows.filter((r) => !r[0].startsWith('D')).map((r) => normPath(r[r.length - 1]));
  const gone = [...deleted, ...renamedFrom];
  try {
    if (written.length) { const co = git(['checkout', head, '--', ...written], { cwd: root }); if (!co.ok) throw Error(co.stderr || 'checkout failed'); }
    if (gone.length) {
      const rm = git(['rm', '--cached', '--quiet', '--ignore-unmatch', '--', ...gone], { cwd: root });
      if (!rm.ok) throw Error(rm.stderr || 'git rm --cached failed');
      for (const f of gone) { try { fs.rmSync(path.join(root, f), { force: true }); } catch { /* already gone */ } }
    }
    return { ok: true, written, removed: gone };
  } catch (error) {
    // Roll back: the ref first (compare-and-swap on our own head), then the paths to base.
    git(['update-ref', '-m', 'supervisor land gate rollback', 'refs/heads/main', base, head], { cwd: root });
    const back = rows.flatMap((r) => (r[0].startsWith('A') ? [] : [normPath(r[1])]));
    if (back.length) git(['checkout', base, '--', ...back], { cwd: root });
    for (const r of rows.filter((x) => x[0].startsWith('A') || x[0].startsWith('R'))) {
      const f = normPath(r[r.length - 1]);
      git(['rm', '--cached', '--quiet', '--ignore-unmatch', '--', f], { cwd: root });
      try { fs.rmSync(path.join(root, f), { force: true }); } catch { /* best effort */ }
    }
    return { ok: false, reason: 'tree-update-failed', detail: String(error?.message ?? error), rolledBack: true };
  }
}

/** Refresh untracked dist only after main has advanced. Knowledge snapshots are tracked contract files, so drift is owed to a lane. */
export function rebuildLandedGrammar({ root = SKILL_ROOT, changed = [] } = {}) {
  if (!changed.map(normPath).some((file) => file.startsWith('packages/grammar/src/') || file === 'packages/grammar/package.json')) return null;
  const packageRoot = path.join(root, 'packages', 'grammar');
  const fail = (step, detail) => ({ ok: false, step, detail, owed: ['grammar-dist-rebuild'] });
  try {
    const npmCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
    const npm = process.platform === 'win32' ? (fs.existsSync(npmCli) ? { file: process.execPath, prefix: [npmCli] } : null) : { file: 'npm', prefix: [] };
    if (!npm) return fail('npm ci', `npm CLI is missing at ${npmCli}`);
    const modules = path.join(packageRoot, 'node_modules');
    if (!unlinkNodeModulesLink(packageRoot)) return fail('npm ci', `cannot unlink ${modules} junction`);
    const install = run(npm.file, [...npm.prefix, 'ci'], { cwd: packageRoot, timeout: 900_000 });
    if (!install.ok) return fail('npm ci', `exit ${install.status ?? 'unknown'}${install.error ? ` (${install.error})` : ''}`);
    const build = run(npm.file, [...npm.prefix, 'run', 'build'], { cwd: packageRoot, timeout: 900_000 });
    if (!build.ok) return fail('npm run build', `exit ${build.status ?? 'unknown'}${build.error ? ` (${build.error})` : ''}`);
    const dist = grammarDistStatus(packageRoot);
    if (!dist.ok || dist.state !== 'fresh') return fail('grammar-dist', dist.detail);
    const knowledge = run(process.execPath, [path.join(root, 'scripts', 'checks', 'grammar-knowledge.mjs')], { cwd: root, timeout: 180_000 });
    return { ok: true, state: dist.state, knowledge: knowledge.ok ? 'fresh' : 'owed',
      owed: knowledge.ok ? [] : ['grammar-knowledge-snapshots'], ...(knowledge.ok ? {} : { knowledgeDetail: `exit ${knowledge.status ?? 'unknown'}` }) };
  } catch (error) { return fail('exception', String(error?.message ?? error)); }
}

/* ------------------------------------------------------------ the gate */

/**
 * Land `commits` (in order) on live main of `root`. `deps.runChecks` / `deps.push` replace the checks and the
 * push in specs. Returns {ok, landed?, base, head?, checks, reason?, push?}.
 */
export function landCommits({ commits, specs = [], specMode = 'touching', root = SKILL_ROOT, env = process.env, push = true, deps = {} }) {
  const check = deps.runChecks ?? runChecks;
  const result = { ok: false, commits, attempts: [] };
  for (let attempt = 1; attempt <= MAX_MAIN_RETRIES; attempt += 1) {
    const base = git(['rev-parse', 'refs/heads/main'], { cwd: root }).stdout;
    const scratch = makeScratch({ root, base, env });
    if (!scratch.ok) return { ...result, reason: 'scratch-failed', detail: scratch.error };
    const step = { attempt, base };
    try {
      const baseline = {};
      if (!deps.runChecks) for (const script of TREE_CHECKS) baseline[script] = treeCheck(scratch.dir, script);
      const pick = git(['cherry-pick', '--allow-empty', '--keep-redundant-commits', ...commits], { cwd: scratch.dir });
      if (!pick.ok) {
        const stopped = /could not apply ([0-9a-f]{7,40})/.exec(pick.stderr || pick.stdout)?.[1] ?? null;
        const conflicts = pickConflicts(scratch.dir, stopped);
        git(['cherry-pick', '--abort'], { cwd: scratch.dir });
        result.attempts.push({ ...step, reason: 'conflict' });
        return { ...result, base, reason: 'conflict', detail: tail(pick.stderr || pick.stdout, 12), conflicts, hint: conflictHint(conflicts, stopped) };
      }
      const head = git(['rev-parse', 'HEAD'], { cwd: scratch.dir }).stdout;
      // The pick changes nothing: main already carries the change (a re-land of a landed commit).
      if (git(['diff', '--quiet', base, head], { cwd: scratch.dir }).ok) {
        result.attempts.push({ ...step, reason: 'already-landed' });
        return { ...result, ok: true, alreadyLanded: base, landed: null, base, head: base, checks: [], changed: [] };
      }
      const checked = check({ dir: scratch.dir, base, head, specs, specMode, baseline, baseTree: root });
      step.head = head;
      step.checks = checked.checks;
      if (!checked.ok) {
        result.attempts.push({ ...step, reason: 'checks-red' });
        return { ...result, base, head, reason: 'checks-red', checks: checked.checks, changed: checked.changed };
      }
      const ff = fastForwardLive({ root, base, head, rows: checked.rows });
      if (!ff.ok) {
        result.attempts.push({ ...step, reason: ff.reason });
        if (ff.reason === 'main-moved') continue;
        return { ...result, base, head, reason: ff.reason, detail: ff.detail ?? null, dirty: ff.dirty ?? null, checks: checked.checks };
      }
      const landed = { ...result, ok: true, landed: head, base, head, checks: checked.checks, changed: checked.changed };
      const grammarPaths = [...(checked.changed ?? []), ...(checked.rows ?? []).flatMap((row) => row.slice(1))].map(normPath);
      if (grammarPaths.some((file) => file.startsWith('packages/grammar/src/') || file === 'packages/grammar/package.json')) {
        try { landed.grammarRebuild = (deps.rebuildGrammar ?? rebuildLandedGrammar)({ root, changed: grammarPaths }); }
        catch (error) { landed.grammarRebuild = { ok: false, step: 'exception', detail: String(error?.message ?? error), owed: ['grammar-dist-rebuild'] }; }
      }
      if (push) landed.push = (deps.push ?? pushLive)({ root });
      return landed;
    } finally { removeScratch(scratch.dir, { root }); }
  }
  return { ...result, reason: 'main-moving', detail: `main moved under the gate ${MAX_MAIN_RETRIES} times` };
}

/** Push live main after a secret scan of origin/main..main. */
export function pushLive({ root = SKILL_ROOT } = {}) {
  const hasRemote = git(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main'], { cwd: root }).ok;
  if (!hasRemote) return { pushed: false, skipped: 'no origin/main' };
  const scan = scanRange({ cwd: root, from: 'origin/main', to: 'main' });
  if (!scan.ok) return { pushed: false, refused: 'secret scan', findings: scan.findings, ...(scanHint(scan.findings) ? { hint: scanHint(scan.findings) } : {}) };
  const r = git(['push', 'origin', 'main'], { cwd: root });
  return r.ok ? { pushed: true } : { pushed: false, error: (r.stderr || r.error || '').split(/\r?\n/).slice(-4).join(' | ').slice(0, 400) };
}

/** The open tickets of the land queue, oldest first ({ticketId, lane, commit, state, requestedBy, enqueuedAt}). */
export function landQueue({ env = process.env } = {}) {
  return readMachine((m) => m.landQueue().map((t) => ({ ticketId: t.ticket_id, lane: t.lane, commit: t.commit_sha, state: t.state, requestedBy: t.requested_by, enqueuedAt: t.enqueued_at })), [], { env });
}

/**
 * Wait for the gate in request order: a land_queue ticket joins the queue and only the oldest live ticket enters.
 * {ok, ticketId, release(state)} or {ok:false, holder, ahead} (the ticket is cancelled then).
 */
export function acquireLand({ env = process.env, waitMs = LAND_WAIT_MS, pollMs = 5000, lane = null, commits = [], sleep = sleepSync } = {}) {
  const ticketId = withMachine((m) => m.enqueueLand({ lane, commitSha: commits[commits.length - 1] ?? 'unknown', commits: commits.length }), { env });
  const finish = (state) => { try { withMachine((m) => m.finishLandTicket(ticketId, state), { env }); } catch { /* the reaper cancels it */ } };
  const drop = () => finish('cancelled');
  process.on('exit', drop);
  const end = Date.now() + waitMs;
  try {
    for (;;) {
      const got = withMachine((m) => m.claimLandGate({ ticketId }), { env });
      if (got.ok) return { ok: true, ticketId, release: (state = 'cancelled') => { process.removeListener('exit', drop); finish(state); } };
      if (Date.now() >= end) {
        const queue = landQueue({ env });
        process.removeListener('exit', drop); drop();
        return { ok: false, holder: queue.find((t) => t.state === 'running') ?? null, ahead: queue.findIndex((t) => t.ticketId === ticketId) };
      }
      sleep(pollMs);
    }
  } catch (error) { process.removeListener('exit', drop); drop(); throw error; }
}

const landResultOf = (r) => (r.ok ? 'passed' : r.reason === 'conflict' ? 'conflict' : ['dirty', 'not-on-main', 'main-moved'].includes(r.reason) ? 'refused' : 'failed');
/** The machine records of one land: the push row, the land_runs row (full result as the stdout blob) and a log line. */
function recordLand(m, { result, root = SKILL_ROOT, ticketId = null, lane = null, commits, jobId = null, specMode = null, startedAt }) {
  let pushId = null;
  if (result.push) {
    const p = result.push;
    pushId = m.recordPush({ repoRoot: root, branch: 'main', head: result.landed ?? commits[commits.length - 1], result: p.pushed ? 'pushed' : p.skipped ? 'skipped' : p.refused ? 'refused' : 'failed',
      reason: p.refused ?? p.skipped ?? p.error ?? null,
      failureSignature: p.pushed || p.skipped ? null : p.refused ? `secret-scan:${(p.findings ?? []).map((x) => x.rule ?? x.id ?? 'finding')[0] ?? 'finding'}` : 'push:error',
      scan: p.findings ? { findings: p.findings } : null, stderr: p.error ?? null });
  }
  const runId = m.recordLandRun({ ticketId, lane, commitSha: commits[commits.length - 1], landedSha: result.landed ?? result.alreadyLanded ?? null, result: landResultOf(result),
    reason: result.reason ?? null, pushId, specs: { mode: specMode, failed: (result.checks ?? []).filter((c) => !c.ok).map((c) => c.name) },
    stdout: JSON.stringify(result, null, 2), stderr: (result.checks ?? []).filter((c) => !c.ok).map((c) => `## ${c.name}\n${c.output ?? ''}`).join('\n') || null, startedAt });
  if (result.ok && lane && (result.landed ?? result.alreadyLanded)) m.update('lanes', { head_sha: result.landed ?? result.alreadyLanded }, { name: lane });
  if (result.ok && jobId && m.supJob(jobId)) { m.setSupJobStatus(jobId, 'succeeded'); m.releaseSupLeases(jobId); }
  m.log({ actor: 'land', kind: result.ok ? 'land.passed' : 'land.failed', level: result.ok ? 'info' : 'warn', msg: describe(result, { jobId }).slice(0, 2000),
    data: { runId, ticketId, lane, jobId, commits, landed: result.landed ?? null, reason: result.reason ?? null }, refs: [...(lane ? [`lane:${lane}`] : []), ...commits.map((c) => `commit:${c}`)] });
  return runId;
}

/** The full gate for one job or commit list, with the queue, the machine records and the optional inbox notice. */
export async function land({ jobId = null, commits = null, specs = [], lane = null, push = null, notify = false, waitMs = LAND_WAIT_MS, root = SKILL_ROOT, env = process.env, deps = {} } = {}) {
  const settings = supervisorSettings();
  const doPush = push ?? settings.landGate.push;
  const asked = specs.map((s) => String(s).trim()).filter(Boolean);
  let named = [];
  if (jobId) {
    const found = readMachine((m) => ({ job: m.supJob(jobId), report: m.supReports({ jobId }).pop()?.report ?? null }), null, { env });
    if (!found?.job) return { ok: false, reason: 'no-job', detail: jobId };
    const { job, report } = found;
    if (job.payload?.self && !commits) {
      const staging = job.payload.staging;
      commits = staging ? git(['rev-list', '--reverse', `${staging.base}..${staging.branch}`], { cwd: root }).stdout.split(/\r?\n/).filter(Boolean) : [];
    } else if (!commits) {
      if (!report || report.outcome !== 'done' || !report.commit) return { ok: false, reason: 'no-done-report', detail: `${jobId} has no done report with a commit` };
      const list = report.base ? git(['rev-list', '--reverse', `${report.base}..${report.commit}`], { cwd: root }).stdout.split(/\r?\n/).filter(Boolean) : [report.commit];
      commits = list.length ? list : [report.commit];
    }
    named = [...new Set([...(report?.specs ?? []), ...(job.payload?.specs ?? [])])];
  }
  if (!commits?.length) return { ok: false, reason: 'nothing-to-land' };
  const startedAt = Date.now();
  if (lane) withMachine((m) => { if (!m.laneOf(lane)) m.upsertLane({ name: lane, worktreePath: path.join(lanesRoot({ env }), lane), branch: `lane/${lane}`, owner: jobId ? `worker:${jobId}` : 'owner-chat' }); }, { env });
  // A pick that cannot apply is refused before the queue: the lane learns its exact hunks in seconds, not after
  // waiting its turn (ledger 2026-09-28: 15 of 16 failed lands were conflicts, most retried blind).
  if (!deps.skipPreflight) {
    const pre = (deps.conflictPreflight ?? conflictPreflight)({ root, commits });
    if (!pre.ok) {
      const result = { ok: false, commits, reason: 'conflict', preflight: true, base: pre.onto ?? null, conflicts: pre.conflicts, hint: conflictHint(pre.conflicts, pre.conflicts[0]?.commit),
        detail: `does not apply on main ${String(pre.onto ?? '').slice(0, 9)}: ${pre.conflicts.map((c) => c.file).join(', ')}` };
      withMachine((m) => recordLand(m, { result, root, lane, commits, jobId, startedAt }), { env });
      return result;
    }
  }
  let enabled = true;
  try { enabled = (deps.specsEnabled ?? harnessSpecsEnabled)(); } catch { /* an unreadable owner file keeps the default */ }
  const plan = specPlan({ enabled, asked, named });
  const lock = (deps.acquireLand ?? acquireLand)({ env, waitMs, lane, commits });
  if (!lock.ok) return { ok: false, reason: 'gate-busy', holder: lock.holder ?? null, ahead: lock.ahead ?? 0 };
  let state = 'cancelled';
  try {
    const result = { ...landCommits({ commits, specs: plan.named, specMode: plan.mode, root, env, push: doPush, deps }), specMode: plan.mode };
    state = result.ok ? 'passed' : 'failed';
    result.landRun = withMachine((m) => recordLand(m, { result, root, ticketId: lock.ticketId, lane, commits, jobId, specMode: plan.mode, startedAt }), { env });
    if (notify || result.grammarRebuild?.ok === false) {
      try { withMachine((m) => m.recordSupMessage({ direction: 'in', channel: 'tell', from: 'land-gate', text: describe(result, { jobId }) }), { env }); } catch { /* the land_runs row is the record */ }
    }
    return result;
  } finally { lock.release(state); }
}

/** The gate for /status: {busy, current, queued}. */
export function landStatus({ env = process.env } = {}) {
  const queue = landQueue({ env });
  const current = queue.find((t) => t.state === 'running') ?? null;
  return { busy: Boolean(current), current, queued: queue.filter((t) => t.state === 'queued').length };
}

export function describe(r, { jobId = null } = {}) {
  const who = jobId ?? (r.commits ?? []).map((c) => String(c).slice(0, 9)).join(',');
  if (r.ok && r.alreadyLanded) return `LAND already-landed ${who}: main has it at ${String(r.alreadyLanded).slice(0, 9)}, nothing moved`;
  if (r.ok) return `LAND passed ${who}: main -> ${String(r.landed).slice(0, 9)}${r.push ? ` (push ${r.push.pushed ? 'ok' : r.push.skipped ?? r.push.refused ?? r.push.error})` : ''}${r.grammarRebuild ? `; grammar rebuild ${r.grammarRebuild.ok ? 'ok' : `FAILED at ${r.grammarRebuild.step}: ${r.grammarRebuild.detail}`}${r.grammarRebuild.owed?.length ? `; owed ${r.grammarRebuild.owed.join(', ')}` : ''}` : ''}`;
  const red = (r.checks ?? []).filter((c) => !c.ok).map((c) => `${c.name}${c.output ? `: ${String(c.output).split(/\r?\n/).slice(-3).join(' / ').slice(0, 300)}` : ''}`);
  const conflicts = (r.conflicts ?? []).map((c) => `CONFLICT ${c.file}${c.hunks?.length ? `\n${c.hunks.map((h) => `    @ line ${h.line}\n${h.text.split('\n').map((l) => `      ${l}`).join('\n')}`).join('\n')}` : ''}`);
  return `LAND FAILED ${who}: ${r.reason}${r.preflight ? ' (preflight, before the queue)' : ''}${r.detail ? ` (${String(r.detail).slice(0, 300)})` : ''}${r.dirty ? ` dirty: ${r.dirty.join(', ')}` : ''}${red.length ? `\n  ${red.join('\n  ')}` : ''}${conflicts.length ? `\n  ${conflicts.join('\n  ')}` : ''}${r.hint ? `\n  next: ${r.hint}` : ''}`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  lowerOwnPriority();
  const argv = process.argv.slice(2);
  const has = (n) => argv.includes(`--${n}`);
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const csv = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
  if (has('status')) console.log(JSON.stringify(landStatus()));
  else if (!value('job') && !value('commit')) { console.error('use: land.mjs --job <id> | --commit <sha>[,<sha>] [--specs <csv|touching|all>] [--lane <name>] [--no-push] [--notify] [--json]'); process.exitCode = 2; }
  else {
    const r = await land({ jobId: value('job'), commits: value('commit') ? csv(value('commit')) : null, specs: csv(value('specs')), lane: value('lane'),
      push: has('no-push') ? false : null, notify: has('notify'), waitMs: Number(value('wait-ms')) || LAND_WAIT_MS });
    console.log(has('json') ? JSON.stringify(r) : describe(r, { jobId: value('job') }));
    if (!r.ok) process.exitCode = 1;
  }
}
