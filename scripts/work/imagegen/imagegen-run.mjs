// imagegen-run.mjs — one `starci work imagegen` call: admit it on the imagegen call tier (the picker and the provider
// reservation of every other launch, scripts/agent/call-admission.mjs), run Codex headlessly, keep the images and the receipt,
// release the slot. The runner, the admission and the clock are injectable. A result is {ok:true, ...} or a typed refusal.
import crypto from 'node:crypto';
import { admitCall, beginCall, endCall, liveCall, refusalKind } from '../../agent/call-admission.mjs';
import { makeTempDir } from '../../api/fs/make-temp-dir.mjs';
import { safeRemove } from '../../api/fs/safe-remove.mjs';
import { failureClass } from '../../lib/codex-exec-events.mjs';
import { collectGenerated, imagegenArgs, imagegenBrief, runCodex } from './imagegen-codex.mjs';
import { IMAGEGEN_CODES, codeOfAdmissionKind, codeOfFailureClass, refusal } from './imagegen-codes.mjs';
import { writeImagegen } from './imagegen-receipt.mjs';

const tail = (text, n = 400) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(-n);

const DEFAULT_DEPS = Object.freeze({ admit: admitCall, begin: beginCall, live: liveCall, end: endCall, runner: runCodex, collect: collectGenerated });

/** The admitted, launching call, or the typed refusal (its reservation released when it could not launch). */
function admitAndBegin(request, { env, now, io, deps }) {
  const attemptId = `imagegen:${crypto.randomUUID()}`;
  const called = deps.admit({ call: 'imagegen', scopeId: request.scopeId, attemptId }, { env, now, io });
  if (!called.ok) return refusal(codeOfAdmissionKind(called.kind), [called.reason, called.detail].filter(Boolean).join(': '), { admission: { kind: called.kind, reason: called.reason, resetAt: called.resetAt ?? null } });
  const began = deps.begin(called, { launchIdentity: attemptId, env, now, io });
  if (began.ok) return { ok: true, called };
  deps.end(called, { env, io });
  return refusal(codeOfAdmissionKind(refusalKind(began.reason)), `the provider reservation could not start the call: ${began.reason}`, { admission: { kind: refusalKind(began.reason), reason: began.reason } });
}

/** Why a finished run produced nothing: the typed refusal, from the run's failures, its exit or its last message. */
function emptyRunRefusal(run) {
  if (run.timedOut) return refusal(IMAGEGEN_CODES.timeout, `codex exec did not finish within the call's timeout (${run.durationMs} ms)`);
  if (run.error) return refusal(IMAGEGEN_CODES.runnerFailed, `codex exec could not run: ${tail(run.error)}`);
  const failures = run.events.failures.join(' ');
  if (failures) return refusal(codeOfFailureClass(failureClass(failures)), tail(failures));
  if (run.code !== 0) return refusal(IMAGEGEN_CODES.runnerFailed, `codex exec exited ${run.code}: ${tail(run.stderr)}`);
  return refusal(IMAGEGEN_CODES.noOutput, `codex exec generated no image: ${tail(run.events.lastMessage) || 'no agent message'}`);
}

/** The run, then the slot's release on the proof that the child exited; a child that did not exit keeps its slot. */
async function runAndRelease(request, { called, env, io, deps }) {
  const workdir = makeTempDir('starci-imagegen-');
  const startedAt = Date.now();
  let pid = null;
  try {
    const run = await deps.runner({ args: imagegenArgs({ cwd: workdir, member: called.selected, references: request.references }),
      brief: imagegenBrief({ promptText: request.promptText, count: request.count, size: request.size, referenceCount: request.references.length }),
      cwd: workdir, env, timeoutMs: called.spec.timeoutMs, onSpawn: (child) => { pid = child; deps.live(called, { pid: child, env, io }); } });
    const finished = { ...run, durationMs: Date.now() - startedAt };
    if (finished.exited !== false) deps.end(called, { pid: finished.pid ?? pid, env, io });
    return finished;
  } catch (error) {
    deps.end(called, { pid, env, io });
    throw error;
  } finally {
    safeRemove(workdir, { hold: () => null }); // a scratch directory this call made, outside every repository
  }
}

/**
 * Generate the images of `request` (imagegen-request.mjs) and write them with their receipt. `deps` replaces any of
 * admit, begin, live, end, runner, collect (specs); `io` is the admission evidence seam (tests/helpers/fake-admission.mjs).
 */
export async function runImagegen(request, { env = process.env, now = Date.now, io = null, deps = {} } = {}) {
  const wired = { ...DEFAULT_DEPS, ...deps };
  const admitted = admitAndBegin(request, { env, now, io, deps: wired });
  if (!admitted.ok) return admitted;
  const { called } = admitted;
  const run = await runAndRelease(request, { called, env, io, deps: wired });
  const items = run.events.threadId ? wired.collect(env, run.events.threadId).slice(0, request.count) : [];
  if (!items.length) return { ...emptyRunRefusal(run), model: called.selected.model };
  const member = { ...called.selected, tier: called.spec.tier };
  const written = writeImagegen({ request, member, run, items });
  return { ok: true, model: member.model, effort: member.effort ?? null, tier: member.tier, requested: request.count, produced: items.length,
    complete: items.length === request.count, files: written.files, receipt: written.receiptFile, durationMs: run.durationMs, usage: run.events.usage };
}
