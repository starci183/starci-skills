// sonar-way.mjs - the Sonar way TypeScript profile (the default quality profile sonar.starci.org and SonarCloud apply) as ESLint rules:
// the one mapping both lint canons (@starci/eslint-canon-be and -fe) publish, so `starci app lint` in the op loop refuses what the scan would
// raise while the code is written. The base is eslint-plugin-sonarjs's recommended config, SonarSource's own port of Sonar way (each rule's
// docs url names its S-id); its rules the canons already publish in another form stay with that owner (SONAR_WAY_OWNED), and the Sonar way
// rules SonarSource builds on other ESLint rules are SONAR_WAY_EXTRA. Every rule is `error`; no rule is left to the server because its port
// disagrees with it (a port that disagrees is fixed in the source it reports, never switched off). A unit or end-to-end spec is outside the scan,
// so outside these rules: the canons give this block the ignores of sonar-syntax-rules.mjs OUTSIDE_THE_SCAN_FILES. The runtime's own
// `sonar-rules` gate reads the two limits below.

/** S3776 cognitive complexity and S107 parameters: the Sonar way thresholds. */
export const COGNITIVE_COMPLEXITY_LIMIT = 15;
export const MAX_PARAMETERS = 7;

/**
 * sonarjs rules of Sonar way the local lint does not run under their sonarjs name because another owner enforces the same Sonar id at error:
 * a canon syntax rule, a borrowed typescript-eslint rule or the TypeScript compiler. Each owner is asserted in packages/eslint/be/sonar-way.spec.mjs and packages/eslint/fe/config.spec.mjs.
 */
const SONAR_WAY_OWNED = Object.freeze({
  'sonarjs/no-nested-conditional': 'S3358, the canon syntax rule no-nested-conditional',
  'sonarjs/unused-import': 'S1128, the canon syntax rule no-unused-import',
  'sonarjs/void-use': 'S3735, the canon syntax rule no-void-operator',
  'sonarjs/deprecation': 'S1874, the borrowed @typescript-eslint/no-deprecated',
  'sonarjs/no-unused-vars': 'S1481, the TypeScript compiler (noUnusedLocals and noUnusedParameters in @starci/tsconfig)',
});

/**
 * Sonar way rules with no ESLint form that applies to the module format of a side. S7785 prefers top-level await, which a CommonJS output
 * (the back end: `module: nodenext` without `type: module`) cannot contain; the front end is ESM and runs the rule.
 */
export const SONAR_WAY_NOT_APPLICABLE = Object.freeze({
  be: Object.freeze({ S7785: 'top-level await does not exist in the CommonJS output of a back end' }),
  fe: Object.freeze({}),
});

/**
 * The Sonar way rules SonarSource implements on an ESLint rule outside eslint-plugin-sonarjs: `{ sonar, rule, options? }`. The canon syntax
 * rules carry S107 (`max-params`, which spares the constructor of an injectable class as the server does) and S4084 (`media-has-caption`,
 * front end); S6582 is typescript-eslint's `prefer-optional-chain`, which needs the type information the canons' typed block provides.
 */
export const SONAR_WAY_EXTRA = Object.freeze([
  { sonar: 'S3863', rule: 'no-duplicate-imports', options: [{ allowSeparateTypeImports: true }] },
  { sonar: 'S6582', rule: '@typescript-eslint/prefer-optional-chain' },
  { sonar: 'S4138', rule: 'unicorn/no-for-loop' },
  { sonar: 'S7721', rule: 'unicorn/consistent-function-scoping' },
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

/** The ESM-only Sonar way rules: S7785 prefers top-level await (see SONAR_WAY_NOT_APPLICABLE). */
const SONAR_WAY_ESM = Object.freeze([{ sonar: 'S7785', rule: 'unicorn/prefer-top-level-await' }]);

/** The Sonar id a sonarjs rule documents (its docs url ends in `#/rspec/S<id>/javascript`), or null. */
const sonarIdOf = (rule) => /\/rspec\/#\/rspec\/(S\d+)\//u.exec(rule?.meta?.docs?.url ?? '')?.[1] ?? null;

/**
 * The Sonar way rules, `{ rules, mapped }`: `rules` the flat-config rule levels (sonarjs' recommended rules at error minus the owned ones,
 * with S3776's limit, then SONAR_WAY_EXTRA, then the ESM-only rules unless `side` is `be`), `mapped` every `{ sonar, rule }` row.
 *
 * @param {object} sonarjs - The eslint-plugin-sonarjs plugin.
 * @param {'be' | 'fe'} [side] - The side the rules lint; the back end compiles to CommonJS.
 */
export function sonarWayRules(sonarjs, side = 'fe') {
  const mapped = [];
  const rules = {};
  for (const [name, setting] of Object.entries(sonarjs.configs.recommended.rules)) {
    if ((Array.isArray(setting) ? setting[0] : setting) !== 'error' || SONAR_WAY_OWNED[name]) continue;
    const declared = Array.isArray(setting) ? setting.slice(1) : [];
    const options = name === 'sonarjs/cognitive-complexity' ? [COGNITIVE_COMPLEXITY_LIMIT] : declared;
    rules[name] = ['error', ...options];
    mapped.push({ sonar: sonarIdOf(sonarjs.rules[name.slice('sonarjs/'.length)]), rule: name });
  }
  for (const entry of [...SONAR_WAY_EXTRA, ...SONAR_WAY_ESM.filter(row => !SONAR_WAY_NOT_APPLICABLE[side][row.sonar])]) {
    rules[entry.rule] = ['error', ...(entry.options ?? [])];
    mapped.push({ sonar: entry.sonar, rule: entry.rule });
  }
  return { rules, mapped };
}
