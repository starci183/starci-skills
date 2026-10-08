/**
 * The law that keeps the code clear of the smells SonarCloud measures (R235 `SCAN_SMELL`).
 *
 * Each rule is the syntax-tree form of one Sonar rule, shared with the back-end canon (scripts/lib/sonar-syntax-rules.mjs,
 * bundled under `runtime/`): `no-await-in-loop` (S9382), `prefer-code-point` (S7758),
 * `prefer-string-raw` (S7780), `no-nested-conditional` (S3358), `no-void-operator` (S3735), `no-unused-import` (S1128),
 * `prefer-export-from` (S7763) and `no-unused-prop-types` (S6767). The three Sonar rules that need the type checker, S1874 (a deprecated
 * API), S6551 (an object turned into text) and S7503 (an `async` function that never awaits), are the typescript-eslint rules
 * `no-deprecated`, `no-base-to-string` and `require-await` the factory turns on.
 */
import { SONAR_SYNTAX_RULES } from "./runtime/scripts/lib/sonar-syntax-rules.mjs"

const NAMES = ["no-await-in-loop", "prefer-code-point", "prefer-string-raw", "no-nested-conditional", "no-void-operator", "no-unused-import", "prefer-export-from", "no-unused-prop-types"]

/** The rules this law contributes to the plugin. */
export const rules = Object.fromEntries(NAMES.map((name) => [name, SONAR_SYNTAX_RULES[name]]))

/** Starts at error: a repository's fix lane clears the debt before the rule ships. */
export const recommended = Object.fromEntries(NAMES.map((name) => [`starci-fe/${name}`, "error"]))
