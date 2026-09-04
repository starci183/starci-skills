// business.decide's own law over one branch, on top of the shared step check: the mode decides which
// half ran, and a reconcile branch binds the delivered source it reconciles against; the head is
// exactly one feature directory below the businesses root; the model, the response and the frozen
// matrix are the same decision read three ways; the lineage transition is legal and agrees with both
// states; an implemented head reconciles against delivered source with no discrepancy; the matrix
// carries exactly one row per declared dimension and no other; a mandatory dimension and a discovered
// lifecycle branch are never not-applicable; each disposition carries the substance it owes and no
// more; every enforcing row rests on a fact claim from claims.json; every discovered consumer is
// disposed once, under the dimension it was discovered in; a blocked branch publishes no head; and a
// promise the request supplies is restated in the person's words and confirmed by them before it is
// modelled (RESTATEMENT_UNCONFIRMED until the request carries the recorded choice).
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { sessionRootOf } from '../../scripts/validate-request.mjs';

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

// The restatement gate. A rule the person stated in one line is restated in their words and put back
// to them before any operator designs on it: `field` is the requirement restated, `id` keys the choice
// `restatement:<id>`, and `owed` says whether this request supplied the rule at all. Until the request
// carries that choice, the branch is blocked on RESTATEMENT_UNCONFIRMED with the typed question and
// nothing else written; once it does, a corrected reading arrives as a changed `field` and an
// as-stated one as the same `field`, both compared against the blocked branch the request resumes.
// The generic response gate already refuses a question on a done branch and a re-asked recorded choice;
// the request gate already checks the choice against state.json; neither is repeated here.
const RESTATEMENT_KIND = 'restatement-confirm';
const RESTATEMENT_OPTIONS = ['as-stated', 'corrected'];
const RESTATEMENT_STOP = 'RESTATEMENT_UNCONFIRMED';
const collapse = (s) => String(s ?? '').replace(/\\\|/g, '|').replace(/\s+/g, ' ').trim();
export async function restatementErrors({ branchDir, request, response, requirements, present, field, id, owed }) {
  const errors = [];
  const decisionId = `restatement:${id}`;
  const asked = response.status === 'blocked' && response.stop === RESTATEMENT_STOP;
  if (!owed) {
    if (present.has('restatement')) errors.push(`response/response.json: the request supplies no ${field}, so there is nothing to restate and fields.restatement is refused`);
    if (asked) errors.push(`response/response.json: the request supplies no ${field}, so no restatement is owed and ${RESTATEMENT_STOP} cannot be the stop`);
    return errors;
  }
  const file = path.join(branchDir, 'response', 'restatement.md');
  if (!present.has('restatement')) errors.push(`response/response.json: the request supplies ${field}, so fields.restatement names response/restatement.md whatever the status`);
  else if (existsSync(file)) {
    const text = await readFile(file, 'utf8');
    if ((text.split(/\r?\n/)[0] ?? '') !== `# restatement — ${id}`) errors.push(`response/restatement.md:1: the title names ${id}, the id the choice ${decisionId} is keyed by`);
    const source = fields(tableUnder(text, '## Source'));
    if (source.Field !== field) errors.push(`response/restatement.md: Source Field is ${source.Field ?? 'absent'}; the restated requirement is ${field}`);
    if (collapse(source.Quoted) !== collapse(requirements[field])) errors.push(`response/restatement.md: Source Quoted differs from the request's ${field}; the person's words are quoted verbatim`);
  }
  const confirmed = request?.decisionId === decisionId && !empty(request?.selectedOption);
  if (!confirmed) {
    if (!asked) errors.push(`response/response.json: the ${field} is restated and the request records no choice on ${decisionId}, so the branch ends blocked with ${RESTATEMENT_STOP}, not ${response.status}${response.stop ? ` ${response.stop}` : ''}`);
    const q = response.interaction;
    if (!q) errors.push(`response/response.json: a branch blocked on ${RESTATEMENT_STOP} carries interaction: kind ${RESTATEMENT_KIND}, decisionId ${decisionId}, options ${RESTATEMENT_OPTIONS.join(' and ')}`);
    else {
      if (q.kind !== RESTATEMENT_KIND) errors.push(`response/response.json: interaction.kind is ${q.kind}; a restatement is confirmed through ${RESTATEMENT_KIND}`);
      if (q.decisionId !== decisionId) errors.push(`response/response.json: interaction.decisionId is ${q.decisionId}; the restatement choice is keyed ${decisionId}`);
      const ids = (q.options ?? []).map((o) => o?.id).sort();
      if (ids.join() !== [...RESTATEMENT_OPTIONS].sort().join()) errors.push(`response/response.json: interaction.options are ${ids.join(', ') || 'none'}; a restatement offers exactly ${RESTATEMENT_OPTIONS.join(' and ')}`);
    }
    for (const kind of present) if (kind !== 'restatement') errors.push(`response/response.json: fields.${kind} is written before the restatement is confirmed; nothing is modelled on an unconfirmed reading`);
    return errors;
  }
  if (asked) errors.push(`response/response.json: the request carries the recorded choice ${request.selectedOption} on ${decisionId}, so the branch does not ask again with ${RESTATEMENT_STOP}`);
  if (!RESTATEMENT_OPTIONS.includes(request.selectedOption)) { errors.push(`request.json: selectedOption ${request.selectedOption} on ${decisionId} is neither ${RESTATEMENT_OPTIONS.join(' nor ')}`); return errors; }
  if (!request.resume) { errors.push(`request.json: a re-entry that answers ${decisionId} names the blocked branch in resume, so its ${field} can be compared against that branch's request`); return errors; }
  const resumed = `step-${request.resume.step}/parallel-${request.resume.parallel}`;
  const target = path.join(sessionRootOf(branchDir) ?? branchDir, resumed, 'request', 'request.json');
  if (!existsSync(target)) { errors.push(`request.json: resume names ${resumed}, whose request/request.json is missing, so the ${field} cannot be compared`); return errors; }
  let previous; try { previous = JSON.parse(await readFile(target, 'utf8')).requirements?.[field]; } catch { previous = undefined; }
  const same = collapse(previous) === collapse(requirements[field]);
  if (request.selectedOption === 'corrected' && same) errors.push(`request.json: selectedOption corrected carries the same ${field} as the blocked branch ${resumed}; a correction arrives as a changed ${field}`);
  if (request.selectedOption === 'as-stated' && !same) errors.push(`request.json: selectedOption as-stated carries a ${field} that differs from the blocked branch ${resumed}; a changed ${field} is a corrected reading`);
  return errors;
}

export async function validateBusinessStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { request, response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'business.decide') return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const mode = requirements.mode ?? 'model';
  const inputs = request?.inputs ?? {};

  // The promise is restated before it is modelled: owed whenever this request supplied one under mode model.
  errors.push(...await restatementErrors({ branchDir, request, response, requirements, present, field: 'promise', id: String(requirements.featureId ?? ''), owed: mode === 'model' && !empty(requirements.promise) }));

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
