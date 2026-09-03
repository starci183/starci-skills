// frontend.direction.decide's own law over one branch, on top of the shared step check: the intent and the
// change level agree; the selection policy and the approval agree; the receipt names exactly one
// selected candidate, falsifies every candidate it formed, and rejects the others by name; a refine
// forms no structural candidate and consults no external reference; more than one candidate is
// rendered, scored, and the dominant one selected, a choice reaching the person only over a tie the
// scores prove; and COVERAGE-1 holds, meaning the coverage declares one surface class from the published
// vocabulary and enumerates every action, region, state and responsive branch the UI contract
// declares, with the receipt naming the same class the coverage carries.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder, userRouted, choiceHandoffErrors, printedCandidates } from '../../scripts/validate-response.mjs';
import { loadErrorsRegistry } from '../../scripts/errors-registry.mjs';
import { TASTE_RULES } from '../frontend-surface-audit/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const list = (v) => (Array.isArray(v) ? v : empty(v) ? [] : [v]);

// Several survivors are ranked, not offered. `## Scores` carries one row per rendered candidate,
// printed viewport and criterion; a candidate is dominant when its mean is the highest and, at the
// same viewport, it scores no lower than every other candidate on every criterion any candidate
// failed. Equal top means are the rubric's own resolution (TASTE-13 Case 1 scores in whole steps),
// so they are a tie, and so is a top scorer that loses a failed criterion to another.
export function scoreRows(rows) {
  return (rows ?? []).map(([candidate, viewport, criterion, score, verdict]) => ({ candidate, viewport, criterion, score: Number(score), verdict }));
}
export function rankCandidates(scores) {
  const by = new Map();
  for (const r of scores) {
    if (!by.has(r.candidate)) by.set(r.candidate, { sum: 0, n: 0, cells: new Map() });
    const c = by.get(r.candidate);
    c.sum += r.score; c.n += 1; c.cells.set(`${r.viewport}|${r.criterion}`, r.score);
  }
  const means = [...by].map(([id, c]) => ({ id, mean: c.n ? c.sum / c.n : 0, sum: c.sum, n: c.n })).sort((a, b) => b.mean - a.mean);
  if (means.length === 0) return { dominant: null, means, tie: null };
  if (means.length === 1) return { dominant: means[0].id, means, tie: null };
  const top = means[0];
  const level = means.filter((m) => m.n === top.n ? m.sum === top.sum : m.mean === top.mean);
  if (level.length > 1) return { dominant: null, means, tie: `the top means of ${level.map((m) => m.id).join(' and ')} are equal` };
  const failed = new Set(scores.filter((r) => r.verdict === 'fail').map((r) => `${r.viewport}|${r.criterion}`));
  for (const key of failed) {
    const mine = by.get(top.id).cells.get(key);
    for (const [id, c] of by) {
      if (id === top.id) continue;
      const theirs = c.cells.get(key);
      if (mine !== undefined && theirs !== undefined && theirs > mine) {
        const [viewport, criterion] = key.split('|');
        return { dominant: null, means, tie: `${top.id} has the highest mean and loses the failed criterion ${criterion} at ${viewport} to ${id}` };
      }
    }
  }
  return { dominant: top.id, means, tie: null };
}
// The scores a decision over several rendered candidates must carry: every rendered candidate at
// every viewport it was printed at, the taste lens whole for each, and one criterion set for all,
// or the means cannot be compared.
export function scoreCoverageErrors({ at, scores, rendered, printed }) {
  const errors = [];
  if (rendered.length < 2) return errors;
  if (scores.length === 0) {
    errors.push(`${at}: ${rendered.length} candidates were rendered and ## Scores carries no row; a decision over several rendered candidates carries the scores that ranked them, or the tie they prove`);
    return errors;
  }
  const keysOf = (id) => new Set(scores.filter((r) => r.candidate === id).map((r) => `${r.viewport}|${r.criterion}`));
  const first = keysOf(rendered[0]);
  for (const id of rendered) {
    const keys = keysOf(id);
    if (keys.size === 0) { errors.push(`${at}: candidate ${id} was rendered and never scored under ## Scores`); continue; }
    for (const viewport of printed.get(id) ?? []) {
      const missing = TASTE_RULES.filter((rule) => !keys.has(`${viewport}|${rule}`));
      if (missing.length) errors.push(`${at}: candidate ${id} at ${viewport} is scored without ${missing.join(', ')}; the taste lens is scored whole (TASTE-13 Case 1)`);
    }
    if (id !== rendered[0] && (keys.size !== first.size || [...keys].some((k) => !first.has(k)))) {
      errors.push(`${at}: candidate ${id} is scored on a different criterion set than ${rendered[0]}; means over different criteria cannot be compared`);
    }
  }
  return errors;
}

// A score is a claim about the candidate it is scored for. `## Candidate limits` carries the
// candidate's own declaration, one row per criterion it says it does not satisfy; a claim in
// `## Scores` that contradicts that declaration — scoring the pairing at the passing end, or
// scoring it nowhere at all — is refused, because a description and a score that disagree cannot
// both stand.
export function candidateLimitRows(rows) {
  return (rows ?? []).map(([candidate, criterion, says]) => ({ candidate, criterion, says }));
}
export function candidateLimitErrors({ at, limits, scores }) {
  const errors = [];
  for (const { candidate, criterion, says } of limits) {
    const matching = scores.filter((r) => r.candidate === candidate && r.criterion === criterion);
    if (matching.length === 0) {
      errors.push(`${at}: candidate ${candidate} declares under ## Candidate limits that it does not satisfy ${criterion} (${says}), and ## Scores carries no row for that pairing; a declared limit needs the score row it constrains`);
      continue;
    }
    for (const row of matching) {
      if (row.verdict !== 'fail') {
        errors.push(`${at}: candidate ${candidate} declares under ## Candidate limits that it does not satisfy ${criterion} (${says}), and ## Scores scores it ${row.verdict} at ${row.viewport}; a score that contradicts the candidate's own description is refused`);
      }
    }
  }
  return errors;
}

// The surface class vocabulary is not copied here: it is read out of the rule that publishes it,
// COVERAGE-1 Case 7 in knowledge/ui/composition/coverage.md, so widening the rule widens the gate and
// there is no second place to forget. The Case names the classes in one sentence, each in backticks.
export async function surfaceClasses(root = ROOT) {
  const file = path.join(root, 'knowledge', 'ui', 'composition', 'coverage.md');
  if (!existsSync(file)) return [];
  const text = await readFile(file, 'utf8');
  const row = text.split(/\r?\n/).find((l) => /^\|\s*Case 7\s*\|/.test(l) && l.includes('surfaceClass'));
  if (!row) return [];
  const from = row.indexOf('one of');
  if (from === -1) return [];
  const after = row.slice(from);
  const end = after.indexOf('.');
  const sentence = end === -1 ? after : after.slice(0, end);
  return [...sentence.matchAll(/`([a-z][a-z0-9-]*)`/g)].map((m) => m[1]);
}

// COVERAGE-1 (knowledge/ui/composition): a decided direction enumerates what a later operator has to
// exercise. Every element the UI contract declares is covered, every pending path settles, every
// meaning has its own carrier, and every responsive branch has one owner.
export function coverageErrors(coverage, declared, at, classes = []) {
  const errors = [];
  // Case 7: a decided direction names exactly one surface class, and it names it from the published
  // vocabulary. Without it every banded proof rule downstream is left without a threshold.
  if (classes.length) {
    if (empty(coverage.surfaceClass)) errors.push(`${at}: COVERAGE-1: the coverage declares no surfaceClass; the audit that reads it has no band and stops with SURFACE_CLASS_MISSING`);
    else if (!classes.includes(coverage.surfaceClass)) errors.push(`${at}: COVERAGE-1: surfaceClass ${coverage.surfaceClass} is outside the vocabulary COVERAGE-1 Case 7 publishes: ${classes.join(', ')}`);
  }
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

  // A structural change is looked at before it is decided: `new` and `reconstruct` render every
  // candidate they form, whatever the preview flag says, because the person cannot approve a
  // structure nobody has seen. `refine` moves elements inside a structure that was already approved,
  // so its page stays optional and is rendered only when a comparison or a preview asks for one.
  const structural = changeLevel === 'new' || changeLevel === 'reconstruct';
  const artifacts = new Set(list(response.fields?.candidates));
  if (response.status === 'done') {
    if (structural && candidates >= 1 && artifacts.size !== candidates) {
      errors.push(`response/response.json: a ${changeLevel} direction renders every candidate it forms; ${candidates} formed and ${artifacts.size} rendered, so the person is asked to approve a structure they cannot see`);
    }
    if (candidates > 1 && artifacts.size === 0) errors.push('response/response.json: more than one candidate was formed but none was rendered');
    if (preview === 'yes' && artifacts.size === 0) errors.push('response/response.json: preview was asked for but no candidate page was rendered');
    if (!structural && candidates === 1 && preview === 'no' && artifacts.size > 0) errors.push('response/response.json: one candidate under no preview renders no page');
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
    // Several rendered candidates are ranked before one is selected. The scores decide a dominant
    // candidate under either policy; only a tie they prove is a choice, taken by the fallback under
    // automatic and by the person under approval-required.
    const rendered = [...artifacts].map((page) => page.replace(/^.*\//, '').replace(/\.html$/, ''));
    const printedMap = printedCandidates(tableUnder(text, '## Printed') ?? []);
    const scores = scoreRows(tableUnder(text, '## Scores'));
    const limits = candidateLimitRows(tableUnder(text, '## Candidate limits'));
    const ranking = rankCandidates(scores);
    const scored = rendered.length > 1 && scores.length > 0;
    if (response.status === 'done') {
      errors.push(...scoreCoverageErrors({ at, scores, rendered, printed: printedMap }));
      errors.push(...candidateLimitErrors({ at, limits, scores }));
      if (scored && ranking.dominant && selected !== ranking.dominant) {
        errors.push(`${at}: the scores make ${ranking.dominant} dominant (mean ${ranking.means[0].mean.toFixed(2)}) and the receipt selects ${selected}; a dominant candidate is the one selected`);
      }
      const tookFallback = list(response.fallbacks).includes('DIRECTION_CHOICE_REQUIRED');
      if (scored && ranking.dominant && tookFallback) errors.push(`${at}: the scores make ${ranking.dominant} dominant, so no choice was required and DIRECTION_CHOICE_REQUIRED was not a fallback to take`);
      if (scored && !ranking.dominant && policy === 'automatic' && !tookFallback) errors.push(`${at}: no candidate dominates (${ranking.tie}) and no DIRECTION_CHOICE_REQUIRED fallback is recorded; a tie under automatic is broken by the fallback and recorded`);
    }
    if (policy === 'approval-required' && response.status === 'done') {
      if (approval === null && !(scored && ranking.dominant)) errors.push('response/response.json: approval-required with no approval cannot end done unless the scores make one candidate dominant; over a tie DIRECTION_CHOICE_REQUIRED terminates here');
      else if (approval !== null && approval !== selected) errors.push(`${at}: the receipt selects ${selected} but approval names ${approval}`);
    }

    // A refine moves elements inside the approved structure and consults no external reference. A
    // structural change names the standard it is aiming at, by class, so the later taste lens can
    // sort the capture beside it (TASTE-12); a decision that names none is this operator's own
    // defect and stops with REFERENCE_MISSING rather than blaming the caller.
    const refs = tableUnder(text, '## References') ?? [];
    if (changeLevel === 'refine' && refs.length) errors.push(`${at}: a refine works from the family idioms alone, so References carries no row`);
    if (references.length && refs.length === 0) errors.push(`${at}: the person supplied references and none of them is recorded`);
    if (structural && response.status === 'done' && refs.length === 0) {
      errors.push(`${at}: a ${changeLevel} direction names at least one reference standard by class under ## References; with none the run stops with REFERENCE_MISSING`);
    }
    for (const [standard, klass] of refs) {
      if (empty(klass)) errors.push(`${at}: the reference ${standard} names no class; a standard is named by the class a reader would sort it into, never by an adjective`);
    }
    // The surface class is declared once, here, and the later audit reads it from the coverage. The
    // receipt says the same name in prose so a person reads it without opening the data, and the two
    // must agree: a receipt and a coverage naming two classes leave the audit banding the wrong one.
    const classes = await surfaceClasses(root);
    const declaredClass = (tableUnder(text, '## Surface class') ?? [])[0]?.[0];
    if (response.status === 'done') {
      if (empty(declaredClass)) errors.push(`${at}: a decided direction names one surface class under ## Surface class; without it every banded proof rule downstream has no threshold`);
      else if (classes.length && !classes.includes(declaredClass)) errors.push(`${at}: surface class ${declaredClass} is outside the vocabulary COVERAGE-1 Case 7 publishes: ${classes.join(', ')}`);
    }

    // Rendering is not showing. A candidate served at a port nobody was told about is a candidate
    // nobody saw, so `## Printed` records what was actually put in front of the person, and a
    // structural direction that decided without printing every candidate it rendered decided alone.
    const printedRows = tableUnder(text, '## Printed') ?? [];
    const printed = printedRows.map(([artifact]) => artifact);
    if (response.status === 'done' && structural) {
      for (const page of artifacts) {
        const candidate = page.replace(/^.*\//, '').replace(/\.html$/, '');
        if (!printed.some((p) => p.includes(candidate))) {
          errors.push(`${at}: candidate ${candidate} was rendered and never printed; ## Printed lists what the person was shown before the decision was written`);
        }
      }
    }
    // When the choice is the person's, the same table is the whole hand-off: one rendered candidate
    // per option, at least three because a composition is chosen by eye, a capture per viewport,
    // and a reason that names the sheet and asks one question. Two options written out in prose
    // are advice, and advice is what the print law exists to refuse.
    if (response.status === 'blocked' && response.stop === 'DIRECTION_CHOICE_REQUIRED' && await userRouted(root, await loadErrorsRegistry(root), 'frontend.direction.decide', response)) {
      errors.push(...choiceHandoffErrors({ at, printedRows, options: rendered, reason: response.reason }));
      // The stop is lawful only over a tie the scores prove: a sheet whose scores name a winner is a
      // confirmation whose answer is already known, and that is never a stop.
      if (scores.length === 0) errors.push(`${at}: the choice is handed to the person with no ## Scores; the stop is lawful only over a tie the scores prove`);
      else {
        errors.push(...scoreCoverageErrors({ at, scores, rendered, printed: printedMap }));
        errors.push(...candidateLimitErrors({ at, limits, scores }));
        if (ranking.dominant) errors.push(`${at}: the scores make ${ranking.dominant} dominant (mean ${ranking.means[0].mean.toFixed(2)}), so the choice was the operator's; a confirmation whose answer the receipt already shows is never a stop`);
      }
    }

    const contract = (tableUnder(text, '## UI contract') ?? []).map(([element, kind]) => ({ element, kind }));
    if (coverage) {
      errors.push(...coverageErrors(coverage, contract, 'response/data/coverage.json', classes));
      if (!empty(decision['Direction id']) && coverage.directionId !== decision['Direction id']) {
        errors.push(`response/data/coverage.json: directionId ${coverage.directionId} differs from the receipt's ${decision['Direction id']}`);
      }
      if (!empty(declaredClass) && coverage.surfaceClass !== declaredClass) {
        errors.push(`response/data/coverage.json: surfaceClass ${coverage.surfaceClass} differs from the receipt's ${declaredClass}`);
      }
    }
  } else if (response.status === 'blocked' && response.stop === 'DIRECTION_CHOICE_REQUIRED' && await userRouted(root, await loadErrorsRegistry(root), 'frontend.direction.decide', response)) {
    errors.push('response/response.md: the choice is handed to the person with no receipt, so nothing was printed; DIRECTION_CHOICE_REQUIRED carries the receipt whose ## Printed table is the choice');
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateDirectionStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid frontend.direction.decide branch\n');
}
