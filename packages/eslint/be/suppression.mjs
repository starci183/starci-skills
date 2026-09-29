/**
 * The rule that holds "no suppression anywhere" (catalog R18 `HFS_INLINE_SUPPRESSION`).
 *
 * `no-inline-suppression` reports every comment that switches a check off at the place it is written:
 * `eslint-disable` in all its forms (block, line, next-line, and the matching `eslint-enable`), an
 * `eslint <rule>: off` configuration comment, `@ts-ignore`, `@ts-expect-error`, `@ts-nocheck`, and the
 * `vn-ok` language marker. The factory also sets `noInlineConfig: true`, so ESLint itself ignores such a
 * comment; this rule is what turns the ignored comment into a failure a person reads, instead of a silent
 * no-op that looks like an exemption.
 *
 * It replaces `no-line-suppression`, which named only the type-safety rules and so let every other rule be
 * silenced. There is no exit here: fix the code, or propose a change to the canon.
 */

const DISABLE = /^\s*eslint-(?:disable|enable)(?:-next-line|-line)?(?:\s|$)/
const CONFIG = /^\s*eslint\s+[@\w/-]+\s*:\s*(?:0|1|2|off|warn|error|\[)/
const TS_DIRECTIVE = /^\s*(?:\/\s*)?@ts-(?:ignore|expect-error|nocheck)\b/
const LANGUAGE_MARKER = /\bvn-ok\b/

const kindOf = (text) => {
    if (DISABLE.test(text) || CONFIG.test(text)) return "eslint"
    if (TS_DIRECTIVE.test(text)) return "typescript"
    if (LANGUAGE_MARKER.test(text)) return "vn-ok"
    return null
}

/** No comment switches a check off at the place it is written. */
export const noInlineSuppression = {
    meta: {
        type: "problem",
        docs: { description: "No eslint-disable, ts-ignore, ts-expect-error, ts-nocheck or vn-ok comment." },
        schema: [],
        messages: {
            eslint: "An `eslint-disable`/`eslint-enable` or rule-configuration comment. HFS does not switch a rule off in place: fix the code, or propose a change to the rule in the canon.",
            typescript: "A `@ts-` directive silences the compiler at one place. Fix the type, or narrow it with a guard.",
            "vn-ok": "A `vn-ok` marker exempts a line from the language rule. HFS keeps no exemption marker: write the text in English, or move the data to a locale or data file.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode || context.getSourceCode()
        return {
            "Program:exit"() {
                for (const comment of sourceCode.getAllComments()) {
                    const kind = kindOf(comment.value)
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
