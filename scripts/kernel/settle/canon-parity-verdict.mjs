// canon-parity-verdict.mjs — the verdict phases of canon-parity.mjs (the contract lives there): a done canon cut
// slice settles only when (a) canon-scan over the owned paths is clean or every finding is owedToWire, (b) the
// gate's lint half finds nothing new, (c) every declared red is covered or re-ran green, and (d) TypeScript shows
// no new error against the admission base. `record` files each measurement as a parity check.
import path from 'node:path';
import { checkVerdictOf } from './check-verdict.mjs';
import { runNode } from '../../api/node/run-node.mjs';
import { catFile } from '../../api/git/cat-file.mjs';
import { diff as gitDiff } from '../../api/git/diff.mjs';
import { sameOrUnder, slash } from '../../lib/path-key.mjs';
import { findInOrder } from '../../lib/in-order.mjs';
import { git, baseBlobsOf, ownedFilesOf, sliceBaseOf, checkFamilyOf, withoutNodePath, declaredProjectsOf,
  tscParity, lintParity, PARITY_CHECKS, stripSlashes } from './canon-parity.mjs';

const hand = (reason, detail, parity = null) => ({ green: false, reason, detail: (Array.isArray(detail) ? detail : [detail]).filter(Boolean).map((d) => String(d).slice(0, 300)).slice(0, 8), ...(parity ? { parity } : {}) });
// H7: a measurement that could not run is tooling, never the slice's red (scripts/kernel/settle/check-verdict.mjs).
const unavailable = (reason, detail) => ({ ...hand(reason, detail), unavailable: true });

const brief = (issue) => {
  const line = issue.line ? `:${issue.line}` : '';
  const where = (issue.file ?? issue.path) ? ` ${issue.file ?? issue.path}${line}` : '';
  const rule = issue.ruleId ? `/${issue.ruleId}` : '';
  const why = issue.newBecause ? ` (${issue.newBecause})` : '';
  return `${issue.code}${rule}${where}${why}`;
};

/** A path of a report or payload (maybe prefixed with the repository folder, e.g. shop-fe/apps/...) relative to root. */
const relOf = (p, root) => { const n = stripSlashes(slash(p)); const head = path.basename(root); return n.startsWith(`${head}/`) ? n.slice(head.length + 1) : n; };

/** The contract's record of a gate the owner switched off (code.refactor: specs.unit, exit 0, evidence "skipped: ..."): not a claim. */
const isSkipRecord = (check) => String(check?.name ?? '').startsWith('specs.') && check?.exitCode === 0 && /^skipped:/i.test(String(check?.evidence ?? '').trim());

/** (c): the declared checks split into owned-scope covered families, re-runnable runtime checks and uncovered ones. */
function splitDeclared(declared, classify, baseline) {
  const covered = { canon: [], lint: [], tsc: [], diff: [], syntax: [] };
  const reruns = [], uncovered = [];
  for (const c of declared) {
    if (baseline(c) || isSkipRecord(c)) continue;
    const cls = classify({ ...c, command: withoutNodePath(c?.command) });
    const family = checkFamilyOf(c);
    if (family) { covered[family].push(c); continue; }
    if (cls.kind === 'action') {
      if (c?.exitCode !== 0 && c?.exitCode != null) uncovered.push(`${c.name}:${c.exitCode} (red action)`);
      continue;
    }
    if (cls.kind === 'runtime') { reruns.push({ check: c, ...cls }); continue; }
    uncovered.push(`${c?.name}:${c?.exitCode} (${cls.why ?? 'not re-verifiable'})`);
  }
  return { covered, reruns, uncovered };
}

/** Re-runs of the declared runtime checks (each recorded); the first red or unrunnable one ends the verdict. */
async function rerunDeclared(reruns, { rerun, repo, settings, env, now, started, record, checks }) {
  let stop = null;
  await findInOrder(reruns, async (c) => {
    if (now() - started > settings.itemBudgetMs) { stop = hand('verify-budget-exceeded', 'parity re-runs'); return true; }
    const r = rerun(c, { repo, timeoutMs: settings.rerunTimeoutMs, env });
    await record({ name: String(c.check.name ?? c.rel), command: String(c.check.command), cwd: repo, phase: 'parity', runner: 'parity', ...r });
    const v = checkVerdictOf(r);
    if (v.verdict === 'unavailable') { stop = unavailable('parity-checker-unavailable', `${c.check.name}:${r.exitCode} ${r.tail ?? ''}`); return true; }
    if (v.verdict === 'red') { stop = hand('parity-rerun-red', `${c.check.name}:${r.exitCode} ${r.tail ?? ''}`); return true; }
    checks.push({ name: String(c.check.name ?? c.rel), exitCode: 0, command: String(c.check.command).slice(0, 2000),
      evidence: `runtime settler re-run: exit 0 in ${Math.round(r.ms / 100) / 10}s (worker declared exit ${c.check.exitCode})` });
    return false;
  });
  return stop;
}

/** node --check <file>: re-run as argv (no shell) in the checkout; the file must parse. */
async function syntaxDeclared(list, { root, now, record, checks }) {
  let stop = null;
  await findInOrder(list, async (c) => {
    const argv = String(c.command).trim().split(/\s+/).slice(1);
    const syntaxStarted = now();
    const r = runNode(argv, { cwd: root, timeout: 60_000 });
    await record({ name: String(c.name), command: String(c.command), cwd: root, phase: 'parity', runner: 'parity',
      exitCode: r.status ?? (r.error?.code === 'ETIMEDOUT' ? 124 : 127), startedAt: syntaxStarted, finishedAt: now(), stdout: r.stdout, stderr: r.stderr ?? r.error?.message });
    if (r.status == null || r.error) { stop = unavailable('parity-checker-unavailable', `${c.name}: ${r.error?.message ?? 'no exit'}`); return true; }
    if (r.status !== 0) { stop = hand('parity-rerun-red', `${c.name}:${r.status} ${String(r.stderr ?? '').trim().split(/\r?\n/)[0] ?? ''}`); return true; }
    checks.push({ name: String(c.name), exitCode: 0, command: String(c.command).slice(0, 2000), evidence: `runtime settler re-run in ${root}: exit 0 (worker declared exit ${c.exitCode})` });
    return false;
  });
  return stop;
}

/** (a): canon-scan over the owned paths; findings left there pass only through owedToWire acceptance. */
async function scanSlice(item, { canon, repo, root, base, ownedRels, wireLegs, canonBase, record }) {
  const slice = await canon(item, { repo });
  await record({ name: 'cut-slice-postcondition', command: `canon-scan --root ${slice.root ?? root}`, cwd: slice.root ?? root,
    phase: 'parity', runner: 'parity', exitCode: slice.exitCode, output: slice.output ?? slice,
    summary: { status: slice.status, findings: slice.findings } });
  if (slice.exitCode === 1) {
    // Coordinator ruling (canon-parity-settle, owedToWire): findings left on owned paths pass only when EVERY one is
    // declared in report.owedToWire, maps to a queued/running canon-wire leg for its path, and was not introduced by
    // the slice (present at base). Anything else stays strict.
    const owed = await owedToWireAccept(item, slice, { root, base, ownedRels, wireLegs: wireLegs(), canonBase });
    if (!owed.ok) return { stop: hand('cut-postcondition-red', [`canon-scan ${slice.status ?? '?'} ${slice.findings ?? '?'} finding(s)`, `owedToWire: ${owed.why}`]) };
    return { slice, owedAccepted: owed };
  }
  const why = slice.why ? ` ${slice.why}` : '';
  if (checkVerdictOf({ exitCode: slice.exitCode, status: slice.status }).verdict === 'unavailable')
    return { stop: unavailable('parity-checker-unavailable', `canon-scan ${slice.status ?? '?'}${why}`) };
  if (slice.exitCode !== 0) {
    const count = slice.findings != null ? ` ${slice.findings} finding(s)` : '';
    return { stop: hand('cut-postcondition-red', `canon-scan ${slice.status ?? '?'}${count}${why}`) };
  }
  return { slice, owedAccepted: null };
}

/** (d): the typecheck parity record and verdict, or {typed} when it measured clean. */
async function tscPhase({ tsc, root, ownedRels, baseFiles, projects, base, record }) {
  let typed;
  try { typed = await Promise.resolve(tsc({ root, ownedRels, baseBlobs: baseFiles.blobs, extraProjects: projects })); }
  catch (error) { typed = { ok: false, unavailable: String(error?.message ?? error) }; }
  let exitCode = 1;
  if (typed.ok) exitCode = 0;
  else if (typed.unavailable) exitCode = 127;
  await record({ name: PARITY_CHECKS.tsc, command: `typescript owned-file parity at ${base}`, cwd: root, phase: 'parity', runner: 'parity',
    exitCode, output: typed,
    summary: { projects: typed.projects?.length ?? 0, newErrors: typed.newErrors?.length ?? null, unavailable: typed.unavailable ?? null } });
  if (typed.unavailable) return { stop: unavailable('parity-tsc-unavailable', typed.unavailable) };
  if (!typed.ok) return { stop: hand('parity-tsc-new', typed.newErrors.slice(0, 8).map((e) => `${e.owned ? 'owned' : 'importer'} ${e.file} ${e.code} x${e.count - e.baseCount}: ${e.message}`), { tsc: typed }) };
  return { typed };
}

/** (b): the gate's lint half over the owned files - no new finding, and every tool ran. */
async function lintPhase({ lint, root, files, base, record }) {
  const linted = await lint({ root, files, base });
  let exitCode = 1;
  if (linted.ok) exitCode = 0;
  else if (linted.status === 'unavailable') exitCode = 2;
  await record({ name: PARITY_CHECKS.lint, command: `gate.mjs lint --root ${root} --base ${base} --changed <${files.length} owned file(s)>`, cwd: root,
    phase: 'parity', runner: 'parity', exitCode, output: linted,
    summary: { status: linted.status, counts: linted.counts } });
  if (linted.status === 'unavailable') return { stop: unavailable('parity-checker-unavailable', `lint gate: ${(linted.gating ?? []).slice(0, 3).map(brief).join('; ')}`) };
  if (!linted.ok) return { stop: hand('parity-lint-new', [`lint gate new=${linted.counts?.new ?? '?'} preexisting=${linted.counts?.preexisting ?? '?'} against ${base}`, ...(linted.gating ?? []).slice(0, 6).map(brief)], { lint: { ...linted, gating: (linted.gating ?? []).slice(0, 20) } }) };
  return { linted };
}

/** git diff --check over the slice's diff (only when the worker declared one). */
async function diffPhase({ diffCheck, root, base, ownedRels, record }) {
  const diffed = diffCheck ? diffCheck({ root, base, ownedRels }) : (() => { const r = git(gitDiff, root, ['--check', base, '--', ...ownedRels]); return { ok: r.ok, tail: String(r.stdout ?? '').trim().split(/\r?\n/).slice(0, 3).join(' ') }; })();
  await record({ name: PARITY_CHECKS.diff, command: `git diff --check ${base} -- <owned paths>`, cwd: root,
    phase: 'parity', runner: 'parity', exitCode: diffed.ok ? 0 : 1, output: diffed,
    summary: { ok: diffed.ok, tail: diffed.tail ?? null } });
  if (!diffed.ok) return { stop: hand('parity-diff-check-red', diffed.tail ?? 'git diff --check reported whitespace/conflict errors in the slice diff') };
  return { diffed };
}

/** The green verdict: the superseded red declared checks and the owned-scope measurement evidence. */
function greenVerdict({ item, checks, covered, reruns, root, base, slice, owedAccepted, linted, typed, diffed, files }) {
  const superseded = [...covered.canon, ...covered.lint, ...covered.tsc, ...covered.diff, ...covered.syntax].filter((c) => c?.exitCode !== 0).map((c) => `${c.name}:${c.exitCode}`);
  const tscLine = typed.projects.map((p) => `${p.project} ${p.errors} error(s) now / ${p.baseErrors} at base, 0 new`).join('; ') || typed.note;
  const lintLine = `lint gate ${linted.status}, new=${linted.counts?.new ?? 0} preexisting=${linted.counts?.preexisting ?? 0} against ${base}`;
  const scanEvidence = owedAccepted
    ? `runtime settler (canon parity): canon-scan ${slice.findings} finding(s) on the owned paths, every one declared owedToWire, held by canon-wire leg(s) ${owedAccepted.wires.join(', ')} and present at base ${base} (not introduced by the slice)`
    : `runtime settler (canon parity): canon-scan status ok, 0 findings on the slice's owned paths (families ${item.payload.params.canonFamilies})`;
  checks.push({ name: 'cut-slice-postcondition', exitCode: 0, command: `canon-scan (in-process) --root ${slice.root} over the slice's ${slice.paths} owned path(s)`, evidence: scanEvidence },
    { name: PARITY_CHECKS.lint, exitCode: 0, command: `gate.mjs lint (child) --root ${root} --base ${base} --changed <${files.length} owned file(s)>`,
      evidence: `runtime settler (canon parity): ${lintLine}` },
    { name: PARITY_CHECKS.tsc, exitCode: 0, command: `typescript (in-process) owned files at ${base} vs working tree`, evidence: `runtime settler (canon parity): ${tscLine}` });
  if (diffed) checks.push({ name: PARITY_CHECKS.diff, exitCode: 0, command: `git diff --check ${base} -- <owned paths>`, evidence: 'runtime settler (canon parity): no whitespace/conflict error in the slice diff' });
  const supersededNote = superseded.length
    ? `the worker's red declared check(s) ${superseded.join(', ')} are foreign residue outside the owned paths (superseded by the owned-scope measurements)`
    : 'no declared check was red';
  const reran = reruns.length ? `; ${reruns.length} runtime check(s) re-ran exit 0` : '';
  checks.push({ name: 'cut-regression-inventory', exitCode: 0, command: `canon parity: canon-scan + lint gate + typecheck over the owned paths vs ${base}`,
    evidence: `runtime settler (canon parity, contract change canon-parity-settle): no new finding and no new type error against the admission base; ${supersededNote}${reran}` });
  return { green: true, via: 'canon-parity', checks: { checks }, parity: { base, ...(owedAccepted ? { owedToWire: { findings: slice.findings, wires: owedAccepted.wires } } : {}), lint: { status: linted.status, counts: linted.counts }, tsc: typed.projects, superseded } };
}

/**
 * The owedToWire acceptance of canon findings left on the owned paths. {ok, why?, wires?}. Every finding must be
 * (1) declared in report.owedToWire (its file sameOrUnder the entry's file/path, the ruleId equal when both name one),
 * (2) held by a canon-wire leg of the workflow that is queued or running and owns its path - or a queued leg, which
 * settle widens with the owed paths - and (3) present at base at least as often as now (canonBase at base).
 */
async function owedToWireAccept(item, slice, { root, base, ownedRels, wireLegs = [], canonBase = canonBaseFindings }) {
  const owed = Array.isArray(item.report?.owedToWire) ? item.report.owedToWire : [];
  const list = Array.isArray(slice.list) ? slice.list : [];
  if (!owed.length) return { ok: false, why: 'the report declares no owedToWire' };
  if (!list.length || list.length !== slice.findings) return { ok: false, why: 'the findings are not itemised' };
  const entries = owed.map((o) => ({ at: relOf(o.file ?? o.path, root), path: relOf(o.path, root), ruleId: o.ruleId ?? null }));
  const undeclared = list.filter((f) => !entries.some((e) => sameOrUnder(slash(f.file), e.at) && (!e.ruleId || !f.ruleId || e.ruleId === f.ruleId)));
  if (undeclared.length) {
    const names = undeclared.slice(0, 3).map((f) => `${f.file} ${f.ruleId}`).join('; ');
    return { ok: false, why: `${undeclared.length} finding(s) not declared: ${names}` };
  }
  const wires = wireLegs.filter((w) => ['queued', 'leased', 'running'].includes(w.status));
  if (!wires.length) return { ok: false, why: 'no canon-wire leg is queued or running' };
  const holders = new Set();
  for (const e of entries) {
    const w = wires.find((x) => x.ownedPaths.some((o) => sameOrUnder(e.path, relOf(o, root)) || sameOrUnder(relOf(o, root), e.path))) ?? wires.find((x) => x.status === 'queued');
    if (!w) return { ok: false, why: `no queued or running canon-wire leg holds ${e.path}` };
    holders.add(w.jobId);
  }
  const was = await canonBase({ root, base, ownedRels, families: String(item.payload.params?.canonFamilies ?? 'all') });
  if (!was.ok) return { ok: false, why: `base measurement unavailable: ${was.reason}` };
  const key = (f) => `${slash(f.file)} ${f.ruleId}`;
  const count = (xs) => xs.reduce((m, f) => m.set(key(f), (m.get(key(f)) ?? 0) + 1), new Map());
  const now = count(list), then = count(was.findings);
  const introduced = [...now].filter(([k, n]) => n > (then.get(k) ?? 0)).map(([k]) => k);
  if (introduced.length) return { ok: false, why: `introduced by the slice (absent at base): ${introduced.slice(0, 3).join('; ')}` };
  return { ok: true, wires: [...holders] };
}

/**
 * The canon findings of the owned paths AT BASE, read-only from git objects: ESLint over each owned file's base blob through
 * the checkout's own install and flat config (scripts/gates/gate.mjs baseEslintFindings) - no base tree, no worktree, no
 * link. {ok, findings: [{file, ruleId}]} or {ok: false, reason}.
 */
async function canonBaseFindings({ root, base, ownedRels }) {
  try {
    const blobs = baseBlobsOf(root, base, ownedRels);
    if (!blobs.ok) return { ok: false, reason: blobs.reason };
    const { baseEslintFindings } = await import('../../gates/gate.mjs');
    return { ok: true, findings: (await baseEslintFindings({ root, base, files: [...blobs.blobs.keys()] })).map((f) => ({ file: slash(f.file), ruleId: f.ruleId })) };
  } catch (error) { return { ok: false, reason: String(error?.message ?? error).slice(0, 200) }; }
}

/**
 * The parity verdict of one reported canon cut slice. {green, via: 'canon-parity', checks, reason?, detail?, parity}
 * `classify(check)` is the settler's classifyCheck; `rerun`/`canon` its seams; `lint`, `tsc`, `diffCheck`, `blobs` ours.
 */
export async function canonParityVerdict(item, { repo, settings, env = process.env, classify, rerun, canon, baseline = () => false,
  resolveRoot, lint = lintParity, tsc = tscParity, diffCheck = null, blobs = baseBlobsOf, now = Date.now, wireLegs = () => [],
  canonBase = canonBaseFindings, record = async () => {} } = {}) {
  const started = now();
  const base = sliceBaseOf(item);
  if (!base) return hand('parity-no-base', 'no --base in the report checks');
  const where = await resolveRoot(item, { repo });
  if (!where.ok) return hand('parity-unresolved', where.why);
  const { root, ownedRels } = where;
  if (!git(catFile, root, ['-e', `${base}^{commit}`]).ok) return hand('parity-base-unknown', `admission base ${base} is not a commit in ${root}`);

  // (c) every declared check is an action, a baseline, covered by an owned-scope measurement, or re-runs green.
  const declared = Array.isArray(item.report?.checks) ? item.report.checks : [];
  const { covered, reruns, uncovered } = splitDeclared(declared, classify, baseline);
  if (uncovered.length) return hand('parity-uncovered', uncovered);

  const checks = [];
  const stop = await rerunDeclared(reruns, { rerun, repo, settings, env, now, started, record, checks })
    ?? await syntaxDeclared(covered.syntax, { root, now, record, checks });
  if (stop) return stop;

  // (a) the slice's goal: canon-scan over its owned paths, 0 findings.
  const scanned = await scanSlice(item, { canon, repo, root, base, ownedRels, wireLegs, canonBase, record });
  if (scanned.stop) return scanned.stop;

  // (d) typecheck parity against the overlay base.
  const baseFiles = blobs(root, base, ownedRels);
  if (!baseFiles.ok) return hand('parity-base-unreadable', baseFiles.reason);
  const tscDone = await tscPhase({ tsc, root, ownedRels, baseFiles, projects: declaredProjectsOf(covered.tsc, root), base, record });
  if (tscDone.stop) return tscDone.stop;

  // (b) lint through the gate: no new finding over the owned files, and every tool ran.
  const files = ownedFilesOf(root, ownedRels);
  if (now() - started > settings.itemBudgetMs) return hand('verify-budget-exceeded', 'before the lint gate');
  const lintDone = await lintPhase({ lint, root, files, base, record });
  if (lintDone.stop) return lintDone.stop;

  // git diff --check over the slice's diff (only when the worker declared one).
  let diffed = null;
  if (covered.diff.length) {
    const r = await diffPhase({ diffCheck, root, base, ownedRels, record });
    if (r.stop) return r.stop;
    diffed = r.diffed;
  }

  return greenVerdict({ item, checks, covered, reruns, root, base, slice: scanned.slice, owedAccepted: scanned.owedAccepted,
    linted: lintDone.linted, typed: tscDone.typed, diffed, files });
}
