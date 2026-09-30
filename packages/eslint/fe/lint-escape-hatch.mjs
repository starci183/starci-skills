/**
 * The rule and flat-config fence that hold `lint-escape-hatch.md` (HFS R18, `HFS_INLINE_SUPPRESSION`).
 *
 * NO LOCAL EXCEPTION, OF ANY SPELLING. A rule that a comment can switch off is a convention, and a
 * codebase learns which conventions are real by which ones it can suppress. The spellings this law
 * refuses are the ones an author actually reaches for:
 *
 *   eslint-disable / -next-line / -line / -enable / -env, and `/* eslint rule: "off" *\/`
 *   @ts-ignore, @ts-expect-error, @ts-nocheck
 *   vn-ok: <reason>   - the retired second-language pragma; it excuses nothing any more
 *
 * TWO LAYERS, BECAUSE ONE IS NOT ENOUGH. The flat-config fence (`noInlineConfig`) makes an ESLint
 * directive INEFFECTIVE; this rule makes it a FINDING, so the attempt is named in the log instead of
 * silently ignored. `reportUnusedDisableDirectives` closes the last gap: a directive that suppresses
 * nothing is dead weight that reads as if it did.
 */

import { isE2eFile, isProductFile, isSpecFile } from "./lib/scope.mjs"
import { normalizePath } from "./lib/path.mjs"

/** Product source, its specs and the e2e tree are governed; canon tests deliberately build forbidden directives. */
const isGoverned = (filename) => {
  const file = normalizePath(filename)
  return isProductFile(file) || isSpecFile(file) || isE2eFile(file)
}

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

/** The retired second-language pragma. Present anywhere in a comment, it is a finding. */
const RETIRED_PRAGMA = /\bvn-ok:/

/** Inline lint configuration is repository policy, never a file-local choice. */
export const noInlineLintConfig = {
  meta: {
    type: "problem",
    docs: { description: "Source cannot change its own lint or type-check policy, and the vn-ok pragma is retired." },
    schema: [],
    messages: {
      directive:
        "Inline ESLint configuration makes this file the author of whether repository law applies. Remove the directive and fix the code or the shared rule; there is no local exception path.",
      typescript:
        "A TypeScript suppression directive. It turns the compiler off for code that is failing the check for a reason. Fix the type, or change the shared contract that produced it; there is no local exception path.",
      pragma:
        "`vn-ok:` was the second-language escape hatch and it is retired: user-facing text comes from a `next-intl` catalogue through `t()`, and there is no comment that excuses a literal. Remove the pragma and move the string.",
    },
  },
  create(context) {
    if (!isGoverned(context.filename || context.getFilename())) return {}
    const source = context.sourceCode || context.getSourceCode()
    return {
      Program() {
        for (const comment of source.getAllComments()) {
          if (ESLINT_DIRECTIVE.test(comment.value)) context.report({ node: comment, messageId: "directive" })
          else if (TS_DIRECTIVE.test(comment.value)) context.report({ node: comment, messageId: "typescript" })
          else if (RETIRED_PRAGMA.test(comment.value)) context.report({ node: comment, messageId: "pragma" })
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
