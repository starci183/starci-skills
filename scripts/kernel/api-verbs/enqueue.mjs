// api enqueue: validate one planned operation and write its queued attempt.
import fs from 'node:fs';
import path from 'node:path';
import { newToken } from '../../../engine/ledger-db.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { getWorkflow, latestGoal, jobPayloadOf, ownedPathsOf } from '../api-lib/rows.mjs';
import { dispatchEvidenceOf } from '../api-lib/dispatch-state.mjs';
import { peerOverlapHeadsUp } from '../api-lib/peers.mjs';
import { splitGoalLegParams, resolveOpParams } from '../../route/dispatch-op.mjs';
import { AUTOPILOT_RULING, HANDOVER_CREDENTIALS_SUBJECT, provisionAskMidFlow } from '../autopilot.mjs';
import { slash } from '../../lib/path-key.mjs';
import { familyGuardOf, familyViolations, familyOwners } from '../write-families.mjs';
import { ownedPathPlacements, enqueueRepository } from '../target-repo.mjs';
import { lineageHeadById } from '../gate-conditions.mjs';
import { loadContractChanges, changeById } from '../contract-version.mjs';
import { normalizeFoundationName, readFoundation } from '../foundations.mjs';
import { lineageJobsOf } from '../owner-answers.mjs';
import { seamPriorityOf } from '../cut-seam.mjs';
import { deferralOf as testDeferralOf, deferJob } from '../spec-deferral.mjs';

export default {
  verb: 'enqueue',
  required: (args) => ['workflow', 'op', ...(args['commit-only-work-debt'] ? [] : ['paths'])],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, repo, emit, internals }) {
    const { refuseDecisionsFirst, refuseStaleKernelRev, goalLegOf, workflowFinished, workDebtOf,
      workflowScopeOf, liveWorkflowIds, scopeCovers, foundationDutyOf, retryLineageFor,
      AGENT_HIERARCHY_SCHEMA, operationNodeId, kernelNodeId, FINAL_SETTLED, skillRoot } = internals;
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  refuseDecisionsFirst(db, workflowId, 'enqueue', { now, resolves: args.resolves ?? null, repo });
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  if (wf.phase === 'finished') {
    throw Object.assign(new Error(`workflow ${workflowId} is finished; a finished phase takes no new work`), { code: 'workflow-finished' });
  }
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
  // Autopilot (owner ruling 2026-09-28 "hạn chế provision ask"): no provision.ask leg opens mid-flow - the code
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
  // --commit-only-work-debt: ONE commit-only attempt of this op covering the union of the exact paths
  // its settled legs in this workflow wrote and left uncommitted (api reconcile --work-debt batches), so a
  // workflow repairs its debt in one attempt per op. With --adopt-from <finished workflow> it adopts that
  // workflow's debt instead - every file it wrote or its jobs cover while no live workflow's job still
  // covers it (those are named in `held`, never taken) - only the paths this workflow's Work scope
  // covers, plus, with --as-repo-owner, the paths no other live workflow's scope covers.
  let commitOnlyBatch = null;
  if (args['as-repo-owner'] && args['adopt-from'] == null) throw Object.assign(new Error('--as-repo-owner goes with --commit-only-work-debt --adopt-from <finished workflow>'), { code: 'commit-only-conflict' });
  if (args['adopt-from'] != null && !args['commit-only-work-debt']) throw Object.assign(new Error('--adopt-from goes with --commit-only-work-debt'), { code: 'commit-only-conflict' });
  if (args['commit-only-work-debt']) {
    if (args.paths != null || args['commit-only-of'] != null) throw Object.assign(new Error('--commit-only-work-debt derives --paths and the repaired jobs itself; pass neither --paths nor --commit-only-of'), { code: 'commit-only-conflict' });
    const from = args['adopt-from'] != null ? String(args['adopt-from']).trim() : null;
    if (from) {
      if (from === workflowId || !getWorkflow(db, from)) throw Object.assign(new Error(`--adopt-from ${from} names no other workflow of this ledger`), { code: 'adopt-from-invalid' });
      if (!workflowFinished(db, from)) throw Object.assign(new Error(`--adopt-from ${from} is live; a live workflow repairs its own Work debt`), { code: 'adopt-from-live' });
    }
    const found = workDebtOf(db, repo, { workflow: from ? null : workflowId, op: args.op });
    let owed = found.debts.filter((debt) => debt.paths.length);
    let outOfScope = 0;
    const held = [];
    if (from) {
      // A file is from's to hand over when from wrote it or one of its jobs covers it, and adoptable
      // only while every workflow covering it is finished or archived; one a live workflow (other than
      // the adopter) still covers stays with that workflow and is named in `held`, never taken.
      const scopes = new Map(), own = workflowScopeOf(db, repo, workflowId, scopes);
      const others = liveWorkflowIds(db).filter((id) => id !== workflowId).map((id) => workflowScopeOf(db, repo, id, scopes));
      owed = owed.filter((debt) => debt.workflowId !== workflowId).map((debt) => {
        const keep = debt.keys.map((key, i) => {
          const covers = debt.covers[i];
          if (debt.workflowId !== from && !covers.workflows.includes(from)) return false;
          const live = [...new Set([...(debt.workflowFinished ? [] : [debt.workflowId]), ...covers.live])].filter((id) => id !== workflowId);
          if (live.length) { held.push({ file: debt.paths[i], liveOwners: live }); return false; }
          const inScope = scopeCovers(own, key) || (args['as-repo-owner'] && !others.some((scope) => scopeCovers(scope, key)));
          if (!inScope) outOfScope += 1;
          return inScope;
        });
        return { ...debt, paths: debt.paths.filter((_, i) => keep[i]), spelled: debt.spelled.filter((_, i) => keep[i]) };
      }).filter((debt) => debt.paths.length);
      for (const item of found.unattributed) {
        const live = item.liveOwners.filter((id) => id !== workflowId);
        if (item.workflows.includes(from) && live.length) held.push({ file: item.file, liveOwners: live });
      }
    }
    const heldBy = [...new Set(held.flatMap((h) => h.liveOwners))];
    if (!owed.length) {
      const reason = from ? (held.length && !outOfScope ? 'adopt-held-live' : 'adopt-out-of-scope') : 'no-work-debt';
      const detail = reason === 'adopt-held-live'
        ? `every ${args.op} Work debt of ${from} is still covered by live workflow(s) ${heldBy.join(', ')} and stays with them (${held.map((h) => h.file).join(', ')})`
        : from
        ? `none of ${from}'s ${args.op} Work debt lies in ${workflowId}'s Work scope${args['as-repo-owner'] ? ' or outside every other live workflow\'s' : ''} (${outOfScope} path(s) out of scope${held.length ? `; ${held.length} held by live ${heldBy.join(', ')}` : ''}; api reconcile --work-debt adoptions)`
        : `no settled ${args.op} job of ${workflowId} has attributed uncommitted Work without a pending repair (api reconcile --work-debt)`;
      const out = { ok: false, workflowId, op: args.op, reason, detail, ...(held.length ? { held } : {}) };
      emit(out, `enqueue REFUSED for ${args.op}: ${reason} — ${detail}`, args.json);
      process.exit(1);
    }
    args.paths = [...new Set(owed.flatMap((debt) => debt.spelled))].join(',');
    commitOnlyBatch = { of: [...new Set(owed.map((debt) => debt.jobId))], batch: 'work-debt',
      ...(from ? { adoptedFrom: from, ...(args['as-repo-owner'] ? { asRepoOwner: true } : {}), outOfScope, ...(held.length ? { held } : {}) } : {}) };
  }
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
  // A commit-only attempt authors nothing and commits settled output wherever it lies.
  if (!commitOnlyBatch && args['commit-only-of'] == null) {
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
  // Bind a new cut slice to its already enqueued siblings when its own path
  // has not been created yet. A sibling's qualified paths can supply the role.
  const siblingRepositories = cut ? db.prepare("SELECT payload_json FROM jobs WHERE workflow_id=? AND op_id=? AND json_extract(payload_json,'$.cut.id')=?")
    .all(workflowId, args.op, cut.id).flatMap((row) => {
      const sibling = jobPayloadOf(row);
      if (sibling.repository) return [sibling.repository];
      return ownedPathPlacements({ op: args.op, payload: sibling, ownedPaths: ownedPathsOf(sibling), repo })
        .filter((place) => place.role && ['path-repository', 'path-repository-name', 'path-absolute', 'path-relative'].includes(place.via)).map((place) => place.role);
    }) : [];
  // Persist the repository so dispatch, guards and settle use the same root.
  const target = enqueueRepository({ op: args.op, repository: args.repository, ownedPaths, repo, siblingRepositories });
  if (!target.ok) {
    const out = { ok: false, workflowId, op: args.op, reason: target.reason, detail: target.detail };
    emit(out, `enqueue REFUSED for ${args.op}: ${out.reason} — ${out.detail}`, args.json);
    process.exit(1);
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
  // --commit-only-of <job>: a commit-only attempt for Work a settled leg of the same op wrote and never
  // committed (api reconcile --work-debt lists them with their exact paths).
  let commitOnly = commitOnlyBatch;
  if (args['commit-only-of'] != null) {
    const ids = [...new Set(String(args['commit-only-of']).split(',').map((id) => id.trim()).filter(Boolean))];
    if (!ids.length) throw Object.assign(new Error('--commit-only-of names no job'), { code: 'commit-only-of-unknown' });
    for (const id of ids) {
      const source = db.prepare('SELECT job_id,op_id,status FROM jobs WHERE job_id=? AND workflow_id=?').get(id, workflowId);
      if (!source) throw Object.assign(new Error(`--commit-only-of ${id} is not a job of ${workflowId}`), { code: 'commit-only-of-unknown' });
      if (source.op_id !== args.op || source.status !== 'succeeded') throw Object.assign(new Error(`--commit-only-of ${source.job_id} is a ${source.status} ${source.op_id} job; a commit-only attempt commits what succeeded jobs of the same op (${args.op}) wrote`), { code: 'commit-only-of-invalid' });
    }
    commitOnly = { of: ids.length === 1 ? ids[0] : ids };
  }
  const jobId = `op-${args.op}-${newToken().slice(0, 10)}`;
  let payload;

  let job, peers = { overlap: [], messages: [] }, testsDeferred = null;
  ledger.transaction(() => {
    const attempt = db.prepare('SELECT COALESCE(MAX(attempt),0)+1 a FROM jobs WHERE workflow_id=? AND op_id=?').get(workflowId, args.op).a;
    // A retry's provenance. `attempt` is durable dispatch identity; `businessAttempt`
    // only advances when the prior attempt actually spent one — an infrastructure
    // launch rejected before any effect does not (engine/admission.mjs deriveRetryLineage).
    // A cut ordinal's predecessor is its own ordinal, never a sibling slice.
    const lineageOf = () => retryLineageFor(db, { workflowId, op: args.op, cut, attempt,
      payload: { owned_paths: ownedPaths, records, ...(Object.keys(resolvedParams.params).length ? { params: resolvedParams.params } : {}) },
      retryOf: typeof args['retry-of'] === 'string' && args['retry-of'].trim() ? args['retry-of'].trim() : null });
    let retry = lineageOf();
    // The Kernel's own enqueue of a step the runtime already queued (enqueueNextStep) replaces that
    // never-dispatched row: it is retired as dropped, so lineage and --after follow this job instead.
    for (let hop = 0; retry?.retryOf && hop < 4; hop += 1) {
      const auto = db.prepare(`SELECT * FROM jobs WHERE workflow_id=? AND op_id=? AND status='queued' AND json_extract(payload_json,'$.retryReason.auto')=1
        AND (job_id=? OR json_extract(payload_json,'$.retry.retryOf')=?)`).all(workflowId, args.op, retry.retryOf, retry.retryOf)
        .filter((row) => !dispatchEvidenceOf(db, row, jobPayloadOf(row)).length);
      if (!auto.length) break;
      for (const row of auto) {
        db.prepare("UPDATE jobs SET status='cancelled', result_json=?, updated_at=? WHERE job_id=? AND status='queued'")
          .run(JSON.stringify({ verdict: 'dropped', reason: 'superseded-by-enqueue', by: jobId, at: now }), now, row.job_id);
        ledger.appendEvent({ workflowId, entityType: 'job', entityId: row.job_id, kind: 'job-dropped', payload: { reason: 'superseded-by-enqueue', by: jobId, auto: true } });
      }
      retry = lineageOf();
    }
    // An --after on this job's own retry lineage waits on itself: a failed prior carries on through its lineage head,
    // and that head is this job (nivo op-interface.draw-e3bf65f8ed sat 4.6 h queued behind itself, then was dropped
    // as a self-dependency). A retry chains to its predecessor through the lineage, never through --after.
    if (retry?.retryOf) {
      const pred = db.prepare('SELECT * FROM jobs WHERE job_id=? AND workflow_id=?').get(retry.retryOf, workflowId);
      const own = new Set([retry.retryOf, ...(pred ? lineageJobsOf(db, pred).map((row) => row.job_id) : [])]);
      const statusOf = (id) => db.prepare('SELECT status FROM jobs WHERE job_id=?').get(id)?.status;
      const self = after.filter((prior) => statusOf(prior) !== 'succeeded' && (own.has(prior) || own.has(lineageHeadById(db, prior)?.row?.job_id)));
      if (self.length) throw Object.assign(new Error(`--after names ${self.join(', ')}, which is this job's own retry lineage (it retries ${retry.retryOf}): it would wait on itself; enqueue without that --after - a retry chains through its lineage`), { code: 'after-self-lineage' });
    }
    payload = {
      opId: args.op, records, owned_paths: ownedPaths, title: args.title ?? args.op, risk: args.risk ?? null,
      // --what: the short human name of the target (Vietnamese, ≤40 chars) the op-job display name shows.
      ...(typeof args.what === 'string' && args.what.trim() ? { displayWhat: args.what.replace(/\s+/g, ' ').trim().slice(0, 60) } : {}),
      ...(target.repository ? { repository: target.repository } : {}),
      ...(Object.keys(resolvedParams.params).length ? { params: resolvedParams.params } : {}),
      ...(cut ? { cut } : {}),
      ...(after.length ? { after } : {}),
      ...(retry ? { retry } : {}),
      ...(foundationLeg ? { foundation: foundationLeg } : {}),
      ...(contractChange ? { contractChange } : {}),
      ...(commitOnly ? { commitOnly } : {}),
      goal_binding: { revision: goal?.revision ?? null, identity: goal?.goal_identity ?? null },
      hierarchy: {
        schema: AGENT_HIERARCHY_SCHEMA,
        nodeId: operationNodeId(jobId),
        parentNodeId: kernelNodeId(workflowId),
        role: 'operation',
        workflowId,
        jobId,
        opId: args.op,
        attempt,
        generation: wf.generation ?? 0,
        runtime: { host: 'orca' },
      },
    };
    job = ledger.enqueueJob({ jobId, workflowId, opId: args.op, attempt, generation: wf.generation ?? 0, kind: 'op', role: 'op', payload, priority: seamPriorityOf(cut), createdAt: now });
    ledger.appendEvent({
      workflowId, entityType: 'job', entityId: jobId,
      kind: 'job-enqueued', payload: { opId: args.op, attempt, records: records.length, ownedPaths: ownedPaths.length, risk: payload.risk, cut, repository: payload.repository ?? null },
    });
    // The owner's config.yaml specs switch off this test class: the leg settles deferred at once, no attempt
    // spent, and the legs behind it proceed (scripts/kernel/spec-deferral.mjs; api run-deferred-tests runs it later).
    const deferral = testDeferralOf({ skillRoot, op: args.op, payload });
    if (deferral) {
      testsDeferred = deferJob(ledger, { job: { job_id: jobId, workflow_id: workflowId, op_id: args.op, attempt }, deferral, via: 'enqueue', now });
      if (testsDeferred) job = { ...job, status: 'succeeded' };
    }
    // Owned paths that overlap an open job of a running peer workflow: the
    // receipt names them and each such peer gets one heads-up. Never a refusal.
    peers = peerOverlapHeadsUp(ledger, { self: wf, jobId, op: args.op, ownedPaths, now, repo, payload });
  });

  const out = { ok: true, job_id: jobId, workflowId, op: args.op, status: job.status, attempt: job.attempt, cut, params: payload.params ?? null, repository: payload.repository ?? null,
    peerOverlap: peers.overlap, peerHeadsUp: peers.messages, ...(testsDeferred ? { deferred: testsDeferred } : {}),
    ...(foundationLeg ? { foundation: foundationLeg } : {}), ...(contractChange ? { contractChange } : {}), ...(foundationAdvisory ? { foundationAdvisory } : {}) };
  if (foundationAdvisory) process.stderr.write(`api: advisory: ${foundationAdvisory}\n`);
  emit(out, `enqueued ${jobId} (op ${args.op}, attempt ${job.attempt}, status ${job.status}${testsDeferred ? `, DEFERRED ${testsDeferred.reason}: not dispatched, no attempt spent; api run-deferred-tests --workflow ${workflowId} runs it later` : ''}${payload.repository ? `, repository ${payload.repository}` : ''}${cut ? `, cut ${cut.ordinal}/${cut.total} ${cut.id}` : ''}${payload.params ? `, params ${Object.entries(payload.params).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}` : ''})${peers.overlap.length ? `; overlaps peer job(s) ${[...new Set(peers.overlap.map((hit) => `${hit.workflowId}/${hit.jobId}`))].join(', ')}, heads-up sent to ${peers.messages.map((message) => message.to).join(', ') || 'nobody new'}` : ''}`, args.json);

  },
};
