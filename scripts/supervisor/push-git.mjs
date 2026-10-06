#!/usr/bin/env node
// starci supervisor push — the ONE place the full test suites run (owner 2026-09-29), then the push of main.
//
//   starci supervisor push [--repo <path>]... [--check] [--json]
//       default repositories: the runtime (.claude) and every product repository a project binding names
//       (.workspaces/projects/*/work.json, the push-mains default set) that has unpushed main commits;
//       an explicit --repo runs whether or not it is ahead.
//   --check   everything except the push (clean checkout, full suites, dry-run and hooks-only of the push)
//
// The harness never runs a full suite in normal work (config.yaml specs.harness, default false = touching-only:
// ops, kernels, supervisor lanes, lands and .claude upgrades run only the specs of the code they change; the land
// gate refuses --specs all). This flow is where the whole suites run, once, before a main leaves the machine:
//   1. the main checkout must be clean - on branch main, no tracked modification, no staged change. The dirty
//      paths are reported and NOTHING is stashed, reset or cleaned. (Untracked files are counted, not blocking.)
//   2. the full suite of that repository, each step to a log file:
//        .claude          npm test, npm run check
//        app              the app's managed scripts (packages/hfs/templates/app/package-scripts): npm run typecheck,
//                         npm run lint, npm test (the be unit project only - e2e is manual-only and never run here),
//                         every npm run build:<side> the app declares (build:be, build:fe), canon-scan
//                         (scripts/gates/canon-scan.mjs --root <repo>); a managed script the app lacks is `absent`.
//   3. red: a failure list grouped by spec file (or by file for typecheck/lint/canon), exit 1, and the flow STOPS -
//      no push, no later repository. The internal release procedure (skills/starci/references/release.md) spawns one fixer per failing group, lands
//      the fixes (land.mjs --specs touching / ff-main.mjs) and runs the authorized native release flow again. main must not move between
//      the suite and the push: if it did, the run is red (main-moved) and starts over.
//   4. green: push-mains.mjs pushMains for that repository - a dry run (secret scan), the pre-push hooks alone
//      (--hooks-only), then the push - and the pushed count. The push is recorded in machine.sqlite `pushes` by
//      pushMains; the suite results are printed as JSON only (no table holds a full-suite run).
// Exit 0 = every selected repository green (and pushed unless --check); 1 = red, dirty, refused or main moved; 2 = usage.
import '../api/process/hide-child-windows.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runNpm } from '../api/npm/run-npm.mjs';
import { runNode } from '../api/node/run-node.mjs';
import { fileURLToPath } from 'node:url';
import { git } from './workers.mjs';
import { defaultPushRepos, pushMains, describePush } from './push-mains.mjs';
import { SKILL_ROOT, supervisorLog } from '../machine/home.mjs';
import { isMain } from '../lib/is-main.mjs';
import { readJsonFile } from '../lib/json.mjs';
import { foldCase, realPath } from '../lib/path-key.mjs';
import { byCodeUnit } from '../lib/list.mjs';

const key = (p) => foldCase(realPath(p));
const samePath = (a, b) => key(a) === key(b);

/** Generous per-step ceilings: a full suite is the point of this flow. */
const STEP_TIMEOUT_MS = Object.freeze({ runtime: 60 * 60_000, product: 40 * 60_000 });
const MAX_ITEMS_PER_GROUP = 12;
const MAX_GROUPS = 60;

/* ------------------------------------------------------------ pure pieces */

/** The state of a main checkout: {branch, onMain, dirty:[porcelain lines], untracked, ahead, head}. Nothing is changed. */
export function mainState(repo, { run = git } = {}) {
  const branch = run(['symbolic-ref', '--short', 'HEAD'], { cwd: repo }).stdout || null;
  const status = run(['status', '--porcelain', '--untracked-files=all'], { cwd: repo });
  const lines = String(status.stdout ?? '').split(/\r?\n/).filter(Boolean);
  const dirty = lines.filter((l) => !l.startsWith('??'));
  const untracked = lines.length - dirty.length;
  const ahead = Number(run(['rev-list', '--count', 'origin/main..main'], { cwd: repo }).stdout) || 0;
  const head = run(['rev-parse', 'main'], { cwd: repo }).stdout || null;
  return { branch, onMain: branch === 'main', dirty, untracked, ahead, head };
}

/** Is this checkout the runtime itself? */
const isRuntime = (repo, runtimeRoot = SKILL_ROOT) => samePath(repo, runtimeRoot);

const readPackage = (repo) => readJsonFile(path.join(repo, 'package.json'));

/**
 * The full-suite steps of one checkout. Runtime: npm test + npm run check. App: the managed scripts typecheck, lint,
 * test (the unit project) and every build:<side> the package declares, sorted (each runs only when the package.json
 * declares it - a missing one is an `absent` step, never a pass by silence; no build:<side> at all is one absent
 * `npm run build:<side>`), then canon-scan. e2e is never a step.
 * Returns {kind, steps: [{name, cmd: 'npm'|'node', args, absent?, after?}]}.
 */
export function planFor(repo, { runtimeRoot = SKILL_ROOT, pkg = readPackage(repo), skillRoot = SKILL_ROOT } = {}) {
  if (isRuntime(repo, runtimeRoot)) {
    return { kind: 'runtime', steps: [{ name: 'npm test', cmd: 'npm', args: ['test'] }, { name: 'npm run check', cmd: 'npm', args: ['run', 'check'] }] };
  }
  const scripts = pkg?.scripts ?? {};
  const npmStep = (script, extra = {}) => (scripts[script]
    ? { name: `npm run ${script}`, cmd: 'npm', args: ['run', script], ...extra }
    : { name: `npm run ${script}`, absent: true, ...extra });
  const builds = Object.keys(scripts).filter((name) => /^build:[\w-]+$/.test(name)).sort(byCodeUnit);
  const after = { after: 'npm run typecheck' };
  return {
    kind: 'product',
    steps: [
      npmStep('typecheck'),
      npmStep('lint'),
      scripts.test ? { name: 'npm test', cmd: 'npm', args: ['test'] } : { name: 'npm test', absent: true },
      ...(builds.length ? builds.map((name) => npmStep(name, after)) : [{ name: 'npm run build:<side>', absent: true, ...after }]),
      { name: 'canon-scan', cmd: 'node', args: [path.join(skillRoot, 'scripts', 'gates', 'canon-scan.mjs'), '--root', repo] },
    ],
  };
}

const rel = (file, repo) => {
  const flat = (p) => String(p ?? '').replace(/^file:\/+/, '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
  const f = flat(file), base = flat(repo);
  return base && f.toLowerCase().startsWith(`${base.toLowerCase()}/`) ? f.slice(base.length + 1) : f;
};

/**
 * A failure list grouped by file from one step's output. Understands node:test (spec and tap reporters), jest/vitest
 * (`FAIL <file>`, `● name`), tsc (`file(l,c): error TSnnnn`), eslint stylish (a path line then indented `l:c error msg rule`) and
 * a canon-scan JSON record (findings[].file). Anything else is one `(unparsed)` group with the last lines.
 * Returns [{file, items: [string]}] sorted by file, at most MAX_GROUPS groups of MAX_ITEMS_PER_GROUP items.
 */
export function failuresOf(name, text, { repo = null } = {}) {
  const groups = new Map();
  const add = (file, item) => {
    const f = rel(file, repo) || '(unparsed)';
    if (!groups.has(f)) groups.set(f, []);
    const list = groups.get(f);
    if (item && !list.includes(item)) list.push(item);
  };
  const lines = String(text ?? '').split(/\r?\n/);
  if (name === 'canon-scan') {
    try {
      const doc = JSON.parse(text);
      for (const f of doc?.findings ?? []) add(f.file, `${f.family ?? 'canon'}${f.rule ? `:${f.rule}` : ''}${f.line ? ` @${f.line}` : ''}${f.message ? ` ${String(f.message).slice(0, 120)}` : ''}`.trim());
      if (groups.size) return finish(groups);
    } catch { /* not JSON: the generic parse below */ }
  }
  let pendingFile = null, pendingTap = null, eslintFile = null, jestFile = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    // node:test spec reporter: "test at <file>:l:c" then "✖ <name> (12ms)"
    if ((m = /^\s*test at (.+?):\d+:\d+\s*$/.exec(line))) { pendingFile = m[1]; continue; }
    if (pendingFile && (m = /^\s*[✖x]\s+(.*?)(?:\s+\([\d.]+m?s\))?\s*$/.exec(line))) { add(pendingFile, m[1]); pendingFile = null; continue; }
    // node:test tap reporter: "not ok N - name" ... "location: '<file>:l:c'"
    if ((m = /^\s*not ok \d+ - (.*?)(?:\s+#.*)?$/.exec(line))) { pendingTap = m[1]; continue; }
    if (pendingTap && (m = /^\s*location:\s*'?(.+?):\d+:\d+'?\s*$/.exec(line))) { add(m[1], pendingTap); pendingTap = null; continue; }
    // jest / vitest
    if ((m = /^\s*FAIL\s+(?:\S+\s+)?(\S+\.(?:spec|test)\.[cm]?[jt]sx?)\b.*?(?:>\s*(.*))?$/.exec(line))) { jestFile = m[1]; add(m[1], m[2] ?? null); continue; }
    if (jestFile && (m = /^\s*●\s+(.*\S)\s*$/.exec(line))) { add(jestFile, m[1]); continue; }
    // tsc
    if ((m = /^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.*)$/.exec(line)) || (m = /^(.+?):(\d+):(\d+)\s+-\s+error\s+(TS\d+):\s+(.*)$/.exec(line))) { add(m[1], `${m[4]} @${m[2]} ${m[5].slice(0, 120)}`); continue; }
    // eslint stylish
    if ((m = /^(?:[A-Za-z]:)?[\w./\\@()[\]-]+\.[cm]?[jt]sx?$/.exec(line.trim())) && !line.startsWith(' ')) { eslintFile = line.trim(); continue; }
    if (eslintFile && (m = /^\s+(\d+):(\d+)\s+error\s+(.*?)\s{2,}(\S+)\s*$/.exec(line))) { add(eslintFile, `${m[4]} @${m[1]} ${m[3].slice(0, 100)}`); continue; }
  }
  if (!groups.size) {
    const tail = lines.map((l) => l.trimEnd()).filter(Boolean).slice(-20);
    if (tail.length) for (const t of tail) add('(unparsed)', t);
  }
  return finish(groups);
  function finish(map) {
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, MAX_GROUPS)
      .map(([file, items]) => ({ file, items: items.slice(0, MAX_ITEMS_PER_GROUP), ...(items.length > MAX_ITEMS_PER_GROUP ? { more: items.length - MAX_ITEMS_PER_GROUP } : {}) }));
  }
}

/* ------------------------------------------------------------ running */

const logDir = () => { const dir = path.join(os.tmpdir(), 'starci-push-git'); fs.mkdirSync(dir, { recursive: true }); return dir; };
const readTail = (file, maxBytes = 24 * 1024 * 1024) => {
  const fd = fs.openSync(file, 'r');
  try { const { size } = fs.fstatSync(fd); const len = Math.min(size, maxBytes); const buf = Buffer.alloc(len); fs.readSync(fd, buf, 0, len, size - len); return buf.toString('utf8'); }
  finally { fs.closeSync(fd); }
};

/** Run one step in `cwd`, its output to a log file (no spawn buffer to overflow). Returns {ok, exit, ms, log, text, timedOut?}. */
export function runStep(step, { cwd, timeoutMs, tag = 'repo', env = process.env } = {}) {
  const log = path.join(logDir(), `${tag}-${step.name.replace(/[^\w.-]+/g, '_')}-${Date.now()}.log`);
  const fd = fs.openSync(log, 'w');
  const started = Date.now();
  let r;
  try {
    const childEnv = { ...env, CI: env.CI ?? '1', STARCI_PUSH_GIT: '1' };
    r = step.cmd === 'npm'
      ? runNpm(step.args, { cwd, stdio: ['ignore', fd, fd], timeout: timeoutMs, env: childEnv })
      : runNode(step.args, { cwd, stdio: ['ignore', fd, fd], timeout: timeoutMs, env: childEnv });
  } finally { fs.closeSync(fd); }
  const timedOut = r.error?.code === 'ETIMEDOUT' || (r.status == null && r.signal === 'SIGTERM');
  const text = readTail(log);
  return { ok: r.status === 0 && !r.error, exit: r.status, ms: Date.now() - started, log, text, ...(timedOut ? { timedOut: true } : {}), ...(r.error && !timedOut ? { error: r.error.message } : {}) };
}

/**
 * The flow for one repository: state -> steps -> (unless check) push. Never stashes, resets or cleans.
 * Seams: git, step (runStep), push (pushMains), plan (planFor).
 */
export function pushGitRepo(repo, { check = false, explicit = false, deps = {} } = {}) {
  const gitRun = deps.git ?? git;
  const stepRun = deps.step ?? runStep;
  const pushRun = deps.push ?? pushMains;
  const out = { repo, name: path.basename(repo), verdict: 'green', steps: [] };
  const state = mainState(repo, { run: gitRun });
  Object.assign(out, { branch: state.branch, ahead: state.ahead, head: state.head, untracked: state.untracked });
  if (!state.onMain) return { ...out, verdict: 'not-on-main', why: `the checkout is on ${state.branch ?? 'a detached HEAD'}, not main` };
  if (state.dirty.length) return { ...out, verdict: 'dirty', dirty: state.dirty.slice(0, 40), dirtyCount: state.dirty.length, why: 'the main checkout has tracked modifications; commit or land them (nothing is stashed, reset or cleaned)' };
  if (!state.ahead && !explicit) return { ...out, verdict: 'nothing-to-push', why: 'main has no commit ahead of origin/main' };
  const plan = (deps.plan ?? planFor)(repo);
  out.kind = plan.kind;
  const failedNames = new Set();
  for (const step of plan.steps) {
    if (step.absent) { out.steps.push({ name: step.name, status: 'absent', note: 'the repository declares no such script' }); continue; }
    if (step.after && failedNames.has(step.after)) { out.steps.push({ name: step.name, status: 'skipped', note: `${step.after} is red` }); continue; }
    const r = stepRun(step, { cwd: repo, timeoutMs: STEP_TIMEOUT_MS[plan.kind], tag: path.basename(repo) });
    const row = { name: step.name, status: r.ok ? 'green' : 'red', exit: r.exit, ms: r.ms, log: r.log };
    if (!r.ok) {
      failedNames.add(step.name);
      row.failures = failuresOf(step.name, r.text, { repo });
      if (r.timedOut) row.timedOut = true;
      if (r.error) row.error = r.error;
    }
    out.steps.push(row);
  }
  if (out.steps.some((s) => s.status === 'red')) return { ...out, verdict: 'red', why: `${out.steps.filter((s) => s.status === 'red').map((s) => s.name).join(', ')} red` };
  const after = mainState(repo, { run: gitRun });
  if (after.head !== state.head || after.dirty.length) return { ...out, verdict: 'main-moved', why: after.head !== state.head ? `main moved during the run (${String(state.head).slice(0, 9)} -> ${String(after.head).slice(0, 9)}); run /starci release again` : 'the checkout became dirty during the run', dirty: after.dirty.slice(0, 40) };
  if (!state.ahead) return { ...out, verdict: 'green', pushed: 0, why: 'green; nothing ahead of origin/main to push' };
  // The push, in the order the native push contract promises: dry run (secret scan), hooks alone, then the push.
  const dry = pushRun({ repos: [repo], dryRun: true, record: false })[0];
  out.dryRun = { wouldPush: Boolean(dry?.wouldPush), refused: dry?.refused ?? null, error: dry?.error ?? null };
  if (dry?.refused || dry?.error) return { ...out, verdict: 'push-refused', why: dry.refused ?? dry.error, hint: dry.hint ?? null, scan: dry.scan ?? null };
  const hooks = pushRun({ repos: [repo], hooksOnly: true, record: false })[0];
  out.hooks = { result: hooks?.hooks ?? null, error: hooks?.error ?? null };
  if (hooks?.hooks !== 'green') return { ...out, verdict: 'hooks-red', why: `pre-push hook ${hooks?.hooks ?? 'unavailable'}: ${String(hooks?.error ?? '').slice(0, 300)}` };
  if (check) return { ...out, verdict: 'green', pushed: 0, checkOnly: true, why: `green; ${state.ahead} commit(s) would be pushed (--check)` };
  const pushed = pushRun({ repos: [repo] })[0];
  out.push = { pushed: Boolean(pushed?.pushed), head: pushed?.head ?? null, refused: pushed?.refused ?? null, error: pushed?.error ?? null, skipped: pushed?.skipped ?? null, line: describePush(pushed ?? { repo }) };
  if (!pushed?.pushed) return { ...out, verdict: 'push-refused', why: pushed?.refused ?? pushed?.error ?? pushed?.skipped ?? 'the push did not go through', pushed: 0 };
  return { ...out, verdict: 'green', pushed: state.ahead };
}

/** Which repositories: explicit --repo list, else the runtime plus every bound product repository (push-mains' set). */
export function selectRepos({ repos = null, deps = {} } = {}) {
  if (repos?.length) return { list: repos.map((r) => path.resolve(r)), explicit: true };
  return { list: (deps.defaultRepos ?? defaultPushRepos)(), explicit: false };
}

/** The whole run: repositories in order, stopping at the first that is not green. */
export function pushGit({ repos = null, check = false, deps = {} } = {}) {
  const { list, explicit } = selectRepos({ repos, deps });
  const results = [];
  for (const repo of list) {
    const r = pushGitRepo(repo, { check, explicit, deps });
    results.push(r);
    if (!['green', 'nothing-to-push'].includes(r.verdict)) break;
  }
  const ok = results.every((r) => ['green', 'nothing-to-push'].includes(r.verdict));
  const skipped = list.slice(results.length).map((r) => path.basename(r));
  return { ok, check, repos: results, notRun: skipped, pushed: results.reduce((n, r) => n + (r.pushed ?? 0), 0) };
}

/** Human text of a run: one line per repository and step, then the failure groups of the red step(s). */
export function describeRun(run) {
  const out = [];
  for (const r of run.repos) {
    out.push(`${r.name}: ${String(r.verdict).toUpperCase()}${r.why ? ` - ${r.why}` : ''}${r.pushed ? ` (pushed ${r.pushed})` : ''}`);
    if (r.dirty?.length) for (const d of r.dirty.slice(0, 15)) out.push(`    dirty ${d}`);
    for (const s of r.steps ?? []) {
      out.push(`  ${s.status.padEnd(7)} ${s.name}${s.ms != null ? ` (${Math.round(s.ms / 1000)}s)` : ''}${s.note ? ` - ${s.note}` : ''}${s.log && s.status === 'red' ? `  log: ${s.log}` : ''}`);
      for (const g of s.failures ?? []) {
        out.push(`      ${g.file}`);
        for (const item of g.items) out.push(`        - ${item}`);
        if (g.more) out.push(`        - ... ${g.more} more`);
      }
    }
  }
  if (run.notRun?.length) out.push(`not run (stopped at the first red): ${run.notRun.join(', ')}`);
  out.push(run.ok ? `PUSH-GIT ${run.check ? 'CHECK ' : ''}GREEN${run.check ? '' : `: ${run.pushed} commit(s) pushed`}` : 'PUSH-GIT RED: fix the failing groups, land the fixes (starci supervisor land --specs touching), then run starci supervisor push again');
  return out.join('\n');
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const bad = argv.filter((a, i) => a.startsWith('--') && !['--repo', '--check', '--json'].includes(a) && !(argv[i - 1] === '--repo'));
  if (bad.length) { console.error(`unknown option ${bad.join(' ')}; use: starci supervisor push [--repo <path>]... [--check] [--json]`); process.exit(2); }
  const repos = argv.flatMap((a, i) => (a === '--repo' && argv[i + 1] ? [argv[i + 1]] : []));
  const run = pushGit({ repos: repos.length ? repos : null, check: argv.includes('--check') });
  try { supervisorLog('push-git', `${run.ok ? 'green' : 'red'} ${run.repos.map((r) => `${r.name}:${r.verdict}`).join(' ')}${run.check ? ' (check)' : ''}`); } catch { /* the printed record is the run */ }
  console.log(argv.includes('--json') ? JSON.stringify(run) : describeRun(run));
  if (!run.ok) process.exitCode = 1;
}
