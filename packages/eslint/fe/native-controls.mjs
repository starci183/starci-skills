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

import { attribute } from "./lib/ast.mjs"
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

// -- NATIVE-2 --------------------------------------------------------------------------------------

/** No bare `<img>`; the framework's image owns size, format, lazy loading and layout shift. */
export const noNativeImg = {
  meta: {
    type: "problem",
    docs: { description: "Use `next/image`, never a bare `<img>`." },
    schema: [],
    messages: {
      img:
        "A bare `<img>` ships the original file at its original size, reserves no space (the page jumps when it loads) and is never lazy by policy. Use `Image` from `next/image` with `width` and `height`, or `fill` and `sizes`, and an `alt` from the message catalogue.",
    },
  },
  create(context) {
    if (isSpecFile(context.filename || context.getFilename())) return {}
    return {
      JSXOpeningElement(node) {
        if (node.name.type === "JSXIdentifier" && node.name.name === "img") context.report({ node, messageId: "img" })
      },
    }
  },
}

// -- NATIVE-3 --------------------------------------------------------------------------------------

/** Every `next/image` reserves its space: a size, or `fill` inside a sized parent with `sizes`. */
export const imageHasSize = {
  meta: {
    type: "problem",
    docs: { description: "`next/image` carries `width` and `height`, or `fill` with `sizes`." },
    schema: [],
    messages: {
      size:
        "This `Image` has no `width` and `height` and is not `fill`. The browser cannot reserve its space, so the page shifts when it loads and the layout score falls. Give it both dimensions, or `fill` inside a sized parent.",
      sizes:
        "This `Image` is `fill` with no `sizes`. Next then assumes the image is as wide as the viewport and downloads the largest variant on every screen. State the rendered width: `sizes=\"(min-width: 768px) 33vw, 100vw\"`.",
    },
  },
  create(context) {
    if (isSpecFile(context.filename || context.getFilename())) return {}
    const locals = new Set()
    return {
      ImportDeclaration(node) {
        if (node.source.value !== "next/image") return
        for (const specifier of node.specifiers) if (specifier.type === "ImportDefaultSpecifier") locals.add(specifier.local.name)
      },
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier" || !locals.has(node.name.name)) return
        // A spread may carry the size; the rule judges what it can read.
        if (node.attributes.some((entry) => entry.type === "JSXSpreadAttribute")) return
        const fill = attribute(node, "fill")
        if (fill) {
          if (!attribute(node, "sizes")) context.report({ node, messageId: "sizes" })
          return
        }
        if (!attribute(node, "width") || !attribute(node, "height")) context.report({ node, messageId: "size" })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-native-form-control": noNativeFormControl,
  "no-native-img": noNativeImg,
  "image-has-size": imageHasSize,
}

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
