// git-land.mjs — `starci git land`: verify one lane under the serial host lock, fast-forward local main, and never push.
// Land verification trailers live in refs/notes/land so the verified lane commit is not amended or otherwise rewritten.
import fs from 'node:fs';
import path from 'node:path';
import { diff as diffCall } from '../api/git/diff.mjs';
import { isAncestor as isAncestorCall } from '../api/git/is-ancestor.mjs';
import { mergeBase as mergeBaseCall } from '../api/git/merge-base.mjs';
import { syncRuntime } from '../hfs/sync-runtime.mjs';
import { revParse as revParseCall } from '../api/git/rev-parse.mjs';
import { gitCallResult, linkedNodeModules, landLocalMain as landLocalMainCall } from './git-land-repo.mjs';
import { underHostLock as underHostLockCall } from '../machine/verb-lock.mjs';
import { runLandGate as runLandGateCall } from './git-land-gate.mjs';
import { runLandFullCheck, verifyLandSpecs } from './git-land-verify.mjs';
import { affectedTrailers, landVerifyReceipt } from './git-land-receipt.mjs';
import { announceLand as announceLandCall } from './land-announce.mjs';
import { KERNEL_NOTE_TRAILER, kernelNoteRefusal } from '../machine/land-kernel-note.mjs';

const SCHEMA = 'starci/git-land@1';
const STEP = Object.freeze({ verify: '0-verify-receipt', links: '1-linked-node-modules', gate: '2-land-gate', check: '3-runtime-check', specs: '4-specs', lock: '5-serial-lock', merge: '6-local-main' });
const cleanResult = ({ ok, landed = false, tip = null, base = null, specs = null, check = null, log = null }) => ({
  schema: SCHEMA, ok, landed, tip, base,
  specs: specs ?? { selected: 0, pass: 0, rerun: 0 },
  check: check ?? { pass: 0, total: 0 }, log,
});
const refused = ({ step, cause, failureCode = null, detail = '', owner = null, result = {} }) => {
  const ownerLabel = owner && typeof owner === 'object' ? JSON.stringify(owner) : owner;
  const suffix = [failureCode, cause, ownerLabel ? `owner ${ownerLabel}` : null, detail].filter(Boolean).join(': ');
  return { code: 1, text: `starci git land: REFUSED at ${step} (${suffix})`, data: { ...cleanResult({ ok: false, ...result }), refusal: { step, cause, ...(failureCode ? { code: failureCode } : {}), ...(owner ? { owner } : {}), ...(detail ? { detail } : {}) } } };
};
const usage = (detail) => ({ code: 2, text: `starci git land: ${detail}`, data: { ...cleanResult({ ok: false }), refusal: { step: 'usage', cause: detail } } });

const changedFiles = (worktree, base, tip, deps) => {
  if (deps.changedFiles) return deps.changedFiles(worktree, base, tip);
  const r = gitCallResult((deps.diff ?? diffCall)(['--name-only', '--diff-filter=ACMR', `${base}..${tip}`], { cwd: worktree }));
  return r.ok ? r.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : null;
};

const tipOf = (worktree, ref, deps) => (deps.resolveTip ?? revParseCall)(worktree, ref, { git: deps.git ?? null });
const baseOf = (worktree, ref, deps) => (deps.mergeBase ?? mergeBaseCall)(worktree, 'main', ref, { git: deps.git ?? null });
const ancestor = (worktree, before, after, deps) => (deps.isAncestor ?? isAncestorCall)(worktree, before, after, { git: deps.git ?? null });

function baseForSpecChecks({ worktree, ref, verified, verifiedLog, tip, check }, deps) {
  if (verified) {
    if (!verifiedLog || !fs.existsSync(verifiedLog)) return { refusal: refused({ step: STEP.specs, cause: 'verified-log-missing', detail: verifiedLog || '--verified-log is required with --verified', result: { tip, base: verified, check } }) };
    const verifiedTip = tipOf(worktree, verified, deps);
    if (!verifiedTip || !ancestor(worktree, verifiedTip, tip, deps)) return { refusal: refused({ step: STEP.specs, cause: 'verified-not-ancestor', detail: `${verified} is not an ancestor of ${ref}`, result: { tip, base: verifiedTip ?? verified, check } }) };
    return { base: verifiedTip };
  }
  const base = baseOf(worktree, ref, deps);
  if (!base) return { refusal: refused({ step: STEP.specs, cause: 'merge-base-missing', detail: `main and ${ref} have no merge base`, result: { tip, check } }) };
  return { base };
}

function specsForLand({ worktree, ref, verified, verifiedLog, tip, base, concurrency, check }, deps) {
  const changed = changedFiles(worktree, base, tip, deps);
  if (!changed) return { refusal: refused({ step: STEP.specs, cause: 'diff-unreadable', detail: `${base}..${tip}`, result: { tip, base, check } }) };
  const specRun = (deps.runSpecs ?? verifyLandSpecs)({ worktree, tip, changed, verifiedLog: verified ? verifiedLog : null, concurrency }, deps);
  const specs = { selected: Number(specRun?.selected ?? 0), pass: Number(specRun?.pass ?? 0), rerun: Number(specRun?.rerun ?? 0) };
  if (!specRun?.ok) return { refusal: refused({ step: STEP.specs, cause: specRun?.cause ?? 'specs-red', detail: specRun?.detail ?? 'dependent specs failed', result: { tip, base, specs, check, log: specRun?.log ?? null } }) };
  return { specRun, specs };
}

/** The regeneration of the runtime copies after a land: {ok, files} or {ok:false, error}; never throws, the land has happened. */
function copiesAfterLand(deps) {
  try { return { ok: true, files: (deps.syncCopies ?? syncRuntime)() }; } catch (error) { return { ok: false, error: String(error?.message ?? error).slice(0, 200) }; }
}

/** The verify receipt of the tip against the land base (main..tip): {receipt, base}, or the typed refusal when `starci runtime verify` has not proved this exact commit. */
function verifyForLand({ worktree, ref, tip }, deps) {
  const base = baseOf(worktree, ref, deps);
  const receipt = (deps.verifyReceipt ?? landVerifyReceipt)({ worktree, tip, base });
  return receipt.ok ? { receipt, base } : { refusal: refused({ step: STEP.verify, cause: 'verify-receipt-missing', detail: receipt.detail, result: { tip, base } }) };
}

async function lockedLand({ worktree, ref, verified, verifiedLog, dryRun, lane, concurrency, kernelNote }, deps) {
  const tip = tipOf(worktree, ref, deps);
  if (!tip) return refused({ step: STEP.gate, cause: 'ref-unresolved', detail: ref });
  const head = tipOf(worktree, 'HEAD', deps);
  if (head !== tip) return refused({ step: STEP.gate, cause: 'worktree-ref-mismatch', detail: `HEAD ${head ?? 'unreadable'} does not equal ${ref} ${tip}`, result: { tip } });

  const proof = verifyForLand({ worktree, ref, tip }, deps);
  if (proof.refusal) return proof.refusal;
  const { receipt, base: verifyBase } = proof;

  const gate = (deps.runGate ?? runLandGateCall)({ worktree, ref }, deps);
  if (!gate?.ok) return refused({ step: STEP.gate, cause: 'gate-red', detail: (gate?.problems ?? [gate?.detail ?? 'land gate failed']).slice(0, 8).join('; '), result: { tip, base: gate?.base ?? null } });

  const checkRun = (deps.runCheck ?? runLandFullCheck)(worktree, deps);
  const check = { pass: Number(checkRun?.pass ?? 0), total: Number(checkRun?.total ?? 1) };
  if (!checkRun?.ok) return refused({ step: STEP.check, cause: 'check-red', detail: String(checkRun?.output ?? 'full runtime check failed').trim().split(/\r?\n/).slice(-8).join(' | '), result: { tip, base: gate.base ?? null, check } });

  const baseResult = baseForSpecChecks({ worktree, ref, verified, verifiedLog, tip, check }, deps);
  if (baseResult.refusal) return baseResult.refusal;
  const { base } = baseResult;
  const specResult = specsForLand({ worktree, ref, verified, verifiedLog, tip, base, concurrency, check }, deps);
  if (specResult.refusal) return specResult.refusal;
  const { specRun, specs } = specResult;

  const trailers = [`Land-Verified: ${tip}`, `Specs: ${specs.pass}/${specs.selected}`, `Check: ${check.pass}/${check.total}`, ...affectedTrailers({ record: receipt.record, base: verifyBase, tip }), ...(kernelNote ? [`${KERNEL_NOTE_TRAILER}: ${kernelNote}`] : [])];
  if (dryRun) {
    const data = { ...cleanResult({ ok: true, landed: false, tip, base, specs, check, log: specRun.log ?? null }), trailers };
    return { code: 0, text: `starci git land: dry run passed for ${tip.slice(0, 12)}; local main was not changed\n${trailers.join('\n')}`, data };
  }
  const landed = (deps.landLocalMain ?? landLocalMainCall)({ worktree, ref, tip, trailers }, deps);
  if (!landed?.ok) return refused({ step: STEP.merge, cause: landed?.cause ?? 'fast-forward', detail: landed?.detail ?? 'local main did not move', result: { landed: Boolean(landed?.landed), tip, base, specs, check, log: specRun.log ?? null } });
  const announced = (deps.announceLand ?? announceLandCall)({ landed: tip, lane, kernelNote });
  // Main moved under the live checkout: its generated, git-ignored package runtime copies are regenerated now, so a running system never serves stale ones.
  const copies = copiesAfterLand(deps);
  const data = { ...cleanResult({ ok: true, landed: true, tip, base, specs, check, log: specRun.log ?? null }), trailers, announced, copies };
  const laneText = lane ? ` (${lane})` : '';
  const copiesText = copies.ok ? '' : `\nstarci git land: the runtime copies were NOT regenerated (${copies.error}); run starci release sync-runtime`;
  return { code: 0, text: `starci git land: landed ${tip.slice(0, 12)}${laneText} on local main\n${trailers.join('\n')}${copiesText}`, data };
}

/** Function-backed `git land <worktree> <ref>` verb. */
export async function gitLand(ctx, deps = {}) {
  const [worktreeArg, ref, ...extra] = ctx?.positionals ?? [];
  if (!worktreeArg || !ref || extra.length) return usage('usage: starci git land <worktree> <ref> [--verified <sha> --verified-log <file>] [--dry-run] [--lane <id>] [--kernel-note <line>] [--concurrency <n>]');
  const args = ctx.args ?? {}, concurrency = Number(args.concurrency ?? 4);
  if (!Number.isInteger(concurrency) || concurrency < 1) return usage('--concurrency must be a positive integer');
  if (args['verified-log'] && !args.verified) return usage('--verified-log requires --verified');
  const noteRefusal = kernelNoteRefusal(args['kernel-note']);
  if (noteRefusal) return usage(noteRefusal);
  const worktree = path.resolve(ctx.cwd ?? process.cwd(), worktreeArg);
  if (!fs.existsSync(worktree)) return refused({ step: STEP.links, cause: 'worktree-missing', detail: worktree });
  const linked = (deps.linkedNodeModules ?? linkedNodeModules)(worktree);
  if (linked.length) return refused({ step: STEP.links, cause: 'linked-node-modules', failureCode: 'RT_NODE_MODULES_LINK', detail: linked.map((file) => path.relative(worktree, file) || file).join(', ') });

  const input = { worktree, ref, verified: args.verified ?? null, verifiedLog: args['verified-log'] ? path.resolve(ctx.cwd ?? process.cwd(), args['verified-log']) : null,
    dryRun: Boolean(args['dry-run']), lane: args.lane ?? null, concurrency, kernelNote: args['kernel-note'] === undefined ? null : String(args['kernel-note']).trim() };
  const lockDoor = deps.underHostLock ?? underHostLockCall;
  const lock = await lockDoor({ role: 'coordinator', purpose: 'land', env: ctx.env ?? process.env }, () => lockedLand(input, deps), deps);
  if (!lock?.ok) return refused({ step: STEP.lock, cause: lock?.cause ?? 'held', owner: lock?.owner ?? 'unknown', detail: lock?.detail ?? '' });
  return await lock.value;
}
