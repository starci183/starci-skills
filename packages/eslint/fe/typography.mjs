/**
 * The rule that holds `typography.md`.
 *
 * MOST OF THIS LAW IS A UNION, and what is left is one shape a type cannot see: a heading TAG
 * written by hand. The level union stops a fifth step being asked for; nothing in the type system
 * notices an `<h2>` in a file that never mentions the heading component at all.
 *
 * The rule's own twin lives in `tokens.mjs`: that one catches a heading assembled out of a large
 * size and a heavy weight on some other element. Between them they cover both ways a heading gets
 * hand-rolled - with the right tag and the wrong look, or the right look and no tag.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** Product source lives under `src/`; tooling and config are out of scope. */
const isSourceFile = (filename) => normalizePath(filename).includes("/src/")

/** A twin test may build heading markup by hand to assert against it. */
const isTestFile = (filename) => /\.(?:test|spec)\.(?:ts|tsx)$/.test(normalizePath(filename))

/** The one component that owns the tag and the size together, and therefore may write the tag. */
const isHeadingComponent = (filename) => normalizePath(filename).includes("/src/components/leaves/Heading/")

/** The tags a document outline is built from. */
const HEADING_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"])

/** The deepest level the component draws; below this a page has nested too far. */
const DEEPEST_LEVEL = 4

/** Intrinsic (lowercase) tag name, or null for a component. */
const tagName = (opening) => {
  const name = opening && opening.name
  if (!name || name.type !== "JSXIdentifier") return null
  return name.name === name.name.toLowerCase() ? name.name : null
}

// -- TYPESET-1 · TYPESET-2 -------------------------------------------------------------------------------

/** A heading comes from the component that owns its tag and its size as one decision. */
export const noHeadingTagOutsideHeadingComponent = {
  meta: {
    type: "problem",
    docs: { description: "Heading tags are written by the heading component, from a level." },
    schema: [],
    messages: {
      tag:
        "`<{{tag}}>` written here throws away the two facts the heading component exists to keep together: the tag a screen reader builds the document outline from, and the size a reader sees. Set separately they drift, and a screen's third-largest text becomes its first heading. Render the heading component with a level of {{level}}; one prop decides both, so they cannot disagree.",
      tooDeep:
        "`<{{tag}}>` is deeper than the scale goes: levels stop at {{deepest}}, because a fifth means the page has nested further than a reader can hold. That is a structure problem wearing a styling problem's clothes - flatten the section, then render the title with a level the scale has.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isSourceFile(file) || isTestFile(file) || isHeadingComponent(file)) return {}
    return {
      JSXOpeningElement(node) {
        const tag = tagName(node)
        if (!tag || !HEADING_TAGS.has(tag)) return
        const level = Number(tag.slice(1))
        if (level > DEEPEST_LEVEL) {
          context.report({ node, messageId: "tooDeep", data: { tag, deepest: DEEPEST_LEVEL } })
          return
        }
        context.report({ node, messageId: "tag", data: { tag, level } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-heading-tag-outside-heading-component": noHeadingTagOutsideHeadingComponent,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * Exact: a tag name in a file that is not the component that owns it. A repository adopting this
 * with history should expect the deeper levels to report a structure problem rather than a styling
 * one, and those take longer to fix than the message suggests.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
