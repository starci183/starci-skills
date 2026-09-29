/**
 * The rules that hold `spec-quality.md` (HFS R67 `FE_SPEC_QUALITY`, and the "specs use the real
 * catalogue" half of R60).
 *
 * A SPEC IS A CLAIM ABOUT ONE UNIT'S BEHAVIOUR. The defects these rules refuse are the ones that made
 * specs pass while the product was wrong, or fail while it was right:
 *
 *   - pinning a class string: the spec fails when a designer changes a token, and passes when the
 *     element that carries it is gone;
 *   - testing something other than the neighbour: a spec that imports a different unit is that
 *     unit's spec in the wrong folder, and its owner will not find it;
 *   - a spec for a barrel: there is no behaviour in `export * from`, so the spec asserts that the
 *     language works;
 *   - a double cast (`as unknown as T`) to build a value the types forbid: the spec then proves the
 *     unit against a shape it can never receive;
 *   - a connected screen with no accessibility assertion: the state a reader with a screen reader
 *     meets is the one nobody looked at;
 *   - a mocked `next-intl`: the spec then passes on the KEY, so a missing or misspelled catalogue
 *     entry is invisible until a reader sees `course.titel`.
 */

import { baseName, isSpecFile } from "./lib/scope.mjs"
import { normalizePath } from "./lib/path.mjs"

/** The subject a spec sits beside: `Feed.test.tsx` -> `Feed`. */
const subjectOf = (file) => baseName(file).replace(/\.(?:test|spec)\.[cm]?tsx?$/, "")

/** The name a call is made through: `toHaveClass` in `expect(x).toHaveClass(...)`, or `axe` in `axe(x)`. */
const calleeName = (callee) => {
  if (callee.type === "Identifier") return callee.name
  if (callee.type === "MemberExpression" && !callee.computed) return callee.property.name
  return null
}

/** Static string of a literal or an expression-free template, else null. */
const staticString = (node) => {
  if (!node) return null
  if (node.type === "Literal" && typeof node.value === "string") return node.value
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0]?.value.cooked ?? ""
  return null
}

// -- SPEC-1 ----------------------------------------------------------------------------------------

/** A spec does not pin class strings. */
export const noClassStringInSpec = {
  meta: {
    type: "problem",
    docs: { description: "A component spec asserts behaviour, never a class string." },
    schema: [],
    messages: {
      pinned:
        "This spec pins a class string. It fails when a designer changes a token and passes when the element that carried it is gone - it tests the stylesheet, not the unit. Assert what the reader gets: a role, a name, a state, or the text.",
    },
  },
  create(context) {
    if (!isSpecFile(context.filename || context.getFilename())) return {}
    return {
      CallExpression(node) {
        const name = calleeName(node.callee)
        if (name === "toHaveClass") return context.report({ node, messageId: "pinned" })
        if ((name === "toHaveAttribute" || name === "getAttribute") && staticString(node.arguments[0]) === "class") {
          return context.report({ node, messageId: "pinned" })
        }
        if (name === "querySelector" || name === "querySelectorAll") {
          const selector = staticString(node.arguments[0])
          if (selector !== null && /(?:^|[\s>+~,])\.[\w-]|\[class/.test(selector)) context.report({ node, messageId: "pinned" })
        }
      },
      MemberExpression(node) {
        if (node.computed || !["className", "classList"].includes(node.property.name)) return
        context.report({ node, messageId: "pinned" })
      },
    }
  },
}

// -- SPEC-2 ----------------------------------------------------------------------------------------

/** A spec imports the unit beside it. */
export const specTestsItsNeighbour = {
  meta: {
    type: "problem",
    docs: { description: "A spec imports its sibling subject: `X.test.tsx` imports `./X`." },
    schema: [],
    messages: {
      subject:
        "This spec does not import its neighbour `./{{subject}}`. A spec exercises the unit beside it; one that imports something else is that unit's spec in the wrong folder, and its owner will not find it. Move it beside its subject, or test the neighbour.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isSpecFile(file)) return {}
    const subject = subjectOf(file)
    const accepted = new Set([`./${subject}`, `./${subject}.tsx`, `./${subject}.ts`, `./${subject}.js`, `./${subject}.jsx`])
    if (subject === "index") ["./", ".", "./index"].forEach((entry) => accepted.add(entry))
    let imported = false
    return {
      ImportDeclaration(node) {
        if (accepted.has(String(node.source.value))) imported = true
      },
      CallExpression(node) {
        // `await import("./X")` and `require("./X")` are also an import of the subject.
        const isImport = node.callee.type === "Import" || (node.callee.type === "Identifier" && node.callee.name === "require")
        if (isImport && accepted.has(staticString(node.arguments[0]))) imported = true
      },
      ImportExpression(node) {
        if (accepted.has(staticString(node.source))) imported = true
      },
      "Program:exit"(program) {
        if (!imported) context.report({ node: program, messageId: "subject", data: { subject } })
      },
    }
  },
}

// -- SPEC-3 ----------------------------------------------------------------------------------------

/** No spec for a barrel. */
export const noBarrelSpec = {
  meta: {
    type: "problem",
    docs: { description: "No `index.test.ts` beside an `index.ts` barrel." },
    schema: [],
    messages: {
      barrel:
        "A spec for a barrel. `index.ts` holds re-exports, which have no behaviour; a spec beside one asserts that the language works. Test the units the barrel re-exports, beside each of them.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!/(?:^|\/)index\.(?:test|spec)\.[cm]?ts$/.test(file)) return {}
    return { Program: (node) => context.report({ node, messageId: "barrel" }) }
  },
}

// -- SPEC-4 ----------------------------------------------------------------------------------------

/** No `as unknown as T` in a spec. */
export const noDoubleCastInSpec = {
  meta: {
    type: "problem",
    docs: { description: "A spec builds its values with the type's own shape, not `as unknown as`." },
    schema: [],
    messages: {
      double:
        "A double cast in a spec. It builds a value the types forbid, so the spec proves the unit against a shape it can never receive. Build the value with a typed factory (`mock<T>()` or a fixture builder), or narrow from `unknown` with a check.",
    },
  },
  create(context) {
    if (!isSpecFile(context.filename || context.getFilename())) return {}
    return {
      TSAsExpression(node) {
        const inner = node.expression
        if (inner && inner.type === "TSAsExpression" && inner.typeAnnotation.type === "TSUnknownKeyword") {
          context.report({ node, messageId: "double" })
        }
      },
    }
  },
}

// -- SPEC-5 ----------------------------------------------------------------------------------------

/** The specs of connected screens: a block's `index` and a feature's `index`. */
const isConnectedSpec = (file) =>
  /(?:^|\/)index\.(?:test|spec)\.[cm]?tsx$/.test(file) &&
  (/\/components\/blocks\//.test(file) || /\/features\/(?:pages|layouts|overlays)\//.test(file))

/** Names that run an accessibility check. */
const AXE_CALLS = new Set(["axe", "runAxe", "expectNoAxeViolations", "expectNoA11yViolations", "toHaveNoViolations"])

/** A connected screen's spec asserts accessibility. */
export const connectedSpecHasAxe = {
  meta: {
    type: "problem",
    docs: { description: "The spec of a connected block or feature runs an axe assertion." },
    schema: [],
    messages: {
      axe:
        "This spec covers a connected screen but runs no accessibility assertion. The state a reader with a screen reader meets is the one nobody looked at; add `expect(await axe(container)).toHaveNoViolations()`.",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!isConnectedSpec(file)) return {}
    let ran = false
    return {
      CallExpression(node) {
        const name = calleeName(node.callee)
        if (name && AXE_CALLS.has(name)) ran = true
      },
      "Program:exit"(program) {
        if (!ran) context.report({ node: program, messageId: "axe" })
      },
    }
  },
}

// -- SPEC-6 ----------------------------------------------------------------------------------------

/** No mock of the translation runtime. */
export const noMockedTranslations = {
  meta: {
    type: "problem",
    docs: { description: "A spec renders with the real catalogue; it never mocks `next-intl`." },
    schema: [],
    messages: {
      mocked:
        "A mocked `next-intl`. The spec then passes on the KEY, so a missing or misspelled catalogue entry is invisible until a reader sees `course.titel`. Render inside `NextIntlClientProvider` with the real `messages/<locale>.json`.",
    },
  },
  create(context) {
    if (!isSpecFile(context.filename || context.getFilename())) return {}
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "MemberExpression" || callee.computed) return
        if (!["mock", "doMock", "unstable_mockModule"].includes(callee.property.name)) return
        if (!["vi", "jest"].includes(callee.object.name)) return
        const target = staticString(node.arguments[0])
        if (target !== null && /^next-intl(?:\/|$)/.test(target)) context.report({ node, messageId: "mocked" })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-class-string-in-spec": noClassStringInSpec,
  "spec-tests-its-neighbour": specTestsItsNeighbour,
  "no-barrel-spec": noBarrelSpec,
  "no-double-cast-in-spec": noDoubleCastInSpec,
  "connected-spec-has-axe": connectedSpecHasAxe,
  "no-mocked-translations": noMockedTranslations,
}

/** Every rule is an error. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
