/**
 * The rule that holds `native-controls.md` (HFS R62, `FE_NATIVE_FORM_CONTROL`).
 *
 * THE GRAMMAR OWNS THE CONTROL. A bare `<select>`, `<input>`, `<textarea>` or `<button>` in product
 * source is a control with no focus ring, no dark value, no density, no disabled or invalid state
 * from the design system - it looks native on one platform and is styled by hand on the next, and
 * the hand styling is where the private colour and pixel values came from (see `brand-values`).
 * The renderer the grammar publishes is the same element with the state the product needs.
 *
 * NO TIER IS EXEMPT. The grammar package itself is not linted by this canon (it is where the native
 * element legitimately lives); everything the product owns - leaves included - renders the grammar's
 * control. If the grammar lacks the control, the fix is to add it to the grammar, not to draw one here.
 */

import { isSpecFile } from "./lib/scope.mjs"

/** Intrinsic elements a reader operates, that the grammar renders for the product. */
const NATIVE = new Set(["select", "input", "textarea", "button"])

/** No native form control in product source. */
export const noNativeFormControl = {
  meta: {
    type: "problem",
    docs: { description: "Use the grammar's renderers; never a bare select, input, textarea or button." },
    schema: [],
    messages: {
      native:
        "A bare `<{{tag}}>`. The grammar owns this control: it brings the focus ring, disabled and invalid states, density and the dark value, and a hand-styled native element brings none of them. Use the grammar's renderer; if it does not exist yet, add it to the grammar rather than drawing one here.",
    },
  },
  create(context) {
    if (isSpecFile(context.filename || context.getFilename())) return {}
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier" || !NATIVE.has(node.name.name)) return
        context.report({ node, messageId: "native", data: { tag: node.name.name } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-native-form-control": noNativeFormControl,
}

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
