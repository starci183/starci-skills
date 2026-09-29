/**
 * `starci/no-css-module` (HFS R61 `FE_STYLE_TOKEN_ONLY`): no `*.module.css`.
 *
 * A CSS module is a private stylesheet for one component, and a private stylesheet is where the second design
 * system starts: its class names are the component's own vocabulary, its values are written in place. Styling goes
 * through grammar components and tokens; a component that needs something the grammar lacks gets it added to the
 * grammar. Nothing else in a `*.module.css` is judged once the file is refused.
 */
import { makeRule } from "./lib/make-rule.mjs"
import { fileKind, fileOf } from "./lib/scope.mjs"

export const noCssModule = makeRule(
  "no-css-module",
  {
    banned: (file) =>
      `\`${file}\` is a CSS module. CSS modules are banned: style through grammar components and tokens, and add what the grammar lacks to the grammar.`,
  },
  ({ root, report }) => {
    const file = fileOf(root)
    if (fileKind(file) !== "module") return
    report(root.first ?? root, "banned", [file.replaceAll("\\", "/").split("/").pop()])
  },
)
