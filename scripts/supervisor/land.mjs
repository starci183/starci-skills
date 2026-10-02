#!/usr/bin/env node
// starci supervisor land — the ONE land gate of the live runtime (modules/supervisor/supervise.yaml landGate, docs/supervisor.md).
// Serialized by a host lock; a change reaches live main only through all of it, or not at all.
//
//   starci supervisor land --job <jobId> [--specs <csv>] [--no-push] [--notify] [--json]
//   starci supervisor land --commit <sha>[,<sha>...] [--specs <csv|touching|direct|all|none>] [--reason <why>] [--full-by-push-git] [--lane <name>] [--no-push] [--notify] [--json]
//   starci supervisor land --status [--json]
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
//      the clean-install proof of every published package the change touches (packageProofCheck: package-clean-test.mjs --base <base>; red or not run refuses, no baseline);
//      the FULL `starci runtime check` of the candidate (land-full-check.mjs: packages/cli/bin/starci.mjs runtime check, not only the gate), a step of its own; red refuses, no baseline;
//      the specs named by the worker/--specs plus every spec that names a changed file (node --test,
//        --test-concurrency allocation.landGate.specConcurrency, timeout specsBaseMs + perSpecMs per spec; `--specs direct` keeps the
//        specs that can see the change instead: land-specs.mjs, hub files narrowed to the exports the diff reaches) -
//        default mode `touching` (owner rule 2026-09-29, config.yaml `specs.harness` default false = touching-only): every
//        named spec plus every spec naming a changed file runs and a red one refuses; the whole suite is never a land's
//        job - `--specs all` is refused unless `specs.harness: true` or the push-git flow passes `--full-by-push-git`
//        (engine/config.mjs harnessSpecsEnabled); `--specs none` needs an explicit `--reason` (recorded as specReason on the
//        land run); `--specs <csv>` adds named specs;
//      contract-changes: every changed contract/schema/knowledge/op file (CONTRACT_PREFIXES) is covered by
//        `paths` of an entry the change itself adds or edits - an entry file modules/kernel/contract-changes/<id>.yaml
//        (contract-changes-store.mjs);
//      gate-stability (a REPORT, never a refusal): a land touching a frozen family's gatePaths, or adding/editing
//        a contract change that adds checks or codes for it (modules/kernel/contract-freeze.yaml), runs the family's
//        gates as main and as the candidate have them over the latest accepted leg of every live workflow
//        (scripts/supervisor/gate-stability.mjs, read-only) and reports how many would flip - so the Supervisor
//        decides when to starci kernel contract-release it.
// 3b. git health: a repo whose shared config says core.bare=true fails every work-tree operation ("this operation must be run
//    in a work tree"); that is refused as `git-unusable` (before the queue and before each scratch), and a cherry-pick that fails
//    without unmerged files is `git-failed`, never `conflict`. Each attempt owns one scratch-<pid>-<token> worktree it alone removes.
// 4. Fast-forward live main: main must still be the scratch's base (else the whole gate reruns on the new main,
//    at most 3 times), the live checkout must be on main and clean for the changed paths; then
//    `git update-ref refs/heads/main <new> <base>` (compare-and-swap) and a working-tree + index update of just
//    those paths. A failed tree update rolls the ref and the paths back.
// 5. Push main (secret scan of origin/main..main first, hooks on) unless --no-push or config
//    supervisor.landGate.push is false. A push the remote refuses leaves the land in place and is reported.
// A worker job lands as `succeeded` and its staging checkout and temp branch are removed - so does a self job
// (`starci supervisor workers stage --self`) whose branch --commit landed in full (selfJobsLandedBy); a red gate records
// `land-failed` and, with --notify, tells the Supervisor through its inbox. Nothing half-lands.
import '../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runNpm } from '../api/npm/run-npm.mjs';
import { randomBytes, createHash } from 'node:crypto';
import { setPriority } from '../api/process/set-priority.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { allocationMs, allocationSettings, harnessSpecsEnabled } from '../../engine/config.mjs';
import { git, normPath, finishLanded, selfJobsLandedBy, recordLandFailed } from './workers.mjs';
import { withMachine, readMachine, writeOrDefer, newSpanId, isMachineBusy } from '../../engine/db/machine.mjs';
import { scanRange, scanHint } from './push-mains.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { unlinkNodeModulesLink } from '../api/fs/unlink-node-modules-link.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { safeRemoveWorktree, createScratchWorktree } from '../machine/worktree-git.mjs';
import { ci } from '../api/npm/ci.mjs';
import { markRemoved } from '../machine/worktree-registry.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { withSwcCache } from '../gates/build-env.mjs';
import { hostThrottle } from '../machine/ram-throttle.mjs';
import { grammarDistStatus } from '../gates/grammar-dist.mjs';
import { specsDependingOn } from '../lib/spec-deps.mjs';
import { readContractChangesDocAt } from '../machine/contract-changes-store.mjs';
import { CONTRACT_CHANGES_DIR, isContractChangesPath } from '../lib/contract-changes-path.mjs';
import { SKILL_ROOT, lanesRoot, landRoot, supervisorSettings } from '../machine/home.mjs';
import { specsDirect, changedExports, headRanges } from './land-specs.mjs';
import { DEFAULT_DUE_MS } from '../machine/decisions.mjs';
import { fullCheckStep } from './land-full-check.mjs';
import { fastForwardLive } from '../machine/live-fast-forward.mjs';
import { withoutGitLocalEnv } from '../lib/git.mjs'; import { isMain } from '../lib/is-main.mjs';
import { tailLines } from '../lib/clip.mjs';
const CONTRACT_PREFIXES = Object.freeze(['knowledge/', 'modules/schemas/', 'modules/ops/', 'modules/kernel/', 'modules/supervisor/', 'modules/models/code-patterns.yaml']);
export const TREE_CHECKS = Object.freeze(['scripts/hfs/sync-runtime.mjs', 'scripts/checks/check-module-yaml.mjs', 'scripts/checks/check-contract-cites.mjs', 'scripts/checks/check-cli-parity.mjs', 'scripts/checks/check-worktree-add.mjs']);
const MAX_MAIN_RETRIES = 3;
export const LAND_WAIT_MS = allocationMs('landGate.waitMs');
/** The spec run's timeout: a base plus a share per spec, so a 70-spec engine change is not cut off under load. */
export const specConcurrency = () => { const n = Number(allocationSettings()?.landGate?.specConcurrency); if (!Number.isInteger(n) || n < 1) throw Error('modules/models/runtimes.yaml allocation.landGate.specConcurrency must be a positive integer'); return n; };
export const specTimeoutMs = (count) => allocationMs('landGate.specsBaseMs') + count * allocationMs('landGate.perSpecMs');

/**
 * The land gate's spec run under the RAM-aware throttle (scripts/machine/ram-throttle.mjs, owner ruling 2026-09-28):
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

/**
 * The roots a tree-wide invariant spec scans, as it declares them ONCE: `export const INVARIANT_ROOTS = ['scripts', ...]`
 * (the list its own walk uses). Such a spec never names the file it catches, so naming alone would skip it.
 */
export const invariantRootsOf = (text) => {
  const m = /^export const INVARIANT_ROOTS = \[([^\]]*)\]/m.exec(String(text ?? ''));
  return m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => normPath(x[1]).replace(/\/+$/, '')) : [];
};
/** Invariant specs (invariantRootsOf) scanning a root that holds a changed file. */
const specsInvariant = (changed, { specs }) => {
  const files = changed.map(normPath);
  return specs.filter(({ file, text }) => file && invariantRootsOf(text).some((r) => files.some((f) => f.startsWith(`${r}/`)))).map((s) => s.file);
};
/** Specs that name a changed file (its last two path segments, or its name for a top-level file), the invariant specs
 *  scanning a changed file's root, plus changed specs. */
export function specsTouching(changed, { specs, root = null }) {
  const needles = changed.map(normPath).filter((f) => !f.startsWith('tests/')).map((f) => f.split('/').slice(-2).join('/'));
  const own = changed.map(normPath).filter((f) => /^tests\/[^/]+\.spec\.mjs$/.test(f));
  const hits = specs.filter(({ file, text }) => needles.some((n) => text.includes(n)) && file).map((s) => s.file);
  // By dependency too: every spec whose relative-import graph reaches a changed file (scripts/lib/spec-deps.mjs), so a
  // clash between two lanes is refused at land time, not found at the final full run.
  const deps = root ? specsDependingOn(root, changed.map(normPath), specs.map((s) => s.file).filter(Boolean)) : [];
  return [...new Set([...own, ...hits, ...deps, ...specsInvariant(changed, { specs })])];
}

/** --specs keywords: `touching` = the named specs plus every spec naming a changed file (the default); `all` = every spec
 *  (refused unless specs.harness is true or the push-git flow asks); `direct` = the specs that can see the change (hub files narrowed to the exports reached); `none` = no spec (needs an explicit --reason). */
const SPEC_KEYWORDS = Object.freeze(['touching', 'direct', 'all', 'none']);
/**
 * The gate's spec plan (owner rule 2026-09-29). The default mode is `touching`: the named specs (--specs csv, a job's) plus
 * every spec touching the change; red refuses. `all` needs `fullAllowed` (config.yaml `specs.harness: true`) or `fullByPushGit`,
 * else the plan is refused (`refused: specs-all-refused`). `none` needs a non-empty `reason` (`specs-none-needs-reason`).
 * Returns {mode: none|touching|all, named, refused?, detail?}.
 */
export function specPlan({ fullAllowed = false, fullByPushGit = false, asked = [], named = [], reason = null } = {}) {
  const words = asked.filter((s) => SPEC_KEYWORDS.includes(s));
  const files = [...new Set([...asked.filter((s) => !SPEC_KEYWORDS.includes(s)), ...named])];
  if (words.includes('all') && !(fullAllowed || fullByPushGit)) return { mode: 'touching', named: files, refused: 'specs-all-refused', detail: 'a land never runs the whole suite: config.yaml specs.harness is not true (touching-only); use --specs touching, or /push-git for the full run' };
  if (words.includes('all')) return { mode: 'all', named: files };
  if (words.includes('direct')) return { mode: 'direct', named: files };
  if (words.includes('none')) {
    if (!String(reason ?? '').trim()) return { mode: 'touching', named: files, refused: 'specs-none-needs-reason', detail: '--specs none needs an explicit --reason "<why no spec touching this change applies>"' };
    return { mode: 'none', named: [] };
  }
  return { mode: 'touching', named: files };
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
const conflictHint = (conflicts, commit = null) => `rebase the lane onto current main (git rebase main in its worktree), resolve ${conflicts.map((c) => c.file).join(', ') || 'the conflicting files'}${commit ? ` in ${String(commit).slice(0, 9)}` : ''}, run its specs, then land the new sha; the same sha on the same main conflicts again`;

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

const outcome = (r) => ({ ok: r.status === 0, status: r.status, stdout: String(r.stdout ?? ''), stderr: String(r.stderr ?? ''), error: r.error?.message ?? null });
const node = (args, { cwd, timeout = 1_200_000, env = process.env } = {}) => outcome(runNode(args, { cwd, timeout, env, maxBuffer: 64 * 1024 * 1024 }));
/** The env the gate's spec run gets: no test-runner channel, no git repository-local variables. */
export function specRunEnv(parent = process.env) {
  const env = withoutGitLocalEnv(parent);
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
export function gitHealth({ root = SKILL_ROOT } = {}) {
  const inside = git(['rev-parse', '--is-inside-work-tree'], { cwd: root });
  if (inside.ok && inside.stdout === 'true') return { ok: true };
  const bare = git(['config', '--show-origin', '--get', 'core.bare'], { cwd: root }).stdout;
  const why = /\btrue$/.test(bare) ? `core.bare=true (${bare.replace(/\s+true$/, '')})` : (inside.stderr || inside.error || `is-inside-work-tree: ${inside.stdout || 'unreadable'}`).slice(0, 200);
  return { ok: false, detail: why, bare: /\btrue$/.test(bare), hint: /\btrue$/.test(bare) ? `something set core.bare=true on ${root}; run \`git -C ${root} config core.bare false\` (the gate never edits the live repo config), then land again` : `git cannot run a work-tree operation in ${root}; fix that first, then land again` };
}
const GIT_HEALTH_WAIT_MS = 20_000;
/** gitHealth, retried for a transient value: {ok} or {ok:false, detail, hint, waitedMs}. Seams: check, sleep, now. */
export function waitGitHealthy({ root = SKILL_ROOT, waitMs = GIT_HEALTH_WAIT_MS, pollMs = 1000, check = gitHealth, sleep = sleepSync, now = Date.now } = {}) {
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
export function findingLines(script, output) {
  const header = `${path.basename(script, '.mjs')}:`;
  return [...new Set(String(output ?? '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith(header)))];
}

/**
 * Whether a tree check's candidate run `cur` passes against its run `pre` on main: green, or red on main too with no
 * finding line main lacks (a finding the land removed is fine). A red run printing no finding line falls back to
 * the exact text. {ok, newFindings[]}
 */
export function baselineVerdict(script, pre, cur) {
  if (cur.ok) return { ok: true, newFindings: [] };
  const text = (r) => r?.full ?? r?.output ?? '';
  const found = findingLines(script, text(cur));
  if (!pre || pre.ok) return { ok: false, newFindings: found };
  if (!found.length) return { ok: text(pre) === text(cur), newFindings: [] };
  const known = new Set(findingLines(script, text(pre)));
  const newFindings = found.filter((l) => !known.has(l));
  return { ok: newFindings.length === 0, newFindings };
}

/**
 * The gate's own node --test reporter (written to a temp file per run): one JSON line per failed test, {file, name},
 * `name` the path of names from the file's top-level test down (' > '), so a failure is known by (spec file, test
 * name), never by a count. A todo test failing is not a failure.
 */
const FAIL_REPORTER = `export default async function* failures(source) {
  const pending = new Map();
  const line = (file, f) => JSON.stringify({ file, name: f.path.join(' > ') }) + '\\n';
  for await (const { type, data } of source) {
    if (type !== 'test:pass' && type !== 'test:fail') continue;
    const file = data.file ?? '';
    const list = pending.get(file) ?? [];
    const up = list.filter((f) => f.nesting > data.nesting).map((f) => ({ nesting: data.nesting, path: [data.name, ...f.path] }));
    const next = [...list.filter((f) => f.nesting <= data.nesting), ...(type === 'test:fail' && !data.todo ? [{ nesting: data.nesting, path: [data.name] }] : []), ...up];
    if (data.nesting === 0) { for (const f of next) yield line(file, f); pending.delete(file); } else pending.set(file, next);
  }
  for (const [file, list] of pending) for (const f of list) yield line(file, f);
}
`;
const failKey = (f) => `${f.file}\u0000${f.name}`;
const uniqFailures = (list) => [...new Map(list.map((f) => [failKey(f), f])).values()];
const failList = (list) => list.map((f) => `${f.file} :: ${f.name}`).join('; ');

/**
 * Run `files` with node --test in `dir` (the gate's env, the tree's own test preload, `concurrency`): {ok, status,
 * error, stdout, stderr, failures} with failures [{file (repo-relative), name}], or null when the reporter wrote
 * nothing readable (the run crashed before reporting).
 */
export function runSpecFiles({ dir, files, concurrency, timeout = specTimeoutMs(files.length) }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'land-specs-'));
  try {
    const reporter = path.join(tmpDir, 'failures.mjs');
    const out = path.join(tmpDir, 'failures.jsonl');
    fs.writeFileSync(reporter, FAIL_REPORTER);
    // The tree's own test preloads run first in every spec child (a tree from before them runs without): isolated-registry
    // isolates the machine registry, runtime-copies regenerates the git-ignored runtime copies the package sources import.
    const importArgs = ['isolated-registry.mjs', 'runtime-copies.mjs'].map((name) => path.join(dir, 'tests', 'setup', name)).filter((preload) => fs.existsSync(preload)).flatMap((preload) => ['--import', pathToFileURL(preload).href]);
    const r = node([...importArgs, '--test', `--test-concurrency=${concurrency}`, '--test-reporter=spec', '--test-reporter-destination=stdout',
      `--test-reporter=${pathToFileURL(reporter).href}`, `--test-reporter-destination=${out}`, ...files], { cwd: dir, timeout, env: specRunEnv() });
    let failures = null;
    try {
      const rel = (f) => normPath(path.isAbsolute(f) ? path.relative(dir, f) : f);
      failures = uniqFailures(fs.readFileSync(out, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l)).map((f) => ({ file: rel(String(f.file)), name: String(f.name) })));
    } catch { failures = null; }
    return { ...r, failures };
  } finally { try { safeRemove(tmpDir, { hold: artifactHoldReason }); } catch { /* temp */ } }
}

/**
 * Rerun `files` once in a scratch worktree of `root` at `base`: {ok:true, failures, ran} or {ok:false, error} when the
 * base run cannot run (no base tree, no scratch, a crash or timeout, a red run naming no failed test).
 */
function specBaseRunAt({ root, base, files, concurrency, env = process.env }) {
  if (!root) return { ok: false, error: 'no base tree to rerun the failing specs at base' };
  let scratch;
  try { scratch = makeScratch({ root, base, env }); } catch (e) { return { ok: false, error: `base scratch failed: ${String(e?.message ?? e).slice(0, 300)}` }; }
  if (!scratch.ok) return { ok: false, error: `base scratch failed: ${String(scratch.error).slice(0, 300)}` };
  try {
    const present = files.filter((f) => fs.existsSync(path.join(scratch.dir, f)));
    if (!present.length) return { ok: true, failures: [], ran: [] };
    const r = runSpecFiles({ dir: scratch.dir, files: present, concurrency });
    if (r.error) return { ok: false, error: `base spec run did not finish: ${r.error}` };
    if (!r.failures) return { ok: false, error: `base spec run wrote no failure report (exit ${r.status}): ${tailLines(r.stdout + r.stderr, 6)}` };
    if (!r.ok && !r.failures.length) return { ok: false, error: `base spec run exited ${r.status} naming no failed test: ${tailLines(r.stdout + r.stderr, 6)}` };
    return { ok: true, failures: r.failures, ran: present };
  } finally { removeScratch(scratch.dir, { root }); }
}

/**
 * Whether a red spec run passes against its rerun at base: every failure is in a spec the change did not add or modify
 * and main fails that same (file, test name) too. {ok, newFailures, changedSpecFailures, inherited, why}
 */
export function specBaselineVerdict({ candidate, base, changed = [] }) {
  if (!candidate) return { ok: false, newFailures: [], changedSpecFailures: [], inherited: [], why: 'the spec run wrote no failure report (it crashed or timed out)' };
  if (!candidate.length) return { ok: false, newFailures: [], changedSpecFailures: [], inherited: [], why: 'the spec run is red but names no failed test' };
  const touched = new Set(changed.map(normPath));
  const changedSpecFailures = candidate.filter((f) => touched.has(f.file));
  const rest = candidate.filter((f) => !touched.has(f.file));
  if (rest.length && !base?.ok) return { ok: false, newFailures: [], changedSpecFailures, inherited: [], why: `the rerun at base could not run: ${base?.error ?? 'not run'}` };
  const known = new Set((base?.failures ?? []).map(failKey));
  const newFailures = rest.filter((f) => !known.has(failKey(f)));
  const inherited = rest.filter((f) => known.has(failKey(f)));
  const ok = !newFailures.length && !changedSpecFailures.length;
  const why = ok ? null : [changedSpecFailures.length ? `${changedSpecFailures.length} failure(s) in a spec this change added or modified` : null, newFailures.length ? `${newFailures.length} failure(s) main does not have` : null].filter(Boolean).join('; ');
  return { ok, newFailures, changedSpecFailures, inherited, why };
}

/** The generator of the published packages' runtime mirrors (packages/hfs/runtime, packages/eslint/{be,fe}/runtime). */
export const MIRROR_CHECK = 'scripts/hfs/sync-runtime.mjs';
export const MIRROR_FIX = 'the runtime copies are generated and git-ignored: fix what sync-runtime.mjs mirrors (starci release sync-runtime regenerates them) until its run is clean';

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
export function mirroredFiles(dir) {
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
export function mirrorDriftCheck({ dir, changed, baseline = null }) {
  if (!fs.existsSync(path.join(dir, MIRROR_CHECK))) return null;
  const mirrored = mirroredFiles(dir);
  const files = new Set(mirrored?.files ?? []);
  const touches = changed.map(normPath).filter((f) => !mirrored || f === MIRROR_CHECK || files.has(f) || mirrored.bundles.some((b) => f.startsWith(`${b}/`)));
  if (!touches.length) return null;
  const r = mirrorRun(dir);
  const { ok, newFindings } = baselineVerdict(MIRROR_CHECK, baseline?.[MIRROR_CHECK], r);
  return { name: 'sync-runtime --check', ok, touches, ...(r.ok ? {} : { output: r.output, ...(ok ? { note: 'red on main too, unchanged by this land' } : { newFindings, hint: MIRROR_FIX }) }) };
}

export const PACKAGE_PROOF = 'scripts/gates/package-clean-test.mjs';
const PACKAGE_PROOF_TIMEOUT_MS = 3_600_000;
/**
 * The clean-install proof of every published package the land changes: package-clean-test.mjs --base <base> in the scratch
 * (each changed package copied to a temp dir, installed from its own manifest and lock, its own tests run there). Red (1)
 * or not run (2) refuses; a land that changes no published package passes it without an install. null when the candidate
 * has no such script.
 */
export function packageProofCheck({ dir, base, runner = node }) {
  if (!fs.existsSync(path.join(dir, PACKAGE_PROOF))) return null;
  const r = runner([PACKAGE_PROOF, '--base', base], { cwd: dir, timeout: PACKAGE_PROOF_TIMEOUT_MS, env: specRunEnv() });
  return { name: 'package-clean-test', ok: r.ok, output: tailLines(`${r.stdout}${r.stderr}${r.error ? `\n${r.error}` : ''}`, r.ok ? 4 : 60) };
}

const readSpecs = (dir) => {
  const tests = path.join(dir, 'tests');
  let names = [];
  try { names = fs.readdirSync(tests, { recursive: true }).map((n) => String(n).split(path.sep).join('/')).filter((n) => n.endsWith('.spec.mjs')); } catch { return []; }
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

export function runChecks({ dir, base, head, specs = [], specMode = 'touching', baseline = null, runSpecs = true, baseTree = null, gateStability = null, ramGate = specRunGate, env = process.env, specBaseRun = specBaseRunAt }) {
  const checks = [];
  const changedOut = git(['diff', '--name-status', `${base}..${head}`], { cwd: dir });
  const rows = changedOut.stdout.split(/\r?\n/).filter(Boolean).map((l) => l.split('\t'));
  const changed = rows.map((r) => normPath(r[r.length - 1]));
  const present = changed.filter((f) => fs.existsSync(path.join(dir, f)));
  for (const f of present.filter((x) => x.endsWith('.mjs'))) {
    const r = node(['--check', f], { cwd: dir, timeout: 60_000 });
    checks.push({ name: `node --check ${f}`, ok: r.ok, ...(r.ok ? {} : { output: tailLines(r.stderr, 10) }) });
  }
  for (const f of present.filter((x) => /\.(ya?ml|json)$/i.test(x))) {
    let ok = true, error = null;
    try { const text = fs.readFileSync(path.join(dir, f), 'utf8'); if (/\.json$/i.test(f)) JSON.parse(text); else parseYaml(text); } catch (e) { ok = false; error = String(e?.message ?? e).slice(0, 300); }
    checks.push({ name: `parse ${f}`, ok, ...(error ? { output: error } : {}) });
  }
  for (const script of TREE_CHECKS) {
    const r = treeCheck(dir, script);
    if (r.skipped) continue;
    const { ok, newFindings } = baselineVerdict(script, baseline?.[script], r);
    checks.push({ name: path.basename(script), ok, ...(r.ok ? {} : { output: r.output, ...(ok ? { note: 'red on main too, unchanged by this land' } : { newFindings }) }) });
  }
  for (const step of [mirrorDriftCheck({ dir, changed, baseline }), packageProofCheck({ dir, base }), fullCheckStep(dir)]) if (step) checks.push(step);
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
        output: `${report.flips} of ${report.legs} accepted ${family} leg(s) of live workflows would newly fail; ${report.newlyFailing} get new findings - the Supervisor decides the release (starci kernel contract-release --family ${family})`,
        perLeg: report.perLeg.filter((l) => l.flipped || l.newFindings.length).map(({ repo, workflowId, jobId, flipped, newFindings }) => ({ repo, workflowId, jobId, flipped, codes: [...new Set(newFindings.map((f) => f.code))] })) }) });
    }
  } catch (e) { checks.push({ name: 'gate-stability', ok: true, advisory: true, error: String(e?.message ?? e).slice(0, 300) }); }
  const pool = ['touching', 'direct', 'all'].includes(specMode) ? readSpecs(dir) : [];
  let narrowed = [];
  const symbolsOf = (file) => {
    const row = rows.find((r) => normPath(r[r.length - 1]) === file);
    if (!row || row[0] !== 'M' || !/.mjs$/.test(file)) return { symbols: null, why: row?.[0] !== 'M' ? `status ${row?.[0] ?? '?'}` : 'not a .mjs file' };
    const diff = git(['diff', '-U0', '--no-color', `${base}..${head}`, '--', file], { cwd: dir });
    const source = git(['show', `${head}:${file}`], { cwd: dir });
    return diff.ok && source.ok ? changedExports({ source: source.stdout, ranges: headRanges(diff.stdout) }) : { symbols: null, why: 'diff unreadable' };
  };
  let extra = [];
  if (specMode === 'all') extra = pool.map((s) => s.file);
  else if (specMode === 'touching') extra = specsTouching(changed, { specs: pool, root: dir });
  else if (specMode === 'direct') { const d = specsDirect(changed, { specs: pool, symbolsOf }); extra = [...d.files, ...specsInvariant(changed, { specs: pool })]; narrowed = d.narrowed; }
  const allSpecs = specMode === 'none' ? [] : [...new Set([...specs.map(normPath), ...extra])].filter((f) => fs.existsSync(path.join(dir, f)));
  if (specMode === 'none') checks.push({ name: 'specs skipped', ok: true, advisory: true, output: '--specs none with an explicit --reason: no spec ran (the reason is recorded as specReason on the land run)' });
  const missing = specs.map(normPath).filter((f) => !fs.existsSync(path.join(dir, f)));
  if (missing.length) checks.push({ name: 'named specs exist', ok: false, output: `missing: ${missing.join(', ')}` });
  const gate = runSpecs && allSpecs.length ? ramGate() : null;
  if (gate && !gate.ok) checks.push({ name: `specs (${allSpecs.length})`, ok: false, specs: allSpecs, output: `spec run paused: host RAM critical after waiting ${Math.round(gate.waitedMs / 1000)}s - ${gate.why}; land again once free RAM is back above allocation.resources.ramThrottle.landSpecResumeAbovePct` });
  if (runSpecs && allSpecs.length && gate?.ok !== false) {
    const concurrency = gate?.concurrency || specConcurrency();
    const r = runSpecFiles({ dir, files: allSpecs, concurrency });
    const specCheck = { name: `specs (${allSpecs.length})`, ok: r.ok, specs: allSpecs, output: tailLines(r.stdout + r.stderr, r.ok ? 6 : 40) };
    // Red: the failing spec files the change did not add or modify run once more at base (red-on-main baseline). A
    // failure main has too is inherited and reported; any other failure, or a base run that cannot run, refuses.
    if (!r.ok) {
      const candidate = r.error ? null : r.failures;
      const rerun = [...new Set((candidate ?? []).map((f) => f.file).filter((f) => !changed.includes(f)))];
      const baseRun = rerun.length ? specBaseRun({ root: baseTree, base, files: rerun, concurrency, env }) : null;
      const v = specBaselineVerdict({ candidate, base: baseRun, changed });
      Object.assign(specCheck, { ok: v.ok, newFailures: v.newFailures, changedSpecFailures: v.changedSpecFailures, inherited: v.inherited, ...(baseRun ? { baseRun: { ok: baseRun.ok, files: rerun, ...(baseRun.error ? { error: baseRun.error } : {}) } } : {}) });
      if (v.ok) specCheck.note = 'red on main too: every failure is inherited from main (see specs red on main)';
      else specCheck.output = `${specCheck.output}\nrefused: ${v.why}${v.changedSpecFailures.length ? `\n  in a changed spec: ${failList(v.changedSpecFailures)}` : ''}${v.newFailures.length ? `\n  new versus main: ${failList(v.newFailures)}` : ''}`;
      checks.push(specCheck);
      if (v.ok && v.inherited.length) checks.push({ name: `specs red on main (${v.inherited.length})`, ok: true, advisory: true, specsRedOnMain: true, base, inherited: v.inherited,
        output: `red on main ${String(base).slice(0, 9)} too, not this change's fault - fix main: ${failList(v.inherited)}` });
    } else checks.push(specCheck);
  }
  if (narrowed.length) checks.push({ name: 'specs direct: hub files', ok: true, advisory: true, narrowed, output: narrowed.map((n) => `${n.file}: ${n.importers} importing specs, kept ${n.kept}${n.symbols ? ` (exports reached: ${n.symbols.join(', ') || 'none'})` : ` (${n.why}: every importer kept)`}`).join('; ') });
  return { ok: checks.every((c) => c.ok), checks, changed, rows, specs: allSpecs };
}

/** The gate-stability report run from the candidate's own script (scripts/supervisor/gate-stability.mjs --base --head). */
function spawnGateStability({ runner, base, head, family }) {
  const r = node([runner, '--family', family, '--base', base, '--head', head, '--json'], { cwd: head, timeout: 600_000 });
  if (!r.ok) return { error: tailLines(r.stderr || r.stdout, 6) };
  try { return JSON.parse(r.stdout.trim().split(/\r?\n/).pop()); } catch { return { error: 'unparseable gate-stability output' }; }
}

/** Refresh untracked dist only after main has advanced. Knowledge snapshots are tracked contract files, so drift is owed to a lane. */
function rebuildLandedGrammar({ root = SKILL_ROOT, changed = [] } = {}) {
  if (!changed.map(normPath).some((file) => file.startsWith('packages/grammar/src/') || file === 'packages/grammar/package.json')) return null;
  const packageRoot = path.join(root, 'packages', 'grammar');
  const fail = (step, detail) => ({ ok: false, step, detail, owed: ['grammar-dist-rebuild'] });
  try {
    const modules = path.join(packageRoot, 'node_modules');
    if (!unlinkNodeModulesLink(packageRoot)) return fail('npm ci', `cannot unlink ${modules} junction`);
    const install = ci(packageRoot, { timeout: 900_000 });
    if (!install.ok) return fail('npm ci', `exit ${install.status ?? 'unknown'}${install.stderr ? ` (${install.stderr.slice(0, 200)})` : ''}`);
    const build = outcome(runNpm(['run', 'build'], { cwd: packageRoot, timeout: 900_000 }));
    if (!build.ok) return fail('npm run build', `exit ${build.status ?? 'unknown'}${build.error ? ` (${build.error})` : ''}`);
    const dist = grammarDistStatus(packageRoot);
    if (!dist.ok || dist.state !== 'fresh') return fail('grammar-dist', dist.detail);
    const knowledge = node([path.join(root, 'scripts', 'work', 'ui', 'grammar-knowledge.mjs')], { cwd: root, timeout: 180_000 });
    return { ok: true, state: dist.state, knowledge: knowledge.ok ? 'fresh' : 'owed',
      owed: knowledge.ok ? [] : ['grammar-knowledge-snapshots'], ...(knowledge.ok ? {} : { knowledgeDetail: `exit ${knowledge.status ?? 'unknown'}` }) };
  } catch (error) { return fail('exception', String(error?.message ?? error)); }
}

/* ------------------------------------------------------------ the gate */

/**
 * The live runtime's installed dependencies (live-node-modules-wiped, 2026-09-29 13:29Z: the live node_modules was
 * found with 0 entries and land run 49 read the missing deps as 6 red spec files). {declared, entries}: declared is
 * how many dependencies package.json names, entries how many node_modules holds (dot entries such as npm's
 * .package-lock.json not counted), null when there is no node_modules.
 */
export function liveDepsState(root = SKILL_ROOT) {
  let declared = 0;
  try { const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')); declared = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length; } catch { /* no manifest: nothing declared */ }
  let entries = null;
  try { entries = fs.readdirSync(path.join(root, 'node_modules')).filter((n) => !n.startsWith('.')).length; } catch { /* absent */ }
  return { declared, entries };
}
const depsMissing = (s) => s.declared > 0 && !s.entries;
const depsHint = (root) => `the live runtime's node_modules is missing or emptied; restore it (\`npm ci\` in ${root}), find what emptied it (a recursive delete or an npm reify through a scratch/staging node_modules junction), then land again`;

/**
 * Land `commits` (in order) on live main of `root`. `deps.runChecks` / `deps.push` replace the checks and the
 * push in specs. Returns {ok, landed?, base, head?, checks, reason?, push?}. A live runtime without its installed
 * dependencies is refused before any check (reason live-deps-missing): its specs would fail on ERR_MODULE_NOT_FOUND
 * and read as the commit's fault. The same reason refuses a land whose checks ran while the live node_modules lost
 * entries, and result.cleanup.liveDepsLost names a scratch removal after which it had fewer.
 */
export function landCommits({ commits, specs = [], specMode = 'touching', root = SKILL_ROOT, env = process.env, push = true, deps = {} }) {
  const check = deps.runChecks ?? runChecks;
  // cleanup is shared by reference with every result below: a scratch this land could not remove shows in it.
  const result = { ok: false, commits, attempts: [], cleanup: { left: [] } };
  const liveDeps = liveDepsState(root);
  if (depsMissing(liveDeps)) return { ...result, reason: 'live-deps-missing', detail: `${path.join(root, 'node_modules')}: ${liveDeps.entries ?? 'no'} entries, package.json declares ${liveDeps.declared}`, hint: depsHint(root) };
  for (let attempt = 1; attempt <= MAX_MAIN_RETRIES; attempt += 1) {
    const base = git(['rev-parse', 'refs/heads/main'], { cwd: root }).stdout;
    const health = (deps.gitHealth ?? waitGitHealthy)({ root });
    if (!health.ok) return { ...result, base, reason: 'git-unusable', detail: health.detail, hint: health.hint };
    const scratch = makeScratch({ root, base, env });
    if (!scratch.ok) return { ...result, reason: 'scratch-failed', detail: scratch.error };
    const step = { attempt, base };
    try {
      const baseline = {};
      if (!deps.runChecks) for (const script of TREE_CHECKS) baseline[script] = treeCheck(scratch.dir, script);
      if (!deps.runChecks) baseline[MIRROR_CHECK] = mirrorRun(scratch.dir);
      const pick = git(['cherry-pick', '--allow-empty', '--keep-redundant-commits', ...commits], { cwd: scratch.dir });
      if (!pick.ok) {
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
      const head = git(['rev-parse', 'HEAD'], { cwd: scratch.dir }).stdout;
      // The pick changes nothing: main already carries the change (a re-land of a landed commit).
      if (git(['diff', '--quiet', base, head], { cwd: scratch.dir }).ok) {
        result.attempts.push({ ...step, reason: 'already-landed' });
        return { ...result, ok: true, alreadyLanded: base, landed: null, base, head: base, checks: [], changed: [] };
      }
      const checked = check({ dir: scratch.dir, base, head, specs, specMode, baseline, baseTree: root, env });
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
    } finally {
      const before = liveDepsState(root).entries ?? 0;
      if (!removeScratch(scratch.dir, { root })) result.cleanup.left.push(scratch.dir);
      const after = liveDepsState(root).entries ?? 0;
      if (after < before) result.cleanup.liveDepsLost = { scratch: scratch.dir, before, after };
    }
  }
  return { ...result, reason: 'main-moving', detail: `main moved under the gate ${MAX_MAIN_RETRIES} times` };
}

/** Push live main after a secret scan of origin/main..main. */
function pushLive({ root = SKILL_ROOT } = {}) {
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
 * {ok, ticketId, release(state)} or {ok:false, holder, ahead, why} (the ticket is cancelled then). A machine.sqlite that stays
 * locked past machine-db's busy budget never throws: the poll goes on until waitMs, then {ok:false, why:'db-busy'}. why is
 * 'gate-held' (another land holds the gate) or 'db-busy'. A claim is one transaction, so a refused one leaves no half-claimed gate.
 */
export function acquireLand({ env = process.env, waitMs = LAND_WAIT_MS, pollMs = 5000, lane = null, commits = [], sleep = sleepSync } = {}) {
  let ticketId;
  try { ticketId = withMachine((m) => m.enqueueLand({ lane, commitSha: commits[commits.length - 1] ?? 'unknown', commits: commits.length }), { env }); }
  catch (error) { if (isMachineBusy(error)) return { ok: false, holder: null, ahead: -1, why: 'db-busy', detail: error.message }; throw error; }
  const finish = (state) => { try { withMachine((m) => m.finishLandTicket(ticketId, state), { env }); } catch { /* the reaper cancels it */ } };
  const drop = () => finish('cancelled');
  process.on('exit', drop);
  const end = Date.now() + waitMs;
  try {
    for (;;) {
      let got;
      try { got = withMachine((m) => m.claimLandGate({ ticketId }), { env }); }
      catch (error) { if (!isMachineBusy(error)) throw error; got = { ok: false, dbBusy: error.message }; }
      if (got.ok) return { ok: true, ticketId, release: (state = 'cancelled') => { process.removeListener('exit', drop); finish(state); } };
      if (Date.now() >= end) {
        const queue = landQueue({ env });
        process.removeListener('exit', drop); drop();
        return { ok: false, holder: queue.find((t) => t.state === 'running') ?? null, ahead: queue.findIndex((t) => t.ticketId === ticketId), why: got.dbBusy ? 'db-busy' : 'gate-held', ...(got.dbBusy ? { detail: got.dbBusy } : {}) };
      }
      sleep(pollMs);
    }
  } catch (error) { process.removeListener('exit', drop); drop(); throw error; }
}

const landResultOf = (r) => (r.ok ? 'passed' : r.reason === 'conflict' ? 'conflict' : ['dirty', 'not-on-main', 'live-not-on-main', 'main-moved', 'gate-busy', 'git-unusable'].includes(r.reason) ? 'refused' : 'failed');
/** MB-12: a land that moved main but whose push did not happen (refused or failed, not skipped). */
const pushOwedOf = (r) => Boolean(r?.ok && r.landed && r.push && !r.push.pushed && !r.push.skipped);
/**
 * The core record of one land as ONE idempotent write (machine-db recordLandOutcome, keyed on spanId): the push row, the
 * land_runs row (full result as the stdout blob), the lane head and the log line. Plain data, so a refused write can wait
 * in the machine-db outbox and be replayed by the next land.
 */
function landOutcomeOf(result, { root = SKILL_ROOT, ticketId = null, lane = null, commits, jobId = null, specMode = null, startedAt, spanId = newSpanId() }) {
  const p = result.push;
  const push = p ? { repoRoot: root, branch: 'main', head: result.landed ?? commits[commits.length - 1], result: p.pushed ? 'pushed' : p.skipped ? 'skipped' : p.refused ? 'refused' : 'failed',
    reason: p.refused ?? p.skipped ?? p.error ?? null,
    failureSignature: p.pushed || p.skipped ? null : p.refused ? `secret-scan:${(p.findings ?? []).map((x) => x.rule ?? x.id ?? 'finding')[0] ?? 'finding'}` : 'push:error',
    scan: p.findings ? { findings: p.findings } : null, stderr: p.error ?? null } : null;
  const run = { ticketId, commitSha: commits[commits.length - 1], commits, landedSha: result.landed ?? null, result: landResultOf(result),
    // an already-landed pick moved nothing: no landed_sha (direct-commit detection keys on the mains the gate produced)
    reason: result.reason ?? (result.alreadyLanded ? `already-landed ${result.alreadyLanded}` : null), specs: { mode: specMode, ...(result.specReason ? { reason: result.specReason } : {}), failed: (result.checks ?? []).filter((c) => !c.ok).map((c) => c.name) },
    stdout: JSON.stringify(result, null, 2), stderr: (result.checks ?? []).filter((c) => !c.ok).map((c) => `## ${c.name}\n${c.output ?? ''}`).join('\n') || null, startedAt, finishedAt: Date.now() };
  const log = { actor: 'land', kind: result.ok ? (pushOwedOf(result) ? 'land.push-owed' : 'land.passed') : result.reason === 'gate-busy' ? 'land.gate-busy' : 'land.failed', level: result.ok ? 'info' : 'warn', msg: describe(result, { jobId }).slice(0, 2000),
    data: { ticketId, lane, jobId, commits, landed: result.landed ?? null, reason: result.reason ?? null }, refs: [...(lane ? [`lane:${lane}`] : []), ...commits.map((c) => `commit:${c}`)] };
  return { spanId, lane, push, run, laneHead: result.ok && lane ? (result.landed ?? result.alreadyLanded ?? null) : null, log };
}
/** The openSupDecision args of the specs-red-on-main DI: ONE per set of failing tests, due like any Supervisor-decided DI. */
export function specsRedOnMainDecision({ redOnMain, root, commits, now }) {
  const signature = createHash('sha1').update(redOnMain.inherited.map(failKey).sort().join('/')).digest('hex').slice(0, 12);
  return { keyParts: { kind: 'specs-red-on-main', repo: path.basename(root).replace(/[^\w.-]/g, '_') || 'runtime', signature }, kind: 'runtime-defect',
    summary: `${redOnMain.name} at ${String(redOnMain.base).slice(0, 9)}: the land gate tolerated them as inherited; fix main: ${failList(redOnMain.inherited)}`.slice(0, 1000), entityType: 'repo', entityId: root, openedBy: 'land-gate',
    dueAt: now + DEFAULT_DUE_MS.supervisor, escalateTo: 'owner',
    evidence: redOnMain.inherited.slice(0, 20).map((f) => ({ ref: `spec:${f.file}`, why: f.name.slice(0, 300) })), payload: { base: redOnMain.base, inherited: redOnMain.inherited, commits } };
}
/** The machine records of one land: the core outcome (landOutcomeOf), then the job, self-job and push-owed follow-ups. */
function recordLand(m, { result, root = SKILL_ROOT, env = process.env, ticketId = null, lane = null, commits, jobId = null, specMode = null, startedAt, outcome = null, orca = undefined }) {
  const { runId } = m.recordLandOutcome(outcome ?? landOutcomeOf(result, { root, ticketId, lane, commits, jobId, specMode, startedAt }));
  // A landed job is succeeded, its leases released, its checkout, branch and [Worker] terminal gone (finishLanded).
  // --commit of a self checkout's commits closes that self job as --job would: left open, it kept its file leases
  // and blocked every worker needing them. A red gate keeps the failure on the job.
  const landedSha = result.landed ?? result.alreadyLanded ?? null;
  if (result.ok && jobId && m.supJob(jobId)) result.finished = finishLanded(m, { jobId, landedSha, root, env, ...(orca ? { orca } : {}) });
  if (result.ok && !jobId) {
    const self = selfJobsLandedBy(m, commits, { root });
    if (self.done.length) result.finished = self.done.map((id) => finishLanded(m, { jobId: id, landedSha, root, env, ...(orca ? { orca } : {}) }));
    if (self.partial.length) result.selfPending = self.partial;
  }
  if (!result.ok && jobId) recordLandFailed(m, { jobId, reason: result.reason ?? null, startedAt });
  // Specs red on main (inherited, not this land's fault): ONE Supervisor DI per set of failing tests, so main gets fixed.
  const redOnMain = specsRedOnMainOf(result);
  if (redOnMain) {
    try {
      m.openSupDecision(specsRedOnMainDecision({ redOnMain, root, commits, now: Date.now() }));
    } catch { /* the land_runs row carries the advisory */ }
  }
  // MB-12: main moved but GitHub did not: its own outcome and ONE Supervisor DI per landed head (the workers:push duty retries).
  if (pushOwedOf(result)) {
    const why = result.push.refused ?? result.push.error ?? 'push failed';
    try {
      m.openSupDecision({ keyParts: { kind: 'push-owed', repo: path.basename(root).replace(/[^\w.-]/g, '_') || 'runtime', head: String(result.landed).slice(0, 12) }, kind: 'push-refused',
        summary: `Land passed ${String(result.landed).slice(0, 9)} but its push did not: ${String(why).slice(0, 300)}`, entityType: 'repo', entityId: root, openedBy: 'land-gate', dueAt: Date.now() + DEFAULT_DUE_MS.supervisor, escalateTo: 'owner',
        evidence: [{ ref: `commit:${result.landed}`, why: String(why).slice(0, 500) }], options: [{ key: 'push', verb: 'starci supervisor push-mains --repo <runtime root> --json', recommended: true }] });
    } catch { /* the land_runs row and its push row are the record */ }
  }
  return runId;
}

/** The full gate for one job or commit list, with the queue, the machine records and the optional inbox notice. */
export async function land({ jobId = null, commits = null, specs = [], reason = null, fullByPushGit = false, lane = null, push = null, notify = false, waitMs = LAND_WAIT_MS, root = SKILL_ROOT, env = process.env, deps = {} } = {}) {
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
  // A repo git cannot run a work-tree operation in fails every step after the queue: refuse it up front with its own reason.
  const health = (deps.gitHealth ?? waitGitHealthy)({ root });
  if (!health.ok) {
    const result = { ok: false, commits, reason: 'git-unusable', preflight: true, detail: health.detail, hint: health.hint };
    try { withMachine((m) => recordLand(m, { result, root, env, lane, commits, jobId, startedAt, orca: deps.orca }), { env }); } catch { /* the answer carries it */ }
    return result;
  }
  if (lane) withMachine((m) => { if (!m.laneOf(lane)) m.upsertLane({ name: lane, worktreePath: path.join(lanesRoot({ env }), lane), branch: `lane/${lane}`, owner: jobId ? `worker:${jobId}` : 'owner-chat' }); }, { env });
  // A pick that cannot apply is refused before the queue: the lane learns its exact hunks in seconds, not after
  // waiting its turn (ledger 2026-09-28: 15 of 16 failed lands were conflicts, most retried blind).
  if (!deps.skipPreflight) {
    const pre = (deps.conflictPreflight ?? conflictPreflight)({ root, commits });
    if (!pre.ok) {
      const result = { ok: false, commits, reason: 'conflict', preflight: true, base: pre.onto ?? null, conflicts: pre.conflicts, hint: conflictHint(pre.conflicts, pre.conflicts[0]?.commit),
        detail: `does not apply on main ${String(pre.onto ?? '').slice(0, 9)}: ${pre.conflicts.map((c) => c.file).join(', ')}` };
      withMachine((m) => recordLand(m, { result, root, env, lane, commits, jobId, startedAt, orca: deps.orca }), { env });
      return result;
    }
  }
  // MB-12: the cheap live condition before the queue and the checks: a live checkout off main fails at the fast-forward
  // after every check has run (10 lands, 46 min on 2026-09-25).
  const branch = (deps.liveBranch ?? (() => git(['symbolic-ref', '-q', 'HEAD'], { cwd: root }).stdout))();
  if (branch !== 'refs/heads/main') {
    const result = { ok: false, commits, reason: 'live-not-on-main', preflight: true, detail: branch || 'detached' };
    try { withMachine((m) => recordLand(m, { result, root, lane, commits, jobId, startedAt, orca: deps.orca }), { env }); } catch { /* the answer carries it */ }
    return result;
  }
  let fullAllowed = false;
  try { fullAllowed = (deps.specsEnabled ?? harnessSpecsEnabled)(); } catch { /* an unreadable owner file keeps the default: touching-only */ }
  const plan = specPlan({ fullAllowed, fullByPushGit, asked, named, reason });
  if (plan.refused) return { ok: false, commits, lane, reason: plan.refused, preflight: true, detail: plan.detail };
  const lock = (deps.acquireLand ?? acquireLand)({ env, waitMs, lane, commits });
  if (!lock.ok) {
    // MB-10: a busy gate is a visible, recorded outcome that names the lane, its commits, the wait and the holder.
    const result = { ok: false, commits, lane, reason: 'gate-busy', why: lock.why ?? 'gate-held', holder: lock.holder ?? null, ahead: lock.ahead ?? 0, waitedMs: Date.now() - startedAt,
      detail: `${lock.why === 'db-busy' ? 'machine.sqlite locked; ' : ''}waited ${Math.round((Date.now() - startedAt) / 1000)}s${lock.holder ? ` behind ${lock.holder.lane ?? lock.holder.ticketId ?? 'a land'} (${String(lock.holder.commit ?? '').slice(0, 9)})` : ''}` };
    try { withMachine((m) => recordLand(m, { result, root, lane, commits, jobId, startedAt, orca: deps.orca }), { env }); } catch { /* the answer carries it */ }
    return result;
  }
  let state = 'cancelled';
  try {
    // Records an earlier land could not write (machine-db outbox) are applied first, inside the gate.
    let outbox = null;
    try { outbox = withMachine((m) => m.flushOutbox(), { env }); } catch (error) { outbox = { error: String(error?.message ?? error) }; }
    const result = { ...landCommits({ commits, specs: plan.named, specMode: plan.mode, root, env, push: doPush, deps }), specMode: plan.mode, ...(plan.mode === 'none' ? { specReason: String(reason).trim() } : {}) };
    if (outbox && (outbox.flushed || outbox.failed || outbox.error || outbox.busy)) result.outbox = outbox;
    if (pushOwedOf(result)) result.outcome = 'landed-push-owed';
    state = result.ok ? 'passed' : 'failed';
    // main already moved: a failed record never turns a landed change into a failed land; it is reported instead
    // (recordError) and the core record is written again, or queued in the outbox for the next land (recordDeferred).
    const outcome = landOutcomeOf(result, { root, ticketId: lock.ticketId, lane, commits, jobId, specMode: plan.mode, startedAt });
    try { result.landRun = withMachine((m) => recordLand(m, { result, root, env, ticketId: lock.ticketId, lane, commits, jobId, specMode: plan.mode, startedAt, outcome, orca: deps.orca }), { env }); }
    catch (error) {
      result.recordError = String(error?.message ?? error);
      const again = writeOrDefer('recordLandOutcome', [outcome], { env });
      if (again.ok) result.landRun = again.value.runId;
      else result.recordDeferred = again.deferred;
    }
    if (notify || result.grammarRebuild?.ok === false || specsRedOnMainOf(result)) {
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

/** The "specs red on main (k)" advisory of a land result, or null. */
const specsRedOnMainOf = (r) => (r?.checks ?? []).find((c) => c.specsRedOnMain && c.inherited?.length) ?? null;

export function describe(r, { jobId = null } = {}) {
  const inherited = specsRedOnMainOf(r);
  const redOnMain = inherited ? `; ${inherited.name} (advisory, fix main): ${failList(inherited.inherited).slice(0, 400)}` : '';
  const who = jobId ?? (r.commits ?? []).map((c) => String(c).slice(0, 9)).join(',');
  if (r.ok && r.alreadyLanded) return `LAND already-landed ${who}: main has it at ${String(r.alreadyLanded).slice(0, 9)}, nothing moved`;
  if (r.ok) return `LAND passed ${who}: main -> ${String(r.landed).slice(0, 9)}${r.push ? ` (push ${r.push.pushed ? 'ok' : r.push.skipped ?? `OWED: ${r.push.refused ?? r.push.error}`})` : ''}${r.grammarRebuild ? `; grammar rebuild ${r.grammarRebuild.ok ? 'ok' : `FAILED at ${r.grammarRebuild.step}: ${r.grammarRebuild.detail}`}${r.grammarRebuild.owed?.length ? `; owed ${r.grammarRebuild.owed.join(', ')}` : ''}` : ''}${redOnMain}`;
  const red = (r.checks ?? []).filter((c) => !c.ok).map((c) => `${c.name}${c.output ? `: ${String(c.output).split(/\r?\n/).slice(-3).join(' / ').slice(0, 300)}` : ''}`);
  const conflicts = (r.conflicts ?? []).map((c) => `CONFLICT ${c.file}${c.hunks?.length ? `\n${c.hunks.map((h) => `    @ line ${h.line}\n${h.text.split('\n').map((l) => `      ${l}`).join('\n')}`).join('\n')}` : ''}`);
  return `LAND FAILED ${who}: ${r.reason}${r.preflight ? ' (preflight, before the queue)' : ''}${r.detail ? ` (${String(r.detail).slice(0, 300)})` : ''}${r.dirty ? ` dirty: ${r.dirty.join(', ')}` : ''}${red.length ? `\n  ${red.join('\n  ')}` : ''}${conflicts.length ? `\n  ${conflicts.join('\n  ')}` : ''}${r.hint ? `\n  next: ${r.hint}` : ''}`;
}

if (isMain(import.meta.url)) {
  setPriority();
  const argv = process.argv.slice(2);
  const has = (n) => argv.includes(`--${n}`);
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const csv = (v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);
  if (has('status')) console.log(JSON.stringify(landStatus()));
  else if (!value('job') && !value('commit')) { console.error('use: starci supervisor land --job <id> | --commit <sha>[,<sha>] [--specs <csv|touching|direct|all|none>] [--reason <why>] [--full-by-push-git] [--lane <name>] [--no-push] [--notify] [--json]'); process.exitCode = 2; }
  else {
    const r = await land({ jobId: value('job'), commits: value('commit') ? csv(value('commit')) : null, specs: csv(value('specs')), reason: value('reason'), fullByPushGit: has('full-by-push-git'), lane: value('lane'),
      push: has('no-push') ? false : null, notify: has('notify'), waitMs: Number(value('wait-ms')) || LAND_WAIT_MS });
    console.log(has('json') ? JSON.stringify(r) : describe(r, { jobId: value('job') }));
    if (!r.ok) process.exitCode = 1;
  }
}
