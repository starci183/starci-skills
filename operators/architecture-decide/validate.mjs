// architecture.decide's own law over one step folder, on top of the shared step check: exactly one
// selected alternative that the response names; the number of alternatives the person asked for;
// approval binds the selection under approval-required and is absent under automatic; every store
// has an owner among its writers and shared writes are justified; retained components are verified
// on all five axes or carry the COMPATIBILITY_UNVERIFIED fallback; the critique attacks the
// selected alternative and a failing attack cannot end in status done; the handoff names contracts,
// never implementation files.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep, tableUnder } from '../../scripts/validate-step.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const AXES = ['runtime-version', 'deployable-unit', 'communication-failure', 'datastore-ownership', 'backup-restore'];
const IMPLEMENTATION_FILE = /\b[\w./-]+\.(ts|tsx|js|jsx|mjs|cjs|py|go|java|rb|rs|php|sql)\b/i;

export async function validateArchitectureStep(stepDir, root = ROOT) {
  const base = await validateStep(root, stepDir);
  const errors = [...base.errors];
  const { output, requirements = {}, present = new Set() } = base;
  if (!output || output.operatorId !== 'architecture.decide') return { errors };
  const has = (f) => existsSync(path.join(stepDir, f));
  const read = (f) => readFile(path.join(stepDir, f), 'utf8');
  const wanted = Number(requirements.alternatives ?? 1);
  const policy = requirements.selectionPolicy ?? 'automatic';
  const approval = (requirements.approval ?? '').trim();
  if (policy === 'automatic' && approval && approval !== '—' && approval !== 'null') errors.push('request.md: approval is bound under automatic policy; supplying both hides which one decided');

  let model = null;
  if (present.has('stack-model') && has('data/stack-model.json')) {
    try { model = JSON.parse(await read('data/stack-model.json')); } catch { model = null; }
  }
  if (model) {
    const selected = model.alternatives.filter((a) => a.status === 'selected');
    if (selected.length !== 1) errors.push(`data/stack-model.json: exactly one alternative must be selected, found ${selected.length}`);
    else if (selected[0].alternativeId !== model.selectedAlternativeId) errors.push('data/stack-model.json: selectedAlternativeId names an alternative that is not the selected one');
    if (model.alternatives.length !== wanted) errors.push(`data/stack-model.json: ${model.alternatives.length} alternatives, but the request asked for ${wanted}`);
    for (const a of model.alternatives) {
      if (a.status === 'rejected' && !a.rejectedBecause) errors.push(`data/stack-model.json: ${a.alternativeId} is rejected without a reason`);
      if (a.status === 'selected' && a.rejectedBecause) errors.push(`data/stack-model.json: ${a.alternativeId} is selected and carries a rejection reason`);
      const axes = String(requirements.tradeoffAxes ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      if (axes.length && wanted > 1) for (const ax of axes) if (a.scores[ax] === undefined) errors.push(`data/stack-model.json: ${a.alternativeId} is not scored on ${ax}`);
    }
    if (wanted > 1 && !present.has('alternatives')) errors.push('output.json: more than one alternative was asked for but no alternatives page is in fields');
    if (policy === 'approval-required' && approval && approval !== model.selectedAlternativeId && output.status === 'done') errors.push(`data/stack-model.json: selected ${model.selectedAlternativeId} but approval names ${approval}`);
    if (policy === 'approval-required' && (!approval || approval === '—' || approval === 'null') && output.status === 'done') errors.push('output.json: approval-required with no approval cannot end done; CHOICE_REQUIRED terminates here');
    const boundaries = new Map(model.boundaries.map((b) => [b.boundaryId, b]));
    const owned = new Map();
    for (const s of model.stores) {
      if (!boundaries.has(s.owningBoundaryId)) errors.push(`data/stack-model.json: store ${s.storeId} is owned by unknown boundary ${s.owningBoundaryId}`);
      if (!s.writers.includes(s.owningBoundaryId)) errors.push(`data/stack-model.json: store ${s.storeId} owner ${s.owningBoundaryId} is not among its writers`);
      if (s.writers.length > 1 && !s.sharedWriteJustification) errors.push(`data/stack-model.json: store ${s.storeId} has ${s.writers.length} writers and no shared-write justification`);
      if (s.writers.length === 1 && s.sharedWriteJustification) errors.push(`data/stack-model.json: store ${s.storeId} has one writer and a shared-write justification`);
      owned.set(s.owningBoundaryId, (owned.get(s.owningBoundaryId) ?? 0) + 1);
    }
    for (const b of model.boundaries) {
      const n = owned.get(b.boundaryId) ?? 0;
      if (b.ownsData && n === 0) errors.push(`data/stack-model.json: boundary ${b.boundaryId} claims data and owns no store`);
      if (!b.ownsData && n > 0) errors.push(`data/stack-model.json: boundary ${b.boundaryId} claims no data and owns ${n} store(s)`);
    }
    const fallbacks = new Set(output.fallbacks ?? []);
    for (const c of model.components) {
      if (c.status === 'removed') { if (c.compatibility.length) errors.push(`data/stack-model.json: removed component ${c.componentId} carries a compatibility verdict`); continue; }
      if (!c.justification) errors.push(`data/stack-model.json: ${c.componentId} has no justification`);
      const verified = new Set(c.compatibility.filter((v) => v.verified && v.evidence).map((v) => v.axis));
      const complete = AXES.every((ax) => verified.has(ax));
      if (c.status === 'replaced-candidate') { if (!fallbacks.has('COMPATIBILITY_UNVERIFIED')) errors.push(`data/stack-model.json: ${c.componentId} is replaced-candidate but output.json lists no COMPATIBILITY_UNVERIFIED fallback`); continue; }
      if (!complete) errors.push(`data/stack-model.json: ${c.componentId} is ${c.status} with compatibility unverified on ${AXES.filter((ax) => !verified.has(ax)).join(', ')}; mark it replaced-candidate under the COMPATIBILITY_UNVERIFIED fallback or terminate`);
    }
  }

  if (present.has('architecture-decision') && has('response.md')) {
    const text = await read('response.md');
    const decision = Object.fromEntries((tableUnder(text, '## Decision') ?? []).map(([k, v]) => [k, v]));
    if (model && decision['Selected alternative'] !== model.selectedAlternativeId) errors.push(`response.md: Decision names ${decision['Selected alternative']} but data/stack-model.json selected ${model.selectedAlternativeId}`);
    if (decision['Selection policy'] !== policy) errors.push(`response.md: Selection policy ${decision['Selection policy']} differs from the request's ${policy}`);
    if (decision['Decision id'] && requirements.decisionId && decision['Decision id'] !== requirements.decisionId) errors.push('response.md: Decision id differs from the request');
    const alts = tableUnder(text, '## Alternatives') ?? [];
    if (model && alts.length !== model.alternatives.length) errors.push(`response.md: Alternatives has ${alts.length} rows, data/stack-model.json has ${model.alternatives.length}`);
    for (const [item, kind, detail] of tableUnder(text, '## Handoff') ?? []) if (kind === 'contract' && IMPLEMENTATION_FILE.test(detail)) errors.push(`response.md: handoff contract "${item}" names an implementation file`);
    const stack = tableUnder(text, '## Stack delta') ?? [];
    for (const [component, status] of stack) if (status === 'replaced-candidate' && !(output.fallbacks ?? []).includes('COMPATIBILITY_UNVERIFIED')) errors.push(`response.md: ${component} is replaced-candidate without the COMPATIBILITY_UNVERIFIED fallback`);
  }

  if (present.has('independent-critique') && has('critique.md')) {
    const text = await read('critique.md');
    const attacks = tableUnder(text, '## Attacks') ?? [];
    const failing = attacks.filter((r) => r[3] === 'fails').map((r) => r[0]);
    const verdict = Object.fromEntries((tableUnder(text, '## Verdict') ?? []).map(([k, v]) => [k, v]));
    if (output.status === 'done' && failing.length) errors.push(`critique.md: attacks ${failing.join(', ')} fail; a done step needs every attack to hold (CRITIQUE_UNRESOLVED or NO_VIABLE_ALTERNATIVE otherwise)`);
    if (output.status === 'done' && verdict.Selection === 'return') errors.push('critique.md: the critique returns the selection, so the step cannot be done');
    const exec = Object.fromEntries((tableUnder(text, '## Execution') ?? []).map(([k, v]) => [k, v]));
    if (exec['Inherited turns'] !== 'none') errors.push('critique.md: the critique must be a fresh execution with no inherited turns');
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N-M\n'); process.exit(2); }
  const { errors } = await validateArchitectureStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write(`${path.basename(path.resolve(target))}: valid architecture.decide step\n`);
}
