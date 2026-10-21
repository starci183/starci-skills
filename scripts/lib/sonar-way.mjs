// sonar-way.mjs - the Sonar way TypeScript profile (the default quality profile sonar.starci.org and SonarCloud apply) as ESLint rules:
// the one mapping both lint canons (@starci/eslint-canon-be and -fe) publish, so `starci app lint` in the op loop refuses what the scan would
// raise while the code is written. The base is eslint-plugin-sonarjs's recommended config, SonarSource's own port of Sonar way (each rule's
// docs url names its S-id); its rules the canons already publish in another form stay with that owner (SONAR_WAY_OWNED), and the Sonar way
// rules SonarSource builds on other ESLint rules are SONAR_WAY_EXTRA. Every rule is `error`. A unit or end-to-end spec is outside the scan,
// so outside these rules: the canons give this block the ignores of sonar-syntax-rules.mjs OUTSIDE_THE_SCAN_FILES. The runtime's own
// `sonar-rules` gate reads the two limits below.

/** S3776 cognitive complexity and S107 parameters: the Sonar way thresholds. */
export const COGNITIVE_COMPLEXITY_LIMIT = 15;
export const MAX_PARAMETERS = 7;

/**
 * sonarjs rules of Sonar way the local lint does not run: another canon owner reports the same Sonar id, or the port does not match what the
 * server reports on the same source and is left to the server. Parity is measured, not assumed: a product scan with 0 issues on the server
 * (Sonar way, 2026-10-21) while these ports reported 130 findings on it; a rule that cannot match the server is not a lint error.
 */
const SONAR_WAY_OWNED = Object.freeze({
  'sonarjs/no-nested-conditional': 'S3358, the canon syntax rule no-nested-conditional',
  'sonarjs/unused-import': 'S1128, the canon syntax rule no-unused-import',
  'sonarjs/void-use': 'S3735, the canon syntax rule no-void-operator',
  'sonarjs/deprecation': 'S1874, the borrowed @typescript-eslint/no-deprecated',
  'sonarjs/no-unused-vars': 'S1481, the TypeScript compiler (noUnusedLocals in @starci/tsconfig); the port also reports a rest-sibling omit the server accepts',
  'sonarjs/different-types-comparison': 'S3403, the server: the port reads control-flow-narrowed types (`x !== null` after an aliased guard) the server does not report',
  'sonarjs/function-return-type': 'S3800, the server: the port reports nullable and union returns the server accepts',
  'sonarjs/argument-type': 'S3782, the server: the port reports optional arguments the server accepts',
});

/**
 * The Sonar way rules SonarSource implements on an ESLint rule outside eslint-plugin-sonarjs: `{ sonar, rule, options? }`. The canon syntax
 * rules carry S107 (`max-params`, which spares the constructor of an injectable class as the server does) and S4084 (`media-has-caption`,
 * front end). Left out: S7785 (top-level await; an app's TypeScript compiles to CommonJS, `module: nodenext` without `type: module`) and
 * S6582 (typescript-eslint's optional-chain rule reports guards whose optional chain would change the value's type, which the server accepts).
 */
export const SONAR_WAY_EXTRA = Object.freeze([
  { sonar: 'S3863', rule: 'no-duplicate-imports', options: [{ allowSeparateTypeImports: true }] },
  { sonar: 'S4138', rule: 'unicorn/no-for-loop' },
  { sonar: 'S7721', rule: 'unicorn/consistent-function-scoping', options: [{ checkArrowFunctions: false }] },
  { sonar: 'S7732', rule: 'unicorn/no-instanceof-builtins' },
  { sonar: 'S7740', rule: 'unicorn/no-this-assignment' },
  { sonar: 'S7744', rule: 'unicorn/no-useless-fallback-in-spread' },
  { sonar: 'S7747', rule: 'unicorn/no-useless-spread' },
  { sonar: 'S7750', rule: 'unicorn/prefer-array-find' },
  { sonar: 'S7754', rule: 'unicorn/prefer-array-some' },
  { sonar: 'S7765', rule: 'unicorn/prefer-includes' },
  { sonar: 'S7767', rule: 'unicorn/prefer-math-trunc' },
  { sonar: 'S7770', rule: 'unicorn/prefer-native-coercion-functions' },
  { sonar: 'S7776', rule: 'unicorn/prefer-set-has' },
  { sonar: 'S7778', rule: 'unicorn/prefer-single-call' },
  { sonar: 'S7784', rule: 'unicorn/prefer-structured-clone' },
]);

/** The Sonar id a sonarjs rule documents (its docs url ends in `#/rspec/S<id>/javascript`), or null. */
const sonarIdOf = (rule) => /\/rspec\/#\/rspec\/(S\d+)\//u.exec(rule?.meta?.docs?.url ?? '')?.[1] ?? null;

/**
 * The Sonar way rules, `{ rules, mapped }`: `rules` the flat-config rule levels (sonarjs' recommended rules at error minus the owned ones,
 * with S3776's limit, then SONAR_WAY_EXTRA), `mapped` every `{ sonar, rule }` row.
 */
export function sonarWayRules(sonarjs) {
  const mapped = [];
  const rules = {};
  for (const [name, setting] of Object.entries(sonarjs.configs.recommended.rules)) {
    if ((Array.isArray(setting) ? setting[0] : setting) !== 'error' || SONAR_WAY_OWNED[name]) continue;
    const declared = Array.isArray(setting) ? setting.slice(1) : [];
    const options = name === 'sonarjs/cognitive-complexity' ? [COGNITIVE_COMPLEXITY_LIMIT] : declared;
    rules[name] = ['error', ...options];
    mapped.push({ sonar: sonarIdOf(sonarjs.rules[name.slice('sonarjs/'.length)]), rule: name });
  }
  for (const entry of SONAR_WAY_EXTRA) {
    rules[entry.rule] = ['error', ...(entry.options ?? [])];
    mapped.push({ sonar: entry.sonar, rule: entry.rule });
  }
  return { rules, mapped };
}
