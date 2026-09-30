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

import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import ts from "typescript"
import { hfsOf } from "./lib/hfs.mjs"
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

/** The siblings `index.spec.ts(x)` can be the spec of. */
const INDEX_SIBLINGS = ["index.ts", "index.tsx"]

/** A statement that holds no behaviour: an import or an export declaration (a re-export, `export {}`, `export type {}`). */
const isBarrelStatement = (statement) => ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)

/** True when the file holds nothing but import and export declarations. */
const isBarrelSource = (text) => {
  const source = ts.createSourceFile("index.tsx", text, ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX)
  return source.statements.every(isBarrelStatement)
}

/** No spec for a barrel: the spec's `index.ts(x)` sibling holds only imports and re-exports. */
export const noBarrelSpec = {
  meta: {
    type: "problem",
    docs: { description: "No `index.spec.ts` beside an `index.ts` that is only a barrel." },
    schema: [],
    messages: {
      barrel:
        "A spec for a barrel. The sibling `index.ts` holds only imports and re-exports, which have no behaviour; a spec beside one asserts that the language works. Test the units the barrel re-exports, beside each of them. (An `index.ts` that holds implementation - a function, a class or a value - may have this spec.)",
    },
  },
  create(context) {
    const file = normalizePath(context.filename || context.getFilename())
    if (!/(?:^|\/)index\.(?:test|spec)\.[cm]?tsx?$/.test(file)) return {}
    const sibling = INDEX_SIBLINGS.map((name) => join(dirname(file), name)).find((candidate) => existsSync(candidate))
    if (!sibling || !isBarrelSource(readFileSync(sibling, "utf8"))) return {}
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

/** The functions a spec mocks a module with. */
const MOCK_CALLS = new Set(["mock", "doMock", "unstable_mockModule"])

/** Every node under `root` (inclusive), through the parser's visitor keys. */
const walk = (root, keys, visit) => {
  if (!root || typeof root.type !== "string") return
  visit(root)
  for (const key of keys[root.type] ?? []) {
    const child = root[key]
    for (const item of Array.isArray(child) ? child : [child]) walk(item, keys, visit)
  }
}

/** Where an import specifier points, as an absolute path: a relative path, or `@/` from the owning app's `src/`. */
const resolveSpecifier = (hfs, file, specifier) => {
  if (specifier.startsWith(".")) return resolve(dirname(file), specifier)
  if (!specifier.startsWith("@/")) return null
  const owner = hfs.ownerOf(file)
  return owner ? join(hfs.repoRoot, owner, "src", specifier.slice(2)) : null
}

/** True when the specifier is the app's message catalogue: a file under `messages/` of the i18n module slot. */
const isCatalogSpecifier = (hfs, file, specifier) => {
  const target = resolveSpecifier(hfs, file, specifier)
  if (!target) return false
  const path = normalizePath(target)
  return hfs.slotOf(path) === "fe.modules.i18n" && /\/modules\/i18n\/messages(?:\/|$)/.test(path)
}

/** A spec renders with the real catalogue; a server helper's mock serves it. */
export const noMockedTranslations = {
  meta: {
    type: "problem",
    docs: { description: "A spec renders with the real catalogue; it never mocks `next-intl` (a `next-intl/server` mock must serve the real catalogue)." },
    schema: [],
    messages: {
      mocked:
        "A mocked `next-intl`. The spec then passes on the KEY, so a missing or misspelled catalogue entry is invisible until a reader sees `course.titel`. Render inside `NextIntlClientProvider` with the real `messages/<locale>.json`.",
      mockedServer:
        "A `next-intl/server` mock that does not serve the real catalogue. A server helper has no provider to render inside, so the mock is allowed - but its factory must build the translator from the app's real messages (import `modules/i18n/messages/<locale>.json` and pass it to `createTranslator` from `next-intl`); a literal or key-echoing translator passes on the KEY and hides a missing or misspelled entry.",
    },
  },
  create(context) {
    const file = context.filename || context.getFilename()
    if (!isSpecFile(file)) return {}
    const source = context.sourceCode ?? context.getSourceCode()
    const keys = source.visitorKeys
    const catalogBindings = new Set()
    const mocks = []
    const hoisted = []
    return {
      ImportDeclaration(node) {
        if (!isCatalogSpecifier(hfsOf(context), file, String(node.source.value))) return
        for (const specifier of node.specifiers) catalogBindings.add(specifier.local.name)
      },
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "MemberExpression" || callee.computed) return
        if (["vi", "jest"].includes(callee.object.name) && callee.property.name === "hoisted") hoisted.push(node)
        if (!MOCK_CALLS.has(callee.property.name) || !["vi", "jest"].includes(callee.object.name)) return
        const target = staticString(node.arguments[0])
        if (target !== null && /^next-intl(?:\/|$)/.test(target)) mocks.push({ node, target })
      },
      "Program:exit"() {
        // The catalogue is served when a catalogue binding, or a dynamic import of the catalogue, is used by the factory or by a `vi.hoisted` block.
        const serves = (root) => {
          let found = false
          walk(root, keys, (inner) => {
            if (inner.type === "Identifier" && catalogBindings.has(inner.name)) found = true
            const specifier = inner.type === "ImportExpression" ? staticString(inner.source) : null
            if (specifier !== null && isCatalogSpecifier(hfsOf(context), file, specifier)) found = true
          })
          return found
        }
        for (const { node, target } of mocks) {
          if (target === "next-intl/server") {
            const factory = node.arguments[1]
            if (factory && (serves(factory) || hoisted.some(serves))) continue
            context.report({ node, messageId: "mockedServer" })
          } else context.report({ node, messageId: "mocked" })
        }
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
