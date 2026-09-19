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

/** Keep direct Heroicons imports in the Icon leaf. */
export const noVendorIconOutsideIconLeaf = {
  meta: { type: "problem", docs: { description: "Vendor Heroicons imports belong in the Icon leaf." }, schema: [], messages: { owner: "Import vendor glyphs through the Icon leaf." } },
  create(context) {
    if (!componentFile(context.filename || context.getFilename()) || leafFile(context.filename || context.getFilename())) return {}
    return { ImportDeclaration(node) { if (/^@heroicons\//.test(String(node.source.value))) context.report({ node, messageId: "owner" }) } }
  },
}

/** Keep HeroUI mechanics inside leaves, named mechanics branches, and styling-owner modules. */
export const vendorPrimitiveHasNamedOwner = {
  meta: { type: "problem", docs: { description: "HeroUI primitives have a named component or styling owner." }, schema: [], messages: { owner: "Import HeroUI primitives from a named leaf, mechanics branch, or colocated classNames module." } },
  create(context) {
    const file = context.filename || context.getFilename()
    if (!componentFile(file) || leafFile(file) || mechanicsFile(file) || classNamesFile(file)) return {}
    return { ImportDeclaration(node) { if (String(node.source.value) === "@heroui/react") context.report({ node, messageId: "owner" }) } }
  },
}

/** Internal navigation uses the application's routed link owner. */
export const noInternalStarciHref = {
  meta: { type: "problem", docs: { description: "Internal StarCi links use routed navigation." }, schema: [], messages: { href: "Use the routed navigation owner for internal links." } },
  create(context) {
    if (!componentFile(context.filename || context.getFilename())) return {}
    return { JSXAttribute(node) { if (node.name?.name !== "href") return; const value = node.value?.type === "Literal" ? node.value.value : null; if (typeof value === "string" && value.startsWith("/")) context.report({ node, messageId: "href" }) } }
  },
}

export const rules = {
  "no-direct-heroicon-import": noVendorIconOutsideIconLeaf,
  "vendor-primitive-has-named-owner": vendorPrimitiveHasNamedOwner,
  "no-internal-starci-href": noInternalStarciHref,
}

export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
