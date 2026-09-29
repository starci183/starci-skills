/**
 * `starci/no-important` (HFS R61 `FE_STYLE_TOKEN_ONLY`): no `!important`, in a declaration or on an `@apply`
 * utility (`!p-4`, `p-4!`).
 *
 * `!important` wins a specificity fight by making the next one unwinnable; it is how an override of the grammar's
 * anatomy survives a re-brand it should not. The layer order the grammar ships already decides who wins.
 */
import { makeRule } from "./lib/make-rule.mjs"

export const noImportant = makeRule(
  "no-important",
  {
    declaration: (prop) =>
      `\`${prop}\` is \`!important\`. Fix the cascade instead: the grammar's layers already decide who wins.`,
    apply: (utility) => `\`@apply ${utility}\` forces importance. Remove the \`!\`; fix the cascade instead.`,
  },
  ({ root, report }) => {
    root.walkDecls((decl) => {
      if (decl.important || /!\s*important/i.test(decl.value)) report(decl, "declaration", [decl.prop], { word: "!important" })
    })
    root.walkAtRules("apply", (rule) => {
      for (const utility of rule.params.split(/\s+/).filter(Boolean)) {
        if (/^!|!$|!important/i.test(utility)) report(rule, "apply", [utility], { word: utility })
      }
    })
  },
)
