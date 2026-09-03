// business.decide's own law over one branch, on top of the shared step check: the mode decides which
// half ran, and a reconcile branch binds the delivered source it reconciles against; the head is
// exactly one feature directory below the businesses root; the model, the response and the frozen
// matrix are the same decision read three ways; the lineage transition is legal and agrees with both
// states; an implemented head reconciles against delivered source with no discrepancy; the matrix
// carries exactly one row per declared dimension and no other; a mandatory dimension and a discovered
// lifecycle branch are never not-applicable; each disposition carries the substance it owes and no
// more; every enforcing row rests on a fact claim from claims.json; every discovered consumer is
// disposed once, under the dimension it was discovered in; and a blocked branch publishes no head.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// A promise always has an actor, an entry, a purchase effect, a settlement, an idempotency answer, an
// entitlement consumer, and a denial path. Marking one of these not-applicable, once it is declared,
// is how "full access" was published while its downstream consumers were never proved.
const MANDATORY_DIMENSIONS = new Set([
  'actor-eligibility', 'offer-entry', 'read-entry', 'purchase-side-effect', 'settlement',
  'idempotency', 'entitlement-consumer', 'denial',
]);
const LEGAL_TRANSITIONS = {
  'absent->pending': { from: null, to: 'pending' },
  'pending->in-progress': { from: 'pending', to: 'in-progress' },
  'pending->rejected': { from: 'pending', to: 'rejected' },
  'in-progress->implemented': { from: 'in-progress', to: 'implemented' },
  'in-progress->rejected': { from: 'in-progress', to: 'rejected' },
  'implemented->in-progress': { from: 'implemented', to: 'in-progress' },
  'implemented->rejected': { from: 'implemented', to: 'rejected' },
  'rejected->pending': { from: 'rejected', to: 'pending' },
};
const BUSINESSES_ROOT = /\.worktrees\/businesses$/;
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const fields = (rows) => Object.fromEntries((rows ?? []).map(([k, v]) => [k, v]));

export async function validateBusinessStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { request, response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'business.decide') return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const mode = requirements.mode ?? 'model';
  const inputs = request?.inputs ?? {};

  // The Inputs table cannot say "required under one mode", so the mode says it here.
  if (mode === 'reconcile' && empty(inputs['backend-source-application'])) {
    errors.push('request.json: mode reconcile reconciles against delivered source, so input backend-source-application is required');
  }
  if (mode === 'model' && !empty(inputs['backend-source-application'])) {
    errors.push('request.json: mode model models the promise and reads no delivered source, so input backend-source-application is refused');
  }

  // A blocked branch publishes no head and freezes no coverage fingerprint.
  if (response.status === 'blocked') {
    if (present.has('coverage-matrix')) errors.push('response/response.json: a blocked branch cannot freeze a coverage matrix');
    if (present.has('model')) errors.push('response/response.json: a blocked branch cannot publish a head');
  }
  if (response.status === 'done' && mode === 'model' && !present.has('coverage-matrix')) {
    errors.push('response/response.json: mode model freezes the coverage matrix, so coverage-matrix must be in fields');
  }
  if (mode === 'reconcile' && present.has('coverage-matrix')) {
    errors.push('response/response.json: mode reconcile models nothing, so it may not freeze a new coverage matrix');
  }

  const declaredDimensions = Array.isArray(requirements.dimensions) ? requirements.dimensions : [];

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
        if (claim.kind === 'contradiction') errors.push(`response/data/claims.json: claim ${claim.claimId} is a contradiction, which stops the branch with CONTRADICTION_UNRESOLVED rather than being published`);
      }
    }
  }

  let matrix = null;
  if (present.has('coverage-matrix') && has('response/data/coverage-matrix.json')) {
    try { matrix = JSON.parse(await read('response/data/coverage-matrix.json')); } catch { matrix = null; }
  }

  if (matrix) {
    if (!empty(requirements.featureId) && matrix.featureId !== requirements.featureId) {
      errors.push(`response/data/coverage-matrix.json: featureId ${matrix.featureId} differs from the request's ${requirements.featureId}`);
    }
    if (declaredDimensions.length) {
      for (const dimension of declaredDimensions) if (!matrix.dimensions.includes(dimension)) errors.push(`response/data/coverage-matrix.json: the request declared dimension ${dimension}, which the matrix does not carry`);
      for (const dimension of matrix.dimensions) if (!declaredDimensions.includes(dimension)) errors.push(`response/data/coverage-matrix.json: dimension ${dimension} was never declared by the request`);
    }
    const rowByDimension = new Map();
    for (const row of matrix.rows) {
      if (rowByDimension.has(row.dimension)) errors.push(`response/data/coverage-matrix.json: coverage dimension ${row.dimension} appears in more than one row`);
      rowByDimension.set(row.dimension, row);
      if (!matrix.dimensions.includes(row.dimension)) errors.push(`response/data/coverage-matrix.json: row ${row.dimension} is not one of the declared dimensions`);
    }
    for (const dimension of matrix.dimensions) {
      if (!rowByDimension.has(dimension)) errors.push(`response/data/coverage-matrix.json: coverage dimension ${dimension} has no disposition`);
    }

    const consumerIds = new Set();
    for (const consumer of matrix.discoveredConsumers) {
      if (consumerIds.has(consumer.consumerId)) errors.push(`response/data/coverage-matrix.json: discovered consumer ${consumer.consumerId} is declared more than once`);
      consumerIds.add(consumer.consumerId);
    }

    const claimedConsumers = new Map();
    for (const row of matrix.rows) {
      const { dimension, disposition } = row;
      if (disposition === 'not-applicable' && MANDATORY_DIMENSIONS.has(dimension)) {
        errors.push(`response/data/coverage-matrix.json: ${dimension} is mandatory for a published promise and cannot be marked not-applicable`);
      }
      if (disposition === 'preserve' || disposition === 'replace') {
        if (row.enforcementOwner === null) errors.push(`response/data/coverage-matrix.json: ${dimension} names no enforcement owner`);
        if (row.sourceRef === null) errors.push(`response/data/coverage-matrix.json: ${dimension} names no enforcing source`);
        if (row.positiveProofRef === null) errors.push(`response/data/coverage-matrix.json: ${dimension} has no positive proof`);
        if (row.negativeProofRef === null) errors.push(`response/data/coverage-matrix.json: ${dimension} has no negative proof, so nothing shows the promise is denied when it should be`);
      }
      if (disposition === 'retire') {
        if (row.enforcementOwner === null) errors.push(`response/data/coverage-matrix.json: retired ${dimension} names no owner of the retirement`);
        if (row.sourceRef === null) errors.push(`response/data/coverage-matrix.json: retired ${dimension} names no source where the path was closed`);
        if (row.positiveProofRef === null) errors.push(`response/data/coverage-matrix.json: retired ${dimension} has no proof the path is closed`);
      }
      if (disposition === 'defer') {
        if (row.deferralRef === null) errors.push(`response/data/coverage-matrix.json: deferred ${dimension} names no deferral owner reference`);
        if (row.positiveProofRef !== null || row.negativeProofRef !== null) errors.push(`response/data/coverage-matrix.json: deferred ${dimension} cannot claim proof for work that has not happened`);
      }
      if (disposition === 'not-applicable' && (row.enforcementOwner !== null || row.sourceRef !== null || row.positiveProofRef !== null || row.negativeProofRef !== null || row.deferralRef !== null || row.consumerIds.length > 0 || row.claimIds.length > 0)) {
        errors.push(`response/data/coverage-matrix.json: ${dimension} is marked not-applicable but still carries owners, proof, consumers, or claims`);
      }
      for (const consumerId of row.consumerIds) {
        if (claimedConsumers.has(consumerId)) errors.push(`response/data/coverage-matrix.json: consumer ${consumerId} is disposed in more than one row`);
        claimedConsumers.set(consumerId, dimension);
      }
      // An example or a screenshot illustrates a promise; it never creates one.
      if (claims.size) {
        for (const claimId of row.claimIds) if (!claims.has(claimId)) errors.push(`response/data/coverage-matrix.json: ${dimension} cites claim ${claimId}, which claims.json does not carry`);
        if (disposition === 'preserve' || disposition === 'replace' || disposition === 'retire') {
          if (!row.claimIds.some((claimId) => claims.get(claimId)?.kind === 'fact')) errors.push(`response/data/coverage-matrix.json: ${dimension} asserts enforcement without one fact claim; examples and intent never create product truth`);
        }
      }
    }

    // The rule the "full access" release lacked: nothing discovered may pass without a disposition.
    for (const consumer of matrix.discoveredConsumers) {
      const disposedAt = claimedConsumers.get(consumer.consumerId);
      if (disposedAt === undefined) errors.push(`response/data/coverage-matrix.json: discovered consumer ${consumer.consumerId} has no disposition in the coverage matrix`);
      else if (disposedAt !== consumer.dimension) errors.push(`response/data/coverage-matrix.json: discovered consumer ${consumer.consumerId} was discovered under ${consumer.dimension} but disposed under ${disposedAt}`);
    }
    for (const consumerId of claimedConsumers.keys()) {
      if (!matrix.discoveredConsumers.some((item) => item.consumerId === consumerId)) errors.push(`response/data/coverage-matrix.json: row consumer ${consumerId} was never discovered, so no evidence supports it`);
    }
    for (const branch of matrix.discoveredLifecycleBranches) {
      const row = rowByDimension.get(branch);
      if (!row) errors.push(`response/data/coverage-matrix.json: lifecycle branch ${branch} was discovered in the source and has no disposition`);
      else if (row.disposition === 'not-applicable') errors.push(`response/data/coverage-matrix.json: lifecycle branch ${branch} was discovered in the source and cannot be marked not-applicable`);
    }
  }

  let model = null;
  if (present.has('model') && has('response/data/model.json')) {
    try { model = JSON.parse(await read('response/data/model.json')); } catch { model = null; }
  }
  if (model) {
    if (!empty(requirements.featureId) && model.featureId !== requirements.featureId) errors.push(`response/data/model.json: featureId ${model.featureId} differs from the request's ${requirements.featureId}`);
    if (model.mode !== mode) errors.push(`response/data/model.json: mode ${model.mode} differs from the request's ${mode}`);
    if (!empty(requirements.targetState) && model.state !== requirements.targetState) errors.push(`response/data/model.json: state ${model.state} differs from the request's target ${requirements.targetState}`);

    // The head is one flat segment below the businesses root, and the root is the businesses worktree.
    const headRef = String(model.headRef ?? '');
    const cut = headRef.lastIndexOf('/features/');
    if (cut === -1) errors.push(`response/data/model.json: head ${headRef} must be exactly <businesses root>/features/${model.featureId}: the feature directory, with no project segment below the businesses root`);
    else {
      if (!BUSINESSES_ROOT.test(headRef.slice(0, cut))) errors.push(`response/data/model.json: head ${headRef} is not under a .worktrees/businesses root`);
      if (headRef.slice(cut + '/features/'.length) !== model.featureId) errors.push(`response/data/model.json: head ${headRef} must name the feature ${model.featureId}, with no project segment below the businesses root`);
    }

    // Lifecycle. A state that arrives through an unlisted transition has no lineage behind it.
    const transition = LEGAL_TRANSITIONS[model.lineage.transition];
    if (!transition) errors.push(`response/data/model.json: transition ${model.lineage.transition} is not a legal lifecycle transition`);
    else {
      if (transition.from !== model.lineage.previousState) errors.push(`response/data/model.json: transition ${model.lineage.transition} contradicts previous state ${String(model.lineage.previousState)}`);
      if (transition.to !== model.state) errors.push(`response/data/model.json: transition ${model.lineage.transition} contradicts published state ${model.state}`);
    }
    if (model.lineage.previousState === null && model.lineage.previousHeadRef !== null) errors.push('response/data/model.json: a first publication cannot name a previous head');
    if (model.lineage.previousState !== null && model.lineage.previousHeadRef === null) errors.push('response/data/model.json: a transition from an existing state must name the previous head, because rejection preserves lineage');

    if (matrix && model.coverageFingerprint !== matrix.fingerprint) errors.push('response/data/model.json: coverageFingerprint must equal the frozen matrix fingerprint, or backend and UAT cannot correlate the same matrix');
    if (claimsDoc && model.claimsFingerprint !== claimsDoc.fingerprint) errors.push('response/data/model.json: claimsFingerprint must equal the frozen claims fingerprint, or the head names claims nobody froze');
    if (mode === 'model' && model.reconciliation !== null) errors.push('response/data/model.json: mode model reconciles nothing, so reconciliation must be null');
    if (mode === 'reconcile') {
      if (model.reconciliation === null) errors.push('response/data/model.json: mode reconcile must carry the reconciliation it performed');
      else if (response.status === 'done' && model.reconciliation.discrepancies.length) errors.push(`response/data/model.json: ${model.reconciliation.discrepancies.length} reconciliation discrepancy or discrepancies remain, so the branch is RECONCILIATION_DISCREPANCY rather than done`);
    }
    // implemented is never published on the strength of a plan.
    if (model.state === 'implemented' && model.reconciliation === null) errors.push('response/data/model.json: an implemented head requires reconciliation against delivered source');
  }

  if (present.has('business-promise-authority') && has('response/response.md')) {
    const text = await read('response/response.md');
    const binding = fields(tableUnder(text, '## Binding'));
    const lineage = fields(tableUnder(text, '## Lineage'));
    const featureId = binding.Feature;

    if (!empty(requirements.featureId) && featureId !== requirements.featureId) errors.push(`response/response.md: Feature ${featureId} differs from the request's ${requirements.featureId}`);
    if (binding.Mode !== mode) errors.push(`response/response.md: Mode ${binding.Mode} differs from the request's ${mode}`);
    if (!empty(requirements.targetState) && binding['Target state'] !== requirements.targetState) errors.push(`response/response.md: Target state ${binding['Target state']} differs from the request's ${requirements.targetState}`);
    if (model) {
      if (binding.Head !== model.headRef) errors.push(`response/response.md: Head ${binding.Head} differs from the published head ${model.headRef}`);
      if (lineage.Transition !== model.lineage.transition) errors.push(`response/response.md: Transition ${lineage.Transition} differs from the model's ${model.lineage.transition}`);
      if (binding['Claims fingerprint'] !== model.claimsFingerprint) errors.push('response/response.md: Claims fingerprint must equal the model claimsFingerprint');
    }
    if (matrix) {
      if (binding['Coverage fingerprint'] !== matrix.fingerprint) errors.push('response/response.md: Coverage fingerprint must equal the coverage matrix fingerprint, or backend and UAT cannot correlate the same matrix');
      if (featureId !== matrix.featureId) errors.push(`response/response.md: Feature ${featureId} differs from the matrix feature ${matrix.featureId}`);
    }

    // Cited claims: the response says exactly what claims.json holds, read by a person.
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

    // The response table and the frozen matrix are the same decision, read two ways.
    const mdRows = tableUnder(text, '## Coverage') ?? [];
    if (matrix) {
      if (mdRows.length !== matrix.rows.length) errors.push(`response/response.md: Coverage has ${mdRows.length} rows, the matrix has ${matrix.rows.length}`);
      const byDimension = new Map(matrix.rows.map((r) => [r.dimension, r]));
      for (const [dimension, disposition] of mdRows) {
        const row = byDimension.get(dimension);
        if (!row) { errors.push(`response/response.md: Coverage names dimension ${dimension}, which the matrix does not carry`); continue; }
        if (row.disposition !== disposition) errors.push(`response/response.md: ${dimension} is ${disposition} here and ${row.disposition} in the matrix`);
      }
    } else if (mdRows.length) errors.push('response/response.md: Coverage carries rows, but no coverage matrix was frozen in this mode');

    const reconciliation = tableUnder(text, '## Reconciliation') ?? [];
    if (mode === 'reconcile') {
      if (reconciliation.length === 0) errors.push('response/response.md: a reconcile branch requires reconciliation against delivered source');
      for (const [dimension, delivered, discrepancy] of reconciliation) {
        if (empty(delivered)) errors.push(`response/response.md: reconciliation of ${dimension} names no delivered evidence`);
        if (!empty(discrepancy) && response.status === 'done') errors.push(`response/response.md: a published head cannot carry the unresolved reconciliation discrepancy on ${dimension}`);
      }
    } else if (reconciliation.length) errors.push('response/response.md: mode model reconciles nothing, so Reconciliation carries no rows');

    // A published receipt cannot retain an error finding.
    if (response.status === 'done') {
      for (const [code, severity] of tableUnder(text, '## Findings') ?? []) {
        if (severity === 'error') errors.push(`response/response.md: finding ${code} is still an open error, so the promise cannot be published`);
      }
    }
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateBusinessStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid business.decide branch\n');
}
