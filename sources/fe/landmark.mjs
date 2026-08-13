/**
 * Rules for the LANDMARK law - `fe/canon/patterns/landmark.md`.
 *
 * WHY THESE EXIST. A registry makes the failure silent. A key named `dashboard-main` records the
 * intent exactly and renders a `div`, because the branch that draws registry nodes draws divs. An
 * application shipped with every region correctly named and not one landmark in the document, and
 * no gate had anything to say: a name in a key is not an element in a document.
 *
 * WHAT THEY HOLD, as two halves of one idea. A route layout that composes its own chrome must hand
 * the routed children to the landmark branch; and that branch may appear only in a ROUTE file,
 * because a second `main` is an ambiguous landmark rather than a stronger one.
 *
 * WHAT THEY CANNOT HOLD, stated rather than implied. A file-at-a-time rule cannot see that a layout
 * and a page under it BOTH opened a landmark. The rules narrow the place to route files and refuse
 * every tier below, which is where the mistake actually happens - a reading column named `*-main`
 * drawn with the landmark branch. The remaining cross-file case is a review question, and pretending
 * otherwise would be the rule claiming a guarantee it does not have.
 *
 * WHY THE `Tree` TEST IS PART OF THE FIRST RULE. Without it the rule fires on every layout that
 * touches `children`, including the root document shell and pass-through layouts that delegate
 * their chrome - and satisfying it there would put the second `main` in the document that the
 * companion rule refuses. The bluntness was real, was measured, and is the reason the condition is
 * narrower than "renders children".
 */

import { contractHostOf } from "./contract.mjs"

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalize = (filename) => String(filename || "").replace(/\\/g, "/")

/** A route layout: `layout.tsx` anywhere under an `app/` router directory. */
export const isRouteLayoutFile = (filename) => /\/app\/(?:.*\/)?layout\.tsx$/.test(normalize(filename))

/**
 * A route file: the layout OR the page of a route.
 *
 * WHY BOTH. The landmark belongs to the outermost file that composes the routed screen, and that is
 * not always a layout. A route with no chrome-composing layout - a scaffold, a standalone screen -
 * has its page as the outermost composer, and forcing the mark upward would mean inventing a layout
 * whose only job is to wrap. That was not a hypothetical: an early version of this rule allowed only
 * layouts, and it refused three route pages that were each the sole composer of their screen and
 * each held exactly one `main`.
 */
export const isRouteFile = (filename) => /\/app\/(?:.*\/)?(?:layout|page)\.tsx$/.test(normalize(filename))

/**
 * A page tier file: either half of a surface under `components/pages/<Name>/`.
 *
 * WHY THE PAGE TIER OWNS THE MARK TOO, AND WHY THIS WAS NOT ALWAYS TRUE.
 *
 * The landmark used to be a named branch, so "the outermost file that composes the screen" and "a
 * file under `app/`" were the same sentence — the branch was imported into the route file and that
 * was that. Then the mark moved into the contract entry as `host: "main"`, and the two sentences
 * came apart: the entry is rendered by whoever renders the screen's outermost frame, and LAYOUT-6
 * says that is emphatically NOT the route file. A route names which page renders at which URL and
 * draws nothing.
 *
 * Held to route files only, the two laws then refused each other. Every page moved out of `app/` to
 * satisfy LAYOUT-6 was reported for misplacing its landmark, and the only way to satisfy both at
 * once was to leave the page owner in the routing tree — which is the defect LAYOUT-6 exists to
 * prevent. A rule that can only be satisfied by breaking another rule is a finding about the rule.
 *
 * What the guarantee actually was, and still is: ONE main per document, owned by whoever owns the
 * whole screen. A route file and a page component are both that. A block, composite, leaf, branch,
 * overlay or shared layout is not, and each of those still reports — which is the case this rule was
 * written for, because a landmark added there is a SECOND main rather than a stronger one.
 */
export const isPageTierFile = (filename) =>
  /\/components\/pages\/[A-Z][A-Za-z0-9]*\/(?:index|component)\.tsx$/.test(normalize(filename))

/** The branches that open a landmark element. One per element, by LANDMARK-1. */
export const LANDMARK_BRANCHES = new Set(["Main"])

/** The branch that composes an ordinary registry node, and therefore marks a layout as chrome-owning. */
const TREE_BRANCH = "Tree"

/**
 * The contract key a frame element is rendering, when it names one literally.
 *
 * @param node - A JSX opening element.
 * @returns The key, or null when the element takes no literal `contract`.
 */
const contractKeyOf = (node) => {
  const attribute = (node.attributes || []).find(
    (candidate) => candidate.type === "JSXAttribute" && candidate.name && candidate.name.name === "contract",
  )
  const value = attribute && attribute.value
  return value && value.type === "Literal" && typeof value.value === "string" ? value.value : null
}

/**
 * True when this element draws a landmark.
 *
 * TWO SHAPES, AND THE SECOND IS THE ONE THAT LASTS. A landmark used to be a named branch, so this
 * asked for the name. The element now belongs to the contract entry - `host: "main"` - which is
 * why a repository can delete its `Main` branch entirely and still have exactly one main landmark:
 * the frame reads the host from the key. Asking only for the branch name reported those repositories
 * as having no landmark at all, which is the opposite of what they had done.
 *
 * @param node - A JSX opening element.
 * @param filename - The file being linted, used to locate the contract table.
 */
const isLandmarkElement = (node, filename) =>
  isLandmarkBranchElement(node) || isHostMainFrame(node, filename)

/**
 * True when this element is a landmark BRANCH, named directly.
 *
 * @param node - A JSX opening element.
 */
const isLandmarkBranchElement = (node) =>
  node.type === "JSXOpeningElement"
  && node.name
  && node.name.type === "JSXIdentifier"
  && LANDMARK_BRANCHES.has(node.name.name)

/**
 * True when this element is an ordinary frame whose CONTRACT ENTRY declares the landmark.
 *
 * @param node - A JSX opening element.
 * @param filename - The file being linted, used to locate the contract table.
 */
const isHostMainFrame = (node, filename) => {
  if (node.type !== "JSXOpeningElement" || !node.name || node.name.type !== "JSXIdentifier") return false
  if (LANDMARK_BRANCHES.has(node.name.name)) return false
  const key = contractKeyOf(node)
  return key !== null && contractHostOf(filename, key) === "main"
}

/**
 * True when this file is a landmark branch's own implementation.
 *
 * That file draws the element by hand and must: it is the one place the element is allowed to
 * appear, exactly as `Tree` is the one place a `div` is.
 *
 * @param filename - The file being linted.
 */
const isLandmarkBranchFile = (filename) =>
  [...LANDMARK_BRANCHES].some((name) => new RegExp(`/branches/${name}/`).test(normalize(filename)))

export const rules = {
  "routed-page-is-a-main-landmark": {
    meta: {
      type: "problem",
      docs: {
        description:
          "A route layout that composes its own chrome must wrap the routed children in the Main branch, so the page is a landmark a reader can skip to.",
      },
      schema: [],
      messages: {
        missing:
          "This layout composes the page chrome but never marks the routed page. Wrap `children` in the `Main` branch so assistive technology can skip the navigation to reach the page - a registry key named `*-main` is a name, not a landmark.",
      },
    },
    create(context) {
      const filename = context.filename || context.getFilename()
      if (!isRouteLayoutFile(filename)) return {}
      let rendersChildren = false
      let composesChrome = false
      let usesLandmark = false
      let firstNode = null
      return {
        JSXExpressionContainer(node) {
          if (node.expression && node.expression.type === "Identifier" && node.expression.name === "children") {
            rendersChildren = true
            firstNode = firstNode || node
          }
        },
        Identifier(node) {
          // `children` reaches the tree through a slot callback as often as through JSX, so the
          // bare identifier counts too - otherwise a layout escapes by handing it to a builder.
          if (node.name === "children" && node.parent && node.parent.type !== "Property") {
            rendersChildren = true
            firstNode = firstNode || node
          }
        },
        JSXOpeningElement(node) {
          if (isLandmarkElement(node, filename)) usesLandmark = true
          if (node.name && node.name.type === "JSXIdentifier" && node.name.name === TREE_BRANCH) {
            composesChrome = true
            firstNode = firstNode || node
          }
        },
        "Program:exit"(node) {
          if (rendersChildren && composesChrome && !usesLandmark) {
            context.report({ node: firstNode || node, messageId: "missing" })
          }
        },
      }
    },
  },

  "main-landmark-belongs-to-a-route-file": {
    meta: {
      type: "problem",
      docs: {
        description:
          "The Main branch draws the document's one main landmark, so it belongs to the route file that composes the screen and nowhere below it.",
      },
      schema: [],
      messages: {
        misplaced:
          "This draws the document's ONE main landmark, so it belongs to whoever owns the whole screen - the route's `layout.tsx` or `page.tsx`, or the page surface under `components/pages/<Name>/`. Used here it puts a second `main` in the document, which is an ambiguous landmark rather than a stronger one - a registry key named `*-main` inside a block or composite is a reading column, and its entry must not declare `host: \"main\"`.",
      },
    },
    /*
     * TWO SHAPES, TWO DIFFERENT SETS OF FILES THAT MAY HOLD THEM, and collapsing them was the bug.
     *
     * The `Main` BRANCH is a component somebody imports in order to wrap a screen. It belongs to the
     * route file that composes that screen and nowhere below - a page reaching for it is the trap
     * this law was written for, because the thing it wraps is a reading COLUMN and the document then
     * has two mains.
     *
     * A frame whose CONTRACT ENTRY declares `host: "main"` is not that. Nobody imported a landmark;
     * the registry says which element this key's node opens, and the frame obeys. That entry is
     * rendered by whoever renders the screen's outermost node - and LAYOUT-6 says the route file is
     * emphatically not it, because a route mounts a page and draws nothing. Holding both shapes to
     * route files only made the two laws refuse each other, and the only way to satisfy both was to
     * leave the page owner in the routing tree, which is the defect LAYOUT-6 exists to prevent.
     */
    create(context) {
      const filename = context.filename || context.getFilename()
      if (isLandmarkBranchFile(filename)) return {}
      const isRoute = isRouteFile(filename)
      const isPageTier = isPageTierFile(filename)
      return {
        JSXOpeningElement(node) {
          if (isLandmarkBranchElement(node)) {
            if (!isRoute) context.report({ node, messageId: "misplaced" })
            return
          }
          if (isHostMainFrame(node, filename) && !isRoute && !isPageTier) {
            context.report({ node, messageId: "misplaced" })
          }
        },
      }
    },
  },
}

/** Every FE canon rule is an error; see `sources/fe/index.mjs` for why there is no warn tier. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
