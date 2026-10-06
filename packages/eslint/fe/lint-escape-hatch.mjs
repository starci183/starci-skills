/**
 * The rule and flat-config fence that hold `lint-escape-hatch.md` (HFS R18, `HFS_INLINE_SUPPRESSION`).
 *
 * NO LOCAL EXCEPTION, OF ANY SPELLING. A rule that a comment can switch off is a convention, and a
 * codebase learns which conventions are real by which ones it can suppress. The spellings this law
 * refuses are the ones an author actually reaches for:
 *
 *   eslint-disable / -next-line / -line / -enable / -env, and `/* eslint rule: "off" *\/`
 *   @ts-ignore, @ts-expect-error, @ts-nocheck
 *   NOSONAR, @sonar-ignore                        - Sonar's own switches
 *   istanbul ignore, c8 ignore, v8 ignore         - a line taken out of the coverage the gate reads
 *   prettier-ignore                               - a region taken out of the formatter
 *   stylelint-disable / -enable                   - a stylelint switch that reached a TS file
 *
 * TWO LAYERS, BECAUSE ONE IS NOT ENOUGH. The flat-config fence (`noInlineConfig`) makes an ESLint
 * directive INEFFECTIVE; this rule makes it a FINDING, so the attempt is named in the log instead of
 * silently ignored. `reportUnusedDisableDirectives` closes the last gap: a directive that suppresses
 * nothing is dead weight that reads as if it did.
 */

import { isProductSource } from "./lib/scope.mjs"

/** Product source is governed; canon tests deliberately build forbidden directives. */
const isGoverned = (context) => isProductSource(context)

/**
 * Any directive that changes ESLint's active rule set inside a source file.
 *
 * ANCHORED AT THE START OF THE COMMENT, because that is the only place ESLint itself honours one:
 * a directive is recognised from the first non-space character of the comment body and nowhere else.
 * An unanchored pattern matched the WORD instead of the directive, so a comment explaining why a
 * file carries no `eslint-disable` was reported as carrying one - and the only way to silence that
 * was to stop writing the explanation, which is the opposite of what this law wants. Under-catching
 * is not the trade: a directive ESLint would obey always sits at the start.
 */
const ESLINT_DIRECTIVE = /^\s*eslint-(?:disable(?:-next-line|-line)?|enable|env)\b|^\s*eslint\s+[@\w/-]+\s*:/

/** A TypeScript directive that turns the compiler's check off for the next line or the file. */
const TS_DIRECTIVE = /^\s*(?:\/\s*)?@ts-(?:ignore|expect-error|nocheck)\b/

/**
 * A quality-tool switch other than ESLint's: Sonar honours `NOSONAR` anywhere in a comment (case-insensitively), so it is
 * matched anywhere; the others are read by their tool from the start of the comment, so they are anchored there too.
 */
const TOOL_DIRECTIVE =
  /\bNOSONAR\b|^\s*@sonar-ignore\b|^\s*(?:istanbul|c8|v8)\s+ignore\b|^\s*prettier-ignore(?:-start|-end)?\b|^\s*stylelint-(?:disable(?:-next-line|-line)?|enable)\b/i

/** Inline lint configuration is repository policy, never a file-local choice. */
export const noInlineLintConfig = {
  meta: {
    type: "problem",
    docs: { description: "Source cannot change its own lint or type-check policy." },
    schema: [],
    messages: {
      directive:
        "Inline ESLint configuration makes this file the author of whether repository law applies. Remove the directive and fix the code or the shared rule; there is no local exception path.",
      typescript:
        "A TypeScript suppression directive. It turns the compiler off for code that is failing the check for a reason. Fix the type, or change the shared contract that produced it; there is no local exception path.",
      tool:
        "A Sonar, coverage, formatter or stylelint suppression (`NOSONAR`, `@sonar-ignore`, `istanbul ignore`, `c8 ignore`, `prettier-ignore`, `stylelint-disable`). It removes this code from a gate that is failing it for a reason, and the next reader cannot tell a measured exception from an avoided fix. Fix the code, or change the shared rule or the coverage threshold; there is no local exception path.",
    },
  },
  create(context) {
    if (!isGoverned(context)) return {}
    const source = context.sourceCode || context.getSourceCode()
    return {
      Program() {
        for (const comment of source.getAllComments()) {
          if (ESLINT_DIRECTIVE.test(comment.value)) context.report({ node: comment, messageId: "directive" })
          else if (TS_DIRECTIVE.test(comment.value)) context.report({ node: comment, messageId: "typescript" })
          else if (TOOL_DIRECTIVE.test(comment.value)) context.report({ node: comment, messageId: "tool" })
        }
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-inline-lint-config": noInlineLintConfig,
}

/** Every lint escape is a build error. */
export const recommended = {
  "starci-fe/no-inline-lint-config": "error",
}
