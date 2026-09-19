/**
 * The rules that hold `icon.md`.
 *
 * Both exist because of the same escape, found by hand rather than by a gate: one leaf imported a
 * caret straight from the glyph library, at a size off both steps and a cut outside the two the
 * icon leaf offers. Nothing reported it. The vendor rule that guards the component library names
 * that library only, and the token rules that police the scale read SPACING utilities - gaps,
 * insets, offsets - so a glyph size is outside every pattern they match.
 *
 * The lesson is worth stating where the next rule gets written: a rule that names one vendor
 * protects one vendor, and a rule that scans one family of utilities protects that family. Neither
 * generalises on its own, and the gap between them is exactly where a third step gets invented.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** The one module allowed to name a glyph from a library. */
const ICON_MODULE_RELATIVE = "leaves/Icon/index.tsx"

/** Repeated goal / metric cells are text-led in the legacy reference. */
const LABELLED_PROGRESS_ROW_RELATIVE = "composites/LabelledProgressRow/index.tsx"

/**
 * Package roots that ship glyphs.
 *
 * Matched as a PREFIX so a subpath cannot walk around it - the escape that started this was
 * `@phosphor-icons/react/dist/ssr`, which an equality check on the package name does not see.
 */
const GLYPH_PACKAGES = [
  "@phosphor-icons/",
  "lucide-react",
  "react-icons",
  "@heroicons/",
  "@tabler/icons",
  "@fortawesome/",
  "@mui/icons-material",
  "@fluentui/react-icons",
  "iconsax-react",
  "react-feather",
]

/** Package-name signal for a glyph catalogue not yet listed explicitly. */
const GLYPH_PACKAGE_NAME = /(?:icon|glyph|lucide|feather|tabler|fortawesome)/i

/** Upstream Heroicons plus StarCi's custom-only extension, each on the same two optical families. */
const HEROICON_PACKAGES = new Set([
  "@heroicons/react/24/outline",
  "@heroicons/react/16/solid",
  "@starci/heroicons/24/outline",
  "@starci/heroicons/16/solid",
])

/**
 * Product reactions are attributed artwork rather than glyph-library imports.
 *
 * Their leaf owns this closed vocabulary and maps it to checked-in Fluent Emoji Flat SVGs under
 * `public/reactions/`; callers pass identities, never Unicode pictographs or asset paths.
 */
export const REACTION_ASSET_NAMES = new Set(["like", "love", "haha", "wow", "sad", "angry"])

/** True when this file is the icon leaf, which owns the meaning-to-glyph map. */
const isIconLeafFile = (filename) => normalizePath(filename).endsWith(`/${ICON_MODULE_RELATIVE}`)

/** True for the reusable repeated metric cell whose reference contains no decorative glyph. */
const isLabelledProgressRowFile = (filename) =>
  normalizePath(filename).endsWith(`/${LABELLED_PROGRESS_ROW_RELATIVE}`)

/** Product source under `src/`; tooling and config are out of scope. */
const isSourceFile = (filename) => normalizePath(filename).includes("/src/")

/** True when an import source resolves into a glyph library, subpaths included. */
const isGlyphImport = (source) => {
  const value = typeof source === "string" ? source : ""
  const isExternalPackage = value !== "" && !value.startsWith(".") && !value.startsWith("@/")
  return GLYPH_PACKAGES.some((pkg) => value === pkg || value.startsWith(pkg)) ||
    (isExternalPackage && GLYPH_PACKAGE_NAME.test(value))
}

/** A glyph size written as a fraction of a step, or as an arbitrary value. */
const OFF_SCALE_GLYPH = /\bsize-(?:\d+\.\d+|\[[^\]]+\])/

/** True for a `className` / `class` JSX attribute. */
const isClassAttribute = (node) =>
  node.type === "JSXAttribute" && node.name && (node.name.name === "className" || node.name.name === "class")

/** Static string carried by a JSX attribute, or by a module constant holding a class string. */
const staticText = (value) => {
  if (!value) return null
  if (value.type === "Literal" && typeof value.value === "string") return value.value
  if (value.type === "TemplateLiteral" && value.expressions.length === 0) {
    return value.quasis.map((quasi) => quasi.value.cooked).join(" ")
  }
  if (value.type === "JSXExpressionContainer") return staticText(value.expression)
  return null
}

// -- ICON-6 ----------------------------------------------------------------------------------------

/** A glyph library is named in one file, and a caller asks for a MEANING instead. */
export const noVendorIconOutsideIconLeaf = {
  meta: {
    type: "problem",
    docs: { description: "Glyph libraries are imported only by the icon leaf." },
    schema: [],
    messages: {
      vendor:
        "`{{source}}` is a glyph library, imported outside `{{leaf}}`. Reaching for it here decides three things at the call site - which library, which glyph, how big - and the next screen answers all three differently. Ask for the MEANING instead; if no meaning fits, add one to the icon leaf, which is where the answer is kept once.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isSourceFile(file) || isIconLeafFile(file)) return {}
    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value
        if (!isGlyphImport(source)) return
        context.report({ node, messageId: "vendor", data: { source, leaf: ICON_MODULE_RELATIVE } })
      },
    }
  },
}

// -- ICON-7 ----------------------------------------------------------------------------------------

/** The icon leaf owns the map, but that ownership does not license a second glyph vocabulary. */
export const heroiconsIsTheGlyphVendor = {
  meta: {
    type: "problem",
    docs: { description: "Only the Heroicons heading and micro families may supply product glyphs." },
    schema: [],
    messages: {
      vendor:
        "`{{source}}` is outside StarCi's closed glyph surface. Use upstream `@heroicons/react/24/outline` or `16/solid` when the icon exists; use the matching `@starci/heroicons` subpath only for a custom cut missing upstream. The StarCi package never re-exports upstream icons. Iconify, Phosphor and every other glyph catalogue are refused.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isSourceFile(file)) return {}
    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value
        if (!isGlyphImport(source) || HEROICON_PACKAGES.has(String(source))) return
        context.report({ node, messageId: "vendor", data: { source } })
      },
    }
  },
}

// -- ICON-1 ----------------------------------------------------------------------------------------

/** A glyph takes one of the two steps; a fraction or an arbitrary value is a third. */
export const noOffScaleGlyphSize = {
  meta: {
    type: "problem",
    docs: { description: "A glyph is sized by one of the two steps, never by a fraction or an arbitrary value." },
    schema: [],
    messages: {
      offScale:
        "`{{cls}}` is a glyph size off both steps. A third step is one nobody applies consistently - the author picks it for a reason true on their screen, and everyone after copies the nearest of three. Use the step the icon leaf offers, and if the case genuinely needs a size neither step gives, that is a change to the two steps rather than an exception here.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isSourceFile(file)) return {}
    const scan = (node, text) => {
      if (!text) return
      const hit = text.match(OFF_SCALE_GLYPH)
      if (hit) context.report({ node, messageId: "offScale", data: { cls: hit[0] } })
    }
    return {
      JSXAttribute(node) {
        if (!isClassAttribute(node)) return
        scan(node, staticText(node.value))
      },
      VariableDeclarator(node) {
        scan(node, staticText(node.init))
      },
    }
  },
}

// -- ICON-10 ---------------------------------------------------------------------------------------

/** A repeated metric cell does not invent a feature glyph absent from the reference. */
export const noDecorativeIconInMetricCell = {
  meta: {
    type: "problem",
    docs: { description: "Repeated metric cells stay text-led unless the reference explicitly contains an icon." },
    schema: [],
    messages: {
      decorative:
        "`LabelledProgressRow` is a repeated metric cell, not a feature entry. Its legacy reference is text-led, so an `Icon` here invents emphasis and repeats glyph meanings across the grid. Keep the label and figure; reserve tiny glyphs for generic state or action semantics actually present in the reference.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isLabelledProgressRowFile(file)) return {}
    return {
      JSXOpeningElement(node) {
        if (node.name?.type === "JSXIdentifier" && node.name.name === "Icon") {
          context.report({ node, messageId: "decorative" })
        }
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-vendor-icon-outside-icon-leaf": noVendorIconOutsideIconLeaf,
  "heroicons-is-the-glyph-vendor": heroiconsIsTheGlyphVendor,
  "no-off-scale-glyph-size": noOffScaleGlyphSize,
  "no-decorative-icon-in-metric-cell": noDecorativeIconInMetricCell,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * A consuming repository's `eslint.config.mjs` stays the authority on what is actually switched on.
 * Both rules are exact - a package prefix and a size pattern - so neither carries the false-positive
 * risk that would justify adopting it at `warn`.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
