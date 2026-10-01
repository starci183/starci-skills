/**
 * The boundary between product code and `@starci/grammar`.
 *
 * Grammar is a business-neutral HeroUI-backed component package. Product code composes its components with ordinary React
 * children and typed props. A page's structure and text are made of those components, not of raw HTML: a raw `<section>`, `<p>`
 * or `<ul>` carries no density, no focus or landmark contract and no dark value from the design system, and the class names
 * written by hand to compensate are where a second visual language starts.
 *
 * Which tags are refused is decided by the package: a tag is in the list only when `@starci/grammar` exports a component that
 * renders it (`GRAMMAR_OWNERS` below, each entry verified against the package source by the twin test). A tag the grammar has no
 * component for (`div`, `br`, `aside`, `article`) is not refused: there is nothing to compose instead, and refusing it would
 * demand a workaround. When the grammar gains a component for one, the tag joins the list.
 *
 * WHERE IT APPLIES. App source that composes the grammar (slots `fe.feature`, `fe.components`, `fe.route`, `fe.hooks`) and any
 * workspace package except the `<family>-ui` package (`fe.package.ui`), whose components are the renderers and are the one place
 * a raw tag belongs. Spec files render raw HTML as a harness and are not judged. A file no slot owns is not judged either: the
 * rule refuses to guess a scope.
 */

import { hfsOf } from "./lib/hfs.mjs"

/**
 * The intrinsic elements of page structure and text, each with the grammar components that render it.
 * Read against packages/grammar/src (`export const <Component>`); `grammar-boundary.spec.mjs` fails when one is not exported.
 */
export const GRAMMAR_OWNERS = Object.freeze({
  h1: "Heading", h2: "Heading", h3: "Heading", h4: "Heading", h5: "Heading", h6: "Heading",
  p: "Text", span: "Text",
  hr: "Divider",
  label: "Label",
  form: "Form",
  fieldset: "Fieldset",
  dl: "DescriptionList", dt: "DescriptionList", dd: "DescriptionList",
  table: "DataTable", thead: "DataTable", tbody: "DataTable", tr: "DataTable", td: "DataTable", th: "DataTable",
  ul: "List, SurfaceListCard or StaticStateRow", ol: "List, SurfaceListCard or StaticStateRow", li: "ListItem, SurfaceListCard or StaticStateRow",
  header: "SectionHeader or TopBar",
  footer: "Footer",
  nav: "NavLandmark, Subnav, Breadcrumbs or NavigationFeatureNav",
  section: "Region or SurfaceCard",
  main: "WorkspaceShell",
  figure: "MediaFrame", figcaption: "MediaFrame",
})

/** The slots of app source that compose the grammar: features, components, routes and hooks. */
const APP_SLOTS = new Set(["fe.feature", "fe.components", "fe.route", "fe.hooks"])

/** The slot of the package whose leaves ARE the renderers: the only place raw structural tags belong. */
const RENDERER_SLOT = "fe.package.ui"

/**
 * True for a file that composes the grammar: app source (`fe.feature`, `fe.components`, `fe.route`, `fe.hooks`) and any
 * workspace package but the `<family>-ui` package, whose components are the renderers.
 */
const composesGrammar = (context, file) => {
  const hfs = hfsOf(context)
  const slot = hfs.slotOf(file)
  if (slot === null || slot === RENDERER_SLOT) return false
  return APP_SLOTS.has(slot) || hfs.tierOf(file) === "package"
}

/** No raw structural or text element in app source or in a package that composes the grammar. */
export const noRawStructuralElement = {
  meta: {
    type: "problem",
    docs: { description: "Page structure and text are grammar components, not raw `div`-family HTML; only `fe.package.ui` renderers draw raw tags." },
    schema: [],
    messages: {
      raw:
        "A raw `<{{tag}}>`. Page structure and text are composed from the grammar (`@starci/grammar`, or the repository's `<family>-ui` package): use {{owner}}. A raw tag brings none of the design system's density, landmark and state contract, and the class names written to make up for it start a second visual language. If the grammar cannot express this structure, add the component to the grammar or the ui package rather than drawing it here.",
    },
  },
  create(context) {
    const file = context.filename || context.getFilename()
    if (!composesGrammar(context, file)) return {}
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier") return
        const owner = Object.hasOwn(GRAMMAR_OWNERS, node.name.name) ? GRAMMAR_OWNERS[node.name.name] : null
        if (owner !== null) context.report({ node, messageId: "raw", data: { tag: node.name.name, owner: `\`${owner}\`` } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-raw-structural-element": noRawStructuralElement,
}

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
