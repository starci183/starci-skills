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

/** The two folders that may name the library, and what each wraps. */
const WRAPPER_DIRS = ["/src/components/leaves/", "/src/components/shells/"]

/** The folder whose entry condition is "it imports the library"; the other tier is not exclusive. */
const SHELL_DIR = "/src/components/shells/"

/** True for a file inside the component tree, where the boundary applies. */
const isComponentFile = (filename) => normalizePath(filename).includes("/src/components/")

/** True when an import names the component library, subpaths included. */
const isVendorImport = (source) => typeof source === "string" && source.startsWith(VENDOR_PACKAGE_PREFIX)

// -- VENDOR-1 · VENDOR-2 ---------------------------------------------------------------------------

/** The library belongs to two folders, and a wrapper folder that wraps nothing is misfiled. */
export const vendorBoundary = {
  meta: {
    type: "problem",
    docs: { description: "The component library is imported by `leaves/` and `shells/`, and every shell imports it." },
    schema: [],
    messages: {
      outside:
        "Importing the component library outside `leaves/` and `shells/`. The vendor is wrapped ONCE, and that monopoly is what lets somebody answer \"what would changing component libraries cost\" by listing two folders instead of reading the tree. Use the wrapper for this primitive, and if none exists, add one - a leaf when it takes only values, a shell when its API needs children. Reaching past it for pure BEHAVIOUR is where this boundary is usually lost, because behaviour does not look like styling.",
      emptyShell:
        "This file is in `shells/` and imports no component library, so it is an ordinary component holding an exemption it does not need. Move it to the tier it belongs to. The folder means one thing - a vendor container wrapped once - and a folder anybody can opt into stops meaning anything; the first thing to opt in is always something that was hard to place.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    // Outside the component tree, a provider standing the library up for the whole application is a
    // different thing from a component pulling in a widget.
    if (!isComponentFile(file)) return {}
    const isWrapper = WRAPPER_DIRS.some((dir) => file.includes(dir))
    const isShell = file.includes(SHELL_DIR)
    let importsVendor = false
    return {
      ImportDeclaration(node) {
        if (!isVendorImport(node.source && node.source.value)) return
        importsVendor = true
        if (isWrapper) return
        context.report({ node, messageId: "outside" })
      },
      "Program:exit"(node) {
        if (isShell && !importsVendor) context.report({ node, messageId: "emptyShell" })
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
