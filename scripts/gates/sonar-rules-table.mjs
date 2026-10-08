// sonar-rules-table.mjs - the Sonar rules the `sonar-rules` gate enforces before merge: Sonar id -> local ESLint rule, one table.
// The ids are the ones SonarCloud flagged on this project (scans of 2026-10-06..08). A local rule is either a port SonarSource ships
// (eslint-plugin-sonarjs), the unicorn rule a Sonar S7xxx rule is built from, an ESLint core rule, or one of ./sonar-own-rules.mjs.
// SonarCloud stays the final measurement; this table is the part of it that runs in seconds, before the code is merged.
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import { ownRules } from './sonar-own-rules.mjs';

const COGNITIVE_COMPLEXITY_LIMIT = 15;
const MAX_PARAMETERS = 7;

/** {sonar, rule, options?, type, note?}: `rule` is `<plugin>/<name>` (the core rules have no plugin). */
export const RULES = Object.freeze([
  { sonar: 'S3776', rule: 'sonarjs/cognitive-complexity', options: [COGNITIVE_COMPLEXITY_LIMIT], type: 'smell' },
  { sonar: 'S107', rule: 'max-params', options: [MAX_PARAMETERS], type: 'smell' },
  { sonar: 'S4624', rule: 'sonarjs/no-nested-template-literals', type: 'smell' },
  { sonar: 'S3358', rule: 'sonarjs/no-nested-conditional', type: 'smell' },
  { sonar: 'S1121', rule: 'sonarjs/no-nested-assignment', type: 'smell' },
  { sonar: 'S1128', rule: 'sonarjs/unused-import', type: 'smell' },
  { sonar: 'S2310', rule: 'sonarjs/updated-loop-counter', type: 'smell' },
  { sonar: 'S1529', rule: 'sonarjs/bitwise-operators', type: 'bug' },
  { sonar: 'S2871', rule: 'starci-sonar/no-alphabetical-sort', type: 'bug', note: 'own rule: the sonarjs port needs type information and reports nothing on plain JavaScript' },
  { sonar: 'S5869', rule: 'sonarjs/duplicates-in-character-class', type: 'smell' },
  { sonar: 'S8786', rule: 'sonarjs/super-linear-regex', type: 'smell' },
  { sonar: 'S9382', rule: 'no-await-in-loop', type: 'smell', note: 'ESLint core; stricter than Sonar, which leaves some early-exit loops alone' },
  { sonar: 'S4138', rule: 'unicorn/no-for-loop', type: 'smell' },
  { sonar: 'S7727', rule: 'starci-sonar/callback-arity', type: 'bug', note: 'own rule: unicorn/no-array-callback-reference would flag the 500+ one-parameter references Sonar accepts' },
  { sonar: 'S7732', rule: 'unicorn/no-instanceof-builtins', type: 'smell' },
  { sonar: 'S7740', rule: 'unicorn/no-this-assignment', type: 'smell' },
  { sonar: 'S7744', rule: 'unicorn/no-useless-fallback-in-spread', type: 'smell' },
  { sonar: 'S7747', rule: 'unicorn/no-useless-spread', type: 'smell' },
  { sonar: 'S7758', rule: 'unicorn/prefer-code-point', type: 'smell' },
  { sonar: 'S7767', rule: 'unicorn/prefer-math-trunc', type: 'smell' },
  { sonar: 'S7770', rule: 'unicorn/prefer-native-coercion-functions', type: 'smell' },
  { sonar: 'S7776', rule: 'unicorn/prefer-set-has', type: 'smell' },
  { sonar: 'S7778', rule: 'unicorn/prefer-single-call', type: 'smell' },
  { sonar: 'S7780', rule: 'unicorn/prefer-string-raw', type: 'smell' },
  { sonar: 'S6582', rule: 'starci-sonar/prefer-optional-chain', type: 'smell', note: 'own rule: typescript-eslint\'s needs type information' },
  { sonar: 'S9383', rule: 'starci-sonar/floating-promise', type: 'bug', note: 'own rule, syntactic: Promise.*, open .then chains and same-file async functions; typescript-eslint\'s needs type information' },
  { sonar: 'S1516', rule: 'starci-sonar/no-line-separator-escape', type: 'smell' },
]);

/** The Sonar ids this project was flagged for that no local rule can judge, with the reason. */
export const NOT_COVERED = Object.freeze([
  { sonar: 'S4790', reason: 'security hotspot: needs the context of the hashed value' },
  { sonar: 'S2612', reason: 'security hotspot: needs the file-system permission context' },
  { sonar: 'S4036', reason: 'security hotspot: needs PATH provenance' },
  { sonar: 'jssecurity:S5144', reason: 'taint analysis (SSRF): needs Sonar\'s inter-procedural data-flow engine' },
  { sonar: 'jssecurity:S5145', reason: 'taint analysis (log injection): needs the data-flow engine' },
  { sonar: 'jssecurity:S8689', reason: 'taint analysis (sensitive data in logs): needs the data-flow engine' },
  { sonar: 'jssecurity:S8703', reason: 'taint analysis (LLM-supplied arguments, SSRF): needs the data-flow engine' },
  { sonar: 'jssecurity:S8707', reason: 'taint analysis (LLM-supplied arguments, path traversal): needs the data-flow engine' },
]);

const PLUGINS = Object.freeze({ sonarjs, unicorn, 'starci-sonar': { rules: ownRules } });

/** The Sonar id of an ESLint rule id, or the rule id itself when the table does not know it. */
export const sonarIdOf = (ruleId) => RULES.find((entry) => entry.rule === ruleId)?.sonar ?? ruleId;

/** The ESLint flat config that enables exactly the table's rules for `.mjs` modules. */
export function sonarFlatConfig() {
  return [{
    files: ['**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    linterOptions: { reportUnusedDisableDirectives: 'off', noInlineConfig: true },
    plugins: PLUGINS,
    rules: Object.fromEntries(RULES.map((entry) => [entry.rule, ['error', ...(entry.options ?? [])]])),
  }];
}
