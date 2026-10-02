/**
 * The rules that hold what a provider's constructor may receive and what production source may contain
 * (catalog R83 `BE_UNNAMED_DATA_ACCESS`, R85 `BE_RAW_INJECT`, R89 `BE_SOURCE_FORM`).
 *
 * A service is unit-tested with `Test.createTestingModule` and a token double for every constructor dependency. That
 * only works when every dependency is a NAMED token and no dependency is a hidden door to the database or a fake:
 *
 *   - `provider-param-token` (R85): a constructor parameter of a Nest provider (a class carrying a `@nestjs/*` class
 *     decorator) is typed by a CLASS (the token Nest resolves), or carries an `Inject<Thing>()` decorator bound to a
 *     named token. A primitive, a union, a `Map`, a function type, an interface or a type alias has no runtime
 *     token: it is either a broken provider or a raw string/number injection.
 *   - `no-repository-class` (R83): a class that receives or returns an `EntityManager`, a typeorm `Repository`, a
 *     `DataSource` or a `QueryRunner` in any member lives only where the manager may be held (an application handler,
 *     a domain service, a platform persistence capability), in the cli app, in the test world or in a migration.
 *     A per-entity persistence class anywhere else is a repository under another name.
 *   - `no-test-double-in-source` (R89): a class, function or constant of production source is not named as a test
 *     double (`Mock`, `Fake`, `Stub` as a PascalCase or camelCase word). A double lives in a spec or `src/tests`;
 *     a production offline driver is an options-driven adapter of the port, named for what it does.
 *
 * Every question about a type asks where the type is DECLARED (`typeOrigins`), every question about a path asks the HFS
 * slot view. A name is read only for the fixed vocabulary of the double markers, as whole words.
 */
import ts from "typescript"
import { hfsOf, inTestWorld } from "./lib/hfs.mjs"
import { isSpecFile, normalizePath } from "./lib/path.mjs"
import { implementsMigration, inCli, isMigrationFile, mayHoldEntityManager } from "./lib/persistence.mjs"
import { typed, typeOrigins } from "./lib/types.mjs"

// -- provider-param-token --------------------------------------------------------------------------

/** The convention's injector vocabulary: `Inject` or `Inject<Thing>`. */
const INJECT_NAME = /^Inject(?:[A-Z][A-Za-z0-9]*)?$/

/** The decorators of a constructor parameter: on the parameter, its wrapper (`private readonly x`) or its inner identifier. */
const paramParts = (param) => {
    const inner = param.type === "TSParameterProperty" ? param.parameter : param
    const target = inner.type === "AssignmentPattern" ? inner.left : inner
    return { target, decorators: [...new Set([...(param.decorators ?? []), ...(inner.decorators ?? []), ...(target.decorators ?? [])])] }
}

/** True when a decorator expression is a call of an `Inject*` function, or of anything typed `TypedParameterDecorator<T>`. */
const isInjector = (context, decorator) => {
    const expression = decorator.expression
    const callee = expression.type === "CallExpression" ? expression.callee : expression
    const name = callee.type === "Identifier" ? callee.name : callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" ? callee.property.name : ""
    if (INJECT_NAME.test(name)) return true
    if (expression.type !== "CallExpression") return false
    const { checker, toTs } = typed(context)
    const tsCall = toTs(expression)
    return Boolean(tsCall && checker.getTypeAtLocation(tsCall).aliasSymbol?.name === "TypedParameterDecorator")
}

/** True when a class is a Nest provider-like: it carries a class decorator declared by a `@nestjs/*` package. */
const isNestClass = (context, node) =>
    (node.decorators ?? []).some((decorator) => {
        const callee = decorator.expression.type === "CallExpression" ? decorator.expression.callee : decorator.expression
        return typeOrigins(context, callee).some((origin) => origin.module !== null && origin.module.startsWith("@nestjs/"))
    })

/** True when a written type is a plain reference to one class: the token Nest resolves from the emitted metadata. */
const isClassToken = (context, annotation) => {
    if (annotation.type !== "TSTypeReference") return false
    const { checker, toTs } = typed(context)
    const tsNode = toTs(annotation)
    if (!tsNode) return false
    const type = checker.getTypeFromTypeNode(tsNode)
    const symbol = type.getSymbol()
    if (!symbol || !(symbol.flags & ts.SymbolFlags.Class)) return false
    const declaration = symbol.declarations?.find((entry) => ts.isClassDeclaration(entry) || ts.isClassExpression(entry))
    return Boolean(declaration)
}

/** A provider's constructor parameter is a class token or carries a named-token injector. */
export const providerParamToken = {
    meta: {
        type: "problem",
        docs: { description: "A constructor parameter of a Nest provider is typed by a class or carries an `Inject<Thing>()` decorator bound to a named token." },
        schema: [],
        messages: {
            untokened:
                "`{{name}}` is injected with no token Nest can resolve: its type `{{type}}` is not a class and the parameter carries no `Inject<Thing>()`. A primitive, a `Map`, a union, a function type or an interface has no runtime identity. Declare a `unique symbol` token and an `Inject<Thing>()` in the owner's `<owner>.decorators.ts` and decorate the parameter, or inject the class that owns the value.",
            unannotated:
                "`{{name}}` is injected without a type annotation, so nothing names its token. Annotate it with a class, or decorate it with the owner's `Inject<Thing>()`.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode
        const check = (classNode) => {
            if (!isNestClass(context, classNode)) return
            for (const member of classNode.body.body) {
                if (member.type !== "MethodDefinition" || member.kind !== "constructor" || !member.value?.params) continue
                for (const param of member.value.params) {
                    const { target, decorators } = paramParts(param)
                    if (decorators.some((decorator) => isInjector(context, decorator))) continue
                    const name = target.type === "Identifier" ? target.name : sourceCode.getText(target)
                    const annotation = target.typeAnnotation?.typeAnnotation
                    if (!annotation) context.report({ node: target, messageId: "unannotated", data: { name } })
                    else if (!isClassToken(context, annotation)) context.report({ node: target, messageId: "untokened", data: { name, type: sourceCode.getText(annotation) } })
                }
            }
        }
        return { ClassDeclaration: check, ClassExpression: check }
    },
}

// -- no-repository-class ---------------------------------------------------------------------------

/** The typeorm types whose presence in a member makes the class a persistence class. */
const PERSISTENCE_TYPES = new Set(["EntityManager", "Repository", "TreeRepository", "MongoRepository", "DataSource", "QueryRunner"])

/** The persistence type a written type annotation names (by declaration origin), else null. */
const persistenceTypeOf = (context, annotation) => {
    if (!annotation) return null
    const origin = typeOrigins(context, annotation).find((entry) => entry.module === "typeorm" && PERSISTENCE_TYPES.has(entry.name))
    return origin ? origin.name : null
}

/** The first member of a class that takes, holds or returns a persistence type: `{ member, type }`, else null. */
const persistenceMember = (context, classNode) => {
    for (const member of classNode.body.body) {
        if (member.type === "PropertyDefinition" || member.type === "AccessorProperty") {
            const type = persistenceTypeOf(context, member.typeAnnotation?.typeAnnotation)
            if (type) return { member, type }
            continue
        }
        if (member.type !== "MethodDefinition" || !member.value) continue
        const fn = member.value
        for (const param of fn.params ?? []) {
            const { target } = paramParts(param)
            const type = persistenceTypeOf(context, target.typeAnnotation?.typeAnnotation)
            if (type) return { member, type }
        }
        const returned = persistenceTypeOf(context, fn.returnType?.typeAnnotation)
        if (returned) return { member, type: returned }
    }
    return null
}

/** A persistence class exists only where the manager may be held. */
export const noRepositoryClass = {
    meta: {
        type: "problem",
        docs: { description: "A class with a member typed `EntityManager`, `Repository`, `DataSource` or `QueryRunner` lives only in an application handler, a domain service, a platform persistence capability, the cli app, the test world or a migration." },
        schema: [],
        messages: {
            statements:
                "`{{name}}` is exported and takes an `EntityManager` as its first parameter: a statement module is a repository without a class. Put the SQL text in `<name>.sql.ts` and run it with `this.entityManager.query(...)` from the capability `*.service.ts` or the application `*.handler.ts`; only `platform/database`, the cli (`apps/cli`, `src/features/cli`) and `src/tests` take a manager in a free function.",
            repository:
                "`{{name}}` takes or holds a `{{type}}` in `{{member}}` but is not an application handler, a domain service or a platform persistence capability. A class wrapping the manager per entity is a repository whatever it is called: it hides which connection and transaction a call runs in and cannot be unit-tested with a token double. Move the queries into the handler or the domain service that owns the use, and call the injected EntityManager directly.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        const file = normalizePath(filename)
        if (mayHoldEntityManager(hfs, file) || inCli(hfs, file) || inTestWorld(hfs, file) || isMigrationFile(hfs, file) || (hfs.slotOf(file) ?? "").startsWith("be.tests.")) return {}
        const check = (node) => {
            if (implementsMigration(context, node)) return
            const found = persistenceMember(context, node)
            if (!found) return
            const key = found.member.key
            const member = found.member.kind === "constructor" ? "constructor" : key?.type === "Identifier" ? key.name : "a member"
            context.report({ node: node.id ?? node, messageId: "repository", data: { name: node.id?.name ?? "this class", type: found.type, member } })
        }
        /** An exported function whose first parameter is an EntityManager is a statement module: the same wrapper without a class. */
        const checkFunction = (fn, id) => {
            const first = fn.params?.[0]
            if (!first) return
            const { target } = paramParts(first)
            if (persistenceTypeOf(context, target.typeAnnotation?.typeAnnotation) !== "EntityManager") return
            context.report({ node: id, messageId: "statements", data: { name: id.name ?? "this function" } })
        }
        return {
            ClassDeclaration: check,
            ClassExpression: check,
            ExportNamedDeclaration(node) {
                const declaration = node.declaration
                if (declaration?.type === "FunctionDeclaration" && declaration.id) checkFunction(declaration, declaration.id)
                if (declaration?.type === "VariableDeclaration") {
                    for (const entry of declaration.declarations) {
                        if (entry.id.type === "Identifier" && entry.init && (entry.init.type === "ArrowFunctionExpression" || entry.init.type === "FunctionExpression")) checkFunction(entry.init, entry.id)
                    }
                }
            },
        }
    },
}

// -- no-test-double-in-source ----------------------------------------------------------------------

/** The words that mark a test double. */
const DOUBLE_WORDS = new Set(["mock", "fake", "stub"])

/**
 * The words of an identifier: `MockExpertAgentService` gives `Mock Expert Agent Service`, `fakeClock` gives `fake Clock`,
 * `FAKE_CLOCK` gives `FAKE CLOCK`, `HTTPStub` gives `HTTP Stub`. A word is whole: `Faker` and `Mockingbird` are not `Fake`
 * and `Mock`.
 */
const wordsOf = (name) =>
    name
        .split(/[^A-Za-z0-9]+/)
        .flatMap((part) => part.match(/[A-Z]+(?![a-z])|[A-Z]?[a-z]+|[0-9]+/g) ?? [])

/** The double marker word an identifier carries, else null. */
export const doubleWordOf = (name) => wordsOf(name).find((word) => DOUBLE_WORDS.has(word.toLowerCase())) ?? null

/** Production source names no test double. */
export const noTestDoubleInSource = {
    meta: {
        type: "problem",
        docs: { description: "A class, function or constant of production source is not named `Mock*`, `Fake*` or `Stub*`." },
        schema: [],
        messages: {
            double:
                "`{{name}}` carries the test-double word `{{word}}` in production source. A double belongs in a spec or `src/tests`; a production offline or deterministic driver is an options-driven adapter of the port (its behaviour chosen by the module's options), renamed for what it does (`TemplateCatalogAdapter`, `OfflineDrafter`), and selected by configuration, never by being a mock.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        if (isSpecFile(filename) || (hfs.slotOf(filename) ?? "").startsWith("be.tests.")) return {}
        const report = (id) => {
            const word = doubleWordOf(id.name)
            if (word) context.report({ node: id, messageId: "double", data: { name: id.name, word } })
        }
        return {
            ClassDeclaration(node) { if (node.id) report(node.id) },
            ClassExpression(node) { if (node.id) report(node.id) },
            FunctionDeclaration(node) { if (node.id) report(node.id) },
            VariableDeclarator(node) {
                if (node.id.type === "Identifier" && node.parent?.parent?.type === "ExportNamedDeclaration") report(node.id)
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "provider-param-token": providerParamToken,
    "no-repository-class": noRepositoryClass,
    "no-test-double-in-source": noTestDoubleInSource,
}

/** Every rule of this law ships at `error`. */
export const recommended = {
    "starci-be/provider-param-token": "error",
    "starci-be/no-repository-class": "error",
    "starci-be/no-test-double-in-source": "error",
}
