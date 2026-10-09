// rejudge.mjs — the job kind `rejudge`: the runtime judges, with its own Critic and proofs, the product a failed attempt finished and preserved.
//
// A failed job is terminal (job_transitions): it is never reopened and never mutated. When its blocker proved to be the RUNTIME's (a Critic that could
// not start: critic-hold.mjs `checker-unavailable`) and the product it wrote is preserved, the failure router admits a NEW job that is the lineage's next
// attempt, without a worker and without a single op token:
//   1. the precondition: the failed job's newest report is blocked on a runtime-owed blocker; the preserved ref (refs/heads/preserved/<wf>/<job>) exists
//      and holds every file the report names (their blob ids are the product digest); the digest has not been re-judged before (one per digest);
//   2. the admission the dispatch would have made (contract, READ snapshot, bound native READ proof), written by the dispatch's own functions;
//   3. the preserved product restored onto the owned paths of the workflow tree (checkoutPaths: exactly those paths, atomically);
//   4. a report filed by the runtime, outcome done, that names the adopted files and says where the product comes from (`rejudge: {of, digest, ref}`).
// The job then stands `reported` and the settler does what it does for any done report of a decision leg: the runtime's Critic judges the bytes, the
// proofs run, and the leg settles pass or fail as that lineage's next attempt. Every refusal is a typed code and the router falls back to the retry route.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileReport, recordJobResult, setJobStatus, startAttempt, updateJob, writeContract } from '../../../engine/db/ledger.mjs';
import { skillRoot } from '../../../engine/runtime-root.mjs';
import { revParseQuery } from '../../api/git/rev-parse-query.mjs';
import { lsTree } from '../../api/git/ls-tree.mjs';
import { checkoutPaths } from '../../api/git/checkout-paths.mjs';
import { tempRoot } from '../../../engine/temp-root.mjs';
import { recordCheck } from '../../machine/evidence-store.mjs';
import { parseJson } from '../../lib/json.mjs';
import { byCodeUnit } from '../../lib/list.mjs';
import { admitPacket, captureDispatchInputs, selectDispatchContract } from '../dispatch-admission.mjs';
import { observationContextOf, observeCheck, stageObservation } from '../mechanism-observation.mjs';
import { criticOwedBy } from '../critic-settle.mjs';
import { CHECKER_UNAVAILABLE, effectiveBlockerKind } from '../critic-hold.mjs';
import { preservedRefOf } from '../preserved-ref.mjs';
import { classifyCheck, rerunCheck } from './job-settle.mjs';

export const REJUDGE_ROUTE = 'rejudge-of-a-preserved-product';
const REJUDGE_EVENT = 'job-rejudge-admitted';
/** Journalled by the router when the precondition does not hold (the code says which part): the leg then takes the retry route. */
export const REJUDGE_REFUSED_EVENT = 'job-rejudge-refused';
/** The blocker kinds the runtime owes the proof of; a failed attempt blocked on one of them is judged, not redone. */
const RUNTIME_OWED = new Set([CHECKER_UNAVAILABLE]);
const refuse = ({ code }, detail) => ({ ok: false, code, detail });

/** The newest report of a job as {outcome, envelope} or null. */
function reportOf(db, jobId) {
  const row = db.prepare('SELECT r.outcome, r.report_json FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE a.job_id=? ORDER BY a.attempt_id DESC LIMIT 1').get(jobId);
  return row ? { outcome: row.outcome, envelope: parseJson(row.report_json, {}) ?? {} } : null;
}

/** The blob ids of `files` at `ref` as the product digest, or null when the ref lacks one of them. */
function productDigestAt(tree, ref, files) {
  if (!files.length) return null;
  const out = lsTree(['-r', ref, '--', ...files], { dir: tree, timeout: 30_000 });
  const rows = String(out.stdout ?? '').split(/\r?\n/).filter(Boolean).map((line) => line.replace(/^\d+ blob /, ''));
  const have = new Set(rows.map((row) => row.split('\t')[1]));
  if (out.status !== 0 || files.some((file) => !have.has(file))) return null;
  return crypto.createHash('sha256').update(rows.sort(byCodeUnit).join('\n')).digest('hex');
}

/**
 * Whether the failed job `job` is owed a re-judgment: {ok: true, ref, digest, report} or {ok: false, code, detail}. Pure over the ledger and the tree's git.
 * Codes: rejudge-not-failed, rejudge-blocker-not-runtime-owed, rejudge-nothing-to-judge, rejudge-no-preserved-ref, rejudge-product-mismatch, rejudge-already-done.
 */
function rejudgeOwed(db, job, { tree }) {
  if (job.status !== 'failed') return refuse({ code: 'rejudge-not-failed' }, `the job is ${job.status}`);
  const report = reportOf(db, job.job_id);
  if (report?.outcome !== 'blocked' || !RUNTIME_OWED.has(effectiveBlockerKind(report.envelope))) return refuse({ code: 'rejudge-blocker-not-runtime-owed' }, 'the newest report is not blocked on a runtime-owed blocker');
  if (!criticOwedBy(job.op_id)) return refuse({ code: 'rejudge-nothing-to-judge' }, `${job.op_id} owes no runtime Critic`);
  const ref = preservedRefOf(db, job.job_id);
  if (!ref || !tree || revParseQuery(['--verify', '--quiet', ref], { dir: tree, timeout: 30_000 }).status !== 0) return refuse({ code: 'rejudge-no-preserved-ref' }, 'the attempt left no preserved ref');
  const files = (report.envelope.files ?? []).filter((file) => typeof file === 'string' && !path.isAbsolute(file));
  const digest = productDigestAt(tree, ref, files);
  if (!digest) return refuse({ code: 'rejudge-product-mismatch' }, 'the preserved ref does not hold every file the report names');
  const done = db.prepare("SELECT 1 FROM events WHERE kind=? AND json_extract(payload_json,'$.digest')=? LIMIT 1").get(REJUDGE_EVENT, digest);
  if (done) return refuse({ code: 'rejudge-already-done' }, 'this product digest was re-judged once');
  return { ok: true, ref, digest, report, files };
}

/** The READ proof of the op's knowledge files, run and recorded by the runtime over the restored tree; the file the report attaches. */
function readProofOf(ledger, { job, attemptId, tree, repo, env }) {
  const row = ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(job.job_id);
  const context = observationContextOf(ledger.db, row, { repo, skillRoot });
  const knowledge = context.readRefs.filter((ref) => ref.rootKind === 'source' && ref.path.startsWith('knowledge/')).map((ref) => ref.path);
  const args = ['node', path.join(skillRoot, 'scripts/cli/gate-read.mjs'), '--root', tree, '--knowledge', ...knowledge];
  const command = args.map((arg) => JSON.stringify(String(arg).replaceAll(path.sep, '/'))).join(' ');
  const check = classifyCheck({ command }, { skillRoot, mechanical: true });
  const run = observeCheck(check, context, (cwd) => rerunCheck(check, { repo: cwd, env, timeoutMs: 180_000 }));
  if (run.processStatus !== 0) throw Object.assign(new Error(`the READ proof of the restored product failed: ${String(run.stderr).slice(0, 200)}`), { code: 'rejudge-read-proof-failed' });
  const file = path.join(tempRoot(), 'starci-settler', `rejudge-${job.job_id}-read-knowledge.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(run.output, null, 2)}\n`);
  const { native, ...staged } = stageObservation(run, [tree]);
  ledger.transaction(() => recordCheck(ledger.db, { attemptId, name: 'native-read-knowledge', phase: 'verify', runner: 'settler', command, ...staged, summary: { native } }));
  return file;
}

/**
 * The checks the failed report declared that the runtime can re-run itself, run now over the restored tree and recorded for the new attempt with their real
 * exit codes: [{name, command, exitCode, evidence}]. A check it cannot re-run mechanically is not declared again.
 */
function declaredChecksOf(ledger, { attemptId, checks, tree, env }) {
  const out = [];
  for (const declared of checks) {
    const command = typeof declared?.command === 'string' ? declared.command : null;
    const check = command ? classifyCheck({ command }, { skillRoot, mechanical: true }) : null;
    if (!check?.script) continue;
    const run = rerunCheck(check, { repo: tree, env, timeoutMs: 180_000 });
    const exitCode = run.exitCode ?? 1;
    ledger.write.recordCheckRun({ attemptId, name: declared.name, phase: 'verify', runner: 'op', status: exitCode === 0 ? 'pass' : 'fail', declaredExitCode: exitCode, exitCode, command });
    out.push({ name: declared.name, command, exitCode, evidence: String(run.tail ?? '').slice(0, 300) });
  }
  return out;
}

/** The admission and the contract a dispatch would have written for `job`'s new attempt; returns the attempt id. */
function admitAttempt(ledger, { job, failed, payload, tree, repo, env, wf, workflowTree, now }) {
  const db = ledger.db;
  // The maker of the product is the author of the failed attempt: the Critic's independence is judged against that provider, not against the runtime.
  const maker = db.prepare('SELECT provider, agent, model FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(failed.job_id) ?? {};
  const attempt = startAttempt(db, { workflowId: job.workflow_id, jobId: job.job_id, dispatchId: `rejudge:${job.job_id}`, at: now, provider: maker.provider ?? null, agent: maker.agent ?? null, model: maker.model ?? null });
  const owned = (payload.owned_paths ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.path));
  const selection = selectDispatchContract(skillRoot, job.op_id, { ...payload, opId: job.op_id });
  const packet = { context: { records: [], owned_paths: owned.map((file) => ({ root: tree, path: file })), selected_op: selection.selected, workflow_worktree: workflowTree } };
  admitPacket(skillRoot, { packet, op: job.op_id, placements: owned.map((file) => ({ base: tree, path: file })), db, workflowId: wf });
  const { inputs, contextPack } = captureDispatchInputs({ skillRoot, op: job.op_id, packet, briefDoc: selection.brief, params: selection.params, repo, stateDir: path.join(repo, '.starciwork'), workerCwd: tree });
  writeContract(db, { attemptId: attempt.attempt_id, markdown: fs.readFileSync(path.join(skillRoot, 'modules/ops/ops', `${job.op_id}.yaml`), 'utf8'),
    context: { worktree: tree, packet, contract: packet.context.contract, inputs, mandatory: contextPack.mandatory } });
  return attempt.attempt_id;
}

/**
 * Admits the re-judgment of the failed job `failed`: the new job (the lineage's next attempt, enqueued through the router's follow-on), its admission,
 * the restored product and the runtime's report. Returns {ok: true, jobId, digest} or {ok: false, code, detail} (nothing was written when it refuses before the enqueue).
 * `internals.enqueueFollowOn`, `workflowTree` ({path, workflowId}) and `repo` come from the failure router.
 */
export function admitRejudge(ledger, failed, { internals, workflowTree, repo, env = process.env, now = Date.now() }) {
  const db = ledger.db, tree = workflowTree?.path ?? null;
  const owed = rejudgeOwed(db, failed, { tree });
  if (!owed.ok) return owed;
  const routed = { route: REJUDGE_ROUTE, from: failed.job_id, firing: 1, limit: 1 };
  const next = internals.enqueueFollowOn(ledger, failed, { retryOf: failed.job_id, reason: REJUDGE_ROUTE, of: failed.job_id, routed });
  if (!next.enqueued) return refuse({ code: 'rejudge-not-enqueued' }, next.reason ?? 'the lineage refused the next attempt');
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(next.jobId);
  const payload = parseJson(job.payload_json, {}) ?? {};
  try {
    for (const to of ['ready', 'leased']) setJobStatus(db, { jobId: job.job_id, to, reason: 'rejudge', at: now });
    const attemptId = admitAttempt(ledger, { job, failed, payload, tree, repo, env, wf: failed.workflow_id, workflowTree: workflowTree.path, now });
    setJobStatus(db, { jobId: job.job_id, to: 'running', reason: 'rejudge', attemptId, at: now });
    const owned = (payload.owned_paths ?? []).map((entry) => (typeof entry === 'string' ? entry : entry.path));
    // Exactly the files the preserved snapshot holds under the owned paths (a directory pathspec is not handed to the atomic checkout).
    const restore = String(lsTree(['-r', '--name-only', '-z', owed.ref, '--', ...owned], { dir: tree, timeout: 30_000 }).stdout ?? '').split(String.fromCodePoint(0)).filter(Boolean);
    checkoutPaths(tree, owed.ref, restore);
    const proof = readProofOf(ledger, { job, attemptId, tree, repo, env });
    // The report attaches the proof only: the product stands in the workflow tree (restored above) and the runtime's Critic reads it there, by the owned paths.
    const files = [proof];
    const checks = declaredChecksOf(ledger, { attemptId, checks: owed.report.envelope.checks ?? [], tree, env });
    if (!checks.length) throw Object.assign(new Error('the failed report declared no check the runtime can re-run'), { code: 'rejudge-no-mechanical-check' });
    const report = { schema: 'starci/op-report@1', outcome: 'done', files, checks,
      summary: `re-judgment of the product ${owed.digest.slice(0, 12)} that ${failed.job_id} finished and preserved: the runtime restored it and judges it with its own Critic; no op attempt was made`,
      rejudge: { of: failed.job_id, digest: owed.digest, ref: owed.ref } };
    ledger.transaction(() => {
      // The READ proof was observed after the admission and before this report: its time is the clock's now, not the start of the admission.
      fileReport(db, { attemptId, outcome: 'done', report, fromTerminal: 'runtime:rejudge', createdAt: Date.now() + 1 });
      setJobStatus(db, { jobId: job.job_id, to: 'reported', reason: 'rejudge', attemptId, at: now });
      updateJob(db, { jobId: job.job_id, payload: { ...payload, rejudge: { of: failed.job_id, digest: owed.digest, ref: owed.ref } } });
      ledger.appendEvent({ workflowId: failed.workflow_id, entityType: 'job', entityId: job.job_id, kind: REJUDGE_EVENT, createdAt: now,
        payload: { jobId: job.job_id, of: failed.job_id, op: failed.op_id, digest: owed.digest, ref: owed.ref, files: owed.files.length, attemptId } });
    });
    return { ok: true, jobId: job.job_id, digest: owed.digest, ref: owed.ref };
  } catch (error) {
    // The enqueued job is a real lineage row: it ends failed, journalled, and the router takes the retry route over the failed lineage.
    ledger.transaction(() => { try { setJobStatus(db, { jobId: job.job_id, to: 'failed', reason: 'rejudge', at: now }); } catch { /* already terminal */ } recordJobResult(db, { jobId: job.job_id, result: { verdict: 'fail', rejudge: { code: error.code ?? 'rejudge-failed', detail: String(error.message ?? error).slice(0, 200) } } }); });
    const detail = String(error.message ?? error).slice(0, 200);
    return error.code ? refuse({ code: error.code }, detail) : refuse({ code: 'rejudge-failed' }, detail);
  }
}
