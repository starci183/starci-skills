/**
 * Vendor ownership rules for the traditional React component hierarchy.
 *
 * Vendor primitives stay behind named leaves or mechanics branches. This boundary is deliberately
 * independent of product composition protocols; ordinary React children and props remain valid.
 */

import { isComponentFile, kindOfFile, roleOfFile } from "./lib/scope.mjs"

/** The layers that may hold vendor mechanics: leaves and branches. */
const MECHANICS_LAYERS = new Set(["leaves", "branches"])

/** Keep HeroUI mechanics inside leaves, branches, and styling-owner modules (the `styles` file of a component). */
export const vendorPrimitiveHasNamedOwner = {
  meta: { type: "problem", docs: { description: "HeroUI primitives have a named component or styling owner." }, schema: [], messages: { owner: "Import HeroUI primitives from a named leaf, mechanics branch, or colocated classNames module." } },
  create(context) {
    if (!isComponentFile(context) || MECHANICS_LAYERS.has(kindOfFile(context)) || roleOfFile(context) === "styles") return {}
    return { ImportDeclaration(node) { if (String(node.source.value) === "@heroui/react") context.report({ node, messageId: "owner" }) } }
  },
}

export const rules = {
  "vendor-primitive-has-named-owner": vendorPrimitiveHasNamedOwner,
}

export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
