/**
 * The rules that hold `loading.md`.
 *
 * Three shapes of the same mistake: a second tree describing the first. A twin component, a
 * ready-made placeholder handed in as a prop, and a ternary picking between two different
 * components at a call site. Each is correct on the day it is written and wrong the first time the
 * real shape changes.
 *
 * WHY THIS NEEDS RULES AT ALL, when so much of this canon is held by types. A resting shape has no
 * assertion to fail: it is not wrong in a way a compiler or a test can see, it is wrong on screen,
 * and only for the second somebody happens to be watching. That is exactly the class of defect a
 * lint rule is for - the one nothing else will ever report.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** The component tree; a placeholder in a test fixture is a fixture, not a second tree. */
const isComponentFile = (filename) => normalizePath(filename).includes("/src/components/")

/** A twin test may build a resting shape by hand to assert against it. */
const isTestFile = (filename) => /\.(?:test|spec)\.(?:ts|tsx)$/.test(normalizePath(filename))

/** Product component source these rules govern. */
const isGoverned = (filename) => isComponentFile(filename) && !isTestFile(filename)

/** A flag that means "waiting", in the spellings this codebase uses. */
const WAITING_FLAG = /\bis(?:Loading|Skeleton|Pending)\b/

/** The name of a component whose whole job is to mirror another one's shape. */
const TWIN_NAME = /^[A-Za-z0-9]*Skeleton$/

/** JSX element name, including `Foo.Bar`. */
const jsxElementName = (opening) => {
  const name = opening && opening.name
  if (!name) return null
  if (name.type === "JSXIdentifier") return name.name
  if (name.type === "JSXMemberExpression" && name.object && name.property) {
    return `${name.object.name}.${name.property.name}`
  }
  return null
}

// -- LOADING-1 -------------------------------------------------------------------------------------

/** No component exists whose job is to mirror another component's shape. */
export const noRestingTwinComponent = {
  meta: {
    type: "problem",
    docs: { description: "No component whose whole job is to mirror another one's shape." },
    schema: [],
    messages: {
      twin:
        "`{{name}}` is a hand-mirrored twin: a second description of a shape that already has one. It cannot be kept in step - it can only be noticed after it has already drifted, and a resting shape has no assertion to fail, so nothing will report the drift. Give the component it mirrors a resting state and let it rest as ITSELF.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isGoverned(file)) return {}
    const hit = file.match(/\/([A-Za-z0-9]*Skeleton)\/index\.tsx?$/) || file.match(/\/([A-Za-z0-9]*Skeleton)\.tsx?$/)
    if (!hit || !TWIN_NAME.test(hit[1])) return {}
    return {
      Program(node) {
        context.report({ node, messageId: "twin", data: { name: hit[1] } })
      },
    }
  },
}

// -- LOADING-1, handed in from outside --------------------------------------------------------------

/** A ready-made placeholder is the same second tree, passed as a prop. */
export const noPlaceholderProp = {
  meta: {
    type: "problem",
    docs: { description: "No prop hands a component a ready-made resting shape to render." },
    schema: [],
    messages: {
      prop:
        "A resting shape handed in as markup is a second description of a tree that already has one, and it sits further from the shape it copies than a twin does - the component it describes cannot even see it. Pass the waiting flag down instead, and let each part rest as itself.",
      import:
        "`{{name}}` is a hand-kept resting tree imported from beside its subject. It drifts the first time the real shape changes, and nothing reports it. Thread the waiting flag down instead.",
    },
  },
  create(context) {
    if (!isGoverned(context.filename || context.getFilename())) return {}
    return {
      JSXAttribute(node) {
        const name = node.name && node.name.type === "JSXIdentifier" ? node.name.name : null
        if (name !== "skeleton" && name !== "placeholder" && name !== "fallback") return
        const value = node.value
        if (!value || value.type !== "JSXExpressionContainer") return
        const expression = value.expression
        if (expression.type === "JSXElement" || expression.type === "JSXFragment") {
          context.report({ node, messageId: "prop" })
        }
      },
      ImportDeclaration(node) {
        const source = node.source && node.source.value
        if (typeof source !== "string" || !/^\.\.?\//.test(source)) return
        for (const specifier of node.specifiers || []) {
          const local = specifier.local && specifier.local.name
          // A bare `Skeleton` is the primitive a component rests WITH, not a twin of one.
          if (!local || local === "Skeleton" || !TWIN_NAME.test(local)) continue
          context.report({ node: specifier, messageId: "import", data: { name: local } })
        }
      },
    }
  },
}

// -- LOADING-2 -------------------------------------------------------------------------------------

/** A caller never picks between a resting shape and a real one. */
export const noRestingBranchAtCallSite = {
  meta: {
    type: "problem",
    docs: { description: "A waiting flag must not choose between two different components." },
    schema: [],
    messages: {
      branch:
        "`{{flag}}` picks between two DIFFERENT elements, which is a resting shape written at the call site - and it drifts from the real one the first time the real one changes. Give the component below a waiting flag and pass it down; let it rest as ITSELF. The same component on both sides is the honest form: one description, two states.",
    },
  },
  create(context) {
    if (!isGoverned(context.filename || context.getFilename())) return {}
    const source = context.sourceCode || context.getSourceCode()
    /** Root element name of one arm, or null when the arm is not an element. */
    const armName = (expression) => {
      if (!expression) return null
      if (expression.type === "JSXElement") return jsxElementName(expression.openingElement)
      if (expression.type === "JSXFragment") return "<>"
      return null
    }
    return {
      ConditionalExpression(node) {
        const test = source.getText(node.test)
        if (!WAITING_FLAG.test(test)) return
        const left = armName(node.consequent)
        const right = armName(node.alternate)
        // Both arms must be real elements AND differ. `null` on one side is LOADING-5 - a control
        // that has nowhere to go yet - and that is correct rather than a second tree.
        if (!left || !right || left === right) return
        context.report({ node, messageId: "branch", data: { flag: test.trim().slice(0, 40) } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-resting-twin-component": noRestingTwinComponent,
  "no-placeholder-prop": noPlaceholderProp,
  "no-resting-branch-at-call-site": noRestingBranchAtCallSite,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * A repository adopting these with history should expect the twin rule to report a folder at a
 * time: hand-kept placeholder trees arrive in families, one per screen, and each is a real shape
 * that has to be folded back into the component it copies rather than deleted.
 */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
