/**
 * Vendor ownership rules for the traditional React component hierarchy.
 *
 * Vendor primitives stay behind named leaves or mechanics branches. This boundary is deliberately
 * independent of product composition protocols; ordinary React children and props remain valid.
 */

const normalize = (filename) => String(filename || "").replace(/\\/g, "/")
const componentFile = (filename) => /\/src\/components\//.test(normalize(filename))
const leafFile = (filename) => /\/src\/components\/leaves\//.test(normalize(filename))
const mechanicsFile = (filename) => /\/src\/components\/(branches|overlays)\//.test(normalize(filename))
const classNamesFile = (filename) => /\/src\/components\/.*\/classNames\.tsx?$/.test(normalize(filename))

/** Keep HeroUI mechanics inside leaves, named mechanics branches, and styling-owner modules. */
export const vendorPrimitiveHasNamedOwner = {
  meta: { type: "problem", docs: { description: "HeroUI primitives have a named component or styling owner." }, schema: [], messages: { owner: "Import HeroUI primitives from a named leaf, mechanics branch, or colocated classNames module." } },
  create(context) {
    const file = context.filename || context.getFilename()
    if (!componentFile(file) || leafFile(file) || mechanicsFile(file) || classNamesFile(file)) return {}
    return { ImportDeclaration(node) { if (String(node.source.value) === "@heroui/react") context.report({ node, messageId: "owner" }) } }
  },
}

export const rules = {
  "vendor-primitive-has-named-owner": vendorPrimitiveHasNamedOwner,
}

export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
