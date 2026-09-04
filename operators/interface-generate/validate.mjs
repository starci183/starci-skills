// interface.generate's own law over one branch, on top of the shared step check. Three laws compose
// here, one per receipt the branch leaves side by side, and each is exported so a validator that reads
// only one of the receipts (interface.fix reads the application half) binds the same rule:
//
// direction (response/direction.md, response/data/coverage.json): the intent and the change level
// agree; the selection policy and the approval agree; the receipt names exactly one selected
// candidate, falsifies every candidate it formed, and rejects the others by name; a refine forms no
// structural candidate and consults no external reference; more than one candidate is rendered and
// scored, with selection following the request policy and recorded user choice; and COVERAGE-1
// holds, meaning the coverage declares one surface class from the published vocabulary and
// enumerates every action, region, state and responsive branch the UI contract declares, with the
// receipt naming the same class the coverage carries.
//
// resolution (response/resolution.md, response/data/inventory.json, the resolved tree): every rule
// the inventory carries is one @knowledge/ui/presentation actually publishes; every class the
// inventory carries appears in the resolved tree; a Grammar-owned property emits no application
// class while an application-owned one emits a class whose step matches the ordinal of its rule; the
// gaps the receipt lists are exactly the gaps the inventory records; with emission on every claimed
// rule reaches the tree as a data-contract token, except a rule whose every node the receipt records
// under ## Gaps; and under a presentation delta of none nothing is resolved at all.
//
// application (response/response.md, response/changes.md, response/data/writes.json): every class in
// every written file comes from the inventory this branch froze, whose treeFingerprint is the hash of
// the resolved tree beside it (RESOLUTION_STALE otherwise); the write lands on the session branch and
// nowhere else; a dry run commits nothing and an applied run commits exactly once; created, modified
// and unchanged agree with the hashes; the presentation sweep ran over the declared paths and found
// nothing; and the receipt and changes.md list exactly the files the plan carries.
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder, userRouted, choiceHandoffErrors, printedCandidates } from '../../scripts/validate-response.mjs';
import { loadErrorsRegistry } from '../../scripts/errors-registry.mjs';
import { sessionRootOf } from '../../scripts/validate-request.mjs';
import { validateAgainst } from '../../scripts/json-schema.mjs';
import { loadFindingsSchema } from '../../scripts/record-findings.mjs';
import { TASTE_RULES } from '../interface-audit/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OPERATOR_ID = 'interface.generate';
// The three receipts of one branch, and the data beside them.
export const FILES = {
  direction: 'response/direction.md',
  coverage: 'response/data/coverage.json',
  resolution: 'response/resolution.md',
  inventory: 'response/data/inventory.json',
  application: 'response/response.md',
  changes: 'response/changes.md',
  writes: 'response/data/writes.json',
};
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const list = (v) => (Array.isArray(v) ? v : empty(v) ? [] : [v]);
export const fingerprintOf = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

// ---------------------------------------------------------------------------------------------------
// Direction law.

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

// The findings ledger, answered. When the request binds `findings` — the ledger's open lines for the
// surfaces the last audit or walk observed, materialized beside that receipt by
// scripts/record-findings.mjs — every open line for this target or unit is named under
// `## Findings answered` with how the direction answers it; a generator that ignores a known finding
// is refused, and a row naming a finding the input does not carry is a claim about nothing.
export function findingsAnsweredErrors({ at, doc, target, unit, answeredRows }) {
  const errors = [];
  const mine = (doc?.lines ?? []).filter((l) => l.fixed === null && (l.surface === target || (unit !== undefined && l.surface === unit)));
  const answered = new Map((answeredRows ?? []).map(([id, how]) => [id, how]));
  for (const l of mine) if (!answered.has(l.id)) errors.push(`${at}: finding ${l.id} (${l.rule ?? l.code ?? 'no rule'}: ${l.statement}) is open for ${l.surface} and ## Findings answered does not name it; a generator that ignores a known finding is refused`);
  for (const id of answered.keys()) if (!(doc?.lines ?? []).some((l) => l.id === id)) errors.push(`${at}: ## Findings answered names ${id}, which the findings input does not carry`);
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

// The direction receipt of one branch, checked against the request that asked for it. Returns the
// errors and the presentation delta the decision declared (app-owned when it declares none).
export async function directionErrors({ branchDir, root = ROOT, request, response, requirements = {}, present = new Set() }) {
  const errors = [];
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  let presentationDelta = 'app-owned';
  if (response.interaction !== undefined && response.stop !== 'DIRECTION_CHOICE_REQUIRED') errors.push('response/response.json: a direction interaction must use DIRECTION_CHOICE_REQUIRED with rendered evidence');

  const intent = requirements.intent ?? 'modify';
  const changeLevel = requirements.changeLevel;
  const candidates = Number(requirements.candidates ?? 1);
  const preview = requirements.preview ?? 'no';
  const policy = requirements.selectionPolicy ?? 'automatic';
  const approval = empty(requirements.approval) ? null : requirements.approval;
  if (policy === 'approval-required' && approval !== null && (!request?.decisionId || request.selectedOption !== approval)) errors.push('request.json: approval must match a recorded user choice through decisionId and selectedOption');
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
  if (present.has('ui-coverage') && has(FILES.coverage)) {
    try { coverage = JSON.parse(await read(FILES.coverage)); } catch { coverage = null; }
  } else if (response.status === 'done') errors.push(`${FILES.coverage}: a done branch needs the coverage enumeration`);

  const handedToPerson = async () => response.status === 'blocked' && response.stop === 'DIRECTION_CHOICE_REQUIRED' && await userRouted(root, await loadErrorsRegistry(root), OPERATOR_ID, response);
  if (present.has('frontend-direction-decision') && has(FILES.direction)) {
    const text = await read(FILES.direction);
    const at = FILES.direction;
    const decision = Object.fromEntries((tableUnder(text, '## Decision') ?? []).map(([k, v]) => [k, v]));
    if (!empty(requirements.target) && decision.Target !== requirements.target) errors.push(`${at}: Target differs from the request`);
    if (decision.Intent !== intent) errors.push(`${at}: Intent ${decision.Intent} differs from the request's ${intent}`);
    if (decision['Change level'] !== changeLevel) errors.push(`${at}: Change level ${decision['Change level']} differs from the request's ${changeLevel}`);
    if (!empty(requirements.ownerCeiling) && decision['Owner ceiling'] !== requirements.ownerCeiling) errors.push(`${at}: Owner ceiling differs from the request`);
    if (decision['Selection policy'] !== policy) errors.push(`${at}: Selection policy ${decision['Selection policy']} differs from the request's ${policy}`);
    if (changeLevel === 'refine' && decision.Classification !== 'locked-refine') errors.push(`${at}: a refine is classified locked-refine, not ${decision.Classification}`);
    if (!['app-owned', 'none'].includes(decision['Presentation delta'])) errors.push(`${at}: Presentation delta ${decision['Presentation delta'] ?? '(absent)'} is neither app-owned nor none`);
    else presentationDelta = decision['Presentation delta'];
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
    // Scores select an internal comparison under automatic and inform a recommendation under
    // approval-required, where the recorded user choice selects the material direction.
    const rendered = [...artifacts].map((page) => page.replace(/^.*\//, '').replace(/\.html$/, ''));
    const printedMap = printedCandidates(tableUnder(text, '## Printed') ?? []);
    const scores = scoreRows(tableUnder(text, '## Scores'));
    const limits = candidateLimitRows(tableUnder(text, '## Candidate limits'));
    const ranking = rankCandidates(scores);
    const scored = rendered.length > 1 && scores.length > 0;
    if (response.status === 'done') {
      errors.push(...scoreCoverageErrors({ at, scores, rendered, printed: printedMap }));
      errors.push(...candidateLimitErrors({ at, limits, scores }));
      if (scored && ranking.dominant && selected !== ranking.dominant && !(policy === 'approval-required' && approval === selected)) {
        errors.push(`${at}: the scores make ${ranking.dominant} dominant (mean ${ranking.means[0].mean.toFixed(2)}) and the receipt selects ${selected}; a dominant candidate is the one selected`);
      }
      const tookFallback = list(response.fallbacks).includes('DIRECTION_CHOICE_REQUIRED');
      if (scored && ranking.dominant && tookFallback) errors.push(`${at}: the scores make ${ranking.dominant} dominant, so no choice was required and DIRECTION_CHOICE_REQUIRED was not a fallback to take`);
      if (scored && !ranking.dominant && policy === 'automatic' && !tookFallback) errors.push(`${at}: no candidate dominates (${ranking.tie}) and no DIRECTION_CHOICE_REQUIRED fallback is recorded; a tie under automatic is broken by the fallback and recorded`);
    }
    if (policy === 'approval-required' && response.status === 'done') {
      if (approval === null) errors.push('response/response.json: approval-required with no approval cannot end done; the user selects the tier even when one candidate scores higher');
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
    // per typed option, a capture per viewport, and a reason that names the sheet and asks one
    // question. Two options written out in prose are advice, and advice is what the print law
    // exists to refuse.
    if (await handedToPerson()) {
      if (response.interaction?.kind !== 'tier-choice') errors.push('response/response.json: a direction choice needs a typed tier-choice interaction');
      const offered = (Array.isArray(response.interaction?.options) ? response.interaction.options : []).map((option) => option?.id);
      if (offered.length !== rendered.length || rendered.some((id) => !offered.includes(id))) errors.push('response/response.json: tier options must match the rendered candidate ids');
      errors.push(...choiceHandoffErrors({ at, printedRows, options: rendered, reason: response.reason }));
      // Every offered direction has scored evidence, including when one is recommended.
      if (scores.length === 0) errors.push(`${at}: the choice is handed to the person with no ## Scores; every offered direction needs scored evidence`);
      else {
        errors.push(...scoreCoverageErrors({ at, scores, rendered, printed: printedMap }));
        errors.push(...candidateLimitErrors({ at, limits, scores }));
        // Scores inform a recommendation; they do not replace the user's explicit tier choice.
      }
    }

    // What the ledger knows about this surface is answered, not ignored.
    const findingsRef = request?.inputs?.findings;
    if (findingsRef) {
      const sessionRoot = sessionRootOf(branchDir);
      let doc = null;
      try { doc = JSON.parse(await readFile(path.join(sessionRoot ?? branchDir, String(findingsRef)), 'utf8')); } catch { doc = null; }
      if (!doc) errors.push(`${findingsRef}: the findings input cannot be read, so nothing the ledger knows about this surface can be answered`);
      else {
        errors.push(...validateAgainst(await loadFindingsSchema(root), doc, String(findingsRef)));
        errors.push(...findingsAnsweredErrors({ at, doc, target: requirements.target, unit: request?.unit, answeredRows: tableUnder(text, '## Findings answered') }));
      }
    }

    const contract = (tableUnder(text, '## UI contract') ?? []).map(([element, kind]) => ({ element, kind }));
    if (coverage) {
      errors.push(...coverageErrors(coverage, contract, FILES.coverage, classes));
      if (!empty(decision['Direction id']) && coverage.directionId !== decision['Direction id']) {
        errors.push(`${FILES.coverage}: directionId ${coverage.directionId} differs from the receipt's ${decision['Direction id']}`);
      }
      if (!empty(declaredClass) && coverage.surfaceClass !== declaredClass) {
        errors.push(`${FILES.coverage}: surfaceClass ${coverage.surfaceClass} differs from the receipt's ${declaredClass}`);
      }
    }
  } else if (await handedToPerson()) {
    errors.push(`${FILES.direction}: the choice is handed to the person with no receipt, so nothing was printed; DIRECTION_CHOICE_REQUIRED carries the receipt whose ## Printed table is the choice`);
  } else if (response.status === 'done') errors.push(`${FILES.direction}: a done branch needs the decision receipt`);
  return { errors, presentationDelta };
}

// ---------------------------------------------------------------------------------------------------
// Resolution law.

// The scale topics publish an ordinal rule identifier while the utility scale publishes a step
// number, and the two diverge above the fourth value. Writing the ordinal as the class is the defect
// this map exists to catch: GAP-5 renders `gap-6`, never `gap-5`.
const ORDINAL_TO_STEP = { 0: '0', 1: '1', 2: '2', 3: '3', 4: '4', 5: '6', 6: '8' };
const SCALE_PATTERN = {
  GAP: /^gap(?:-[xy])?-([0-9]+)$/,
  PADDING: /^p(?:[xytrbse])?-([0-9]+)$/,
  MARGIN: /^-?m(?:[xytrbse])?-([0-9]+)$/,
};
const prefixOf = (ruleId) => ruleId.slice(0, ruleId.lastIndexOf('-'));
const ordinalOf = (ruleId) => Number(ruleId.slice(ruleId.lastIndexOf('-') + 1));

// The bound inventory is what @knowledge/ui/presentation publishes: one `## PREFIX-n` heading per rule.
export async function publishedRuleIds(root = ROOT) {
  const dir = path.join(root, 'knowledge', 'ui', 'presentation');
  const ids = new Set();
  if (!existsSync(dir)) return ids;
  for (const name of (await readdir(dir)).filter((f) => f.endsWith('.md') && !f.endsWith('.vi.md') && f !== 'INDEX.md')) {
    const text = await readFile(path.join(dir, name), 'utf8');
    for (const m of text.matchAll(/^##\s+([A-Z][A-Z0-9-]*-[0-9]+)\b/gm)) ids.add(m[1]);
  }
  return ids;
}

// Reads the inventory and the resolved tree of a branch: { inventory, tree, treeRef }, each null when absent.
export async function readResolution(branchDir, response) {
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  let inventory = null;
  if (has(FILES.inventory)) { try { inventory = JSON.parse(await read(FILES.inventory)); } catch { inventory = null; } }
  let tree = null; let treeRef = null;
  for (const ref of list(response?.fields?.['resolved-tree'])) if (has(ref)) { tree = await read(ref); treeRef = ref; }
  return { inventory, tree, treeRef };
}

export async function resolutionErrors({ branchDir, root = ROOT, response, requirements = {}, present = new Set(), presentationDelta = 'app-owned' }) {
  const errors = [];
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const maxRounds = Number(requirements.maxRounds ?? 2);
  if (!Number.isInteger(maxRounds) || maxRounds < 1) errors.push(`request.json: maxRounds must be a positive whole number, not ${requirements.maxRounds}`);
  const emission = requirements.contractEmission ?? 'on';

  const { inventory, tree } = await readResolution(branchDir, response);
  if (!inventory || !present.has('inventory')) {
    if (response.status === 'done') errors.push(`${FILES.inventory}: a done branch needs the inventory`);
    return { errors };
  }
  const at = FILES.inventory;

  const published = await publishedRuleIds(root);
  for (const ruleId of inventory.ruleIds) {
    if (!published.has(ruleId)) errors.push(`${at}: rule ${ruleId} is outside the published presentation inventory (UNKNOWN_RULE)`);
  }

  // The receipt is read before the tree, because a rule recorded under `## Gaps` is a rule whose node
  // publishes no path for the attribute: the emission check below must know that before it accuses the
  // tree of hiding a claim that could never have been written.
  const receiptText = present.has('frontend-presentation-resolution') && has(FILES.resolution) ? await read(FILES.resolution) : null;
  if (receiptText === null && response.status === 'done') errors.push(`${FILES.resolution}: a done branch needs the resolution receipt`);
  const gapRows = receiptText === null ? [] : (tableUnder(receiptText, '## Gaps') ?? []);
  const gapNodes = new Set(gapRows.map(([node]) => node));
  const chosenRows = receiptText === null ? [] : (tableUnder(receiptText, '## Rules chosen') ?? []);
  // A rule is exempt only when every node that chose it is a gap node; one ordinary node still owes
  // its attribute.
  const gapOnlyRules = new Set();
  for (const [, rule] of chosenRows) {
    const nodes = chosenRows.filter(([, r]) => r === rule).map(([n]) => n);
    if (nodes.length && nodes.every((n) => gapNodes.has(n))) gapOnlyRules.add(String(rule).replace(/`/g, ''));
  }

  // The resolved tree is the only place the classes may land, so every class the inventory claims
  // must actually be in it.
  if (tree === null) { if (response.status === 'done') errors.push('response/artifacts: the resolved tree is missing'); }
  else {
    for (const className of inventory.classNames) {
      if (!tree.includes(className)) errors.push(`${at}: class ${className} is in the inventory and not in the resolved tree`);
    }
    if (emission === 'on') {
      for (const ruleId of inventory.ruleIds) {
        // A property the application owns on a Grammar component's className carries no attribute:
        // the component forwards className and nothing else, so the claim is recorded under `## Gaps`
        // instead of being demanded of a tree that cannot carry it.
        if (gapOnlyRules.has(ruleId)) continue;
        const claimed = [...tree.matchAll(/data-contract="([^"]*)"/g)].some((m) => m[1].split(/\s+/).includes(ruleId));
        if (!claimed) errors.push(`${at}: rule ${ruleId} is applied and no node claims it under data-contract`);
      }
    } else if (/data-contract=/.test(tree)) errors.push('response/artifacts: contract emission is off and the resolved tree carries a data-contract attribute');
  }

  if (receiptText !== null) {
    const text = receiptText;
    const rel = FILES.resolution;
    const owners = tableUnder(text, '## Owner map') ?? [];
    const chosen = chosenRows;
    const removed = tableUnder(text, '## Removed') ?? [];
    const gaps = gapRows;

    if (response.status === 'done') {
      if (presentationDelta === 'none') {
        if (owners.length || chosen.length) errors.push(`${rel}: the direction declares Presentation delta none and the resolution still resolves ${owners.length} owner row(s) and ${chosen.length} chosen rule(s); a copy, behaviour or binding change owes no presentation value`);
        if (inventory.ruleIds.length || inventory.classNames.length) errors.push(`${at}: Presentation delta none carries an empty inventory`);
      } else if (!owners.some(([, , owner]) => owner === 'app') || !chosen.length) errors.push(`${rel}: an app-owned presentation delta resolves at least one application-owned property; the owner map and the rules chosen cannot both be empty (declare Presentation delta none in the direction when nothing is owed)`);
    }
    const appRules = new Set();
    const grammarRules = new Set();
    const seen = new Set();
    for (const [node, property, owner, rule] of owners) {
      const key = `${node}|${property}`;
      if (seen.has(key)) errors.push(`${rel}: ${node} decides ${property} more than once in the owner map`);
      seen.add(key);
      (owner === 'app' ? appRules : grammarRules).add(`${node}|${rule}`);
    }
    for (const [node, rule, className] of chosen) {
      if (grammarRules.has(`${node}|${rule}`)) { errors.push(`${rel}: ${node} chooses a class for ${rule}, which Grammar already owns`); continue; }
      if (!appRules.has(`${node}|${rule}`)) { errors.push(`${rel}: ${node} chooses ${rule} without an application-owned row in the owner map`); continue; }
      if (!inventory.ruleIds.includes(rule)) errors.push(`${rel}: ${node} chooses ${rule}, which the inventory does not carry`);
      if (!inventory.classNames.includes(className)) errors.push(`${rel}: ${node} writes ${className}, which the inventory does not carry`);
      const pattern = SCALE_PATTERN[prefixOf(rule)];
      if (pattern) {
        const expected = ORDINAL_TO_STEP[ordinalOf(rule)];
        const steps = className.split(/\s+/).map((token) => pattern.exec(token)).filter(Boolean).map((m) => m[1]);
        if (expected !== undefined) {
          if (steps.length === 0) errors.push(`${rel}: ${node} emits no class for ${rule}`);
          else if (!steps.includes(expected)) errors.push(`${rel}: ${node} renders ${rule} as ${className}, expected step ${expected}`);
        }
      }
    }
    for (const key of appRules) {
      const [node, rule] = key.split('|');
      if (!chosen.some(([n, r]) => n === node && r === rule)) errors.push(`${rel}: ${node} owns ${rule} and chooses no class for it`);
    }
    for (const [node, className] of removed) {
      if (inventory.classNames.includes(className)) errors.push(`${rel}: ${node} removed ${className} and the inventory still carries it`);
    }

    // The gaps a reader sees and the gaps the machine carries are one list.
    const receiptGaps = gaps.map(([node, property, missing]) => `${node}|${property}|${missing}`).sort();
    const dataGaps = inventory.gaps.map((g) => `${g.nodePath}|${g.property}|${g.missingPath}`).sort();
    if (receiptGaps.join('\n') !== dataGaps.join('\n')) {
      // Two counts say nothing about which row is wrong, so the first row that differs is named.
      const width = Math.max(receiptGaps.length, dataGaps.length);
      let first = 0;
      while (first < width && receiptGaps[first] === dataGaps[first]) first += 1;
      errors.push(`${rel}: the Gaps table and inventory.gaps differ (${receiptGaps.length} rows against ${dataGaps.length}); the first differing row is the receipt's ${receiptGaps[first] ?? '(absent)'} against the inventory's ${dataGaps[first] ?? '(absent)'}`);
    }
  }
  return { errors };
}

// ---------------------------------------------------------------------------------------------------
// Application law.

// The inventory a write reads is the one frozen beside the resolved tree, and its treeFingerprint is
// the hash of that tree: a fingerprint that no longer matches the tree is RESOLUTION_STALE, whether the
// tree moved or the inventory did.
export function resolutionStaleErrors({ at, inventory, tree, treeRef }) {
  const errors = [];
  if (!inventory || tree === null) return errors;
  const actual = fingerprintOf(Buffer.from(tree, 'utf8'));
  if (inventory.treeFingerprint !== actual) errors.push(`${at}: treeFingerprint ${inventory.treeFingerprint} is not the hash of the resolved tree ${treeRef} (${actual}); the inventory and the tree it was frozen for disagree (RESOLUTION_STALE)`);
  return errors;
}

// The application receipt, the change record and the write plan of one branch, against the inventory
// the values must come from. `operatorId` names the operator whose changes.md is checked;
// `inventory` is null when the branch could not read one, which a done branch reports as
// RESOLUTION_STALE.
export async function applicationErrors({ branchDir, request, response, requirements = {}, present = new Set(), inventory, operatorId = OPERATOR_ID }) {
  const errors = [];
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');
  const mode = requirements.mode ?? 'apply';

  let plan = null;
  if (present.has('writes') && has(FILES.writes)) {
    try { plan = JSON.parse(await read(FILES.writes)); } catch { plan = null; }
  }
  if (!plan) {
    if (response.status === 'done') errors.push(`${FILES.writes}: a done branch needs the write plan`);
    return { errors, plan: null };
  }
  const at = FILES.writes;

  if (plan.mode !== mode) errors.push(`${at}: mode ${plan.mode} differs from the request's ${mode}`);
  if (!plan.branch.startsWith('session/')) errors.push(`${at}: the write lands on ${plan.branch}; only session/<sessionId> may be committed to`);
  if (request?.sessionId && plan.branch !== `session/${request.sessionId}`) errors.push(`${at}: branch ${plan.branch} is not the session branch of ${request.sessionId}`);

  const commits = response.commits ?? [];
  if (mode === 'dry') {
    if (plan.commit !== null) errors.push(`${at}: a dry run commits nothing, so commit must be null`);
    if (commits.length) errors.push('response/response.json: a dry run records no commit');
    for (const file of plan.files) if (file.change !== 'unchanged' && file.after !== null && file.before !== file.after) {
      errors.push(`${at}: ${file.path} reports a change under a dry run, which writes nothing`);
    }
  } else if (response.status === 'done') {
    if (plan.commit === null) errors.push(`${at}: an applied branch commits the declared write set exactly once`);
    if (commits.length !== 1) errors.push(`response/response.json: an applied branch records exactly one commit, found ${commits.length}`);
    else if (plan.commit !== null && commits[0] !== plan.commit) errors.push(`response/response.json: commits[0] ${commits[0]} is not the commit ${plan.commit} the plan recorded`);
    if (!plan.files.some((f) => f.change !== 'unchanged')) errors.push(`${at}: an applied branch moves at least one declared path (NO_PROGRESS otherwise)`);
  }

  // Every value that entered source came from the resolution; there is no other source of one.
  if (inventory) {
    const published = new Set(inventory.classNames);
    for (const file of plan.files) {
      for (const className of file.classes) {
        if (!published.has(className)) errors.push(`${at}: ${file.path} writes class ${className}, which the resolution never published (WRITE_REJECTED)`);
      }
    }
  } else if (response.status === 'done') errors.push(`${at}: the resolution inventory could not be read beside the resolved tree the write reads (RESOLUTION_STALE)`);

  // The presentation sweep is the second half of the conformance check: the inventory proves where a
  // class came from, the sweep proves the node it landed on may carry it. An applied write set that
  // carries no sweep record was never checked against the laws the knowledge tree already publishes.
  const sweep = plan.sweep ?? null;
  if (mode === 'apply') {
    if (sweep === null) errors.push(`${at}: an applied write set records the presentation sweep over the declared paths (WRITE_REJECTED)`);
    else {
      if (!/sweep-presentation\.mjs/.test(sweep.command)) errors.push(`${at}: the sweep command ${sweep.command} is not scripts/sweep-presentation.mjs`);
      if (sweep.findings.length && sweep.exitCode === 0) errors.push(`${at}: the sweep reports ${sweep.findings.length} finding(s) with exit code 0; a finding exits 1`);
      if (!sweep.findings.length && sweep.exitCode !== 0) errors.push(`${at}: the sweep exited ${sweep.exitCode} with no finding recorded`);
      if (sweep.findings.length && response.status === 'done') {
        errors.push(`${at}: the sweep found ${sweep.findings.map((f) => `${f.file}:${f.line} ${f.code} ${f.token}`).join('; ')}; any finding is WRITE_REJECTED and the branch is blocked`);
      }
      const declared = new Set(plan.files.map((f) => f.path));
      for (const f of sweep.findings) if (!declared.has(f.file)) errors.push(`${at}: the sweep read ${f.file}, which the declared write set does not carry`);
    }
  }

  const seen = new Set();
  for (const file of plan.files) {
    if (seen.has(file.path)) errors.push(`${at}: path ${file.path} appears twice in the plan`);
    seen.add(file.path);
    if (file.change === 'created' && file.before !== null) errors.push(`${at}: ${file.path} was created but reports a prior hash`);
    if (file.change === 'modified') {
      if (file.before === null) errors.push(`${at}: ${file.path} was modified but reports no prior hash`);
      else if (file.before === file.after) errors.push(`${at}: ${file.path} reports a modification with an unchanged hash`);
    }
    if (file.change === 'unchanged') {
      if (file.before !== file.after) errors.push(`${at}: ${file.path} is reported unchanged with a different hash`);
      if (file.classes.length) errors.push(`${at}: ${file.path} is reported unchanged while carrying classes`);
    }
    if (file.change === 'deleted' && file.after !== null) errors.push(`${at}: ${file.path} was deleted and still reports a later hash`);
  }

  if (present.has('frontend-source-application') && has(FILES.application)) {
    const text = await read(FILES.application);
    const rel = FILES.application;
    const binding = Object.fromEntries((tableUnder(text, '## Binding') ?? []).map(([k, v]) => [k, v]));
    if (binding.Mode !== mode) errors.push(`${rel}: Mode ${binding.Mode} differs from the request's ${mode}`);
    if (binding.Branch !== plan.branch) errors.push(`${rel}: Branch differs from the write plan`);
    if (binding.Base !== plan.base) errors.push(`${rel}: Base differs from the write plan`);
    if (binding.Commit !== (plan.commit ?? '—')) errors.push(`${rel}: Commit ${binding.Commit} differs from the write plan's ${plan.commit ?? '—'}`);
    const rows = tableUnder(text, '## Projection') ?? [];
    if (rows.length !== plan.files.length) errors.push(`${rel}: Projection has ${rows.length} rows, the plan has ${plan.files.length}`);
    for (const [p, change] of rows) {
      const file = plan.files.find((f) => f.path === p);
      if (!file) { errors.push(`${rel}: Projection names ${p}, which the plan does not carry`); continue; }
      if (file.change !== change) errors.push(`${rel}: ${p} is ${change} here and ${file.change} in the plan`);
    }
  } else if (response.status === 'done') errors.push(`${FILES.application}: a done branch needs the application receipt`);

  if (present.has('changes') && has(FILES.changes)) {
    const text = await read(FILES.changes);
    const rel = FILES.changes;
    if (!new RegExp(`^# changes — ${operatorId.replace(/\./g, '\\.')} step-\\d+/parallel-\\d+`, 'm').test(text)) errors.push(`${rel}: the title names another operator than ${operatorId}`);
    const rows = tableUnder(text, '## Files') ?? [];
    const listed = rows.map(([p]) => p).sort();
    const planned = plan.files.map((f) => f.path).sort();
    if (listed.join('\n') !== planned.join('\n')) errors.push(`${rel}: Files lists ${listed.length} paths, the plan carries ${planned.length}`);
    for (const [p, change] of rows) {
      const file = plan.files.find((f) => f.path === p);
      if (!file) { errors.push(`${rel}: Files names ${p}, which the plan does not carry`); continue; }
      if (file.change !== change) errors.push(`${rel}: ${p} is ${change} here and ${file.change} in the plan`);
    }
    const binding = Object.fromEntries((tableUnder(text, '## Binding') ?? []).map(([k, v]) => [k, v]));
    if (!empty(binding.Checkout) && !binding.Checkout.includes(plan.branch)) errors.push(`${rel}: the Checkout row does not name the session branch ${plan.branch}`);
  }
  return { errors, plan };
}

// ---------------------------------------------------------------------------------------------------
// The whole branch.

export async function validateGenerateStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { request, response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== OPERATOR_ID) return { errors };

  const direction = await directionErrors({ branchDir, root, request, response, requirements, present });
  errors.push(...direction.errors);
  const resolution = await resolutionErrors({ branchDir, root, response, requirements, present, presentationDelta: direction.presentationDelta });
  errors.push(...resolution.errors);
  const { inventory, tree, treeRef } = await readResolution(branchDir, response);
  errors.push(...resolutionStaleErrors({ at: FILES.inventory, inventory, tree, treeRef }));
  const application = await applicationErrors({ branchDir, request, response, requirements, present, inventory: present.has('inventory') ? inventory : null });
  errors.push(...application.errors);
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateGenerateStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid interface.generate branch\n');
}
