// lint-why.mjs - the why code of a back-end canon lint rule.
//
// A finding of the code-pattern gate that comes from an ESLint rule of @starci/eslint-canon-be carries the
// catalogued why code of the HFS rule that owns it (modules/kernel/failure-codes.yaml: title_vi, meaning_vi,
// causes_vi, nextStep_vi), so the agent reads the Vietnamese reason and the next step and not only the rule id.
// The map is the single place that ties a lint rule id to a catalogue code; tests/lint-why.spec.mjs proves every
// mapped rule exists in the plugin, every mapped code is in the catalogue, and every HFS rule is mapped.

/** Lint rule id -> catalogued why code. Several rules of one HFS rule (R41, R45, R72) share its code. */
export const LINT_WHY = Object.freeze({
  'starci-be/catch-must-account': 'BE_LOGGER_REQUIRED',
  'starci-be/error-home': 'BE_ERROR_HOME',
  'starci-be/no-runtime-schema': 'BE_SCHEMA_AUTHORITY',
  'starci-be/sql-only-in-repository': 'BE_SQL_OUTSIDE_REPOSITORY',
  'starci-be/no-entity-in-contract': 'BE_ENTITY_IN_CONTRACT',
  'starci-be/no-untyped-body': 'BE_DEFAULT_DENY',
  'starci-be/public-needs-reason': 'BE_DEFAULT_DENY',
  'starci-be/secret-compare-timing-safe': 'BE_DEFAULT_DENY',
  'starci-be/no-direct-env-read': 'BE_CONFIG_OWNER',
  'starci-be/no-secret-default': 'BE_SECRET_DEFAULT',
  'starci-be/global-module-allowlist': 'BE_MODULE_SHAPE',
  'starci-be/typed-module-definition': 'BE_MODULE_SHAPE',
  'starci-be/static-module-register': 'BE_MODULE_SHAPE',
  'starci-be/no-new-injectable': 'BE_MODULE_SHAPE',
  'starci-be/no-module-let': 'BE_MODULE_SHAPE',
  'starci-be/one-module-per-file': 'BE_MODULE_SHAPE',
  'starci-be/no-inline-suppression': 'HFS_INLINE_SUPPRESSION',
  'starci-be/file-size-growth': 'HFS_SIZE_GROWTH',
  'starci-be/spec-no-source-read': 'BE_SPEC_QUALITY',
  'starci-be/spec-typed-doubles': 'BE_SPEC_QUALITY',
  'starci-be/must-deep-module-import': 'BE_PUBLIC_SURFACE',
  'starci-be/no-folder-reexport': 'BE_PUBLIC_SURFACE',
  'starci-be/dto-needs-validator': 'BE_INPUT_BOUNDED',
  'starci-be/no-interpolated-sql': 'BE_SQL_INTERPOLATED',
  'starci-be/query-needs-limit': 'BE_QUERY_UNBOUNDED',
  'starci-be/http-needs-timeout': 'BE_HTTP_TIMEOUT',
  'starci-be/no-secret-in-log': 'BE_LOG_SECRET',
  'starci-be/no-never-cast': 'BE_TYPE_ESCAPE',
  'starci-be/no-non-null-assertion': 'BE_TYPE_ESCAPE',
  'starci-be/async-needs-await': 'BE_ASYNC_NO_AWAIT',
  'starci-be/migration-down-reversible': 'BE_MIGRATION_REVERSIBLE',
  'starci-be/explicit-handler-return-type': 'BE_RETURN_TYPE',
  'starci-be/json-parse-needs-guard': 'BE_JSON_PARSE_UNGUARDED',
});

/** The why code of a lint rule id, or undefined when the rule has none. */
export const whyOfLintRule = (ruleId) => (typeof ruleId === 'string' ? LINT_WHY[ruleId] : undefined);
