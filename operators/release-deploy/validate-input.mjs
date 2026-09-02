import { validatorFor, runValidatorCli } from './validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const { context, input } = value;
  const { intent, manifest, authorization, credentials, observed } = context;
  const { project, release, target, steady, probes, rollbackIdentity, resume } = input;

  // Deployment authority is declared, never implied. An authorization scoped elsewhere is the same as
  // no authorization at all.
  if (authorization.scope.projectId !== project.id) {
    errors.push('the declared authorization is scoped to another project');
  }
  if (authorization.scope.environment !== target.environment) {
    errors.push('the declared authorization is scoped to another environment');
  }
  if (authorization.scope.targetRef !== target.targetRef) {
    errors.push('the declared authorization is scoped to another target');
  }
  if (Date.parse(authorization.expiresAt) <= Date.parse(authorization.grantedAt)) {
    errors.push('the declared authorization expires at or before it was granted');
  }
  if (Date.parse(authorization.expiresAt) <= Date.parse(observed.observedAt)) {
    errors.push('the declared authorization had already expired when the target was observed');
  }

  if (intent.environment !== target.environment) {
    errors.push('the declared deployment intent names another environment');
  }

  // A manifest validated against a different release cannot authorize this one; that substitution is
  // how an unreviewed image reaches a reviewed target.
  if (manifest.validatedAgainstReleaseId !== release.releaseId) {
    errors.push('the validated manifest is pinned to a different release');
  }

  if (observed.targetRef !== target.targetRef) {
    errors.push('the observed state belongs to another target');
  }

  // The observed active release is the one this run replaces. Anything else appearing later is drift.
  if (observed.activeReleaseId !== target.replacedReleaseId) {
    errors.push('target.replacedReleaseId must equal the observed active release');
  }
  if (observed.activeReleaseId === null && observed.activeDigest !== null) {
    errors.push('an observed target with no active release cannot report an active digest');
  }
  if (observed.activeDigest === release.digest && observed.activeReleaseId !== release.releaseId) {
    errors.push('the observed digest already matches this release under a different release identity');
  }

  const handles = credentials.map((item) => item.handle);
  if (new Set(handles).size !== handles.length) {
    errors.push('context.credentials repeats a credential handle');
  }

  const probeIds = probes.map((item) => item.probeId);
  if (new Set(probeIds).size !== probeIds.length) errors.push('input.probes repeats a probe identifier');

  // Steady state is public. A run that declares only runtime probes proves nothing a user could see.
  if (!probes.some((item) => item.kind !== 'runtime')) {
    errors.push('at least one declared probe must be public; the GraphQL typename probe returning 200 is the readiness signal');
  }

  // The deadline must be able to contain the window it is meant to observe. On this project a push to
  // main takes roughly eight to nine minutes to boot, so a deadline shorter than the window is a
  // guaranteed false failure.
  if (steady.deadlineSeconds <= steady.windowSeconds) {
    errors.push('the monitoring deadline must exceed the steady window it has to contain');
  }
  if (steady.backoffSeconds > steady.windowSeconds) {
    errors.push('the probe backoff cannot exceed the steady window');
  }

  if (rollbackIdentity !== null) {
    if (rollbackIdentity.releaseId === release.releaseId) {
      errors.push('the rollback identity must name a release other than the one being deployed');
    }
    if (rollbackIdentity.digest === release.digest) {
      errors.push('the rollback identity must name an artifact other than the one being deployed');
    }
  }

  if (resume !== null && resume.addedContextRefs.length === 0) {
    errors.push('resume must add at least one authorization, manifest, credential, or observation reference');
  }

  if (/(^|[\\/])\.\.([\\/]|$)/.test(project.artifactRootRef)) {
    errors.push('artifactRootRef cannot contain path traversal');
  }

  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
