// business.reconcile's own law over one branch, on top of the shared step check: the delivered source
// input is bound; the head is exactly one feature directory below the businesses root; the model, the
// receipt and the frozen matrix's fingerprint are the same reconciliation read three ways; the lineage
// transition is legal and agrees with both states; every fact claim binds the frozen source head and
// every row of the reconciliation rests on delivered evidence; a discrepancy stops the branch and
// publishes no head; an implemented head carries the reconciliation that earned it; and the head is
// published rather than merely written — archived under its content address and named by the index of
// the businesses root, with a lineage that is a chain of objects; and what the feature still has unchecked
// are carried in the receipt, with a journey entry keeping the head at in-progress rather than
// implemented, because a promise whose own journey was left partly unmeasured is not yet enforced.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { businessesRootOf, contentAddress, objectRef, openStore, verifyHeadPublication } from '../../scripts/business-registry.mjs';
import { hostRootOf } from '../../scripts/validate-request.mjs';
import { openUnchecked } from '../../scripts/unchecked.mjs';
import { ledgerKeyOf } from '../../scripts/record-unchecked.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OPERATOR = 'business.reconcile';
const LEGAL_TRANSITIONS = {
  'absent->pending': { from: null, to: 'pending' },
  'pending->in-progress': { from: 'pending', to: 'in-progress' },
  'pending->rejected': { from: 'pending', to: 'rejected' },
  'in-progress->implemented': { from: 'in-progress', to: 'implemented' },
  'in-progress->rejected': { from: 'in-progress', to: 'rejected' },
  'implemented->in-progress': { from: 'implemented', to: 'in-progress' },
  // A rebinding: the delivered source moved after the head was reconciled (a repair, a re-verification) and the
  // promise still holds with no discrepancy, so the head is republished implemented with its claims bound to
  // the new source head; only a reconciliation takes it, never a decision.
  'implemented->implemented': { from: 'implemented', to: 'implemented' },
  'implemented->rejected': { from: 'implemented', to: 'rejected' },
  'rejected->pending': { from: 'rejected', to: 'pending' },
};
// A reconciliation republishes an existing head: the transitions that start from nothing or end in a
// rejection are decisions about the promise, and belong to business.decide.
const RECONCILE_STATES = new Set(['implemented', 'in-progress']);
const BUSINESSES_ROOT = /\.worktrees\/businesses$/;
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const fields = (rows) => Object.fromEntries((rows ?? []).map(([k, v]) => [k, v]));

export async function validateReconcileStep(branchDir, root = ROOT, { uncheckedRoot = null } = {}) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { request, response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== OPERATOR) return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const inputs = request?.inputs ?? {};
  const delivered = inputs['backend-source-application'];
  const target = requirements.targetState;

  if (!empty(target) && !RECONCILE_STATES.has(target)) errors.push(`request.json: targetState ${target} is not one a reconciliation publishes; a head is reconciled into implemented or in-progress, and decided into anything else by business.decide`);
  for (const key of ['mode', 'promise', 'dimensions']) if (requirements[key] !== undefined) errors.push(`request.json: requirements.${key} belongs to business.decide; a reconciliation models nothing`);
  const discrepancyStop = response.status === 'blocked' && response.stop === 'RECONCILIATION_DISCREPANCY';
  if (response.status === 'blocked' && present.has('model')) errors.push('response/response.json: a blocked branch cannot publish a head');
  if (present.has('coverage-matrix')) errors.push('response/response.json: a reconciliation freezes no coverage matrix; the matrix is the one business.decide froze at the published head');
  if (discrepancyStop && !present.has('business-reconciliation')) errors.push('response/response.json: a branch blocked on RECONCILIATION_DISCREPANCY carries the reconciliation that names the discrepancy');

  let claims = new Map();
  let claimsDoc = null;
  if (present.has('claims') && has('response/data/claims.json')) {
    let doc = null;
    try { doc = JSON.parse(await read('response/data/claims.json')); } catch { doc = null; }
    if (doc) {
      claimsDoc = doc;
      if (!empty(requirements.featureId) && doc.featureId !== requirements.featureId) errors.push(`response/data/claims.json: featureId ${doc.featureId} differs from the request's ${requirements.featureId}`);
      for (const claim of doc.claims ?? []) {
        if (claims.has(claim.claimId)) errors.push(`response/data/claims.json: claim ${claim.claimId} is declared more than once`);
        claims.set(claim.claimId, claim);
        if (claim.lineEnd < claim.lineStart) errors.push(`response/data/claims.json: claim ${claim.claimId} has an inverted line range`);
        if (claim.kind === 'fact' && claim.sourceHead === null) errors.push(`response/data/claims.json: fact claim ${claim.claimId} must bind the observed source head`);
        if (claim.kind === 'contradiction') errors.push(`response/data/claims.json: claim ${claim.claimId} is a contradiction, which is a discrepancy against its dimension rather than a published claim`);
      }
      if (![...claims.values()].some((c) => c.kind === 'fact')) errors.push('response/data/claims.json: a reconciliation reads delivered source and carries at least one fact claim; a reconciliation with no fact is an opinion about code nobody read');
    }
  }

  let model = null;
  if (present.has('model') && has('response/data/model.json')) {
    try { model = JSON.parse(await read('response/data/model.json')); } catch { model = null; }
  }
  if (model) {
    if (!empty(requirements.featureId) && model.featureId !== requirements.featureId) errors.push(`response/data/model.json: featureId ${model.featureId} differs from the request's ${requirements.featureId}`);
    if (model.mode !== 'reconcile') errors.push(`response/data/model.json: mode ${model.mode} is not reconcile; this operator reconciles and models nothing`);
    if (!empty(target) && model.state !== target) errors.push(`response/data/model.json: state ${model.state} differs from the request's target ${target}`);
    const headRef = String(model.headRef ?? '');
    const cut = headRef.lastIndexOf('/features/');
    if (cut === -1) errors.push(`response/data/model.json: head ${headRef} must be exactly <businesses root>/features/${model.featureId}: the feature directory, with no project segment below the businesses root`);
    else {
      if (!BUSINESSES_ROOT.test(headRef.slice(0, cut))) errors.push(`response/data/model.json: head ${headRef} is not under a .worktrees/businesses root`);
      if (headRef.slice(cut + '/features/'.length) !== model.featureId) errors.push(`response/data/model.json: head ${headRef} must name the feature ${model.featureId}, with no project segment below the businesses root`);
    }
    const transition = LEGAL_TRANSITIONS[model.lineage.transition];
    if (!transition) errors.push(`response/data/model.json: transition ${model.lineage.transition} is not a legal lifecycle transition`);
    else {
      if (transition.from !== model.lineage.previousState) errors.push(`response/data/model.json: transition ${model.lineage.transition} contradicts previous state ${String(model.lineage.previousState)}`);
      if (transition.to !== model.state) errors.push(`response/data/model.json: transition ${model.lineage.transition} contradicts published state ${model.state}`);
    }
    if (model.lineage.previousState === null || model.lineage.previousHeadRef === null) errors.push('response/data/model.json: a reconciliation republishes an existing head and names the previous head and state; a first publication is business.decide\'s');
    if (model.coverageFingerprint === null) errors.push('response/data/model.json: a reconciled head carries the coverage fingerprint of the matrix it was compared against');
    if (claimsDoc && model.claimsFingerprint !== claimsDoc.fingerprint) errors.push('response/data/model.json: claimsFingerprint must equal the frozen claims fingerprint, or the head names claims nobody froze');
    if (model.reconciliation === null) errors.push('response/data/model.json: a reconciliation carries the reconciliation it performed');
    else if (model.reconciliation.discrepancies.length) errors.push(`response/data/model.json: ${model.reconciliation.discrepancies.length} discrepancy or discrepancies remain, so the branch is RECONCILIATION_DISCREPANCY and publishes no head`);
  } else if (response.status === 'done') errors.push('response/data/model.json: a done reconciliation republishes the head');

  // Publishing the head is this operator's job, not a person's follow-up: a done branch has archived
  // the model under its content address and named it in the index of the same businesses root, or the
  // feature directory says implemented while every other reader still sees the head it replaced. The
  // whole law lives in scripts/business-registry.mjs, so the operator that writes it and the validator
  // that reads it back cannot drift apart.
  const publishedRoot = model && response.status === 'done' ? businessesRootOf(String(model.headRef ?? '')) : null;
  if (publishedRoot && claimsDoc) errors.push(...verifyHeadPublication({ store: openStore(publishedRoot), featureId: model.featureId, model, claims: claimsDoc }));

  if (present.has('business-reconciliation') && has('response/response.md')) {
    const text = await read('response/response.md');
    const binding = fields(tableUnder(text, '## Binding'));
    const lineage = fields(tableUnder(text, '## Lineage'));
    if (!empty(requirements.featureId) && binding.Feature !== requirements.featureId) errors.push(`response/response.md: Feature ${binding.Feature} differs from the request's ${requirements.featureId}`);
    if (!empty(target) && binding['Target state'] !== target) errors.push(`response/response.md: Target state ${binding['Target state']} differs from the request's ${target}`);
    if (!empty(delivered) && binding['Delivered source'] !== delivered) errors.push(`response/response.md: Delivered source ${binding['Delivered source']} is not the backend-source-application input ${delivered} the request bound`);
    if (model) {
      if (binding.Head !== model.headRef) errors.push(`response/response.md: Head ${binding.Head} differs from the published head ${model.headRef}`);
      if (lineage.Transition !== model.lineage.transition) errors.push(`response/response.md: Transition ${lineage.Transition} differs from the model's ${model.lineage.transition}`);
      if (lineage['Previous head'] !== model.lineage.previousHeadRef) errors.push(`response/response.md: Previous head ${lineage['Previous head']} differs from the model's ${String(model.lineage.previousHeadRef)}`);
      // The receipt names the object the head was archived under, so a reader who has only this file
      // can find the head in the store without recomputing an address.
      const root = businessesRootOf(String(model.headRef ?? ''));
      const expected = root ? objectRef(root, contentAddress(model)) : null;
      if (expected && lineage['Head object'] !== expected) errors.push(`response/response.md: Head object ${lineage['Head object']} is not the archived object of the published head, ${expected}`);
      if (binding['Claims fingerprint'] !== model.claimsFingerprint) errors.push('response/response.md: Claims fingerprint must equal the model claimsFingerprint');
      if (binding['Coverage fingerprint'] !== model.coverageFingerprint) errors.push('response/response.md: Coverage fingerprint must equal the model coverageFingerprint, or backend and UAT cannot correlate the same matrix');
    }
    const cited = new Set();
    for (const [claim, kind] of tableUnder(text, '## Cited claims') ?? []) {
      if (cited.has(claim)) errors.push(`response/response.md: cited claim ${claim} is listed more than once`);
      cited.add(claim);
      if (claims.size) {
        const record = claims.get(claim);
        if (!record) errors.push(`response/response.md: cited claim ${claim} is absent from claims.json`);
        else if (record.kind !== kind) errors.push(`response/response.md: claim ${claim} is ${kind} here and ${record.kind} in claims.json`);
      }
    }
    for (const claimId of claims.keys()) if (!cited.has(claimId)) errors.push(`response/response.md: claims.json carries ${claimId}, which Cited claims omits`);
    const rows = tableUnder(text, '## Reconciliation') ?? [];
    const dimensions = new Set();
    let standing = 0;
    for (const [dimension, evidence, discrepancy] of rows) {
      if (dimensions.has(dimension)) errors.push(`response/response.md: dimension ${dimension} is reconciled more than once`);
      dimensions.add(dimension);
      if (empty(evidence)) errors.push(`response/response.md: reconciliation of ${dimension} names no delivered evidence`);
      if (!empty(discrepancy)) { standing += 1; if (response.status === 'done') errors.push(`response/response.md: a republished head cannot carry the unresolved reconciliation discrepancy on ${dimension}`); }
    }
    if (model?.reconciliation && standing !== model.reconciliation.discrepancies.length) errors.push(`response/response.md: Reconciliation names ${standing} standing discrepancy or discrepancies, the model carries ${model.reconciliation.discrepancies.length}`);
    if (discrepancyStop && standing === 0) errors.push('response/response.md: the branch stopped on RECONCILIATION_DISCREPANCY and the reconciliation names no discrepancy; a stop names what stands');
    // What was promised is compared with what was delivered, and coverage nobody took is part of that
    // comparison: a promise proved over three surfaces of five was proved over three. The Unchecked table
    // is the feature's open coverage ledger (@worktrees/unchecked, scripts/unchecked.mjs) copied into the
    // receipt, so the reader of a reconciliation sees the delivery's limits beside its claims. An entry
    // of tier `journey` — a state of a surface the journey itself passes through, left unmeasured —
    // means the delivery does not yet enforce the promise end to end, and `implemented` is not the
    // state that describes it; the head is republished `in-progress`, which is the vocabulary the
    // lifecycle already has for a promise carried as far as it has been carried.
    const { product, featureId } = await ledgerKeyOf(branchDir);
    if (product && featureId) {
      const open = await openUnchecked(uncheckedRoot ?? hostRootOf(root), product, featureId);
      const listed = new Set((tableUnder(text, '## Unchecked') ?? []).map(([unit, state]) => `${unit}|${state}`));
      for (const d of open) {
        const key = `${d.unit}|${d.state === null ? '—' : d.state}`;
        if (!listed.has(key)) errors.push(`response/response.md: Unchecked omits the open ${d.lane} entry on ${d.unit}${d.state ? `/${d.state}` : ''} the feature still carries; a reconciliation states the limits of the delivery beside its claims`);
      }
      if (response.status === 'done' && target === 'implemented' && open.some((d) => d.tier === 'journey')) {
        errors.push(`response/response.md: the head is republished implemented while the feature carries an open journey entry (${open.filter((d) => d.tier === 'journey').map((d) => `${d.unit}/${d.state}`).join(', ')}); a promise whose own journey was left partly unmeasured is carried as in-progress, not declared enforced`);
      }
    }
    if (response.status === 'done') for (const [code, severity] of tableUnder(text, '## Findings') ?? []) if (severity === 'error') errors.push(`response/response.md: finding ${code} is still an open error, so the head cannot be republished`);
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateReconcileStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write(`valid ${OPERATOR} branch\n`);
}
