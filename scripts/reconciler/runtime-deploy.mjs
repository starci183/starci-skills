// runtime-deploy.mjs - `starci runtime deploy --from <clone-or-ref> [--plan] [--json]`: carry one runtime revision onto the running host.
//
// It replaces the hand sequence (fetch and `git merge --ff-only` in the live checkout, `starci reconciler restart`, read the digest). The verb
//   1. refuses unless the source is committed and clean, a fast-forward of the host tree, and proven by a check receipt bound to that exact commit
//      (runtime-deploy-receipt.mjs: the verb ran `starci runtime check` itself in the clean source, or the land note holds a full pass);
//   2. refuses while a release cut (or any other holder) has the host lock, and WAITS for the steps in flight - a settle, the Critic run a settle owes, a prepared
//      decision under apply (runtime-deploy-inflight.mjs); it never stops one, and refuses with their names when they do not finish in time;
//   3. fast-forwards the host tree (several commits are ONE revision change), then runs the NEW tree's verbs: `runtime artefacts --migrate` (the generated
//      copies and every installed artefact of every live workflow, verified) and `reconciler restart`;
//   4. verifies from the stores that the leader reports the new revision with a fresh heartbeat, that every controller kept its mode and that no seat died
//      (runtime-deploy-verify.mjs); on a failed verification it says what state the host is in and the non-destructive way back;
//   5. journals one `runtime-deployed` event (from, to, areas, who, the changed-file list as a blob, `roleActions` for the role notification).
// `--plan` runs every read and prints the steps and every refusal, changing nothing.
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { underHostLock } from '../machine/verb-lock.mjs';
import { hostSeams, deployNumbers, DEPLOY_EVENT, DEPLOY_FAILED_EVENT, DEPLOY_SCHEMA } from './runtime-deploy-host.mjs';
import { resolveSource, isDirty, rangeOf, areasOf } from './runtime-deploy-source.mjs';
import { receiptFor, writeReceipt } from './runtime-deploy-receipt.mjs';
import { waitForQuiet, stepLine } from './runtime-deploy-inflight.mjs';
import { verifyRestart } from './runtime-deploy-verify.mjs';
import { DEPLOY, refusal } from './runtime-deploy-codes.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { symbolicRefQuery } from '../api/git/symbolic-ref-query.mjs';

const USAGE = 'usage: starci runtime deploy --from <clone-or-ref> [--plan] [--json]';

function hostFacts(host) {
  const branch = symbolicRefQuery(['-q', '--short', 'HEAD'], { cwd: host });
  return { head: revParse(host, 'HEAD'), branch: branch.status === 0 ? String(branch.stdout).trim() : null, dirty: isDirty(host, { trackedOnly: true }) };
}

/** Every read the judgement needs: no write. */
function gather({ from, host, seams, env }) {
  const source = resolveSource(from, host);
  const hostState = hostFacts(host);
  if (!source.ok) return { source, host: hostState };
  const range = rangeOf(source, hostState.head);
  const sourceDirty = source.kind === 'clone' && isDirty(source.dir);
  const receipt = receiptFor({ sha: source.sha, tree: source.tree, host, env });
  return { source, host: hostState, range, sourceDirty, receipt, lock: seams.lockOwner(), leader: seams.leader(), inFlight: seams.inFlight() };
}

function lockRefusal(lock) {
  if (!lock || lock.stale) return null;
  if (lock.purpose === 'release-cut') return refusal(DEPLOY.releaseCutRunning, `a release cut holds the host lock (pid ${lock.pid ?? 'unknown'}, since ${lock.since ?? 'unknown'}); deploy after it ends`);
  return refusal(DEPLOY.hostLockHeld, `the host lock is held for ${lock.purpose ?? 'an unknown purpose'} (pid ${lock.pid ?? 'unknown'}); deploy when it is released`);
}

/** The refusals the facts alone decide, in the order a person fixes them. */
export function judge(facts) {
  if (!facts.source.ok) return [refusal(DEPLOY.sourceUnresolved, `--from ${facts.source.from} is neither a clone with a commit nor a ref of the host repository`)];
  const { source, host, range } = facts;
  const found = [
    facts.sourceDirty && refusal(DEPLOY.sourceDirty, `${source.dir} has uncommitted or untracked changes; commit them, the check receipt binds to a commit`),
    host.branch !== 'main' && refusal(DEPLOY.hostNotMain, `the host tree is on ${host.branch ?? 'a detached HEAD'}, not main`),
    host.dirty && refusal(DEPLOY.hostDirty, 'the host tree has uncommitted changes to tracked files; a fast-forward would overwrite or refuse them'),
    !range.fastForward && refusal(DEPLOY.notFastForward, `host ${String(host.head).slice(0, 12)} is not an ancestor of ${source.sha.slice(0, 12)}; merge the host main into the source and check again`),
    !facts.receipt && source.kind === 'ref' && refusal(DEPLOY.checkUnproven, `no check receipt binds ${source.sha.slice(0, 12)}; deploy from its clone so the verb runs the check itself`),
    lockRefusal(facts.lock),
  ];
  return found.filter(Boolean);
}

/** The steps the verb would take, in order, for the facts. */
function plannedSteps(facts) {
  const { source, range } = facts;
  const check = facts.receipt ? `check receipt present (${facts.receipt.via})` : `run starci runtime check in ${source.dir} (exit 0 required) and write the receipt`;
  const wait = facts.inFlight.length ? `wait for ${facts.inFlight.length} step(s) in flight: ${facts.inFlight.map(stepLine).join('; ')}` : 'no step in flight';
  return [check, `take the host lock (purpose runtime-deploy)`, wait,
    `fast-forward the host tree ${facts.host.head.slice(0, 12)} -> ${source.sha.slice(0, 12)} (${range.commits} commit(s), ${range.files.length} file(s), ONE revision change)`,
    'from the new tree: starci runtime artefacts --migrate (generated copies and the installed artefacts of every live workflow, verified)',
    'from the new tree: starci reconciler restart',
    'verify: new revision with a fresh heartbeat, controller modes unchanged, no seat dead',
    `journal one ${DEPLOY_EVENT} event`];
}

const summaryOf = (facts) => ({ from: { kind: facts.source.kind, ref: facts.source.from, sha: facts.source.sha ?? null }, hostHead: facts.host?.head ?? null,
  commits: facts.range?.commits ?? 0, files: facts.range?.files.length ?? 0, areas: areasOf(facts.range?.files ?? []) });

const result = (code, ok, text, data) => ({ code, text, data: { schema: DEPLOY_SCHEMA, ok, ...data } });

function planResult(facts, refusals) {
  const steps = facts.source.ok ? plannedSteps(facts) : [];
  const lines = ['starci runtime deploy --plan (nothing was changed)', ...steps.map((s, i) => `  ${i + 1}. ${s}`), ...refusals.map((r) => `  REFUSED ${r.code}: ${r.detail}`)];
  return result(refusals.length ? 1 : 0, !refusals.length, lines.join('\n'), { mode: 'plan', ...(facts.source.ok ? summaryOf(facts) : null), steps, refusals, inFlight: facts.inFlight?.map(stepLine) ?? [] });
}

const refused = (facts, found, extra = {}) => result(1, false, `starci runtime deploy: REFUSED ${found.code}: ${found.detail}\nnothing was changed`,
  { mode: 'deploy', ...(facts.source?.ok ? summaryOf(facts) : null), refusals: [found], changed: false, ...extra });

/** The check in the clean source: the receipt exists afterwards, or the verb refuses. */
function ensureCheck({ facts, seams, env, who }) {
  if (facts.receipt) return null;
  const { source } = facts;
  const run = seams.runCheck(source.dir);
  const after = resolveSource(source.dir, source.dir);
  if (!run.ok) return refusal(DEPLOY.checkRed, `starci runtime check exited non-zero on ${source.sha.slice(0, 12)}: ${String(run.output ?? '').trim().split(/\r?\n/).slice(-6).join(' | ')}`);
  if (after.sha !== source.sha || isDirty(source.dir)) return refusal(DEPLOY.sourceDirty, 'the check changed the source tree or its HEAD moved while it ran; the receipt would not bind the commit');
  writeReceipt({ sha: source.sha, tree: source.tree, exit: 0, by: who, counts: { pass: run.pass, total: run.total } }, env);
  return null;
}


function returnAdvice({ host, prev, sha }) {
  return [`the previous revision is ${prev}`,
    `to return without destructive git: git -C ${host} revert --no-edit ${prev}..${sha}, then starci reconciler restart (this adds commits; history keeps ${sha})`];
}

/** The state of the host after a failure past the fast-forward, from what the stages recorded. */
const hostStateOf = (run) => ({ treeAt: run.moved ? run.facts.source.sha : run.facts.host.head, moved: run.moved, migrated: run.migrated, restarted: run.restarted });

function failedAfterMove(run, kind, detail) {
  const { facts, host, seams } = run;
  const state = hostStateOf(run);
  const advice = returnAdvice({ host, prev: facts.host.head, sha: facts.source.sha });
  seams.journal(DEPLOY_FAILED_EVENT, { schema: DEPLOY_SCHEMA, from: facts.host.head, to: facts.source.sha, code: kind.code, detail, state }, null);
  const moved = state.moved ? 'moved to' : 'still at';
  const text = [`starci runtime deploy: FAILED ${kind.code}: ${detail}`,
    `host state: tree ${moved} ${state.treeAt.slice(0, 12)}; artefacts ${state.migrated ? 'migrated' : 'not migrated'}; engine ${state.restarted ? 'restarted' : 'not restarted'}`, ...advice].join('\n');
  return result(1, false, text, { mode: 'deploy', ...summaryOf(facts), refusals: [refusal(kind, detail)], changed: state.moved, state, advice });
}

/** Waits for the steps in flight to finish; a refusal result when they do not. */
async function waitStage(run) {
  const { facts, seams, numbers, deps } = run;
  const quiet = await waitForQuiet({ scan: seams.inFlight, waitMs: numbers.waitMs, pollMs: numbers.pollMs, now: deps.now, sleep: deps.sleep });
  run.waitedMs = quiet.waitedMs;
  if (quiet.quiet) return null;
  const names = quiet.steps.map(stepLine);
  return refused(facts, refusal(DEPLOY.inFlight, `${names.length} step(s) still in flight after ${Math.round(quiet.waitedMs / 1000)}s: ${names.join('; ')}; none was stopped`), { inFlight: names });
}

/** The fast-forward: the host tree is the source tip afterwards, or the deploy fails naming it. */
function moveStage(run) {
  const { facts, host, seams } = run;
  const { source } = facts;
  if (revParse(host, 'HEAD') !== facts.host.head) return refused(facts, refusal(DEPLOY.notFastForward, 'the host tree moved while the deploy waited; run it again'));
  run.before = seams.snapshot()?.after ?? { pid: null, modes: {}, seats: {} };
  if (source.kind === 'clone') seams.fetchFrom(source.dir);
  const merged = seams.fastForward(source.sha);
  run.moved = revParse(host, 'HEAD') === source.sha;
  return merged.status === 0 && run.moved ? null : failedAfterMove(run, DEPLOY.notFastForward, `git merge --ff-only failed: ${String(merged.stderr ?? '').trim().slice(0, 200)}`);
}

/** The new tree's own migration of the installed artefacts, then its engine restart. */
function reviveStage(run) {
  const { seams } = run;
  const migrated = seams.migrate();
  run.migrated = migrated.status === 0 && migrated.data?.ok === true;
  run.counts = migrated.data?.counts ?? null;
  if (!run.migrated) return failedAfterMove(run, DEPLOY.migrationFailed, `starci runtime artefacts --migrate: ${JSON.stringify(migrated.data?.counts ?? migrated.stderr)}`);
  run.restartedAt = (run.deps.now ?? Date.now)();
  const restarted = seams.restart();
  run.restarted = restarted.status === 0;
  return run.restarted ? null : failedAfterMove(run, DEPLOY.restartFailed, `starci reconciler restart: ${restarted.stderr || JSON.stringify(restarted.data)}`);
}

function succeeded(run, verified) {
  const { facts, seams, deps } = run;
  const { source, range } = facts;
  const payload = { schema: DEPLOY_SCHEMA, from: facts.host.head, to: source.sha, commits: range.commits, fileCount: range.files.length, areas: areasOf(range.files), who: seams.who(),
    receipt: facts.receipt?.via ?? 'check-run', artefacts: run.counts, engine: { pid: verified.leader.pid, epoch: verified.leader.epoch, rev: verified.leader.rev },
    waitedMs: run.waitedMs, roleActions: deps.roleActions?.({ from: facts.host.head, to: source.sha, files: range.files }) ?? null };
  const event = seams.journal(DEPLOY_EVENT, payload, range.files);
  const text = `starci runtime deploy: ${payload.from.slice(0, 12)} -> ${payload.to.slice(0, 12)} (${range.commits} commit(s), one revision change); engine pid ${payload.engine.pid} on the new revision; artefacts ${JSON.stringify(payload.artefacts)}; event seq ${event?.seq ?? '-'}`;
  return result(0, true, text, { mode: 'deploy', ...summaryOf(facts), changed: true, event: event ?? null, verification: { ok: true, waitedMs: verified.waitedMs }, artefacts: payload.artefacts, engine: payload.engine });
}

/** The stages under the host lock, in order; the first one that returns a result ends the deploy. */
async function carryOut(run) {
  const stopped = (await waitStage(run)) ?? moveStage(run) ?? reviveStage(run);
  if (stopped) return stopped;
  const { facts, seams, numbers, deps } = run;
  const verified = await verifyRestart({ read: seams.snapshot, before: run.before, sha: facts.source.sha, restartedAt: run.restartedAt, verifyMs: numbers.verifyMs, pollMs: numbers.pollMs, now: deps.now, sleep: deps.sleep });
  return verified.ok ? succeeded(run, verified) : failedAfterMove(run, DEPLOY.verifyFailed, verified.problems.join('; '));
}

/** Function-backed `runtime deploy` verb. `deps` replaces the host seams (specs): root, seams, numbers, now, sleep, roleActions, underHostLock. */
export async function runtimeDeploy(ctx, deps = {}) {
  const from = ctx?.args?.from;
  if ((ctx?.positionals ?? []).length || typeof from !== 'string' || !from) return { code: 2, text: USAGE, data: { schema: DEPLOY_SCHEMA, ok: false, usage: USAGE } };
  const env = ctx.env ?? process.env;
  const host = path.resolve(deps.root ?? skillRoot);
  const seams = { ...hostSeams({ host, env }), ...deps.seams };
  const facts = gather({ from, host, seams, env });
  const refusals = judge(facts);
  if (ctx.args.plan) return planResult(facts, refusals);
  if (refusals.length) return refused(facts, refusals[0], { refusals });
  const checked = ensureCheck({ facts, seams, env, who: seams.who().user });
  if (checked) return refused(facts, checked);
  const run = { facts: { ...facts, receipt: facts.receipt ?? { via: 'check-run' } }, host, seams, numbers: deps.numbers ?? deployNumbers(), deps, moved: false, migrated: false, restarted: false,
    before: null, restartedAt: 0, waitedMs: 0, counts: null };
  const locked = await (deps.underHostLock ?? underHostLock)({ role: ctx.role ?? 'owner', purpose: 'runtime-deploy', env }, () => carryOut(run));
  if (locked?.ok !== false) return locked.value;
  const lock = lockRefusal({ purpose: locked.owner?.purpose, pid: locked.owner?.pid, since: locked.owner?.since });
  return refused(facts, lock ?? refusal(DEPLOY.hostLockHeld, `the host lock refused: ${locked.reason}`));
}
