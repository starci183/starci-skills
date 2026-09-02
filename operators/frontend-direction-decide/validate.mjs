// frontend.direction.decide's own law over one branch, on top of the shared step check: the intent and the
// change level agree; the selection policy and the approval agree; the receipt names exactly one
// selected candidate, falsifies every candidate it formed, and rejects the others by name; a refine
// forms no structural candidate and consults no external reference; more than one candidate is
// rendered; and COVERAGE-1 holds, meaning the coverage enumerates every action, region, state and
// responsive branch the UI contract declares.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const list = (v) => (Array.isArray(v) ? v : empty(v) ? [] : [v]);

// COVERAGE-1 (knowledge/ui/composition): a decided direction enumerates what a later operator has to
// exercise. Every element the UI contract declares is covered, every pending path settles, every
// meaning has its own carrier, and every responsive branch has one owner.
export function coverageErrors(coverage, declared, at) {
  const errors = [];
  const need = (kind) => declared.filter((d) => d.kind === kind).map((d) => d.element);
  const actions = need('action');
  if (actions.length) {
    if ((coverage.actions ?? []).length === 0) errors.push(`${at}: COVERAGE-1: actions must enumerate every declared action`);
    const covered = (coverage.actions ?? []).map((a) => a.action);
    for (const action of actions) if (!covered.includes(action)) errors.push(`${at}: COVERAGE-1: action is not covered: ${action}`);
    for (const entry of coverage.actions ?? []) for (const p of entry.pendingPaths ?? []) if (!p.settlement) errors.push(`${at}: COVERAGE-1: pending path without a settlement: ${entry.action}`);
  }
  const regions = need('region');
  if (regions.length) {
    if ((coverage.regions ?? []).length === 0) errors.push(`${at}: COVERAGE-1: regions must enumerate every declared region`);
    const covered = (coverage.regions ?? []).map((r) => r.region);
    for (const region of regions) if (!covered.includes(region)) errors.push(`${at}: COVERAGE-1: region is not covered: ${region}`);
    for (const region of covered) if (!regions.includes(region)) errors.push(`${at}: COVERAGE-1: coverage names a region the UI contract does not declare: ${region}`);
  }
  const states = need('state');
  if (states.length) {
    if ((coverage.states ?? []).length === 0) errors.push(`${at}: COVERAGE-1: states must enumerate every named meaning`);
    const covered = (coverage.states ?? []).map((s) => s.meaning);
    for (const state of states) if (!covered.includes(state)) errors.push(`${at}: COVERAGE-1: state is not covered: ${state}`);
    const carriers = (coverage.states ?? []).map((s) => s.carrier);
    if (new Set(carriers).size !== carriers.length) errors.push(`${at}: COVERAGE-1: two meanings share one carrier`);
  }
  const responsive = need('responsive');
  if (responsive.length) {
    if ((coverage.responsive ?? []).length === 0) errors.push(`${at}: COVERAGE-1: responsive must enumerate every responsive branch`);
    const covered = (coverage.responsive ?? []).map((b) => b.branch);
    for (const branch of responsive) if (!covered.includes(branch)) errors.push(`${at}: COVERAGE-1: responsive branch is not covered: ${branch}`);
    if (new Set(covered).size !== covered.length) errors.push(`${at}: COVERAGE-1: a responsive branch is named twice, so it has more than one owner`);
  }
  return errors;
}

export async function validateDirectionStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'frontend.direction.decide') return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');

  const intent = requirements.intent ?? 'modify';
  const changeLevel = requirements.changeLevel;
  const candidates = Number(requirements.candidates ?? 1);
  const preview = requirements.preview ?? 'no';
  const policy = requirements.selectionPolicy ?? 'automatic';
  const approval = empty(requirements.approval) ? null : requirements.approval;
  const references = list(requirements.references);

  if (intent === 'create' && changeLevel !== 'new') errors.push('request.json: intent create requires changeLevel new');
  if (changeLevel === 'new' && intent !== 'create') errors.push('request.json: changeLevel new requires intent create');
  if (!(candidates >= 1 && candidates <= 3)) errors.push(`request.json: candidates must be 1, 2 or 3, not ${requirements.candidates}`);
  if (policy === 'automatic' && approval !== null) errors.push('request.json: approval is bound under automatic policy; supplying both hides which one decided');

  const artifacts = new Set(list(response.fields?.candidates));
  if (response.status === 'done') {
    if (candidates > 1 && artifacts.size === 0) errors.push('response/response.json: more than one candidate was formed but none was rendered');
    if (preview === 'yes' && artifacts.size === 0) errors.push('response/response.json: preview was asked for but no candidate page was rendered');
    if (candidates === 1 && preview === 'no' && artifacts.size > 0) errors.push('response/response.json: one candidate under no preview renders no page');
  }

  let coverage = null;
  if (present.has('ui-coverage') && has('response/data/coverage.json')) {
    try { coverage = JSON.parse(await read('response/data/coverage.json')); } catch { coverage = null; }
  } else if (response.status === 'done') errors.push('response/data/coverage.json: a done branch needs the coverage enumeration');

  if (present.has('frontend-direction-decision') && has('response/response.md')) {
    const text = await read('response/response.md');
    const at = 'response/response.md';
    const decision = Object.fromEntries((tableUnder(text, '## Decision') ?? []).map(([k, v]) => [k, v]));
    if (!empty(requirements.target) && decision.Target !== requirements.target) errors.push(`${at}: Target differs from the request`);
    if (decision.Intent !== intent) errors.push(`${at}: Intent ${decision.Intent} differs from the request's ${intent}`);
    if (decision['Change level'] !== changeLevel) errors.push(`${at}: Change level ${decision['Change level']} differs from the request's ${changeLevel}`);
    if (!empty(requirements.ownerCeiling) && decision['Owner ceiling'] !== requirements.ownerCeiling) errors.push(`${at}: Owner ceiling differs from the request`);
    if (decision['Selection policy'] !== policy) errors.push(`${at}: Selection policy ${decision['Selection policy']} differs from the request's ${policy}`);
    if (changeLevel === 'refine' && decision.Classification !== 'locked-refine') errors.push(`${at}: a refine is classified locked-refine, not ${decision.Classification}`);
    if (changeLevel !== 'refine' && decision.Classification === 'locked-refine') errors.push(`${at}: locked-refine requires change level refine`);

    // Exactly one candidate is selected, every candidate formed is falsified, and every candidate
    // that was not selected is rejected by name.
    const attacks = tableUnder(text, '## Falsification') ?? [];
    const formed = new Set(attacks.map((r) => r[1]));
    const rejected = new Set((tableUnder(text, '## Why not the others') ?? []).map((r) => r[0]));
    const selected = decision['Selected candidate'];
    if (response.status === 'done') {
      if (empty(selected)) errors.push(`${at}: a decided direction names one selected candidate`);
      else if (!formed.has(selected)) errors.push(`${at}: the selected candidate ${selected} carries no falsification row`);
      if (formed.size !== candidates) errors.push(`${at}: Falsification covers ${formed.size} candidates, the request asked for ${candidates}`);
      for (const candidate of formed) {
        if (candidate === selected) continue;
        if (!rejected.has(candidate)) errors.push(`${at}: candidate ${candidate} was not selected and is not rejected by name`);
      }
      if (rejected.has(selected)) errors.push(`${at}: the selected candidate ${selected} is also listed under Why not the others`);
      for (const [, candidate, verdict] of attacks) {
        if (candidate === selected && verdict === 'fails') errors.push(`${at}: the selected candidate ${selected} fails an attack, so the direction is not decided`);
      }
    }
    if (policy === 'approval-required' && response.status === 'done') {
      if (approval === null) errors.push('response/response.json: approval-required with no approval cannot end done; DIRECTION_CHOICE_REQUIRED terminates here');
      else if (approval !== selected) errors.push(`${at}: the receipt selects ${selected} but approval names ${approval}`);
    }

    // A refine moves elements inside the approved structure and consults no external reference.
    const refs = tableUnder(text, '## References') ?? [];
    if (changeLevel === 'refine' && refs.length) errors.push(`${at}: a refine works from the family idioms alone, so References carries no row`);
    if (references.length && refs.length === 0) errors.push(`${at}: the person supplied references and none of them is recorded`);
    const contract = (tableUnder(text, '## UI contract') ?? []).map(([element, kind]) => ({ element, kind }));
    if (coverage) {
      errors.push(...coverageErrors(coverage, contract, 'response/data/coverage.json'));
      if (!empty(decision['Direction id']) && coverage.directionId !== decision['Direction id']) {
        errors.push(`response/data/coverage.json: directionId ${coverage.directionId} differs from the receipt's ${decision['Direction id']}`);
      }
    }
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateDirectionStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid frontend.direction.decide branch\n');
}
