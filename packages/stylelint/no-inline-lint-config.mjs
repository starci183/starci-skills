/**
 * `starci/no-inline-lint-config` (HFS `HFS_INLINE_SUPPRESSION`): no `stylelint-disable`, `stylelint-enable` or
 * `stylelint-disable-next-line` comment. A rule that fires is fixed, or changed in the canon; it is not switched
 * off at the line. The factory also sets `ignoreDisables`, so a comment that slips through switches nothing off.
 */
import { makeRule } from "./lib/make-rule.mjs"

export const noInlineLintConfig = makeRule(
  "no-inline-lint-config",
  {
    comment: (text) =>
      `\`/* ${text} */\` switches a rule off at the line. Fix the cause, or propose the change to the canon; nothing is suppressed inline.`,
  },
  ({ root, report }) => {
    root.walkComments((comment) => {
      const text = comment.text.trim()
      if (/^stylelint-(?:disable|enable)/.test(text)) report(comment, "comment", [text.split(/\s+/)[0]])
    })
  },
)
