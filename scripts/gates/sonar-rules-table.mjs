// sonar-rules-table.mjs - the Sonar rules the `sonar-rules` gate enforces before merge: Sonar id -> local ESLint rule, one table.
// The ids are the ones SonarCloud flagged on this project (scans of 2026-10-06..08). A local rule is either a port SonarSource ships
// (eslint-plugin-sonarjs), the unicorn rule a Sonar S7xxx rule is built from, an ESLint core rule, or one of ./sonar-own-rules.mjs.
// SonarCloud stays the final measurement; this table is the part of it that runs in seconds, before the code is merged.
import { createRequire } from 'node:module';
import path from 'node:path';
import sonarjs from 'eslint-plugin-sonarjs';
import unicorn from 'eslint-plugin-unicorn';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { SONAR_SYNTAX_RULES } from '../lib/sonar-syntax-rules.mjs';
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

/**
 * The rules the `sonar-rules` gate enforces over the TypeScript the example apps scan (examples/<app>/sonar-project.properties): the same
 * shape as RULES. Most are the syntax rules both lint canons publish to every product (scripts/lib/sonar-syntax-rules.mjs); S8786 is the
 * Sonar port that analyses regex backtracking, which the canons do not carry because it needs a dependency.
 */
export const TS_RULES = Object.freeze([
  { sonar: 'S9382', rule: 'starci-canon/no-await-in-loop', type: 'smell' },
  { sonar: 'S7758', rule: 'starci-canon/prefer-code-point', type: 'smell' },
  { sonar: 'S7780', rule: 'starci-canon/prefer-string-raw', type: 'smell' },
  { sonar: 'S3358', rule: 'starci-canon/no-nested-conditional', type: 'smell' },
  { sonar: 'S3735', rule: 'starci-canon/no-void-operator', type: 'smell' },
  { sonar: 'S1128', rule: 'starci-canon/no-unused-import', type: 'smell' },
  { sonar: 'S7763', rule: 'starci-canon/prefer-export-from', type: 'smell' },
  { sonar: 'S6767', rule: 'starci-canon/no-unused-prop-types', type: 'smell' },
  { sonar: 'S8786', rule: 'sonarjs/super-linear-regex', type: 'smell' },
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
  { sonar: 'S1874', reason: 'a deprecated API of a library (example apps): needs the type checker; the lint canons turn on typescript-eslint no-deprecated, which `starci app lint` runs, not this fast check' },
  { sonar: 'S6551', reason: 'an object turned into text (example apps): needs the type checker; the lint canons turn on typescript-eslint no-base-to-string, which `starci app lint` runs, not this fast check' },
  { sonar: 'S7503', reason: 'an async function that never awaits (example apps): Sonar spares one that returns a promise, which only the type checker knows; the lint canons turn on typescript-eslint require-await, which `starci app lint` runs, not this fast check' },
]);

const PLUGINS = Object.freeze({ sonarjs, unicorn, 'starci-sonar': { rules: ownRules }, 'starci-canon': { rules: SONAR_SYNTAX_RULES } });

/** The Sonar id of an ESLint rule id, or the rule id itself when no table knows it. */
export const sonarIdOf = (ruleId) => [...RULES, ...TS_RULES].find((entry) => entry.rule === ruleId)?.sonar ?? ruleId;

const rulesOf = (table) => Object.fromEntries(table.map((entry) => [entry.rule, ['error', ...(entry.options ?? [])]]));

/** The TypeScript parser of the example scope: a devDependency of the root package, installed by `npm ci`. */
const typescriptParser = () => {
  try {
    return createRequire(path.join(skillRoot, 'package.json'))('@typescript-eslint/parser');
  } catch (cause) {
    throw new Error('the sonar-rules gate parses the example apps with @typescript-eslint/parser: run npm ci', { cause });
  }
};

/** The ESLint flat config that enables exactly the tables' rules: RULES for `.mjs` modules, TS_RULES for `.ts` and `.tsx` files (when `typescript`, which loads the parser). */
export function sonarFlatConfig({ typescript = true } = {}) {
  const linterOptions = { reportUnusedDisableDirectives: 'off', noInlineConfig: true };
  const modules = { files: ['**/*.mjs'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module' }, linterOptions, plugins: PLUGINS, rules: rulesOf(RULES) };
  if (!typescript) return [modules];
  return [modules, { files: ['**/*.ts', '**/*.tsx'], languageOptions: { parser: typescriptParser(), ecmaVersion: 'latest', sourceType: 'module' }, linterOptions, plugins: PLUGINS, rules: rulesOf(TS_RULES) }];
}
