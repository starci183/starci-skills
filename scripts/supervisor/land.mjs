#!/usr/bin/env node
// starci supervisor land — the ONE land gate of the live runtime (modules/supervisor/supervise.yaml landGate, docs/supervisor.md).
// Lands serialize on the land queue; the host lock is held for the publish alone (land-lock.mjs). A change reaches live main only through all of it, or not at all.
//
//   starci supervisor land --job <jobId> [--notify] [--json]
//   starci supervisor land --commit <sha>[,<sha>...] [--lane <name>] [--notify] [--json]
//   starci supervisor land --status [--json]
// Without --foreground the land runs in a detached child (land-detach.mjs) and the verb answers at once: a caller whose command window is shorter than the gate cannot kill the land.
//
// 1. The land queue in machine.sqlite (engine/db/machine.mjs land_queue): each waiter files a ticket and only the
//    oldest live ticket enters the gate; a ticket whose process died is cancelled (waits up to --wait-ms, default
//    runtimes.yaml allocation.landGate.waitMs). Every run is a land_runs row (full output as blobs, G9/MB-10).
// 2. Rebase-free apply: a scratch worktree (detached) of current main under <lanesRoot>/land
//    (scripts/machine/home.mjs lanesRoot: STARCI_LANES_ROOT, the owner config roots.lanes, else <starciLocalRoot>/lanes), then
//    `git cherry-pick` of the commit(s). A conflict lands nothing; a pick with no diff against main is
//    already landed and moves nothing. Before a waiter even joins the queue, a lock-free preflight
//    (`git merge-tree` of each commit onto main, conflictPreflight) refuses a pick that cannot apply, so a lane
//    never waits an hour for a conflict. Either way a conflict names every file and its conflict hunks
//    (`conflicts`) and the one fix (rebase the lane onto main, resolve those hunks, land the new sha).
//    Append-only files (.gitattributes merge=union) never conflict.
// 3. Checks on the result, each red one refusing the land:
//      node --check of every changed .mjs; YAML/JSON parse of every changed .yaml/.yml/.json;
//      sync-runtime regenerates the git-ignored runtime copies a scratch worktree lacks, then check-module-yaml,
//        check-contract-cites, check-cli-parity, check-db-openers, check-worktree-add (red only when red on the
//        candidate and not the same on main, so a lane's pre-existing breakage never blocks an unrelated land);
//      sync-runtime --check when the change touches a file a runtime mirror bundles (mirrorDriftCheck, same baseline);
//      the clean-install proof of every published package the change touches, a file its runtime copy bundles included (packageProofCheck: package-clean-test.mjs --base <base>; red or not run refuses, no baseline);
//      the FULL `starci runtime check` of the candidate (land-full-check.mjs: packages/cli/bin/starci.mjs runtime check, not only the gate), a step of its own; red refuses, no baseline;
//      the runtime carries no specs of its own (owner ruling no-runtime-specs, 2026-10-17): the package proof above and the full check are the land's tests;
//      current module contracts and citations are checked on the candidate; native gate and package proofs refuse red or unavailable evidence.
// 3b. git health: a repo whose shared config says core.bare=true fails every work-tree operation ("this operation must be run
//    in a work tree"); that is refused as `git-unusable` (before the queue and before each scratch), and a cherry-pick that fails
//    without unmerged files is `git-failed`, never `conflict`. Each attempt owns one scratch-<pid>-<token> worktree it alone removes.
// 4. Fast-forward live main, under the host lock (land-lock.mjs, held for this step only, waited for up to 10 minutes): main must still be the scratch's base (else the whole gate reruns on the new main,
//    at most 3 times), the live checkout must be on main and clean for the changed paths; then
//    `git update-ref refs/heads/main <new> <base>` (compare-and-swap) and a working-tree + index update of just those paths - each swapped in by
//    rename of a fully written temp (checkout-paths.mjs), so a reader mid-update only ever opens the old or the new full file. A failed tree update rolls the ref and the paths back.
// 5. Nothing is pushed: a land fast-forwards LOCAL main only. The remote main moves once per release, through `starci release cut`, and the pre-push hook of the
//    runtime repository refuses every other push of it (docs/git-governance.md).
// A worker job lands as `succeeded` and its staging checkout and temp branch are removed - so does a self job
// (`starci supervisor workers stage --self`) whose branch --commit landed in full (selfJobsLandedBy); a red gate records
// `land-failed` and, with --notify, tells the Supervisor through its inbox. Nothing half-lands.
import '../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { setPriority } from '../api/process/set-priority.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { detachedLandLine, startDetachedLand } from './land-detach.mjs';
import { landQueue, landStatus } from './land-status.mjs';
export { landQueue, landStatus };
import { parseYaml } from '../../engine/yaml.mjs';
import { allocationMs } from '../../engine/config.mjs';
import { git, normPath } from './workers.mjs';
import { withMachine, readMachine, writeOrDefer, isMachineBusy } from '../../engine/db/machine.mjs';
import { safeRemoveWorktree, createScratchWorktree } from '../machine/worktree-git.mjs';
import { ci } from '../api/npm/ci.mjs';
import { markRemoved } from '../machine/worktree-registry.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { withSwcCache } from '../gates/build-env.mjs';
import { buildGrammar } from '../gates/grammar-build.mjs';
import { SKILL_ROOT, lanesRoot, landRoot } from '../machine/home.mjs';
import { fullCheckStep, gateLooseningCheck } from './land-full-check.mjs';
import { fastForwardLive } from '../machine/live-fast-forward.mjs';
import { withoutGitLocalEnv } from '../lib/git.mjs'; import { isMain } from '../lib/is-main.mjs'; import { withoutSeatEnv } from '../lib/seat-env.mjs';
import { tailLines } from '../lib/clip.mjs'; import { underHostLockWaiting } from './land-lock.mjs'; import { selfUpgradeBranchContaining, selfUpgradeIdOf, withSelfUpgradeRef, writeSelfUpgradeRef } from './self-upgrade-ref.mjs'; import { describe } from './land-format.mjs'; export { describe };
import { landOutcomeOf, recordLand } from './land-record.mjs';
import { conflictHint, conflictPreflight, pickConflicts } from './land-conflicts.mjs';
export { conflictHunks } from './land-conflicts.mjs'; export { conflictPreflight };
export const TREE_CHECKS = Object.freeze(['scripts/hfs/sync-runtime.mjs', 'scripts/checks/check-module-yaml.mjs', 'scripts/checks/check-contract-cites.mjs', 'scripts/checks/check-cli-parity.mjs', 'scripts/checks/check-worktree-add.mjs']);
const MAX_MAIN_RETRIES = 3;
const LAND_WAIT_MS = allocationMs('landGate.waitMs');
/* ------------------------------------------------------------ scratch */

const outcome = (r) => ({ ok: r.status === 0, status: r.status, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? ''), error: r.error?.message ?? null });
/** `node <args>` in `cwd`, with STARCI_RUNTIME = cwd: the CLI resolves its runtime root from that variable before the per-user record, so every child verifies the tree being landed, not the live checkout. The child is the gate's own work, never the calling seat's tool call: it runs without the seat identity (scripts/lib/seat-env.mjs). */
const node = (args, { cwd, timeout = 1_200_000, env = process.env } = {}) => outcome(runNode(args, { cwd, timeout, env: { ...withoutSeatEnv(env), STARCI_RUNTIME: cwd }, maxBuffer: 64 * 1024 * 1024 }));
/** The env the gate's test runs get (the package proof): no test-runner channel, no git repository-local variables, no seat identity — a result never depends on which terminal ran the land. */
function testRunEnv(parent = process.env) {
  const env = withoutSeatEnv(withoutGitLocalEnv(parent));
  delete env.NODE_TEST_CONTEXT;
  return withSwcCache(env);
}

/**
 * Remove ONE scratch this land made (never another land's: the name carries the pid and a per-attempt token) and drop
 * its registration. Never throws: a removal that fails is returned (false) and reported by the land, and a scratch
 * left behind cannot break the next land, whose own scratch has its own name.
 */
export function removeScratch(dir, { root }) {
  try {
    // safeRemoveWorktree: every link (the node_modules junction to the live tree included) removed as a link, found
    // without following one; zero links asserted; only then `git worktree remove`; the main checkout asserted untouched.
    safeRemoveWorktree(dir, { repo: root });
    const gone = !fs.existsSync(dir);
    if (gone) markRemoved(dir);
    return gone;
  } catch { return false; }
}

/**
 * git health of `root`: a work-tree operation must work. `core.bare=true` in the SHARED config (2026-09-29 17:21-17:30:
 * something outside the gate set it, then cleared it) makes `git status` in the live checkout and `git cherry-pick`
 * in every scratch worktree die with "fatal: this operation must be run in a work tree" - lands 20, 21 and 22 - and the
 * gate read the cherry-pick failure as a conflict. `git -c core.bare=false` does not help a linked worktree; only the
 * config does. The gate never edits the live repo's config: it waits a moment for a transient value, then refuses.
 */
function gitHealth({ root = SKILL_ROOT } = {}) {
  const inside = git(['rev-parse', '--is-inside-work-tree'], { cwd: root });
  if (inside.ok && inside.stdout === 'true') return { ok: true };
  const bare = git(['config', '--show-origin', '--get', 'core.bare'], { cwd: root }).stdout;
  const why = /\btrue$/.test(bare) ? `core.bare=true (${bare.replace(BARE_VALUE, '')})` : (inside.stderr || inside.error || `is-inside-work-tree: ${inside.stdout || 'unreadable'}`).slice(0, 200);
  return { ok: false, detail: why, bare: /\btrue$/.test(bare), hint: /\btrue$/.test(bare) ? `something set core.bare=true on ${root}; run \`git -C ${root} config core.bare false\` (the gate never edits the live repo config), then land again` : `git cannot run a work-tree operation in ${root}; fix that first, then land again` };
}
const GIT_HEALTH_WAIT_MS = 20_000;
// The `true` value (and the whitespace before it) at the end of a `git config --show-origin --get core.bare` line.
const BARE_VALUE = new RegExp([String.raw`\s+`, 'true', '$'].join(''));
/** gitHealth, retried for a transient value: {ok} or {ok:false, detail, hint, waitedMs}. Seams: check, sleep, now. */
function waitGitHealthy({ root = SKILL_ROOT, waitMs = GIT_HEALTH_WAIT_MS, pollMs = 1000, check = gitHealth, sleep = sleepSync, now = Date.now } = {}) {
  const start = now();
  let h = check({ root });
  while (!h.ok && now() - start < waitMs) { sleep(Math.min(pollMs, Math.max(1, waitMs - (now() - start)))); h = check({ root }); }
  return h.ok ? h : { ...h, waitedMs: now() - start };
}

function makeScratch({ root, base, env }) {
  const dir = path.join(landRoot(env), `scratch-${process.pid}-${Date.now().toString(36)}${randomBytes(2).toString('hex')}`);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  const added = createScratchWorktree({ repoRoot: root, dir, kind: 'land-scratch', detach: true, base });
  if (!added.ok) { removeScratch(dir, { root }); return { ok: false, error: added.detail || added.reason || 'git worktree add failed' }; }
  const deps = fs.existsSync(path.join(dir, 'package-lock.json')) ? ci(dir) : { ok: true }; // its own npm ci; never a junction to the live node_modules (RT_NODE_MODULES_LINK)
  if (!deps.ok) { removeScratch(dir, { root }); return { ok: false, error: `npm ci in the land scratch failed (exit ${deps.status ?? 'unknown'}): ${deps.stderr.slice(-400)}` }; }
  try { const cfg = path.join(root, 'config.yaml'); if (fs.existsSync(cfg)) fs.copyFileSync(cfg, path.join(dir, 'config.yaml')); } catch { /* optional */ }
  return { ok: true, dir };
}

/* ------------------------------------------------------------ checks */
function treeCheck(dir, script) {
  if (!fs.existsSync(path.join(dir, script))) return { ok: true, skipped: true };
  const r = node([script], { cwd: dir, timeout: 600_000 });
  const full = r.stdout + r.stderr;
  return { ok: r.ok, output: tailLines(full, 15), full };
}

/**
 * The finding lines of a tree check's output: every non-empty trimmed line but the script's own summary lines
 * (`<script>: ...`, which carry counts such as "11 dead cite(s) of 5368 checked"). Each of the check-* TREE_CHECKS
 * prints one line per finding naming a file (path or path:line).
 */
function findingLines(script, output) {
  const header = `${path.basename(script, '.mjs')}:`;
  return [...new Set(String(output ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith(header)))];
}

/**
 * Whether a tree check's candidate run `cur` passes against its run `pre` on main: green, or red on main too with no
 * finding line main lacks (a finding the land removed is fine). A red run printing no finding line falls back to
 * the exact text. {ok, newFindings[]}
 */
function baselineVerdict(script, pre, cur) {
  if (cur.ok) return { ok: true, newFindings: [] };
  const text = (r) => r?.full ?? r?.output ?? '';
  const found = findingLines(script, text(cur));
  if (!pre || pre.ok) return { ok: false, newFindings: found };
  if (!found.length) return { ok: text(pre) === text(cur), newFindings: [] };
  const known = new Set(findingLines(script, text(pre)));
  const newFindings = found.filter((l) => !known.has(l));
  return { ok: newFindings.length === 0, newFindings };
}

/** The generator of the published packages' runtime mirrors (packages/hfs/runtime, packages/eslint/{be,fe}/runtime). */
const MIRROR_CHECK = 'scripts/hfs/sync-runtime.mjs';
const MIRROR_FIX = 'the runtime copies are generated and git-ignored: fix what sync-runtime.mjs mirrors (starci release sync-runtime regenerates them) until its run is clean';

/** `sync-runtime --check` in `dir`, shaped like a tree check run ({ok, output, full}). */
export function mirrorRun(dir) {
  if (!fs.existsSync(path.join(dir, MIRROR_CHECK))) return { ok: true, skipped: true };
  const r = node([MIRROR_CHECK, '--check'], { cwd: dir, timeout: 600_000 });
  const full = r.stdout + r.stderr;
  return { ok: r.ok, output: tailLines(full, 15), full };
}

/**
 * What the candidate's own sync-runtime mirrors, from its exported BUNDLES (never a second list): {bundles[], files[]}
 * runtime-relative, the failure-code catalog included when a bundle carries its slice. null when it cannot be read.
 */
function mirroredFiles(dir) {
  const href = pathToFileURL(path.join(dir, MIRROR_CHECK)).href;
  const script = `const m = await import(${JSON.stringify(href)}); const specs = Object.values(m.BUNDLES);
process.stdout.write(JSON.stringify({ bundles: Object.keys(m.BUNDLES), files: [...new Set([...specs.flatMap((s) => [...s.files]), ...(specs.some((s) => s.catalog) && m.CATALOG ? [m.CATALOG] : [])])] }));`;
  const r = node(['--input-type=module', '-e', script], { cwd: dir, timeout: 120_000 });
  try { return r.ok ? JSON.parse(r.stdout) : null; } catch { return null; }
}

/**
 * The mirror-drift check: a candidate changing a file a sync-runtime bundle mirrors (or a bundle, or the generator)
 * runs `sync-runtime --check` in the already-synced scratch; any drift still reported refuses with the one fix, drift
 * inherited from main (the baseline entry of the mirror check, same verdict as TREE_CHECKS) is advisory. null when it does not apply.
 */
function mirrorDriftCheck({ dir, changed, baseline = null }) {
  if (!fs.existsSync(path.join(dir, MIRROR_CHECK))) return null;
  const mirrored = mirroredFiles(dir);
  const files = new Set(mirrored?.files ?? []);
  const touches = changed.map(normPath).filter((f) => !mirrored || f === MIRROR_CHECK || files.has(f) || mirrored.bundles.some((b) => f.startsWith(`${b}/`)));
  if (!touches.length) return null;
  const r = mirrorRun(dir);
  const { ok, newFindings } = baselineVerdict(MIRROR_CHECK, baseline?.[MIRROR_CHECK], r);
  return { name: 'sync-runtime --check', ok, touches, ...(r.ok ? {} : { output: r.output, ...(ok ? { note: 'red on main too, unchanged by this land' } : { newFindings, hint: MIRROR_FIX }) }) };
}

const PACKAGE_PROOF = 'scripts/gates/package-clean-test.mjs';
const PACKAGE_PROOF_TIMEOUT_MS = 3_600_000;
/**
 * The clean-install proof of every published package the land changes (or whose bundled runtime copy mirrors a changed file): package-clean-test.mjs --base <base> in the scratch
 * (each changed package copied to a temp dir, installed from its own manifest and lock, its own tests run there). Red (1)
 * or not run (2) refuses; a land that changes no published package passes it without an install. null when the candidate
 * has no such script.
 */
function packageProofCheck({ dir, base, runner = node }) {
  if (!fs.existsSync(path.join(dir, PACKAGE_PROOF))) return null;
  const r = runner([PACKAGE_PROOF, '--base', base], { cwd: dir, timeout: PACKAGE_PROOF_TIMEOUT_MS, env: testRunEnv() });
  return { name: 'package-clean-test', ok: r.ok, output: tailLines(String(r.stdout) + String(r.stderr) + (r.error ? '\n' + String(r.error) : ''), r.ok ? 4 : 60) };
}

const syntaxChecks = (dir, present) => present.filter((x) => x.endsWith('.mjs')).map((f) => {
  const r = node(['--check', f], { cwd: dir, timeout: 60_000 });
  return { name: `node --check ${f}`, ok: r.ok, ...(r.ok ? {} : { output: tailLines(r.stderr, 10) }) };
});

const parseChecks = (dir, present) => present.filter((x) => /\.(ya?ml|json)$/i.test(x)).map((f) => {
  let ok = true, error = null;
  try { const text = fs.readFileSync(path.join(dir, f), 'utf8'); if (/\.json$/i.test(f)) JSON.parse(text); else parseYaml(text); } catch (e) { ok = false; error = String(e?.message ?? e).slice(0, 300); }
  return { name: `parse ${f}`, ok, ...(error ? { output: error } : {}) };
});

const treeChecks = (dir, baseline) => TREE_CHECKS.flatMap((script) => {
  const r = treeCheck(dir, script);
  if (r.skipped) return [];
  const { ok, newFindings } = baselineVerdict(script, baseline?.[script], r);
  return [{ name: path.basename(script), ok, ...(r.ok ? {} : { output: r.output, ...(ok ? { note: 'red on main too, unchanged by this land' } : { newFindings }) }) }];
});

/** Every required check over the candidate scratch; red or unavailable proof refuses. */
export function runChecks({ dir, base, head, baseline = null }) {
  const changedOut = git(['diff', '--name-status', `${base}..${head}`], { cwd: dir });
  const rows = changedOut.stdout.split(/\r?\n/).filter(Boolean).map((l) => l.split('\t'));
  const changed = rows.map((r) => normPath(r.at(-1)));
  const present = changed.filter((f) => fs.existsSync(path.join(dir, f)));
  const checks = [...syntaxChecks(dir, present), ...parseChecks(dir, present), ...treeChecks(dir, baseline)];
  for (const step of [mirrorDriftCheck({ dir, changed, baseline }), packageProofCheck({ dir, base }), gateLooseningCheck({ dir, base, head }), fullCheckStep(dir)]) if (step) checks.push(step);
  return { ok: checks.every((c) => c.ok), checks, changed, rows };
}

/* ------------------------------------------------------------ the gate */

/**
 * The live runtime's installed dependencies (live-node-modules-wiped, 2026-09-29 13:29Z: the live node_modules was
 * found with 0 entries and land run 49 read the missing deps as 6 red spec files). {declared, entries}: declared is
 * how many dependencies package.json names, entries how many node_modules holds (dot entries such as npm's
 * .package-lock.json not counted), null when there is no node_modules.
 */
function liveDepsState(root = SKILL_ROOT) {
  let declared = 0;
  try { const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')); declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length; } catch { /* no manifest: nothing declared */ }
  let entries = null;
  try { entries = fs.readdirSync(path.join(root, 'node_modules')).filter((n) => !n.startsWith('.')).length; } catch { /* absent */ }
  return { declared, entries };
}
const depsMissing = (s) => s.declared > 0 && !s.entries;
const depsHint = (root) => `the live runtime's node_modules is missing or emptied; restore it (\`npm ci\` in ${root}), find what emptied it (a recursive delete or an npm reify through a scratch/staging node_modules junction), then land again`;

/** A cherry-pick that did not apply, with the scratch's pick aborted: the refusal result (conflict, git-failed or git-unusable). */
function pickRefusal({ root, deps, result }, { scratch, step, base, pick }) {
  const said = pick.stderr || pick.stdout || pick.error || '';
  const stopped = /could not apply ([0-9a-f]{7,40})/.exec(said)?.[1] ?? null;
  const conflicts = pickConflicts(scratch.dir, stopped);
  git(['cherry-pick', '--abort'], { cwd: scratch.dir });
  // A conflict is unmerged files (or git saying so). Anything else is git failing, and it is reported as that: a
  // broken repo (core.bare) must never read as "rebase your lane" (runs 21 and 22, 2026-09-29).
  if (!conflicts.length && !/\bCONFLICT\b|could not apply|after resolving the conflicts/i.test(said)) {
    const again = (deps.gitHealth ?? gitHealth)({ root });
    if (!again.ok) { result.attempts.push({ ...step, reason: 'git-unusable' }); return { ...result, base, reason: 'git-unusable', detail: again.detail, hint: again.hint }; }
    result.attempts.push({ ...step, reason: 'git-failed' });
    return { ...result, base, reason: 'git-failed', detail: tailLines(said, 12), hint: 'git itself failed applying the commit(s); this is not a content conflict, so do not rebase: land again, and if it repeats read the detail' };
  }
  result.attempts.push({ ...step, reason: 'conflict' });
  return { ...result, base, reason: 'conflict', detail: tailLines(said, 12), conflicts, hint: conflictHint(conflicts, stopped) };
}

/** The landed result: main moved to `head`; the grammar rebuild when the change touched it. */
function landedResult({ root, env, deps, result }, { checked, base, head }) {
  const landed = { ...result, ok: true, landed: head, base, head, checks: checked.checks, changed: checked.changed };
  const grammarPaths = [...(checked.changed ?? []), ...(checked.rows ?? []).flatMap((row) => row.slice(1))].map((file) => normPath(file));
  if (grammarPaths.some((file) => file.startsWith('packages/grammar/src/') || file === 'packages/grammar/package.json')) {
    try { landed.grammarRebuild = (deps.rebuildGrammar ?? buildGrammar)({ root, changed: grammarPaths, env }); }
    catch (error) { landed.grammarRebuild = { ok: false, step: 'exception', detail: String(error?.message ?? error), owed: ['grammar-dist-rebuild'] }; }
  }
  return landed;
}

/** One attempt's work inside its scratch: the pick, the checks, the fast-forward. The result, or null when main moved under it (the gate reruns). */
function landInScratch(run, scratch, step) {
  const { commits, root, deps, result, check, liveDeps } = run;
  const { base } = step;
  const baseline = {};
  if (!deps.runChecks) {
    for (const script of TREE_CHECKS) baseline[script] = treeCheck(scratch.dir, script);
    baseline[MIRROR_CHECK] = mirrorRun(scratch.dir);
  }
  const pick = git(['cherry-pick', '--allow-empty', '--keep-redundant-commits', ...commits], { cwd: scratch.dir });
  if (!pick.ok) return pickRefusal(run, { scratch, step, base, pick });
  const head = git(['rev-parse', 'HEAD'], { cwd: scratch.dir }).stdout;
  // The pick changes nothing: main already carries the change (a re-land of a landed commit).
  if (git(['diff', '--quiet', base, head], { cwd: scratch.dir }).ok) {
    result.attempts.push({ ...step, reason: 'already-landed' });
    return { ...result, ok: true, alreadyLanded: base, landed: null, base, head: base, checks: [], changed: [] };
  }
  const checked = check({ dir: scratch.dir, base, head, baseline });
  step.head = head;
  step.checks = checked.checks;
  const depsAfter = liveDepsState(root);
  if ((depsAfter.entries ?? 0) < (liveDeps.entries ?? 0)) {
    result.attempts.push({ ...step, reason: 'live-deps-missing' });
    return { ...result, base, head, reason: 'live-deps-missing', detail: `${path.join(root, 'node_modules')} went from ${liveDeps.entries} to ${depsAfter.entries ?? 'no'} entries while this land's checks ran in ${scratch.dir}`, hint: depsHint(root), checks: checked.checks };
  }
  if (!checked.ok) {
    result.attempts.push({ ...step, reason: 'checks-red' });
    return { ...result, base, head, reason: 'checks-red', checks: checked.checks, changed: checked.changed };
  }
  // Only the publish holds the host lock; main must still be `base` when it does (compare-and-swap), else the gate reruns on the new main.
  const ff = underHostLockWaiting(run, () => { const moved = fastForwardLive({ root, base, head, rows: checked.rows }); return moved.ok ? { ...moved, landed: landedResult(run, { checked, base, head }) } : moved; });
  if (ff.ok) return ff.landed;
  result.attempts.push({ ...step, reason: ff.reason });
  if (ff.reason === 'main-moved') return null;
  return { ...result, base, head, reason: ff.reason, detail: ff.detail ?? null, dirty: ff.dirty ?? null, checks: checked.checks, ...(ff.reason === 'host-lock-held' ? { owner: ff.owner, hint: ff.hint, waitedMs: ff.waitedMs } : {}) };
}

/** One attempt of the gate on the current main: its own scratch, removed afterwards. The result, or null when main moved (rerun). */
function landAttempt(run, attempt) {
  const { root, env, deps, result } = run;
  const base = git(['rev-parse', 'refs/heads/main'], { cwd: root }).stdout;
  const health = (deps.gitHealth ?? waitGitHealthy)({ root });
  if (!health.ok) return { ...result, base, reason: 'git-unusable', detail: health.detail, hint: health.hint };
  const scratch = makeScratch({ root, base, env });
  if (!scratch.ok) return { ...result, reason: 'scratch-failed', detail: scratch.error };
  try {
    return landInScratch(run, scratch, { attempt, base });
  } finally {
    const before = liveDepsState(root).entries ?? 0;
    if (!removeScratch(scratch.dir, { root })) result.cleanup.left.push(scratch.dir);
    const after = liveDepsState(root).entries ?? 0;
    if (after < before) result.cleanup.liveDepsLost = { scratch: scratch.dir, before, after };
  }
}

/**
 * Land `commits` (in order) on live main of `root`. `deps.runChecks` replaces the checks. Returns {ok, landed?, base, head?, checks, reason?}. A live runtime without its installed
 * dependencies is refused before any check (reason live-deps-missing): its checks would fail on ERR_MODULE_NOT_FOUND
 * and read as the commit's fault. The same reason refuses a land whose checks ran while the live node_modules lost
 * entries, and result.cleanup.liveDepsLost names a scratch removal after which it had fewer.
 */
function landCommits({ commits, root = SKILL_ROOT, env = process.env, deps = {} }) {
  const check = deps.runChecks ?? runChecks;
  // cleanup is shared by reference with every result below: a scratch this land could not remove shows in it.
  const result = { ok: false, commits, attempts: [], cleanup: { left: [] } };
  const liveDeps = liveDepsState(root);
  if (depsMissing(liveDeps)) return { ...result, reason: 'live-deps-missing', detail: `${path.join(root, 'node_modules')}: ${liveDeps.entries ?? 'no'} entries, package.json declares ${liveDeps.declared}`, hint: depsHint(root) };
  const run = { commits, root, env, deps, check, result, liveDeps };
  for (let attempt = 1; attempt <= MAX_MAIN_RETRIES; attempt += 1) {
    const landed = landAttempt(run, attempt);
    if (landed) return landed;
  }
  return { ...result, reason: 'main-moving', detail: `main moved under the gate ${MAX_MAIN_RETRIES} times` };
}

const claimGate = (env, ticketId) => {
  try { return withMachine((m) => m.claimLandGate({ ticketId }), { env }); }
  catch (error) { if (!isMachineBusy(error)) { throw error; } return { ok: false, dbBusy: error.message }; }
};
const gateRefusal = (queue, ticketId, got) => ({ ok: false, holder: queue.find((t) => t.state === 'running') ?? null, ahead: queue.findIndex((t) => t.ticketId === ticketId), why: got.dbBusy ? 'db-busy' : 'gate-held', ...(got.dbBusy ? { detail: got.dbBusy } : {}) });

/**
 * Wait for the gate in request order: a land_queue ticket joins the queue and only the oldest live ticket enters.
 * {ok, ticketId, release(state)} or {ok:false, holder, ahead, why} (the ticket is cancelled then). A machine.sqlite that stays
 * locked past machine-db's busy budget never throws: the poll goes on until waitMs, then {ok:false, why:'db-busy'}. why is
 * 'gate-held' (another land holds the gate) or 'db-busy'. A claim is one transaction, so a refused one leaves no half-claimed gate.
 */
export function acquireLand({ env = process.env, waitMs = LAND_WAIT_MS, pollMs = 5000, lane = null, commits = [], sleep = sleepSync } = {}) {
  let ticketId;
  try { ticketId = withMachine((m) => m.enqueueLand({ lane, commitSha: commits.at(-1) ?? 'unknown', commits: commits.length }), { env }); }
  catch (error) { if (isMachineBusy(error)) { return { ok: false, holder: null, ahead: -1, why: 'db-busy', detail: error.message }; } throw error; }
  const finish = (state) => { try { withMachine((m) => m.finishLandTicket(ticketId, state), { env }); } catch { /* the reaper cancels it */ } };
  const drop = () => finish('cancelled');
  process.on('exit', drop);
  const end = Date.now() + waitMs;
  try {
    for (;;) {
      const got = claimGate(env, ticketId);
      if (got.ok) return { ok: true, ticketId, release: (state = 'cancelled') => { process.removeListener('exit', drop); finish(state); } };
      if (Date.now() >= end) {
        const queue = landQueue({ env });
        process.removeListener('exit', drop); drop();
        return gateRefusal(queue, ticketId, got);
      }
      sleep(pollMs);
    }
  } catch (error) { process.removeListener('exit', drop); drop(); throw error; }
}

/** What a land of a job carries: its commits and its source branch, or {refused} (no job, no done report). */
const jobLandTarget = ({ jobId, commits, root, env }) => {
  const found = readMachine((m) => ({ job: m.supJob(jobId), report: m.supReports({ jobId }).pop()?.report ?? null }), null, { env });
  if (!found?.job) return { refused: { ok: false, reason: 'no-job', detail: jobId } };
  const { job, report } = found;
  const revList = (range) => git(['rev-list', '--reverse', range], { cwd: root }).stdout.split(/\r?\n/).filter(Boolean);
  let list = commits;
  if (job.payload?.self && !list) {
    const staging = job.payload.staging;
    list = staging ? revList(`${staging.base}..${staging.branch}`) : [];
  } else if (!list) {
    if (report?.outcome !== 'done' || !report.commit) return { refused: { ok: false, reason: 'no-done-report', detail: `${jobId} has no done report with a commit` } };
    const range = report.base ? revList(`${report.base}..${report.commit}`) : [report.commit];
    list = range.length ? range : [report.commit];
  }
  return { commits: list, sourceBranch: report?.branch ?? job.payload?.staging?.branch ?? null, supervisorJob: true };
};

/** Record a land refused before it ran and answer with it. `swallow` keeps a failed record from replacing the answer. */
const refuseLand = (c, result, { swallow = true } = {}) => {
  const record = () => withMachine((m) => recordLand(m, { result, root: c.root, env: c.env, lane: c.lane, commits: c.commits, jobId: c.jobId, startedAt: c.startedAt, orca: c.deps.orca }), { env: c.env });
  if (!swallow) record();
  else { try { record(); } catch { /* the answer carries it */ } }
  return result;
};

/** The refusals that need no queue and no scratch: git health, a pick that cannot apply, a live checkout off main. The refusal result or null. */
function refusalBeforeQueue(c) {
  const { root, env, lane, commits, jobId, deps } = c;
  // A repo git cannot run a work-tree operation in fails every step after the queue: refuse it up front with its own reason.
  const health = (deps.gitHealth ?? waitGitHealthy)({ root });
  if (!health.ok) return refuseLand(c, { ok: false, commits, reason: 'git-unusable', preflight: true, detail: health.detail, hint: health.hint });
  if (lane) withMachine((m) => { if (!m.laneOf(lane)) m.upsertLane({ name: lane, worktreePath: path.join(lanesRoot({ env }), lane), branch: `lane/${lane}`, owner: jobId ? `worker:${jobId}` : 'owner-chat' }); }, { env });
  // A pick that cannot apply is refused before the queue: the lane learns its exact hunks in seconds, not after
  // waiting its turn (ledger 2026-09-28: 15 of 16 failed lands were conflicts, most retried blind).
  if (!deps.skipPreflight) {
    const pre = (deps.conflictPreflight ?? conflictPreflight)({ root, commits });
    if (!pre.ok) {
      return refuseLand(c, { ok: false, commits, reason: 'conflict', preflight: true, base: pre.onto ?? null, conflicts: pre.conflicts, hint: conflictHint(pre.conflicts, pre.conflicts[0]?.commit),
        detail: `does not apply on main ${String(pre.onto ?? '').slice(0, 9)}: ${pre.conflicts.map((x) => x.file).join(', ')}` }, { swallow: false });
    }
  }
  // MB-12: the cheap live condition before the queue and the checks: a live checkout off main fails at the fast-forward
  // after every check has run (10 lands, 46 min on 2026-09-25).
  const branch = (deps.liveBranch ?? (() => git(['symbolic-ref', '-q', 'HEAD'], { cwd: root }).stdout))();
  if (branch === 'refs/heads/main') return null;
  return refuseLand(c, { ok: false, commits, reason: 'live-not-on-main', preflight: true, detail: branch || 'detached' });
}

/** MB-10: a busy gate is a visible, recorded outcome that names the lane, its commits, the wait and the holder. */
const gateBusyResult = (c, lock) => ({ ok: false, commits: c.commits, lane: c.lane, reason: 'gate-busy', why: lock.why ?? 'gate-held', holder: lock.holder ?? null, ahead: lock.ahead ?? 0, waitedMs: Date.now() - c.startedAt,
  detail: (lock.why === 'db-busy' ? 'machine.sqlite locked; ' : '') + 'waited ' + Math.round((Date.now() - c.startedAt) / 1000) + 's' + (lock.holder ? ' behind ' + String(lock.holder.lane ?? lock.holder.ticketId ?? 'a land') + ' (' + String(lock.holder.commit ?? '').slice(0, 9) + ')' : '') });

/** Write the core record of a landed result; main already moved, so a failed write never turns it into a failed land. */
const persistLand = (c, result, { ticketId }) => {
  const { root, env, lane, commits, jobId, startedAt, deps } = c;
  // A failed record is reported (recordError) and the core record is written again, or queued in the outbox for the next land (recordDeferred).
  const outcome = landOutcomeOf(result, { ticketId, lane, commits, jobId, startedAt });
  try { result.landRun = withMachine((m) => recordLand(m, { result, root, env, ticketId, lane, commits, jobId, startedAt, outcome, orca: deps.orca }), { env }); }
  catch (error) {
    result.recordError = String(error?.message ?? error);
    const again = writeOrDefer('recordLandOutcome', [outcome], { env });
    if (again.ok) result.landRun = again.value.runId;
    else result.recordDeferred = again.deferred;
  }
};

const upgradeIdOf = (c, { sourceBranch, supervisorJob }) => selfUpgradeIdOf({
  branch: sourceBranch ?? (supervisorJob ? null : (c.deps.selfUpgradeBranchContaining ?? selfUpgradeBranchContaining)({ root: c.root, commit: c.commits[c.commits.length - 1] })),
  lane: c.lane, jobId: supervisorJob ? c.jobId : null });

/** The land itself, inside the gate: the outbox, the checks and the fast-forward, the records. `gate.state` is what the ticket is released as. */
function landInsideGate(c, { lock, notify, target, gate }) {
  const { root, env, commits, jobId, deps } = c;
  // Records an earlier land could not write (machine-db outbox) are applied first, inside the gate.
  let outbox = null;
  try { outbox = withMachine((m) => m.flushOutbox(), { env }); } catch (error) { outbox = { error: String(error?.message ?? error) }; }
  const landed = landCommits({ commits, root, env, deps });
  const result = withSelfUpgradeRef(landed, { root, id: upgradeIdOf(c, target), write: deps.writeSelfUpgradeRef ?? writeSelfUpgradeRef });
  if (outbox && (outbox.flushed || outbox.failed || outbox.error || outbox.busy)) result.outbox = outbox;
  gate.state = result.ok ? 'passed' : 'failed';
  persistLand(c, result, { ticketId: lock.ticketId });
  if (notify || result.grammarRebuild?.ok === false) {
    try { withMachine((m) => m.recordSupMessage({ direction: 'in', channel: 'tell', from: 'land-gate', text: describe(result, { jobId }) }), { env }); } catch { /* the land_runs row is the record */ }
  }
  return result;
}

/** The full gate for one job or commit list, with the queue, the machine records and the optional inbox notice. */
export async function land({ jobId = null, commits = null, lane = null, notify = false, waitMs = LAND_WAIT_MS, root = SKILL_ROOT, env = process.env, deps = {} } = {}) {
  let target = { commits, sourceBranch: null, supervisorJob: false };
  if (jobId) target = jobLandTarget({ jobId, commits, root, env });
  if (target.refused) return target.refused;
  if (!target.commits?.length) return { ok: false, reason: 'nothing-to-land' };
  const c = { root, env, lane, commits: target.commits, jobId, startedAt: Date.now(), deps };
  const refused = refusalBeforeQueue(c);
  if (refused) return refused;
  const lock = (deps.acquireLand ?? acquireLand)({ env, waitMs, lane, commits: c.commits });
  if (!lock.ok) return refuseLand(c, gateBusyResult(c, lock));
  const gate = { state: 'cancelled' };
  try { return landInsideGate(c, { lock, notify, target, gate }); } finally { lock.release(gate.state); }
}

if (isMain(import.meta.url)) {
  setPriority();
  const argv = process.argv.slice(2);
  const has = (n) => argv.includes(`--${n}`);
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const csv = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
  if (has('status')) console.log(JSON.stringify(landStatus()));
  else if (!value('job') && !value('commit')) { console.error('use: starci supervisor land --job <id> | --commit <sha>[,<sha>] [--lane <name>] [--notify] [--foreground] [--json]'); process.exitCode = 2; }
  else if (!has('foreground')) {
    const started = startDetachedLand({ script: fileURLToPath(import.meta.url), argv });
    console.log(has('json') ? JSON.stringify({ ok: true, detached: true, ...started }) : detachedLandLine(started));
  } else {
    const r = await land({ jobId: value('job'), commits: value('commit') ? csv(value('commit')) : null, lane: value('lane'),
      notify: has('notify'), waitMs: Number(value('wait-ms')) || LAND_WAIT_MS });
    console.log(has('json') ? JSON.stringify(r) : describe(r, { jobId: value('job') }));
    if (!r.ok) process.exitCode = 1;
  }
}
