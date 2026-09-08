// content.generate's own law over one branch, on top of the shared step check: the brief is the measure
// of everything after it, and the receipt restates it; every declared edition exists once per language
// and covers the whole published outcome set; the image stage produces something only when stageModes
// turns it on, and a stage that stayed off is recorded rather than merely absent; every declared track
// builds and is exercised by the executable check inside the iteration bound, whose contract
// fingerprint did not move; and the review is a fresh execution that produced none of the artifacts,
// received all of them, received no producer rationale, approves only at or above the published
// minimum with no open error finding, and spends no more rounds than maxReviewRounds.
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateStep } from '../../scripts/validate-step.mjs';
import { tableUnder } from '../../scripts/validate-response.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const MINIMUM_SCORE = 85;
const empty = (v) => v === undefined || v === null || v === '' || v === '—';
const fields = (rows) => Object.fromEntries((rows ?? []).map(([k, v]) => [k, v]));
const sameSet = (left, right) => { const a = new Set(left); const b = new Set(right); return a.size === b.size && [...a].every((item) => b.has(item)); };
const list = (v) => (Array.isArray(v) ? v : String(v ?? '').split(',').map((s) => s.trim()).filter(Boolean));
const listed = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);
// An edition is filed as article.<language>.md and a track as track.<language>.<extension>, so the
// language is everything between the prefix and the extension.
const languageOf = (file, prefix) => {
  const parts = String(file).split('/').pop().split('.');
  if (parts.length < 3 || parts[0] !== prefix) return null;
  return parts.slice(1, -1).join('.');
};

export async function validateContentStep(branchDir, root = ROOT) {
  const base = await validateStep(root, branchDir);
  const errors = [...base.errors];
  const { response, requirements = {}, present = new Set() } = base;
  if (!response || response.operatorId !== 'content.generate') return { errors };
  const has = (f) => existsSync(path.join(branchDir, f));
  const read = (f) => readFile(path.join(branchDir, f), 'utf8');

  const naturalLanguages = list(requirements.naturalLanguages);
  const implementationLanguages = list(requirements.implementationLanguages);
  const imageOn = (requirements.stageModes ?? {}).image === 'on';
  const maxE2eIterations = Number(requirements.maxE2eIterations ?? 2);
  const maxReviewRounds = Number(requirements.maxReviewRounds ?? 2);
  if (naturalLanguages.length === 0) errors.push('request.json: a unit is written in at least one natural language');
  if (new Set(naturalLanguages).size !== naturalLanguages.length) errors.push('request.json: naturalLanguages must not repeat a language');
  if (new Set(implementationLanguages).size !== implementationLanguages.length) errors.push('request.json: implementationLanguages must not repeat a language');
  const commandLanguages = (Array.isArray(requirements.commands) ? requirements.commands : []).map((c) => c.language);
  if (new Set(commandLanguages).size !== commandLanguages.length) errors.push('request.json: commands must not name a language twice');
  if (!sameSet(commandLanguages, implementationLanguages)) errors.push('request.json: commands must cover exactly the declared implementationLanguages, and nothing else');

  // A blocked branch carries no unit at all.
  if (response.status === 'blocked' && (present.has('content-generation-receipt') || present.has('content-brief') || present.has('e2e'))) {
    errors.push('response/response.json: a blocked branch carries no unit');
  }

  const articleFiles = listed(response.fields?.article);
  const trackFiles = listed(response.fields?.track);
  const imageFiles = listed(response.fields?.image);
  const promptFiles = listed(response.fields?.['image-prompt']);
  const articleLanguages = articleFiles.map((f) => languageOf(f, 'article'));
  const trackLanguages = trackFiles.map((f) => languageOf(f, 'track'));
  if (response.status !== 'blocked') {
    if (new Set(articleLanguages).size !== articleLanguages.length) errors.push('response/response.json: a language cannot have two article editions');
    if (articleFiles.length && !sameSet(articleLanguages, naturalLanguages)) errors.push('response/response.json: the article editions must cover exactly the declared natural languages');
    if (!sameSet(trackLanguages, implementationLanguages)) errors.push('response/response.json: the implementation tracks must cover exactly the declared implementation languages');
    // The image stage is a decision, and a stage that is off produces nothing at all.
    if (!imageOn && (imageFiles.length || promptFiles.length)) errors.push('response/response.json: stageModes turns the image off, so no image and no prompt may be produced');
    if (imageOn && response.status === 'done' && (imageFiles.length === 0 || promptFiles.length === 0)) errors.push('response/response.json: stageModes turns the image on, so the unit carries an image and the prompt that states its intent');
  }

  let publishedOutcomes = [];
  let publishedClaims = [];
  let briefFingerprint = null;
  if (present.has('content-brief') && has('response/brief.md')) {
    const text = await read('response/brief.md');
    const binding = fields(tableUnder(text, '## Binding'));
    briefFingerprint = binding.Fingerprint;
    if (!empty(requirements.unit) && binding.Unit !== requirements.unit) errors.push('response/brief.md: Unit differs from the request');
    publishedOutcomes = (tableUnder(text, '## Outcomes') ?? []).map(([id]) => id);
    publishedClaims = (tableUnder(text, '## Claims') ?? []).map(([id]) => id);
    if (new Set(publishedOutcomes).size !== publishedOutcomes.length) errors.push('response/brief.md: an outcome is published twice');
    if (new Set(publishedClaims).size !== publishedClaims.length) errors.push('response/brief.md: a claim is published twice');
    for (const [kind, target] of tableUnder(text, '## Dispositions') ?? []) if (kind !== 'add' && empty(target)) errors.push(`response/brief.md: a ${kind} disposition must name what it acts on`);
  }

  let e2e = null;
  if (present.has('e2e') && has('response/data/e2e.json')) { try { e2e = JSON.parse(await read('response/data/e2e.json')); } catch { e2e = null; } }
  if (implementationLanguages.length === 0 && e2e !== null) errors.push('response/data/e2e.json: no implementation language is declared, so nothing was built and nothing ran');
  if (implementationLanguages.length > 0 && e2e === null && response.status === 'done') errors.push('response/data/e2e.json: a unit that ships code ships the record of building and running it');
  if (e2e) {
    if (!empty(requirements.unit) && e2e.unitId !== requirements.unit) errors.push(`response/data/e2e.json: unitId ${e2e.unitId} differs from the request's ${requirements.unit}`);
    if (e2e.maxIterations !== maxE2eIterations) errors.push(`response/data/e2e.json: maxIterations ${e2e.maxIterations} differs from the request's ${maxE2eIterations}`);
    if (e2e.iterations > maxE2eIterations) errors.push(`response/data/e2e.json: the executable check spent ${e2e.iterations} iterations, past the bound of ${maxE2eIterations}`);
    // The repair loop may fix the implementation. It may never move the contract it is measured by.
    if (e2e.contractFingerprintBefore !== e2e.contractFingerprintAfter) errors.push('response/data/e2e.json: the executable contract changed during the repair loop, so the proof measures nothing');
    const builtLanguages = e2e.tracks.map((t) => t.language);
    if (new Set(builtLanguages).size !== builtLanguages.length) errors.push('response/data/e2e.json: a language cannot have two implementation tracks');
    if (!sameSet(builtLanguages, implementationLanguages)) errors.push('response/data/e2e.json: the build records must cover exactly the declared implementation languages');
    const runLanguages = e2e.runs.map((r) => r.language);
    if (new Set(runLanguages).size !== runLanguages.length) errors.push('response/data/e2e.json: a language cannot have two executable-check runs');
    if (!sameSet(runLanguages, builtLanguages)) errors.push('response/data/e2e.json: every implementation track must be exercised by the executable check');
    const declaredCommands = new Map((Array.isArray(requirements.commands) ? requirements.commands : []).map((c) => [c.language, c]));
    for (const track of e2e.tracks) {
      const command = declaredCommands.get(track.language);
      if (command && track.buildCommand !== command.buildCommand) errors.push(`response/data/e2e.json: the ${track.language} track was built with ${track.buildCommand}, the request declared ${command.buildCommand}`);
      if (response.status === 'done' && track.exitCode !== 0) errors.push(`response/data/e2e.json: the ${track.language} track exits ${track.exitCode} and cannot be shipped as working code`);
    }
    for (const run of e2e.runs) {
      const command = declaredCommands.get(run.language);
      if (command && run.command !== command.checkCommand) errors.push(`response/data/e2e.json: the ${run.language} check ran ${run.command}, the request declared ${command.checkCommand}`);
      if (response.status === 'done' && run.exitCode !== 0) errors.push(`response/data/e2e.json: the ${run.language} executable check exits ${run.exitCode} and proves nothing`);
      if (response.status === 'done') for (const assertion of run.assertions) if (!assertion.held) errors.push(`response/data/e2e.json: the ${run.language} assertion ${assertion.name} did not hold, so the check proves nothing`);
    }
  }

  const produced = [...articleFiles, ...trackFiles, ...imageFiles, ...promptFiles];
  let verdict = null;
  let round = null;
  if (present.has('content-review') && has('review/response/review.md')) {
    const text = await read('review/response/review.md');
    const execution = fields(tableUnder(text, '## Execution'));
    verdict = fields(tableUnder(text, '## Verdict')).Verdict;
    round = Number(execution.Round);
    // A unit that passes its own author's review has not been reviewed.
    if (execution['Inherited turns'] !== 'none') errors.push('review/response/review.md: the review must be a fresh execution with no inherited turns');
    if (execution['Producer rationale'] !== 'withheld') errors.push("review/response/review.md: the review may not receive the producer's rationale");
    if (!Number.isInteger(round) || round < 1) errors.push('review/response/review.md: Round must be the number of this review round');
    else if (round > maxReviewRounds) errors.push(`review/response/review.md: this is review round ${round}, past the approved maxReviewRounds of ${maxReviewRounds}`);

    const received = (tableUnder(text, '## Received') ?? []).map(([artifact]) => artifact);
    for (const ref of produced) if (!received.includes(ref)) errors.push(`review/response/review.md: the review never received ${ref}, so nothing reviewed it`);

    const scores = (tableUnder(text, '## Scores') ?? []).filter(([, score]) => !empty(score)).map(([, score]) => Number(score));
    const findings = tableUnder(text, '## Findings') ?? [];
    const errorFindings = findings.filter(([, severity]) => severity === 'error');
    if (verdict === 'approved') {
      const lowest = scores.length ? Math.min(...scores) : 0;
      if (lowest < MINIMUM_SCORE) errors.push(`review/response/review.md: the review approved the unit while a score sits at ${lowest}, below ${MINIMUM_SCORE}`);
      if (errorFindings.length > 0) errors.push('review/response/review.md: the review approved the unit while an error finding remains open');
    } else if (errorFindings.length === 0) errors.push('review/response/review.md: a revision verdict must name at least one error finding and its owning stage');
    for (const [stage] of findings) {
      if (stage === 'image' && !imageOn) errors.push('review/response/review.md: a finding cannot be assigned to the image stage, which stageModes turned off');
      if ((stage === 'code' || stage === 'e2e') && implementationLanguages.length === 0) errors.push(`review/response/review.md: a finding cannot be assigned to the ${stage} stage, which never ran`);
    }
    if (response.status === 'done' && verdict !== 'approved') errors.push('review/response/review.md: a unit cannot be generated while the independent review demands a revision');
  } else if (response.status === 'done') errors.push('review/response/review.md: a generated unit needs the review exchange');

  // The revision fallback is bounded: every round past the first is one taken fallback, and the round
  // after the last approved one is REVIEW_ROUNDS_EXHAUSTED rather than another quiet rewrite.
  const revised = (response.fallbacks ?? []).includes('REVIEW_REVISION_REQUIRED');
  if (revised && round !== null && round < 2) errors.push('response/response.json: REVIEW_REVISION_REQUIRED was taken, so the review that answered it is at least the second round');
  if (!revised && round !== null && round > 1) errors.push(`response/response.json: this is review round ${round}, so the REVIEW_REVISION_REQUIRED fallback that reopened the exchange must be recorded`);
  if (response.status === 'blocked' && response.stop === 'REVIEW_ROUNDS_EXHAUSTED' && round !== null && round !== maxReviewRounds) {
    errors.push(`response/response.json: the rounds are exhausted only at round ${maxReviewRounds}, and the review is at round ${round}`);
  }

  if (present.has('content-generation-receipt') && has('response/response.md')) {
    const text = await read('response/response.md');
    const binding = fields(tableUnder(text, '## Binding'));
    if (!empty(requirements.unit) && binding.Unit !== requirements.unit) errors.push('response/response.md: Unit differs from the request');
    if (briefFingerprint !== null && binding['Brief fingerprint'] !== briefFingerprint) errors.push('response/response.md: Brief fingerprint differs from the frozen brief');
    if (verdict !== null && binding.Verdict !== verdict) errors.push(`response/response.md: Verdict ${binding.Verdict} differs from the review's ${verdict}`);
    if (round !== null && Number(binding.Round) !== round) errors.push(`response/response.md: Round ${binding.Round} differs from the review's ${round}`);

    const editions = tableUnder(text, '## Editions') ?? [];
    if (!sameSet(editions.map(([language]) => language), articleLanguages.filter(Boolean))) errors.push('response/response.md: the editions differ from the article files the response registers');
    for (const [language, article, covered] of editions) {
      const expected = `response/artifacts/article.${language}.md`;
      if (article !== expected) errors.push(`response/response.md: the ${language} edition names ${article}, and an edition of ${language} is filed as ${expected}`);
      const claimed = list(covered);
      for (const ref of claimed) if (publishedOutcomes.length && !publishedOutcomes.includes(ref)) errors.push(`response/response.md: the ${language} edition claims outcome ${ref}, which the brief never published`);
      if (response.status === 'done') for (const ref of publishedOutcomes) if (!claimed.includes(ref)) errors.push(`response/response.md: the ${language} edition leaves published outcome ${ref} uncovered`);
    }

    const approved = (tableUnder(text, '## Approved artifacts') ?? []).map(([artifact]) => artifact);
    if (response.status === 'done') {
      if (approved.length === 0) errors.push('response/response.md: a generated unit must name the artifacts the review approved');
      for (const ref of approved) if (produced.length && !produced.includes(ref)) errors.push(`response/response.md: approved artifact ${ref} was never produced by this unit`);
    }
    // A stage that stayed off is a decision, and a decision that leaves no record reads later as an omission.
    const recorded = new Set((tableUnder(text, '## Findings') ?? []).filter(([code]) => code === 'STAGE_DISABLED').map(([, stage]) => stage));
    if (!imageOn && !recorded.has('image')) errors.push('response/response.md: the image stage stayed off and must be recorded as a STAGE_DISABLED finding');
    if (implementationLanguages.length === 0) {
      for (const stage of ['code', 'e2e']) if (!recorded.has(stage)) errors.push(`response/response.md: the ${stage} stage never ran and must be recorded as a STAGE_DISABLED finding`);
    }
  }
  return { errors };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) { process.stderr.write('usage: node validate.mjs <session>/step-N/parallel-M\n'); process.exit(2); }
  const { errors } = await validateContentStep(path.resolve(target));
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; } else process.stdout.write('valid content.generate branch\n');
}
