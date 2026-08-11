/**
 * The rule that holds `vendor-boundary.md`.
 *
 * IT IS CHECKED IN BOTH DIRECTIONS, and the second direction is the whole reason this is a policy
 * rather than a hole. Outward, a component that imports the library from the wrong folder is
 * misfiled - that half is obvious. Inward, a file sitting in a wrapper folder that imports nothing
 * is an ordinary component holding an exemption it does not need, and without that check the folder
 * becomes the place difficult things go. The first thing to opt in is always something that was
 * hard to place.
 *
 * THE GLYPH LIBRARY IS SOMEBODY ELSE'S RULE, deliberately. `icon.mjs` owns it, because a rule that
 * names one vendor protects one vendor - and the gap between two such rules is where a caret came
 * to be imported straight from a glyph package at a size that existed nowhere else, reported by
 * nothing.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** The component library this boundary owns. Its glyph counterpart belongs to `icon.mjs`. */
const VENDOR_PACKAGE_PREFIX = "@heroui/"

/** The shell folder is closed to the two covering mechanics that intentionally ignore their interior. */
const SHELL_DIR = "/src/components/shells/"
const SHELL_FILE = /\/src\/components\/shells\/(?:ModalShell|DrawerShell)\//

/** Named surface branches may own the vendor wrapper they project a content contract into. */
const SURFACE_BRANCH = /\/src\/components\/branches\/(?:SurfaceCard|SurfaceAccordionCard|SurfaceListCard)\//

const isAllowedVendorOwner = (file) =>
  file.includes("/src/components/leaves/") || SHELL_FILE.test(file) || SURFACE_BRANCH.test(file)

/** True for a file inside the component tree, where the boundary applies. */
const isComponentFile = (filename) => normalizePath(filename).includes("/src/components/")

/** True when an import names the component library, subpaths included. */
const isVendorImport = (source) => typeof source === "string" && source.startsWith(VENDOR_PACKAGE_PREFIX)

// -- VENDOR-1 · VENDOR-2 ---------------------------------------------------------------------------

/** The library belongs to two folders, and a wrapper folder that wraps nothing is misfiled. */
export const vendorBoundary = {
  meta: {
    type: "problem",
    docs: { description: "Vendor imports belong to leaves, the two covering shells, and named surface branches." },
    schema: [],
    messages: {
      outside:
        "This component does not own a vendor primitive. Vendor imports belong to leaves, ModalShell/DrawerShell, and the named SurfaceCard family branches that project contracts into vendor bodies.",
      emptyShell:
        "ModalShell/DrawerShell must wrap their vendor covering primitive; otherwise this is an ordinary branch in the wrong tier.",
      unknownShell:
        "Only ModalShell and DrawerShell are shells. This component must use contract + render as a branch; needing an arbitrary vendor children slot does not create a third shell.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    // Outside the component tree, a provider standing the library up for the whole application is a
    // different thing from a component pulling in a widget.
    if (!isComponentFile(file)) return {}
    const isShellDirectory = file.includes(SHELL_DIR)
    const isShell = SHELL_FILE.test(file)
    const isAllowed = isAllowedVendorOwner(file)
    let importsVendor = false
    return {
      ImportDeclaration(node) {
        if (!isVendorImport(node.source && node.source.value)) return
        importsVendor = true
        if (isAllowed) return
        context.report({ node, messageId: "outside" })
      },
      "Program:exit"(node) {
        if (isShellDirectory && !isShell) context.report({ node, messageId: "unknownShell" })
        else if (isShell && !importsVendor) context.report({ node, messageId: "emptyShell" })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "vendor-boundary": vendorBoundary,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * A repository adopting this with history should expect the outward half to report and the inward
 * half to be silent, because `shells/` will not exist yet. Creating it is the migration: every
 * vendor container currently wrapped as something else moves there, and each move is what makes the
 * inward check meaningful afterwards.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
