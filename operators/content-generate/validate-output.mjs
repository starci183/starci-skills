import { validatorFor, runValidatorCli } from './validation.mjs';

const sameSet = (left, right) => {
  const a = new Set(left);
  const b = new Set(right);
  return a.size === b.size && [...a].every((item) => b.has(item));
};

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { outcome, receipt, artifactRefs } = value.output;
  const { status, binding, unit, findings, failure, resume } = receipt;
  const modes = binding.stageModes;

  if (outcome !== status) errors.push('output.outcome must equal receipt.status');

  if (outcome === 'generated') {
    if (unit === null) errors.push('a generated receipt requires a unit');
    if (failure !== null) errors.push('a generated receipt cannot carry a failure');
    if (resume !== null) errors.push('a generated receipt cannot carry a resume');
  } else {
    if (unit !== null) errors.push('a blocked receipt cannot carry a unit');
    if (failure === null) errors.push('a blocked receipt requires one typed failure');
    else if (failure.retryable && resume === null) errors.push('a retryable failure requires a resume');
    else if (!failure.retryable && resume !== null) errors.push('a non-retryable failure cannot carry a resume');
  }

  // A disabled stage is a decision, and a decision that leaves no record reads later as an omission.
  for (const [stage, mode] of Object.entries(modes)) {
    if (mode !== 'disabled') continue;
    if (!findings.some((item) => item.code === 'STAGE_DISABLED' && item.stage === stage)) {
      errors.push(`the disabled ${stage} stage must be recorded as a STAGE_DISABLED finding`);
    }
  }

  if (unit === null) return errors;

  const { brief, articles, image, tracks, e2e, critique } = unit;

  // The teacher brief precedes the writing and constrains it. An article may only claim coverage of
  // an outcome the brief published, and every declared edition must cover the whole published set.
  const publishedOutcomes = new Set(brief.learnerOutcomeRefs);
  const articleLanguages = articles.map((item) => item.language);
  if (new Set(articleLanguages).size !== articleLanguages.length) {
    errors.push('a language cannot have two article editions');
  }
  if (!sameSet(articleLanguages, binding.naturalLanguages)) {
    errors.push('the article editions must cover exactly the declared natural languages');
  }
  for (const article of articles) {
    for (const ref of article.coveredOutcomeRefs) {
      if (!publishedOutcomes.has(ref)) {
        errors.push(`the ${article.language} edition claims outcome ${ref}, which the brief never published`);
      }
    }
    if (outcome === 'generated') {
      for (const ref of brief.learnerOutcomeRefs) {
        if (!article.coveredOutcomeRefs.includes(ref)) {
          errors.push(`the ${article.language} edition leaves published outcome ${ref} uncovered`);
        }
      }
    }
  }

  for (const disposition of brief.dispositions) {
    if (disposition.kind !== 'add' && disposition.targetRef === null) {
      errors.push(`a ${disposition.kind} disposition must name what it acts on`);
    }
  }

  // An image is generated to a stated intent: it carries the brief's own claims, keeps the prompt
  // that stated them, and cannot be approved while the inspection says it does not carry them.
  if (modes.image === 'disabled' && image !== null) {
    errors.push('a disabled image stage cannot produce an image');
  }
  if (modes.image === 'required' && image === null) {
    errors.push('a required image stage must produce an image');
  }
  if (image !== null) {
    const publishedClaims = new Set(brief.claimRefs);
    for (const ref of image.claimRefs) {
      if (!publishedClaims.has(ref)) {
        errors.push(`the image encodes claim ${ref}, which the brief never published`);
      }
    }
    if (outcome === 'generated' && !image.inspection.claimFidelity) {
      errors.push('an image that failed its own claim-fidelity inspection cannot ship');
    }
  }

  // Generated code in a lesson must actually run. A track without a read exit code, or with a
  // non-zero one, is code the learner will be told works on nobody's evidence.
  const trackLanguages = tracks.map((item) => item.language);
  if (new Set(trackLanguages).size !== trackLanguages.length) {
    errors.push('a language cannot have two implementation tracks');
  }
  if (modes.code === 'disabled') {
    if (tracks.length > 0) errors.push('a disabled code stage cannot produce an implementation track');
  } else if (!sameSet(trackLanguages, binding.implementationLanguages)) {
    errors.push('the implementation tracks must cover exactly the declared implementation languages');
  }
  if (outcome === 'generated') {
    for (const track of tracks) {
      if (track.exitCode !== 0) {
        errors.push(`the ${track.language} track exits ${track.exitCode} and cannot be shipped as working code`);
      }
    }
  }

  if (modes.e2e === 'disabled' && e2e !== null) {
    errors.push('a disabled e2e stage cannot produce executable proof');
  }
  if (modes.e2e === 'required' && e2e === null) {
    errors.push('a required e2e stage must produce executable proof');
  }
  if (e2e !== null) {
    // The repair loop may fix the implementation. It may never move the contract it is measured by.
    if (e2e.contractFingerprintBefore !== e2e.contractFingerprintAfter) {
      errors.push('the executable contract changed during the repair loop, so the proof measures nothing');
    }
    const runLanguages = e2e.runs.map((item) => item.language);
    if (new Set(runLanguages).size !== runLanguages.length) {
      errors.push('a language cannot have two executable-check runs');
    }
    if (!sameSet(runLanguages, trackLanguages)) {
      errors.push('every implementation track must be exercised by the executable check');
    }
    if (outcome === 'generated') {
      for (const run of e2e.runs) {
        if (run.exitCode !== 0) {
          errors.push(`the ${run.language} executable check exits ${run.exitCode} and proves nothing`);
        }
      }
    }
  }

  // The critique is independent of the producer. It runs fresh, inherits no turns, is not the same
  // execution that produced anything, and receives the artifact without the producer's rationale.
  const producerExecutions = new Set([brief.execution.executionRef, ...articles.map((item) => item.execution.executionRef)]);
  if (critique.execution.isolation !== 'fresh' || critique.execution.forkTurns !== 'none') {
    errors.push('the critique must run in a fresh execution that inherits no turns');
  }
  if (producerExecutions.has(critique.execution.executionRef)) {
    errors.push('the critique cannot be performed by an execution that produced the unit');
  }
  if (brief.execution.isolation !== 'fresh' || brief.execution.forkTurns !== 'none') {
    errors.push('the teacher brief must be written in a fresh execution that inherits no turns');
  }

  const produced = [
    ...articles.map((item) => item.articleRef),
    ...tracks.map((item) => item.sourceRef),
    ...(image === null ? [] : [image.imageRef, image.promptRef]),
    ...(e2e === null ? [] : e2e.runs.map((item) => item.assertionsRef)),
  ];
  for (const ref of produced) {
    if (!critique.receivedArtifactRefs.includes(ref)) {
      errors.push(`the critique never received ${ref}, so nothing reviewed it`);
    }
  }

  const scores = Object.values(critique.scores).filter((item) => item !== null);
  const lowest = Math.min(...scores);
  const errorFindings = critique.findings.filter((item) => item.severity === 'error');
  if (critique.verdict === 'approved') {
    if (lowest < binding.minimumScore) {
      errors.push(`the critique approved the unit while a score sits at ${lowest}, below ${binding.minimumScore}`);
    }
    if (errorFindings.length > 0) {
      errors.push('the critique approved the unit while an error finding remains open');
    }
  } else if (errorFindings.length === 0) {
    errors.push('a revision verdict must name at least one error finding and its owning stage');
  }
  for (const finding of critique.findings) {
    if (finding.owningStage !== 'critique' && modes[finding.owningStage] === 'disabled') {
      errors.push(`a finding cannot be assigned to the disabled ${finding.owningStage} stage`);
    }
  }

  if (outcome === 'generated') {
    if (critique.verdict !== 'approved') {
      errors.push('a unit cannot be generated while the independent critique demands a revision');
    }
    if (unit.approvedArtifactRefs.length === 0) {
      errors.push('a generated unit must name the artifacts the critique approved');
    }
    for (const ref of unit.approvedArtifactRefs) {
      if (!produced.includes(ref)) errors.push(`approved artifact ${ref} was never produced by this unit`);
      if (!artifactRefs.includes(ref)) errors.push(`artifactRefs must register approved artifact ${ref}`);
    }
    if (!artifactRefs.includes(brief.briefRef)) errors.push('artifactRefs must register the teacher brief');
    if (!artifactRefs.includes(critique.reviewRef)) errors.push('artifactRefs must register the critique');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
