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

/** The two Heroicon families selected by the product roles. */
const HEROICON_PACKAGES = new Set([
  "@heroicons/react/24/outline",
  "@heroicons/react/16/solid",
])

/**
 * Product reactions are attributed artwork rather than glyph-library imports.
 *
 * Their leaf owns this closed vocabulary and maps it to checked-in Fluent Emoji Flat SVGs under
 * `public/reactions/`; callers pass identities, never Unicode pictographs or asset paths.
 */
export const REACTION_ASSET_NAMES = new Set(["like", "love", "haha", "wow", "sad", "angry"])

/**
 * ICON-11 - rank artwork is a second closed leaf, and it is the only one.
 *
 * A leaderboard place is not a feature, a state or an action, which is what the Heroicons map is
 * for. It is an AWARD, and the product decided - explicitly, twice - that an award is drawn as the
 * Fluent Emoji Flat medal for it. Heroicons ships no medal, so the choice was never between two
 * glyph families; it was between the artwork the product asked for and no artwork at all.
 *
 * WHY THIS IS A NAMED EXEMPTION RATHER THAN A HOLE. It is bounded on three sides at once: one file
 * may import the library, only from `@iconify/react`, and only these four artwork identities. A
 * fifth medal, a second importing file, or a different vendor is still reported. That is the same
 * shape as the reaction vocabulary above - a closed set owned by one leaf - and it is what keeps
 * "the product asked for it" from becoming a sentence any call site can write.
 *
 * WHY IT IS NOT THE `public/` ROUTE THE REACTIONS TOOK. That route is better and it stays the
 * default: checked-in SVG needs no network at render time and no vendor at all. It was not taken
 * here because the four assets are not in the repository, and the exemption records a decision the
 * product owner made knowing that - not a claim that this is the stronger mechanism.
 */
const RANK_MARK_RELATIVE = "leaves/RankMark/index.tsx"

/** The one glyph package the rank leaf may name, and nothing else may. */
const RANK_ARTWORK_PACKAGE = "@iconify/react"

/** The complete rank artwork vocabulary: three places, then one trophy for everyone below. */
export const RANK_ARTWORK_IDS = new Set([
  "fluent-emoji-flat:1st-place-medal",
  "fluent-emoji-flat:2nd-place-medal",
  "fluent-emoji-flat:3rd-place-medal",
  "fluent-emoji-flat:trophy",
])

/** True when this file is the rank leaf, which owns the place-to-artwork map. */
const isRankMarkFile = (filename) => normalizePath(filename).endsWith(`/${RANK_MARK_RELATIVE}`)

/** True for the one import the rank leaf is permitted to make. */
const isRankArtworkImport = (filename, source) =>
  isRankMarkFile(filename) && source === RANK_ARTWORK_PACKAGE

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
        // ICON-11: the rank leaf owns award artwork the Heroicons map does not carry.
        if (isRankArtworkImport(file, source)) return
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
        "`{{source}}` is not one of StarCi's two glyph families. Heading and leading roles use `@heroicons/react/24/outline`; chip roles use `@heroicons/react/16/solid`. Map the meaning there instead. Brand marks are exact house SVGs. Product reactions use the attributed Fluent Emoji Flat SVG subset checked into `public/reactions/`, never another glyph import.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isSourceFile(file)) return {}
    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value
        if (!isGlyphImport(source) || HEROICON_PACKAGES.has(String(source))) return
        // ICON-11: Heroicons ships no medal, so the award vocabulary has its own closed leaf.
        if (isRankArtworkImport(file, source)) return
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

// -- ICON-11 ---------------------------------------------------------------------------------------

/**
 * The rank leaf's exemption is a vocabulary, not a door.
 *
 * ICON-11 lets exactly one file import exactly one glyph package. Without this rule that file could
 * then name ANY artwork in that package, and the exemption would have bought the product four
 * medals and handed back an unbounded catalogue - which is the failure the icon leaf exists to
 * prevent, reintroduced one folder over.
 */
export const rankArtworkIsAClosedSet = {
  meta: {
    type: "problem",
    docs: { description: "The rank leaf names only the four approved award artworks." },
    schema: [],
    messages: {
      unknown:
        "`{{id}}` is not one of the four approved rank artworks. The vocabulary is `fluent-emoji-flat:1st-place-medal`, `2nd-place-medal`, `3rd-place-medal` and `trophy` for every place below third. A fifth artwork is a product decision about what a place MEANS, so it is made in the icon law rather than in this file.",
      outside:
        "`{{id}}` is rank award artwork, named outside `{{leaf}}`. The place-to-artwork map is kept in one file so a second screen cannot answer the same question differently.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    // A twin test proves the map is closed, which it cannot do without naming what is in it and
    // what is not. Same exemption, same reason, as the one the double-cast rule already carries.
    if (!isSourceFile(file) || /\.test\.tsx?$/.test(file)) return {}
    const inRankLeaf = isRankMarkFile(file)
    return {
      Literal(node) {
        if (typeof node.value !== "string") return
        const id = node.value
        if (!id.startsWith("fluent-emoji-flat:")) return
        if (!inRankLeaf) {
          context.report({ node, messageId: "outside", data: { id, leaf: RANK_MARK_RELATIVE } })
          return
        }
        if (!RANK_ARTWORK_IDS.has(id)) context.report({ node, messageId: "unknown", data: { id } })
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
  "rank-artwork-is-a-closed-set": rankArtworkIsAClosedSet,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * A consuming repository's `eslint.config.mjs` stays the authority on what is actually switched on.
 * Both rules are exact - a package prefix and a size pattern - so neither carries the false-positive
 * risk that would justify adopting it at `warn`.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
