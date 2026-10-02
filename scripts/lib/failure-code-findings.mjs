// failure-code-findings.mjs - the stable codes of the failure-code catalog check (scripts/checks/check-failure-codes.mjs).
// They live here, not in the checker, because the checker does not read itself: a code its own file spelled would count as
// emitted by nothing else. Each has an entry in modules/kernel/failure-codes.yaml.
export const CODE_FINDINGS = Object.freeze({
  uncatalogued: 'RT_CODE_UNCATALOGUED',
  stale: 'RT_CODE_STALE',
  malformed: 'RT_CODE_MALFORMED',
  soleEmitter: 'RT_CODE_SOLE_EMITTER',
});

/** The enforcer kinds that report a rule's code without spelling it in a source file: a lint plugin reports through its rule id, Sonar through its gate. */
export const PLUGIN_ENFORCERS = Object.freeze(['eslint-be', 'eslint-fe', 'stylelint', 'sonar']);
