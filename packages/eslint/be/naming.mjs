/**
 * The rules that hold `naming.md`.
 *
 * Three rules, which are the parts of naming a parser can actually judge: whether a name encodes a
 * schema VERSION, whether an exported function is a bare verb, and whether a `.module.ts` file's
 * OWN static factory borrows a vendor dynamic-module's exact name instead of this tree's `register`.
 *
 * `no-default-export` (BE-CONVENTION 1.15, R89) is the form rule beside them: named exports only, with one Jest
 * `*.global-setup.ts` in slot `be.tests.e2e-setup` as the single default export.
 *
 * A FOURTH RULE WAS WRITTEN AND DELETED, and the deletion is the useful part. It demanded that a
 * file name spell out the class it declares, and measured 616 offenders in 4430 files -- because
 * the convention is the opposite of what it assumed: the PATH carries the role and the scope
 * (`parsers/content.service.ts` and `path/content.service.ts` declare `ContentParserService` and
 * `ContentPathService`), and the file names only the subject. Fourteen percent of a tree is a
 * convention, not debt. Canon records what the code does; a rule that disagrees with the code at
 * that scale is the rule being wrong.
 *
 * The module-factory rule (NAME-1) stays narrow on purpose: it visits DECLARATIONS only -- a static
 * method on a class this repository declares, decorated `@Module(...)` -- and never a CallExpression,
 * so `BullModule.forRoot(...)`, `ConfigModule.forRoot(...)`, `TypeOrmModule.forFeature(...)` and
 * `SentryCoreModule.forRoot(...)` are calls into vendor code and are never reported. Its forbidden
 * set is closed to the four literal vendor names (`forRoot`, `forRootAsync`, `forFeature`,
 * `forFeatureAsync`); a repository-invented auxiliary factory like `registerQueue` does not collide
 * with a vendor shape and is left alone.
 *
 * The rest of the law is not enforced and should not be faked. Whether a name describes a folder
 * (NAME-3), a mechanism (NAME-4) or its first caller (NAME-7) needs to know what the thing IS --
 * `VolumeService` reads perfectly well until you know the folder was renamed, and no parser knows
 * that. Those are read by a person, which is why the law states them with the scars attached.
 */

import { hfsOf } from "./lib/hfs.mjs"
import { normalizePath } from "./lib/path.mjs"

/** A schema generation baked into an identifier. */
const VERSIONED_NAME = /(?:^|[a-z])V[0-9]+(?:$|[A-Z_])|_V[0-9]+/

/** Bare verbs that say nothing about their object. */
const BARE_VERBS = new Set([
  "generate",
  "parse",
  "run",
  "handle",
  "process",
  "build",
  "create",
  "load",
  "resolve",
  "check",
  "convert",
  "transform",
  "send",
  "fetch",
  "get",
  "set",
  "update",
  "apply",
])

// -- NAME-1 ----------------------------------------------------------------------------------------

/** Decorator names carried by a class declaration. */
const decoratorNames = (node) =>
  (node.decorators || []).map((decorator) => {
    const expression = decorator.expression
    if (expression.type === "CallExpression" && expression.callee.type === "Identifier") return expression.callee.name
    if (expression.type === "Identifier") return expression.name
    return null
  }).filter(Boolean)

/**
 * Vendor dynamic-module factory names, each mapped to the house name a `.module.ts` file's own
 * factory declares instead: `register`, or `registerAsync` for its async companion.
 *
 * This is a CLOSED list of the exact method names Nest's own modules publish
 * (`ConfigModule.forRoot`, `TypeOrmModule.forFeature`, `BullModule.forRootAsync`,
 * `SentryCoreModule.forRoot`). A repository class that declares its OWN static factory under one of
 * these names is not calling the vendor - it is shaped like the vendor, which is exactly what makes
 * `PrimaryPostgreSQLModule.forFeature()` unreadable at a glance from `TypeOrmModule.forFeature()`:
 * same literal name, two different owners, and nothing at the call site says which.
 */
const VENDOR_FACTORY_NAMES = new Map([
  ["forRoot", "register"],
  ["forRootAsync", "registerAsync"],
  ["forFeature", "register"],
  ["forFeatureAsync", "registerAsync"],
])

/** A `.module.ts` file's own static factory is named `register`, never a vendor's factory shape. */
export const noVendorModuleFactoryName = {
  meta: {
    type: "problem",
    docs: {
      description:
        "NAME-1: a `.module.ts` file's own static factory is named `register` (`registerAsync` for its async companion), never a vendor dynamic-module name it does not own.",
    },
    schema: [],
    messages: {
      vendorShaped:
        "`{{name}}` is a module declared IN THIS REPOSITORY, but its static factory is named `{{method}}` - the exact name Nest's own vendor modules publish (`ConfigModule.forRoot`, `TypeOrmModule.forFeature`, `BullModule.forRootAsync`). A reader hitting `{{name}}.{{method}}(...)` in an `imports:` list cannot tell, from the name alone, whether that call lands in this class or forwards straight into a vendor's. Thirty-nine other modules in this tree already answer that question by calling this factory `{{suggestion}}` instead - a name no vendor already owns. Rename `{{method}}` to `{{suggestion}}`.",
    },
  },
  create(context) {
    return {
      MethodDefinition(node) {
        if (!node.static) return
        if (!node.key || node.key.type !== "Identifier") return
        const suggestion = VENDOR_FACTORY_NAMES.get(node.key.name)
        if (!suggestion) return

        const classBody = node.parent
        const classNode = classBody && classBody.parent
        if (!classNode || !decoratorNames(classNode).includes("Module")) return

        const name = (classNode.id && classNode.id.name) || "this module"
        context.report({
          node: node.key,
          messageId: "vendorShaped",
          data: { name, method: node.key.name, suggestion },
        })
      },
    }
  },
}

// -- NAME-2 ----------------------------------------------------------------------------------------

/** A name says what a thing is, never which schema generation it was built for. */
export const noVersionInName = {
  meta: {
    type: "problem",
    docs: { description: "Identifiers do not encode a schema version." },
    schema: [],
    messages: {
      versioned:
        "`{{name}}` bakes a schema generation into the name. It has to be renamed the day the next one arrives, and until then nobody can tell from the name whether it means the CURRENT shape or an old one -- so every reader goes and finds out. Name the property that generation introduced instead: `hasVerifiedMarker`, not `isV2`.",
    },
  },
  create(context) {
    const report = (node, name) => {
      if (!name || !VERSIONED_NAME.test(name)) return
      context.report({ node, messageId: "versioned", data: { name } })
    }
    return {
      FunctionDeclaration(node) {
        if (node.id) report(node.id, node.id.name)
      },
      ClassDeclaration(node) {
        if (node.id) report(node.id, node.id.name)
      },
      TSInterfaceDeclaration(node) {
        if (node.id) report(node.id, node.id.name)
      },
      TSTypeAliasDeclaration(node) {
        if (node.id) report(node.id, node.id.name)
      },
      MethodDefinition(node) {
        if (node.key && node.key.type === "Identifier") report(node.key, node.key.name)
      },
    }
  },
}

// -- NAME-5 ----------------------------------------------------------------------------------------

/** An exported function is a verb plus its object. */
export const noBareVerbExport = {
  meta: {
    type: "problem",
    docs: { description: "An exported function names its object, not just its verb." },
    schema: [],
    messages: {
      bareVerb:
        "`{{name}}` is a bare verb: {{name}} WHAT? At an import list it collides with every other module's `{{name}}`, so the reader falls back on reading the path to tell them apart -- and the path is the thing that moves. Give it its object.",
    },
  },
  create(context) {
    const check = (node, name) => {
      if (!name || !BARE_VERBS.has(name)) return
      context.report({ node, messageId: "bareVerb", data: { name } })
    }
    return {
      ExportNamedDeclaration(node) {
        const declaration = node.declaration
        if (!declaration) return
        if (declaration.type === "FunctionDeclaration" && declaration.id) {
          check(declaration.id, declaration.id.name)
          return
        }
        if (declaration.type !== "VariableDeclaration") return
        for (const one of declaration.declarations) {
          const init = one.init
          const isFunction = init
            && (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")
          if (isFunction && one.id && one.id.type === "Identifier") check(one.id, one.id.name)
        }
      },
    }
  },
}

// -- no-default-export -------------------------------------------------------------------------------------------

/** The one file kind that may default-export: a Jest global setup, whose API is a default function. */
const isGlobalSetup = (context) => hfsOf(context).slotOf(context.filename) === "be.tests.e2e-setup" && normalizePath(context.filename).endsWith(".global-setup.ts")

/** Named exports only: a default export has no name to grep, rename or import-check. */
export const noDefaultExport = {
  meta: {
    type: "problem",
    docs: { description: "TypeScript source uses named exports only; the Jest global setup is the one exception." },
    schema: [],
    messages: {
      default:
        "A default export has no name of its own: every importer picks one, renames and greps stop working, and the file cannot be found by what it exports. Use a named export. (The only default export is a Jest global setup, `*.global-setup.ts` in the e2e setup folder, whose API requires it.)",
    },
  },
  create(context) {
    if (!/\.[cm]?ts$/.test(normalizePath(context.filename))) return {}
    if (isGlobalSetup(context)) return {}
    const isDefault = (name) => name && ((name.type === "Identifier" && name.name === "default") || (name.type === "Literal" && name.value === "default"))
    return {
      ExportDefaultDeclaration(node) {
        context.report({ node, messageId: "default" })
      },
      TSExportAssignment(node) {
        context.report({ node, messageId: "default" })
      },
      ExportSpecifier(node) {
        if (isDefault(node.exported) || (node.parent.source && isDefault(node.local))) context.report({ node, messageId: "default" })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-version-in-name": noVersionInName,
  "no-bare-verb-export": noBareVerbExport,
  "no-vendor-module-factory-name": noVendorModuleFactoryName,
  "no-default-export": noDefaultExport,
}

/** Every rule of this law at `error`. */
export const recommended = {
  "starci-be/no-version-in-name": "error",
  "starci-be/no-bare-verb-export": "error",
  "starci-be/no-vendor-module-factory-name": "error",
  "starci-be/no-default-export": "error",
}
