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

import { isClassAttribute, staticText } from "./lib/ast.mjs"
import { canonicalPackages } from "./lib/fe-stack.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { fileOf, inSlot, isComponentFile, isProductSource, kindOfFile, roleOfFile } from "./lib/scope.mjs"
import { why } from "./lib/why.mjs"

/** The one module allowed to name a glyph from a library: the entry of the leaf owner named `Icon`. */
const ICON_LEAF = { kind: "leaves", owner: "Icon" }

/** Repeated goal / metric cells are text-led in the reference: the entry of the composite owner named `LabelledProgressRow`. */
const LABELLED_PROGRESS_ROW = { kind: "composites", owner: "LabelledProgressRow" }

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

/** The two optical families of the heroicons family: the 24px outline heading cut and the 16px solid micro cut. */
const GLYPH_CUTS = ["24/outline", "16/solid"]

/**
 * The closed glyph surface: each package of the one application icon set (fe-stack `icons`: upstream `@heroicons/react`,
 * used first, and StarCi's custom-only `@starci/heroicons` for the glyphs it lacks) on each of the two cuts. Read from the
 * catalog, so the set is named once.
 */
const glyphSurface = () => canonicalPackages("icons").flatMap((name) => GLYPH_CUTS.map((cut) => `${name}/${cut}`))

/**
 * True when the file is the entry (slot role `entry`) of the component owner named `owner` in the layer `kind`.
 * The slot says which layer and which role; the owner's own folder name is the one fact it cannot say, so it is compared.
 */
const isEntryOf = (context, { kind, owner }) =>
  isComponentFile(context) && kindOfFile(context) === kind && roleOfFile(context) === "entry" &&
  hfsOf(context).relative(fileOf(context)).split("/").slice(-2)[0] === owner

/**
 * True when this file owns glyphs: the icon leaf, which owns the meaning-to-glyph map, or the toast module (`fe.modules.toast`),
 * whose region draws the status glyph of each toast and sits in the modules tier, below every component it could ask.
 */
const isIconLeafFile = (context) => isEntryOf(context, ICON_LEAF) || inSlot(context, "fe.modules.toast")

/** True for the reusable repeated metric cell whose reference contains no decorative glyph. */
const isLabelledProgressRowFile = (context) => isEntryOf(context, LABELLED_PROGRESS_ROW)

/** True when an import source resolves into a glyph library, subpaths included. */
const isGlyphImport = (source) => {
  const value = typeof source === "string" ? source : ""
  const isExternalPackage = value !== "" && !value.startsWith(".") && !value.startsWith("@/")
  return GLYPH_PACKAGES.some((pkg) => value === pkg || value.startsWith(pkg)) ||
    (isExternalPackage && GLYPH_PACKAGE_NAME.test(value))
}

/** A glyph size written as a fraction of a step, or as an arbitrary value. */
const OFF_SCALE_GLYPH = /\bsize-(?:\d+\.\d+|\[[^\]]+\])/

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
    if (!isProductSource(context) || isIconLeafFile(context)) return {}
    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value
        if (!isGlyphImport(source)) return
        context.report({ node, messageId: "vendor", data: { source, leaf: `${ICON_LEAF.kind}/${ICON_LEAF.owner}/index.tsx` } })
      },
    }
  },
}

// -- ICON-7 ----------------------------------------------------------------------------------------

/**
 * The icon leaf owns the map, but that ownership does not license a second glyph vocabulary: every glyph comes from the
 * heroicons family on its two cuts. Phosphor, Iconify, Lucide and every other glyph catalogue are refused, including the
 * ones no list can name in advance.
 */
export const heroiconsIsTheGlyphVendor = {
  meta: {
    type: "problem",
    docs: { description: "Only the Heroicons heading and micro families (`@heroicons/react`, then `@starci/heroicons`) may supply product glyphs." },
    schema: [],
    messages: {
      vendor:
        "`{{source}}` is outside StarCi's closed glyph surface ({{surface}}). Use upstream `@heroicons/react/24/outline` or `16/solid` when the icon exists; use the matching `@starci/heroicons` subpath only for a custom cut missing upstream, and add a missing glyph there. The StarCi package never re-exports upstream icons. Phosphor, Iconify and every other glyph catalogue are refused: two sets draw the same meaning with two strokes, two grids and two weights.",
    },
  },
  create(context) {
    if (!isProductSource(context)) return {}
    return {
      ImportDeclaration(node) {
        const source = node.source && node.source.value
        const surface = glyphSurface()
        if (!isGlyphImport(source) || surface.includes(String(source))) return
        context.report({ node, messageId: "vendor", data: { source, surface: surface.map((name) => `\`${name}\``).join(", ") } })
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
    if (!isProductSource(context)) return {}
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
        "`LabelledProgressRow` is a repeated metric cell, not a feature entry. Its reference is text-led, so an `Icon` here invents emphasis and repeats glyph meanings across the grid. Keep the label and figure; reserve tiny glyphs for generic state or action semantics actually present in the reference.",
    },
  },
  create(context) {
    if (!isLabelledProgressRowFile(context)) return {}
    return {
      JSXOpeningElement(node) {
        if (node.name?.type === "JSXIdentifier" && node.name.name === "Icon") {
          context.report({ node, messageId: "decorative" })
        }
      },
    }
  },
}

/** The immediately preceding JSDoc declares this exported component as a brand mark. */
const declaresBrandMark = (sourceCode, node) => {
  const comment = sourceCode.getCommentsBefore(node).at(-1)
  return comment?.type === "Block" && comment.value.startsWith("*") &&
    /(?:^|\n)\s*\*?\s*@brand-mark(?:\s|$)/.test(comment.value) &&
    sourceCode.text.slice(comment.range[1], node.range[0]).trim() === ""
}

/** A marker belongs to the exported component itself, never to a sibling or an enclosing file. */
const isDeclaredBrandMarkFunction = (sourceCode, node) => {
  let declaration = node
  if (node.parent?.type === "VariableDeclarator") {
    if (node.parent.init !== node || node.parent.id.type !== "Identifier") return false
    declaration = node.parent.parent
    if (declaration.type !== "VariableDeclaration" || declaration.declarations.length !== 1) return false
  }
  const exported = declaration.parent
  if (!["ExportNamedDeclaration", "ExportDefaultDeclaration"].includes(exported?.type)) return false
  return declaresBrandMark(sourceCode, exported) || declaresBrandMark(sourceCode, declaration)
}

/** An SVG belongs to its nearest function; marking another component cannot license it. */
const inDeclaredBrandMark = (sourceCode, node) => {
  for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
    if (["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"].includes(ancestor.type)) {
      return isDeclaredBrandMarkFunction(sourceCode, ancestor)
    }
  }
  return false
}

/** Inline SVG belongs only to an explicitly declared brand mark in a leaf entry. */
export const noInlineSvgOutsideBrandMarkLeaf = {
  meta: {
    type: "problem",
    docs: { description: "FE_ICON_INLINE_SVG: inline SVG is drawn only by an exported leaf entry component with a @brand-mark JSDoc declaration." },
    schema: [],
    messages: {
      inlineSvg:
        "FE_ICON_INLINE_SVG: inline `<svg>` draws a second glyph vocabulary. Use the Icon leaf for product glyphs. A brand mark may draw its own SVG only in a leaf entry whose exported component is immediately documented with `@brand-mark` in JSDoc.",
    },
  },
  create(context) {
    if (!isProductSource(context)) return {}
    const sourceCode = context.sourceCode ?? context.getSourceCode()
    const isLeafEntry = isComponentFile(context) && kindOfFile(context) === "leaves" && roleOfFile(context) === "entry"
    return {
      JSXOpeningElement(node) {
        if (node.name?.type !== "JSXIdentifier" || node.name.name !== "svg") return
        if (isLeafEntry && inDeclaredBrandMark(sourceCode, node)) return
        context.report({ node, messageId: "inlineSvg" })
      },
    }
  },
}

/** The finding code for the copy-and-glyph law's inline SVG enforcer. */
Object.assign(why, {
  "no-inline-svg-outside-brand-mark-leaf": {
    code: "FE_ICON_INLINE_SVG",
    en: "`<file>` draws an inline SVG outside an exported leaf entry component declared as a brand mark.",
    fix: "Use the Icon leaf for product glyphs; declare an original brand mark with @brand-mark JSDoc on its exported leaf entry component.",
  },
})

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-vendor-icon-outside-icon-leaf": noVendorIconOutsideIconLeaf,
  "heroicons-is-the-glyph-vendor": heroiconsIsTheGlyphVendor,
  "no-off-scale-glyph-size": noOffScaleGlyphSize,
  "no-decorative-icon-in-metric-cell": noDecorativeIconInMetricCell,
  "no-inline-svg-outside-brand-mark-leaf": noInlineSvgOutsideBrandMarkLeaf,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * A consuming repository's `eslint.config.mjs` stays the authority on what is actually switched on.
 * Both rules are exact - a package prefix and a size pattern - so neither carries the false-positive
 * risk that would justify adopting it at `warn`.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
