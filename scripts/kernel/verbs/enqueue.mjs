// api enqueue: validate one planned operation and write its queued try of a work unit.
import fs from 'node:fs';
import path from 'node:path';
import { newToken } from '../../../engine/db/ledger.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { getWorkflow, latestGoal, jobPayloadOf, ownedPathsOf } from './shared/rows.mjs';
import { peerOverlapHeadsUp } from './shared/peer-waits.mjs';
import { splitGoalLegParams, resolveOpParams } from '../dispatch-op.mjs';
import { AUTOPILOT_RULING, HANDOVER_CREDENTIALS_SUBJECT, provisionAskMidFlow } from '../autopilot-run.mjs';
import { slash } from '../../lib/path-key.mjs';
import { familyGuardOf, familyViolations, familyOwners } from '../write-families.mjs';
import { ownedPathPlacements, enqueueRepository } from '../target-repo.mjs';
import { checkGrantParents } from '../grant-parents.mjs';
import { lineageHeadById } from '../gate-conditions.mjs';
import { loadContractChanges, changeById } from '../../machine/contract-version.mjs';
import { normalizeFoundationName, readFoundation } from '../foundation-registry.mjs';
import { admitUnit, writeUnitTry } from '../units.mjs';
import { isCanonSlice, requirePlannedCanonSlice } from '../canon-plan-gate.mjs';
import { requirePhase, ACCEPTS_WORK } from './shared/workflow-transitions.mjs';
import { seamPriorityOf } from '../seam-policy.mjs';
import { deferralOf as testDeferralOf, deferJob, explicitAsksOf } from '../../route/spec-deferral.mjs';

export default {
  verb: 'enqueue',
  required: ['workflow', 'op', 'paths'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, repo, emit, internals }) {
    const { refuseDecisionsFirst, refuseStaleKernelRev, goalLegOf, foundationDutyOf,
      AGENT_HIERARCHY_SCHEMA, operationNodeId, kernelNodeId, FINAL_SETTLED, skillRoot } = internals;
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  refuseDecisionsFirst(db, workflowId, 'enqueue', { now, resolves: args.resolves ?? null, repo });
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  // A paused, stopped, finished or archived workflow takes no new work (DBTREE jobs_enqueue_guard).
  requirePhase(wf, ACCEPTS_WORK, 'enqueue');
  const briefFile = path.join(skillRoot, 'modules', 'ops', 'ops', `${args.op}.yaml`);
  if (!fs.existsSync(briefFile)) {
    throw Object.assign(new Error(`unknown op ${args.op} — no brief at modules/ops/ops/${args.op}.yaml`), { code: 'unknown-op' });
  }
  refuseStaleKernelRev(db, workflowId, args.op, 'enqueue');
  const goal = latestGoal(db, workflowId);
  // Tunables are data. The brief declares each param's type, default and setter;
  // the approved goal leg carries what the owner chose, --params carries what the
  // kernel chose, and a value that fails either authority is refused here rather
  // than reaching an agent as an unbound number.
  const brief = parseYaml(fs.readFileSync(briefFile, 'utf8'));
  let flagParams = null;
  if (args.params !== undefined) {
    try { flagParams = JSON.parse(args.params); }
    catch (e) { throw Object.assign(new Error(`--params is not JSON: ${e.message}`), { code: 'params-invalid' }); }
    if (flagParams === null || typeof flagParams !== 'object' || Array.isArray(flagParams)) {
      throw Object.assign(new Error('--params must be a JSON object of {name: value}'), { code: 'params-invalid' });
    }
  }
  const legSplit = splitGoalLegParams(brief, goalLegOf(goal, args.op));
  const kernelFlag = Object.keys(legSplit.kernel).length || flagParams ? { ...legSplit.kernel, ...(flagParams ?? {}) } : null;
  // Autopilot (owner ruling 2026-09-28 "limit provision asks"): no provision.ask leg opens mid-flow - the code
  // proceeds on sandbox/stub/mocks and every credential or approval need is recorded deferred-to-handover
  // (api autopilot --defer-to-handover). The one provision.ask is the end-of-flow credential checklist (params.subject
  // handover-credentials); a retry of an ask the owner already answered (--retry-of) still runs.
  if (args.op === 'provision.ask' && args['retry-of'] == null && provisionAskMidFlow(db, workflowId, { params: { ...(legSplit.owner ?? {}), ...(kernelFlag ?? {}) } })) {
    const out = { ok: false, workflowId, op: args.op, reason: 'autopilot-provision-deferred',
      detail: `autopilot (${AUTOPILOT_RULING}) opens no provision.ask mid-flow: build on the sandbox/stub path, record the need with api autopilot --workflow ${workflowId} --defer-to-handover --op <asking op> --class credential|real-money|shared-system|owner-decision --detail "<what is owed>" [--fields <FILE_OR_VAR,...>], and the end-of-flow checklist (--params '{"subject":"${HANDOVER_CREDENTIALS_SUBJECT}"}') collects it once` };
    emit(out, `enqueue REFUSED for ${args.op}: ${out.reason} — ${out.detail}`, args.json);
    process.exit(1);
  }
  const resolvedParams = resolveOpParams(brief, { leg: legSplit.owner, flag: kernelFlag, enforceRequired: true });
  if (!resolvedParams.ok && resolvedParams.param) {
    const out = { ok: false, workflowId, op: args.op, reason: resolvedParams.reason, param: resolvedParams.param, detail: resolvedParams.detail };
    emit(out, `enqueue REFUSED for ${args.op}: ${out.reason} — ${out.detail}`, args.json);
    process.exit(1);
  }
  if (!resolvedParams.ok) throw Object.assign(new Error(resolvedParams.detail), { code: resolvedParams.reason });
  const ownedPaths = [...new Set(String(args.paths).split(',').map((s) => s.trim()).filter(Boolean))];
  // An op with no owned_paths is an unbounded write grant: the packet would
  // tell the worker "(per brief write-ceiling)" and nothing would fence it.
  if (ownedPaths.length === 0) {
    throw Object.assign(new Error(`--paths resolved to no path for ${args.op} — an op without owned_paths is an unbounded grant`), { code: 'empty-paths' });
  }
  // The kernel custody roots (modules/schemas/work-layout.yaml kernelCustody)
  // belong to the kernel. An op that owns one also takes a path lease every
  // sibling op in the workflow collides with, which serializes parallel cells.
  const custody = ownedPaths.filter((p) => /(^|\/)\.starciwork\/(kernel-evidence|kernel-strays|kernel-approvals)(\/|$)/.test(slash(p)));
  if (custody.length) {
    throw Object.assign(new Error(`--paths names kernel custody ${custody.join(', ')} for ${args.op}; kernel-evidence, kernel-strays and kernel-approvals are the kernel's, never an op's write set`), { code: 'path-kernel-custody' });
  }
  // An authoring op goes only onto the Work families its manifest writes (scripts/kernel/write-families.mjs):
  // business.decide onto integration/, impl/ or src/ was an LLM attempt spent to report blocked authority.
  {
    const familyGuard = familyGuardOf(brief);
    const wrongFamily = familyViolations(familyGuard, ownedPaths);
    if (wrongFamily.length) {
      const owners = familyOwners(fs.readdirSync(path.join(skillRoot, 'modules', 'ops', 'ops')).filter((f) => f.endsWith('.yaml'))
        .map((f) => { try { return parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'ops', 'ops', f), 'utf8')); } catch { return null; } }).filter(Boolean));
      const hint = [...new Set(wrongFamily.map((v) => v.family).filter(Boolean))].map((family) => `${family}/ -> ${(owners.get(family) ?? ['no op']).join('|')}`).join('; ');
      const out = { ok: false, workflowId, op: args.op, reason: 'owned-paths-outside-writes', violations: wrongFamily, families: [...(familyGuard?.families ?? [])], owners: Object.fromEntries(owners),
        detail: `${wrongFamily.length} owned path(s) lie outside ${args.op}'s writes: ${wrongFamily.slice(0, 5).map((v) => `${v.path} (${v.why})`).join('; ')}${hint ? `. Route by family: ${hint}` : ''}` };
      emit(out, `enqueue REFUSED for ${args.op}: ${out.reason} — ${out.detail}`, args.json);
      process.exit(1);
    }
  }
  const records = [...new Set(String(args.records ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
  const cutValues = [args['cut-id'], args['cut-ordinal'], args['cut-total']];
  const hasCut = cutValues.some((value) => value != null);
  if (hasCut && cutValues.some((value) => value == null)) {
    throw Object.assign(new Error('cut enqueue requires --cut-id, --cut-ordinal and --cut-total together'), { code: 'cut-invalid' });
  }
  const cutOrdinal = hasCut ? Number(args['cut-ordinal']) : null;
  const cutTotal = hasCut ? Number(args['cut-total']) : null;
  if (hasCut && (!String(args['cut-id']).trim() || !Number.isInteger(cutOrdinal) || !Number.isInteger(cutTotal)
      || cutOrdinal < 1 || cutTotal < 2 || cutOrdinal > cutTotal)) {
    throw Object.assign(new Error('cut enqueue requires a non-empty id and integers 1 <= ordinal <= total with total >= 2'), { code: 'cut-invalid' });
  }
  const cut = hasCut ? { id: String(args['cut-id']).trim(), ordinal: cutOrdinal, total: cutTotal } : null;
  // H6: the first try of a canon slice comes from the canon plan (scripts/kernel/canon-plan-gate.mjs): its owned paths
  // cover the plan's grants, and a slice whose moves another slice holds is cut again, never enqueued to block.
  const canonPlan = isCanonSlice({ cut, params: resolvedParams.params }) && !(typeof args['retry-of'] === 'string' && args['retry-of'].trim())
    ? requirePlannedCanonSlice({ cut, ownedPaths, scanFile: args['canon-scan'] ?? null }).plan : null;
  // Persist the repository so dispatch, guards and settle use the same root.
  const target = enqueueRepository({ op: args.op, repository: args.repository, ownedPaths, repo });
  if (!target.ok) {
    const out = { ok: false, workflowId, op: args.op, reason: target.reason, detail: target.detail };
    emit(out, `enqueue REFUSED for ${args.op}: ${out.reason} — ${out.detail}`, args.json);
    process.exit(1);
  }
  // A grant the worker could never satisfy (its directory does not exist in the target repository) is refused here,
  // unless it is an explicit --new-module grant (scripts/kernel/grant-parents.mjs).
  const newModules = [...new Set(String(args['new-module'] ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
  {
    const grant = checkGrantParents({ op: args.op, payload: { repository: target.repository ?? undefined, new_modules: newModules }, ownedPaths, repo });
    if (!grant.ok) {
      const out = { ok: false, workflowId, op: args.op, reason: grant.reason, violations: grant.violations.map(({ owned, dir, closest }) => ({ owned, dir, closest })), detail: grant.detail };
      emit(out, `enqueue REFUSED for ${args.op}: ${out.reason} — ${out.detail}`, args.json);
      process.exit(1);
    }
  }
  // --after: jobs of this workflow that must settle succeeded before this one
  // may run (a seam/composition job ahead of its record-level siblings). The
  // order lives in the ledger, so status never calls a held sibling ready.
  const after = [...new Set(String(args.after ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
  for (const prior of after) {
    const row = db.prepare('SELECT status FROM jobs WHERE job_id=? AND workflow_id=?').get(prior, workflowId);
    if (!row) throw Object.assign(new Error(`--after names ${prior}, which is not a job of ${workflowId}`), { code: 'after-unknown' });
    // A settled row never changes status, so an --after on one that did not
    // succeed can never be met. inc-5005d003825a: a retry of an answered ask
    // was enqueued --after the ask attempt and could only be dropped; the
    // retry chains to the ask through its retry lineage, never through --after.
    // A failed or cancelled job whose retry lineage carries on is waited on through it (lineageHeadOf).
    const head = FINAL_SETTLED.includes(row.status) && row.status !== 'succeeded' ? lineageHeadById(db, prior).row : row;
    if (FINAL_SETTLED.includes(head.status) && head.status !== 'succeeded') {
      throw Object.assign(new Error(`--after names ${prior}, which already settled ${row.status} and can never succeed; a retry of it chains through its retry lineage (enqueue the same op${hasCut ? ' and cut ordinal' : ''} without --after)`), { code: 'after-settled' });
    }
  }
  // Shared foundations (driver-loop.yaml foundations): --foundation <name> marks a leg that builds a
  // foundation this workflow owns, and such legs run first. A workflow with running peers declares
  // its foundations before its first leg - required of one created after the shared-foundation-planning
  // change, advised (the receipt says so, nothing is held) for an older one.
  const registry = loadContractChanges(skillRoot);
  let foundationLeg = null, foundationAdvisory = null;
  if (args.foundation != null) {
    const name = normalizeFoundationName(args.foundation);
    const foundation = readFoundation(db, name);
    if (foundation?.owner?.workflowId !== workflowId) {
      throw Object.assign(new Error(`--foundation ${name}: ${foundation?.owner ? `owned by ${foundation.owner.workflowId}` : 'not claimed'}; a foundation leg builds a foundation this workflow claimed (api foundation --claim ${name})`), { code: 'foundation-not-owned' });
    }
    foundationLeg = name;
  } else {
    const duty = foundationDutyOf(db, wf, { registry });
    if (duty.required) {
      const out = { ok: false, workflowId, op: args.op, reason: 'foundations-undeclared', peers: duty.peers, detail: duty.detail };
      emit(out, `enqueue REFUSED for ${args.op}: foundations-undeclared — ${duty.detail}`, args.json);
      process.exit(1);
    }
    if (duty.advised) foundationAdvisory = duty.detail;
  }
  // --contract-change <id> --follow-up-of <job>: the follow-up leg a `reach: follow-up` contract change
  // owes an older leg (api status contractFollowUps); the older leg is never held for it.
  let contractChange = null;
  if (args['contract-change'] != null || args['follow-up-of'] != null) {
    const change = changeById(registry, String(args['contract-change'] ?? '').trim());
    if (!change || change.reach !== 'follow-up') throw Object.assign(new Error(`--contract-change ${args['contract-change'] ?? '(missing)'} names no registered reach: follow-up change in modules/kernel/contract-changes.yaml`), { code: 'contract-change-unknown' });
    const source = db.prepare('SELECT job_id FROM jobs WHERE job_id=? AND workflow_id=?').get(String(args['follow-up-of'] ?? ''), workflowId);
    if (!source) throw Object.assign(new Error(`--follow-up-of ${args['follow-up-of'] ?? '(missing)'} is not a job of ${workflowId}`), { code: 'follow-up-of-unknown' });
    contractChange = { id: change.id, followUpOf: source.job_id };
  }
  const jobId = `op-${args.op}-${newToken().slice(0, 10)}`;
  let payload;

  let job, unit = null, peers = { overlap: [], messages: [] }, testsDeferred = null;
  ledger.transaction(() => {
    // The work unit this job is a try of (scripts/kernel/units.mjs, H3/H4/H5): its budget, its lineage (--retry-of may
    // name only the unit's latest failed try) and the reopen a passed unit needs. A refusal is typed and nothing is written.
    const admitted = admitUnit(db, { workflowId, op: args.op, goalRevision: goal?.revision ?? null,
      payload: { cut, records, owned_paths: ownedPaths, ...(Object.keys(resolvedParams.params).length ? { params: resolvedParams.params } : {}) },
      retryOf: typeof args['retry-of'] === 'string' && args['retry-of'].trim() ? args['retry-of'].trim() : null,
      reopen: typeof args.reopen === 'string' && args.reopen.trim() ? { reason: args.reopen.trim(), by: 'kernel' } : null,
      derivedFrom: String(args['derived-from'] ?? '').split(',').map((id) => id.trim()).filter(Boolean) });
    // An --after on a try of this very unit waits on itself: a retry chains to its predecessor through the unit.
    const self = admitted.unitId ? after.filter((prior) => db.prepare('SELECT unit_id FROM jobs WHERE job_id=?').get(prior)?.unit_id === admitted.unitId) : [];
    if (self.length) throw Object.assign(new Error(`--after names ${self.join(', ')}, a try of this job's own unit ${admitted.unitId}: it would wait on itself; enqueue without that --after - a retry chains through its unit`), { code: 'after-self-lineage' });
    payload = {
      opId: args.op, records, owned_paths: ownedPaths, ...(newModules.length ? { new_modules: newModules } : {}), title: args.title ?? args.op, risk: args.risk ?? null,
      // --what: the short human name of the target (Vietnamese, ≤40 chars) the op-job display name shows.
      ...(typeof args.what === 'string' && args.what.trim() ? { displayWhat: args.what.replace(/\s+/g, ' ').trim().slice(0, 60) } : {}),
      ...(target.repository ? { repository: target.repository } : {}),
      ...(Object.keys(resolvedParams.params).length ? { params: resolvedParams.params } : {}),
      ...(cut ? { cut } : {}),
      ...(after.length ? { after } : {}),
      ...(foundationLeg ? { foundation: foundationLeg } : {}),
      ...(contractChange ? { contractChange } : {}),
      ...(canonPlan ? { canonPlan } : {}),
      // The manual-only proofs this goal explicitly asks for (spec-deferral.mjs): an explicit-ask-only leg without the stamp is deferred.
      ...(explicitAsksOf({ skillRoot, text: goal?.markdown }).length ? { explicitAsk: explicitAsksOf({ skillRoot, text: goal?.markdown }) } : {}),
      goal_binding: { revision: goal?.revision ?? null, identity: goal?.goal_identity ?? null },
      hierarchy: {
        schema: AGENT_HIERARCHY_SCHEMA,
        nodeId: operationNodeId(jobId),
        parentNodeId: kernelNodeId(workflowId),
        role: 'operation',
        workflowId,
        jobId,
        opId: args.op,
        attempt: admitted.tryNo,
        generation: wf.generation ?? 0,
        runtime: { host: 'orca' },
      },
    };
    const unitTry = writeUnitTry(db, admitted, { workflowId, jobId, op: args.op, title: payload.title, cut, repository: payload.repository ?? null, at: now });
    job = ledger.enqueueJob({ jobId, workflowId, opId: args.op, ...unitTry, generation: wf.generation ?? 0, kind: 'op', role: 'op', payload, priority: seamPriorityOf(cut), createdAt: now });
    unit = { unitId: unitTry.unitId, tryNo: unitTry.tryNo, tryBudget: admitted.tryBudget, retryOf: unitTry.retryOf, resumeOf: unitTry.resumeOf, ...(admitted.reopen ? { reopen: admitted.reopen } : {}) };
    // The owner's config.yaml specs switch off this test class: the leg settles deferred at once, no attempt
    // spent, and the legs behind it proceed (scripts/route/spec-deferral.mjs; api run-deferred-tests runs it later).
    // An explicit-ask-only leg (integration.verify) the goal did not ask for is deferred the same way.
    const deferral = testDeferralOf({ skillRoot, op: args.op, payload });
    if (deferral) {
      testsDeferred = deferJob(ledger, { job: { job_id: jobId, workflow_id: workflowId, op_id: args.op, try_no: unitTry.tryNo }, deferral, via: 'enqueue', now });
      if (testsDeferred) job = { ...job, status: 'succeeded' };
    }
    // Owned paths that overlap an open job of a running peer workflow: the
    // receipt names them and each such peer gets one heads-up. Never a refusal.
    peers = peerOverlapHeadsUp(ledger, { self: wf, jobId, op: args.op, ownedPaths, now, repo, payload });
  });

  const out = { ok: true, job_id: jobId, workflowId, op: args.op, status: job.status, unit, cut, params: payload.params ?? null, repository: payload.repository ?? null,
    peerOverlap: peers.overlap, peerHeadsUp: peers.messages, ...(testsDeferred ? { deferred: testsDeferred } : {}),
    ...(foundationLeg ? { foundation: foundationLeg } : {}), ...(contractChange ? { contractChange } : {}), ...(foundationAdvisory ? { foundationAdvisory } : {}) };
  if (foundationAdvisory) process.stderr.write(`api: advisory: ${foundationAdvisory}\n`);
  emit(out, `enqueued ${jobId} (op ${args.op}, unit ${unit.unitId} try ${unit.tryNo}/${unit.tryBudget}${unit.retryOf ? ` retry of ${unit.retryOf}` : ''}${unit.reopen ? ` REOPENED: ${unit.reopen.reason}` : ''}, status ${job.status}${testsDeferred ? `, DEFERRED (${testsDeferred.reason}): not dispatched, no attempt spent; api run-deferred-tests --workflow ${workflowId} runs it later` : ''}${payload.repository ? `, repository ${payload.repository}` : ''}${cut ? `, cut ${cut.ordinal}/${cut.total} ${cut.id}` : ''}${payload.params ? `, params ${Object.entries(payload.params).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}` : ''})${peers.overlap.length ? `; overlaps peer job(s) ${[...new Set(peers.overlap.map((hit) => `${hit.workflowId}/${hit.jobId}`))].join(', ')}, heads-up sent to ${peers.messages.map((message) => message.to).join(', ') || 'nobody new'}` : ''}`, args.json);

  },
};
