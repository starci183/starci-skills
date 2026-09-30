/**
 * The rule that holds "no suppression anywhere" (catalog R18 `HFS_INLINE_SUPPRESSION`).
 *
 * `no-inline-suppression` reports every comment that switches a check off, or declares an exemption, at the place it
 * is written:
 *
 *   - ESLint: `eslint-disable` / `eslint-enable` in every form, an `eslint <rule>: off` configuration comment,
 *     `eslint-env`, and a `/* global x *\/` declaration;
 *   - TypeScript: `@ts-ignore`, `@ts-expect-error` and `@ts-nocheck`, wherever they sit in a comment;
 *   - coverage: `istanbul ignore`, `c8 ignore`, `v8 ignore`;
 *   - Sonar: `NOSONAR` and `sonar-disable`;
 *   - Prettier: `prettier-ignore`;
 *   - the `vn-ok` language marker.
 *
 * The factory also sets `noInlineConfig: true`, so ESLint itself ignores such a comment; this rule is what turns the
 * ignored comment into a failure a person reads, instead of a silent no-op that looks like an exemption. There is no
 * exit here: fix the code, or propose a change to the canon.
 */

const ESLINT_DIRECTIVE = /^\s*eslint-(?:disable|enable|env)(?:-next-line|-line)?(?:\s|$)/
const ESLINT_CONFIG = /^\s*eslint\s+[@\w/-]+\s*:\s*(?:0|1|2|off|warn|error|\[)/
const GLOBAL_DECLARATION = /^\s*globals?\s+[\w$]/
const TS_DIRECTIVE = /@ts-(?:ignore|expect-error|nocheck)\b/
const COVERAGE_IGNORE = /(?:^|[\s*/])(?:istanbul|c8|v8)\s+ignore\b/
const SONAR = /\bNOSONAR\b|\bsonar-(?:disable|enable)\b/i
const PRETTIER_IGNORE = /(?:^|[\s*/])prettier-ignore\b/
const LANGUAGE_MARKER = /\bvn-ok\b/

/** The finding a comment is, or null when it is ordinary prose. `/* global x *\/` is a block-comment form only. */
const kindOf = (comment) => {
    const text = comment.value
    if (ESLINT_DIRECTIVE.test(text) || ESLINT_CONFIG.test(text)) return "eslint"
    if (comment.type === "Block" && GLOBAL_DECLARATION.test(text)) return "eslint"
    if (TS_DIRECTIVE.test(text)) return "typescript"
    if (COVERAGE_IGNORE.test(text)) return "coverage"
    if (SONAR.test(text)) return "sonar"
    if (PRETTIER_IGNORE.test(text)) return "prettier"
    if (LANGUAGE_MARKER.test(text)) return "vn-ok"
    return null
}

/** No comment switches a check off at the place it is written. */
export const noInlineSuppression = {
    meta: {
        type: "problem",
        docs: { description: "No eslint, TypeScript, coverage, Sonar or Prettier suppression comment, and no vn-ok marker." },
        schema: [],
        messages: {
            eslint: "An `eslint-disable`/`eslint-enable`, `eslint-env`, `/* global */` or rule-configuration comment. HFS does not switch a rule off or declare a global in place: fix the code, or propose a change to the rule in the canon.",
            typescript: "A `@ts-` directive silences the compiler at one place. Fix the type, or narrow it with a guard.",
            coverage: "An `istanbul`/`c8`/`v8 ignore` comment hides code from coverage. Write the test that covers it, or delete the code that nothing reaches.",
            sonar: "A `NOSONAR` or `sonar-disable` comment hides a finding from Sonar. Fix the finding.",
            prettier: "A `prettier-ignore` comment exempts code from the formatter. Let the formatter write it.",
            "vn-ok": "A `vn-ok` marker exempts a line from the language rule. HFS keeps no exemption marker: write the text in English, or move the data to a locale or data file.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode || context.getSourceCode()
        return {
            "Program:exit"() {
                for (const comment of sourceCode.getAllComments()) {
                    const kind = kindOf(comment)
                    if (kind) context.report({ loc: comment.loc, messageId: kind })
                }
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "no-inline-suppression": noInlineSuppression,
}

/** Error from the start: there is no baseline and no allowlist for a suppression. */
export const recommended = {
    "starci-be/no-inline-suppression": "error",
}
