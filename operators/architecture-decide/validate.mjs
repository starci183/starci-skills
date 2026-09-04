// architecture.decide's own law over one branch, on top of the shared step check: exactly one selected
// alternative that the response names; the number of alternatives the person asked for; approval
// binds the selection under approval-required and is absent under automatic; every store has an
// owner among its writers and shared writes are justified; retained components are verified on all
// five axes or carry the COMPATIBILITY_UNVERIFIED fallback; the critique came from the nested
// exchange, attacks the selected alternative, and a failing attack cannot end in status done; the
// handoff names contracts, never implementation files; every declared operation is named once, names a
// writer, cites at least one business dimension, and is restated by the receipt's Operations table;
// and the objective is restated in the person's words and confirmed by them before anything is
// observed or designed (RESTATEMENT_UNCONFIRMED until the request carries the recorded choice).
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';
import { validateMigrationOperation } from '../../scripts/migration-operation.mjs';
import { restatementErrors } from '../business-decide/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const AXES = ['runtime-version', 'deployable-unit', 'communication-failure', 'datastore-ownership', 'backup-restore'];
const IMPLEMENTATION_FILE = /\b[\w./-]+\.(ts|tsx|js|jsx|mjs|cjs|py|go|java|rb|rs|php|sql)\b/i;
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
// The Requirements default of decisionId: the slug of the objective, computed here so the choice key
// restatement:<decisionId> resolves when the request leaves the field to its default.
const slug = (s) => String(s ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export async function validateArchitectureStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { request, response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'architecture.decide') return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  // The objective is restated before it is designed: every request supplies one, and the promise's
  // confirmation in business.decide does not transfer to the architecture's own reading.
  const decisionId = empty(requirements.decisionId) ? slug(requirements.objective) : String(requirements.decisionId);
  errors.push(...await restatementErrors({ branchDir, request, response, requirements, present, field: 'objective', id: decisionId, owed: !empty(requirements.objective) }));
  const wanted = Number(requirements.alternatives ?? 1);
  const policy = requirements.selectionPolicy ?? 'automatic';
  const approval = requirements.approval;
  if (policy === 'automatic' && !empty(approval)) errors.push('request.json: approval is bound under automatic policy; supplying both hides which one decided');

  let model = null;
  if (present.has('stack-model') && has('response/data/stack-model.json')) { try { model = JSON.parse(await read('response/data/stack-model.json')); } catch { model = null; } }
  if (model) {
    const selected = model.alternatives.filter((a) => a.status === 'selected');
    if (selected.length !== 1) errors.push(`response/data/stack-model.json: exactly one alternative must be selected, found ${selected.length}`);
    else if (selected[0].alternativeId !== model.selectedAlternativeId) errors.push('response/data/stack-model.json: selectedAlternativeId names an alternative that is not the selected one');
    if (model.alternatives.length !== wanted) errors.push(`response/data/stack-model.json: ${model.alternatives.length} alternatives, but the request asked for ${wanted}`);
    const axes = Array.isArray(requirements.tradeoffAxes) ? requirements.tradeoffAxes : String(requirements.tradeoffAxes ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    for (const a of model.alternatives) {
      if (a.status === 'rejected' && !a.rejectedBecause) errors.push(`response/data/stack-model.json: ${a.alternativeId} is rejected without a reason`);
      if (a.status === 'selected' && a.rejectedBecause) errors.push(`response/data/stack-model.json: ${a.alternativeId} is selected and carries a rejection reason`);
      if (wanted > 1) for (const ax of axes) if (a.scores[ax] === undefined) errors.push(`response/data/stack-model.json: ${a.alternativeId} is not scored on ${ax}`);
    }
    if (wanted > 1 && !present.has('alternatives')) errors.push('response/response.json: more than one alternative was asked for but no alternatives page is in fields');
    if (policy === 'approval-required' && response.status === 'done') {
      if (empty(approval)) errors.push('response/response.json: approval-required with no approval cannot end done; CHOICE_REQUIRED terminates here');
      else if (approval !== model.selectedAlternativeId) errors.push(`response/data/stack-model.json: selected ${model.selectedAlternativeId} but approval names ${approval}`);
    }
    const boundaries = new Map(model.boundaries.map((b) => [b.boundaryId, b]));
    const owned = new Map();
    for (const s of model.stores) {
      if (!boundaries.has(s.owningBoundaryId)) errors.push(`response/data/stack-model.json: store ${s.storeId} is owned by unknown boundary ${s.owningBoundaryId}`);
      if (!s.writers.includes(s.owningBoundaryId)) errors.push(`response/data/stack-model.json: store ${s.storeId} owner ${s.owningBoundaryId} is not among its writers`);
      if (s.writers.length > 1 && !s.sharedWriteJustification) errors.push(`response/data/stack-model.json: store ${s.storeId} has ${s.writers.length} writers and no shared-write justification`);
      if (s.writers.length === 1 && s.sharedWriteJustification) errors.push(`response/data/stack-model.json: store ${s.storeId} has one writer and a shared-write justification`);
      owned.set(s.owningBoundaryId, (owned.get(s.owningBoundaryId) ?? 0) + 1);
    }
    for (const b of model.boundaries) {
      const n = owned.get(b.boundaryId) ?? 0;
      if (b.ownsData && n === 0) errors.push(`response/data/stack-model.json: boundary ${b.boundaryId} claims data and owns no store`);
      if (!b.ownsData && n > 0) errors.push(`response/data/stack-model.json: boundary ${b.boundaryId} claims no data and owns ${n} store(s)`);
    }
    const seenOperations = new Set();
    for (const o of model.operations ?? []) {
      errors.push(...await validateMigrationOperation(root, o, `response/data/stack-model.json: operation ${o.operationId}`));
      if (seenOperations.has(o.operationId)) errors.push(`response/data/stack-model.json: operation ${o.operationId} is declared twice`);
      seenOperations.add(o.operationId);
      for (const storeRef of o.storeRefs) if (!model.stores.some((st) => st.storeId === storeRef)) errors.push(`response/data/stack-model.json: operation ${o.operationId} names store ${storeRef}, which this decision does not own`);
      if (o.transactionBoundary === 'read-only' && o.migrationRefs.length) errors.push(`response/data/stack-model.json: operation ${o.operationId} is read-only and ships a migration`);
      if (o.transport === 'event-consumer' && o.idempotencyKind === 'none') errors.push(`response/data/stack-model.json: operation ${o.operationId} consumes events with no idempotency, so a redelivery applies it twice`);
    }
    const fallbacks = new Set(response.fallbacks ?? []);
    for (const c of model.components) {
      if (c.status === 'removed') { if (c.compatibility.length) errors.push(`response/data/stack-model.json: removed component ${c.componentId} carries a compatibility verdict`); continue; }
      if (!c.justification) errors.push(`response/data/stack-model.json: ${c.componentId} has no justification`);
      const verified = new Set(c.compatibility.filter((v) => v.verified && v.evidence).map((v) => v.axis));
      if (c.status === 'replaced-candidate') { if (!fallbacks.has('COMPATIBILITY_UNVERIFIED')) errors.push(`response/data/stack-model.json: ${c.componentId} is replaced-candidate but response.json lists no COMPATIBILITY_UNVERIFIED fallback`); continue; }
      const missing = AXES.filter((ax) => !verified.has(ax));
      if (missing.length) errors.push(`response/data/stack-model.json: ${c.componentId} is ${c.status} with compatibility unverified on ${missing.join(', ')}; mark it replaced-candidate under the COMPATIBILITY_UNVERIFIED fallback or terminate`);
    }
  }

  if (present.has('architecture-decision') && has('response/response.md')) {
    const text = await read('response/response.md');
    const decision = Object.fromEntries((tableUnder(text, '## Decision') ?? []).map(([k, v]) => [k, v]));
    if (model && decision['Selected alternative'] !== model.selectedAlternativeId) errors.push(`response/response.md: Decision names ${decision['Selected alternative']} but stack-model selected ${model.selectedAlternativeId}`);
    if (decision['Selection policy'] !== policy) errors.push(`response/response.md: Selection policy ${decision['Selection policy']} differs from the request's ${policy}`);
    if (!empty(requirements.decisionId) && decision['Decision id'] !== requirements.decisionId) errors.push('response/response.md: Decision id differs from the request');
    const alts = tableUnder(text, '## Alternatives') ?? [];
    if (model && alts.length !== model.alternatives.length) errors.push(`response/response.md: Alternatives has ${alts.length} rows, stack-model has ${model.alternatives.length}`);
    const operationRows = tableUnder(text, '## Operations') ?? [];
    if (model) {
      const declared = new Map((model.operations ?? []).map((o) => [o.operationId, o]));
      if (operationRows.length !== declared.size) errors.push(`response/response.md: Operations has ${operationRows.length} rows, stack-model declares ${declared.size}`);
      for (const [operationId, transport, writer, stores, transaction, idempotency, dimensions] of operationRows) {
        const id = String(operationId).replace(/`/g, '');
        const o = declared.get(id);
        if (!o) { errors.push(`response/response.md: Operations names ${id}, which stack-model does not declare`); continue; }
        if (transport !== o.transport) errors.push(`response/response.md: operation ${id} reports transport ${transport}, stack-model declares ${o.transport}`);
        if (String(writer).replace(/`/g, '') !== o.writerRef) errors.push(`response/response.md: operation ${id} names another writer than stack-model`);
        if (transaction !== o.transactionBoundary) errors.push(`response/response.md: operation ${id} reports transaction ${transaction}, stack-model declares ${o.transactionBoundary}`);
        if (idempotency !== o.idempotencyKind) errors.push(`response/response.md: operation ${id} reports idempotency ${idempotency}, stack-model declares ${o.idempotencyKind}`);
        const cited = String(dimensions).split(',').map((v) => v.trim().replace(/`/g, '')).filter(Boolean);
        for (const dimensionId of cited) if (!o.authorityDimensionIds.includes(dimensionId)) errors.push(`response/response.md: operation ${id} cites dimension ${dimensionId}, which stack-model does not declare`);
        for (const dimensionId of o.authorityDimensionIds) if (!cited.includes(dimensionId)) errors.push(`response/response.md: operation ${id} does not restate declared dimension ${dimensionId}`);
        const declaredStores = String(stores).split(',').map((v) => v.trim().replace(/`/g, '')).filter((v) => v && v !== '—');
        for (const storeRef of o.storeRefs) if (!declaredStores.includes(storeRef)) errors.push(`response/response.md: operation ${id} does not restate store ${storeRef}`);
      }
    }
    for (const [item, kind, detail] of tableUnder(text, '## Handoff') ?? []) if (kind === 'contract' && IMPLEMENTATION_FILE.test(detail)) errors.push(`response/response.md: handoff contract "${item}" names an implementation file`);
    for (const [component, status] of tableUnder(text, '## Stack delta') ?? []) if (status === 'replaced-candidate' && !(response.fallbacks ?? []).includes('COMPATIBILITY_UNVERIFIED')) errors.push(`response/response.md: ${component} is replaced-candidate without the COMPATIBILITY_UNVERIFIED fallback`);
  }

  if (present.has('independent-critique') && has('critique/response/critique.md')) {
    const text = await read('critique/response/critique.md');
    const attacks = tableUnder(text, '## Attacks') ?? [];
    const failing = attacks.filter((r) => r[3] === 'fails').map((r) => r[0]);
    const verdict = Object.fromEntries((tableUnder(text, '## Verdict') ?? []).map(([k, v]) => [k, v]));
    if (response.status === 'done' && failing.length) errors.push(`critique/response/critique.md: attacks ${failing.join(', ')} fail; a done branch needs every attack to hold (CRITIQUE_UNRESOLVED or NO_VIABLE_ALTERNATIVE otherwise)`);
    if (response.status === 'done' && verdict.Selection === 'return') errors.push('critique/response/critique.md: the critique returns the selection, so the branch cannot be done');
    const exec = Object.fromEntries((tableUnder(text, '## Execution') ?? []).map(([k, v]) => [k, v]));
    if (exec['Inherited turns'] !== 'none') errors.push('critique/response/critique.md: the critique must be a fresh execution with no inherited turns');
    if (has('critique/request/request.json')) {
      const creq = JSON.parse(await read('critique/request/request.json'));
      const given = Object.values(creq.inputs ?? {});
      if (!given.some((p) => p.endsWith('/response/data/stack-model.json'))) errors.push('critique/request/request.json: the critique must be given the stack model');
      if (given.some((p) => p.endsWith('/response/response.md'))) errors.push('critique/request/request.json: the critique may not be given the author\'s response.md');
    }
  } else if (response.status === 'done') errors.push('critique/response/critique.md: a done branch needs the critique exchange');
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateArchitectureStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid architecture.decide branch\n');
}
