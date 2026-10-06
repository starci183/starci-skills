/**
 * The rules that hold the test data builder standard (knowledge BE-TEST-16, catalog R98 to R101).
 *
 * Builders live only in `src/tests/fixtures/builders/<area>.builder.ts` (slot `be.tests.fixtures.builders`). The slot manifest refuses the
 * file names (`*.repository.ts`, `*.fixture.ts`, `*.factory.ts`, a `*.builder.ts` elsewhere: BE_SOURCE_FORM); these rules judge what
 * the files DO, so a builder cannot hide under another name:
 *
 *   - `persisting-builder-in-builders-slot` (R98): a module of the test tree that exports something creating persisted rows through an
 *     EntityManager, DataSource or QueryRunner IS a builder, wherever it sits and whatever it is called, so it must be in the builders slot.
 *   - `spec-no-raw-insert` (R99): a spec never runs a raw INSERT/UPDATE/DELETE or writes (`save`, `insert`, ...) through a database receiver.
 *   - `spec-no-repeated-row-literal` (R99): a spec never builds the same persistence entity as an object literal twice; the row comes from a builder.
 *   - `builder-arranges-only` (R101): a builder never asserts and has deterministic defaults.
 *   - `tests-keep-constraints` (R100): nothing in the test tree switches database constraints off.
 *
 * A receiver is recognised by its TYPE, an entity by its declaration (a class decorated with typeorm's `@Entity`), a builder file by
 * its slot; nothing is matched by a name.
 */
import { basename } from "node:path"
import ts from "typescript"
import { INSERTING_SQL, isDatabaseReceiver, methodOf, queryText, WRITING_SQL } from "./lib/db-writes.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { moduleOf, typed } from "./lib/types.mjs"

/** The file name of a linted path, in forward-slash form. */
const baseOf = (filename) => basename(String(filename || "").replaceAll("\\", "/"))

// -- spec-no-raw-insert ----------------------------------------------------------------------------

const WRITE_METHODS = new Set(["save", "insert", "upsert", "update", "delete", "remove", "softDelete", "softRemove", "recover", "restore"])

/** A unit service spec, an integration spec or an e2e spec. */
const isSpecName = (name) => /\.(?:spec|integration-spec|e2e-spec)\.[cm]?ts$/.test(name)

/** A spec arranges rows through a builder, never by writing them itself. */
export const specNoRawInsert = {
    meta: {
        type: "problem",
        docs: { description: "A spec arranges rows through a builder, never through a raw INSERT or a direct write on an EntityManager." },
        schema: [],
        messages: {
            write: "This spec writes rows itself with `{{method}}` on a database receiver. Arrange the row through the area's builder (`src/tests/fixtures/builders/<area>.builder.ts`), which creates the parent chain with constraints on; a spec reads state back, it does not write it.",
            sql: "This spec runs a raw INSERT/UPDATE/DELETE. Arrange the row through the area's builder (`src/tests/fixtures/builders/<area>.builder.ts`); a spec reads state back with `find*`, `count` or a SELECT, it does not write it.",
        },
    },
    create(context) {
        if (!isSpecName(baseOf(context.filename || context.getFilename()))) return {}
        const sourceCode = context.sourceCode || context.getSourceCode()
        return {
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
                const method = callee.property.name
                if (!WRITE_METHODS.has(method) && method !== "query") return
                if (!isDatabaseReceiver(context, callee.object)) return
                if (method === "query") {
                    const text = queryText(node.arguments[0], sourceCode.getScope(node))
                    if (text !== null && WRITING_SQL.test(text)) context.report({ node, messageId: "sql" })
                    return
                }
                context.report({ node, messageId: "write", data: { method } })
            },
        }
    },
}

// -- spec-no-repeated-row-literal ------------------------------------------------------------------

/** True when a class declaration carries typeorm's `@Entity(...)`, resolved by where the decorator is declared. */
const isEntityClass = (checker, declaration) => {
    if (!ts.isClassDeclaration(declaration)) return false
    return (ts.getDecorators(declaration) ?? []).some((decorator) => {
        const callee = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression
        const symbol = checker.getSymbolAtLocation(callee)
        if (!symbol) return false
        const target = (symbol.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(symbol) : symbol
        return (target.getDeclarations?.() ?? []).some((found) => moduleOf(found, String(found.getSourceFile().fileName).replaceAll("\\", "/")) === "typeorm")
    })
}

/** The entity class declarations a type stands for: itself, a union member, or the argument of a `Partial<Entity>` style alias. */
const entityClassesOf = (checker, type) => {
    if (!type) return []
    const parts = type.isUnion?.() ? type.types : [type]
    const candidates = parts.flatMap((part) => [part, ...(part.aliasTypeArguments ?? [])])
    return candidates.flatMap((candidate) => (candidate.getSymbol?.()?.getDeclarations?.() ?? []).filter((declaration) => isEntityClass(checker, declaration)))
}

/** A spec builds each persistence entity as an object literal at most once; further rows come from a builder. */
export const specNoRepeatedRowLiteral = {
    meta: {
        type: "problem",
        docs: { description: "A spec does not hand-build the same persistence entity as an object literal more than once." },
        schema: [],
        messages: {
            repeated: "This spec builds a `{{entity}}` row as an object literal again (first at line {{line}}). Repeated hand-built rows belong in the area's builder (`src/tests/fixtures/builders/<area>.builder.ts`): `orderRow(overrides)` for a unit spec, `orderBuilder(db).pending().build(overrides)` for integration and e2e.",
        },
    },
    create(context) {
        if (!isSpecName(baseOf(context.filename || context.getFilename()))) return {}
        const { checker, toTs } = typed(context)
        const firstLine = new Map()
        return {
            ObjectExpression(node) {
                if (node.properties.length === 0 || node.properties.some((property) => property.type === "SpreadElement")) return
                const tsNode = toTs(node)
                const [entity] = entityClassesOf(checker, tsNode && checker.getContextualType(tsNode))
                if (!entity) return
                const seen = firstLine.get(entity)
                if (seen === undefined) firstLine.set(entity, node.loc.start.line)
                else context.report({ node, messageId: "repeated", data: { entity: entity.name?.text ?? "entity", line: String(seen) } })
            },
        }
    },
}

// -- persisting-builder-in-builders-slot -----------------------------------------------------------

const BUILDERS = "be.tests.fixtures.builders"
/** The spec slots of the test tree; a spec is judged by the spec rules, not as a builder. */
const SPEC_SLOTS = new Set(["be.tests.integration", "be.tests.e2e", "be.tests.contract"])
const CREATING_METHODS = new Set(["save", "insert", "upsert"])

/** A file of the test tree that is not a spec and is not the builders slot. */
const isTestSupport = (slot) => typeof slot === "string" && slot.startsWith("be.tests.") && slot !== BUILDERS && !SPEC_SLOTS.has(slot)

/** The top-level statement that holds a node. */
const topStatementOf = (node) => {
    let current = node
    while (current.parent && current.parent.type !== "Program") current = current.parent
    return current
}

/** The names a top-level statement declares. */
const declaredNames = (statement) => {
    const declaration = statement.type === "ExportNamedDeclaration" ? statement.declaration : statement
    if (!declaration) return []
    if (declaration.type === "VariableDeclaration") return declaration.declarations.flatMap((entry) => (entry.id.type === "Identifier" ? [entry.id.name] : []))
    return declaration.id ? [declaration.id.name] : []
}

/** A module of the test tree that exports something creating persisted rows is a builder and lives in the builders slot. */
export const persistingBuilderInBuildersSlot = {
    meta: {
        type: "problem",
        docs: { description: "A module that exports functions creating persisted rows through an EntityManager is a test data builder and lives in the builders slot." },
        schema: [],
        messages: {
            misplaced: "`{{name}}` creates persisted rows through a database receiver, so it is a test data builder, whatever it is called. Move it to `src/tests/fixtures/builders/<area>.builder.ts` (its SQL text to `<area>.sql.ts` beside it); the test tree keeps one home for arranging data.",
        },
    },
    create(context) {
        if (!isTestSupport(hfsOf(context).slotOf(context.filename || context.getFilename()))) return {}
        const sourceCode = context.sourceCode || context.getSourceCode()
        const writes = new Set()
        const references = new Map()
        const isCreation = (node) => {
            const method = methodOf(node)
            if (!method || !isDatabaseReceiver(context, node.callee.object)) return false
            if (CREATING_METHODS.has(method)) return true
            return method === "query" && INSERTING_SQL.test(queryText(node.arguments[0], sourceCode.getScope(node)) ?? "")
        }
        return {
            CallExpression(node) {
                if (isCreation(node)) writes.add(topStatementOf(node))
            },
            Identifier(node) {
                const statement = topStatementOf(node)
                if (!references.has(statement)) references.set(statement, new Set())
                references.get(statement).add(node.name)
            },
            "Program:exit"(program) {
                const exported = new Set(program.body.flatMap((statement) => (statement.type === "ExportNamedDeclaration" && !statement.declaration && !statement.source ? statement.specifiers.map((specifier) => specifier.local.name) : [])))
                const writerNames = new Set(program.body.filter((statement) => writes.has(statement)).flatMap(declaredNames))
                for (const statement of program.body) {
                    const isExported = statement.type === "ExportNamedDeclaration" ? Boolean(statement.declaration) : declaredNames(statement).some((name) => exported.has(name))
                    if (!isExported) continue
                    const uses = references.get(statement) ?? new Set()
                    if (!writes.has(statement) && ![...uses].some((name) => writerNames.has(name))) continue
                    context.report({ node: statement, messageId: "misplaced", data: { name: declaredNames(statement)[0] ?? "This export" } })
                }
            },
        }
    },
}

// -- builder-arranges-only -------------------------------------------------------------------------

const JEST_GLOBALS = new Set(["expect", "jest", "describe", "it", "test", "beforeAll", "beforeEach", "afterAll", "afterEach", "fail"])
const RANDOM_FUNCTIONS = new Set(["randomUUID", "randomBytes", "randomInt", "randomFillSync", "randomFill", "getRandomValues"])

/** A builder arranges data only: no assertion, deterministic defaults. */
export const builderArrangesOnly = {
    meta: {
        type: "problem",
        docs: { description: "A test data builder arranges data only: no assertion, deterministic defaults." },
        schema: [],
        messages: {
            assertion: "A builder arranges data and never asserts: `{{name}}` is a test-framework global. Return the object or row and let the spec assert.",
            random: "`{{name}}` makes a builder default non-deterministic. Take ids from constants or `fakeIds()` and use a fixed date, so a failing spec reproduces.",
        },
    },
    create(context) {
        if (hfsOf(context).slotOf(context.filename || context.getFilename()) !== BUILDERS) return {}
        const sourceCode = context.sourceCode || context.getSourceCode()
        /** True when the identifier is not declared in the file (a framework global, not a local named `test`). */
        const isGlobal = (node) => {
            for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
                const variable = scope.set.get(node.name)
                if (variable) return variable.defs.length === 0
            }
            return true
        }
        return {
            ImportDeclaration(node) {
                if (node.source.value === "@jest/globals") context.report({ node, messageId: "assertion", data: { name: "@jest/globals" } })
            },
            Identifier(node) {
                const parent = node.parent
                const used = (parent.type === "CallExpression" && parent.callee === node) || (parent.type === "MemberExpression" && parent.object === node)
                if (used && JEST_GLOBALS.has(node.name) && isGlobal(node)) context.report({ node, messageId: "assertion", data: { name: node.name } })
            },
            CallExpression(node) {
                const callee = node.callee
                if (callee.type === "Identifier" && RANDOM_FUNCTIONS.has(callee.name)) {
                    context.report({ node, messageId: "random", data: { name: `${callee.name}()` } })
                    return
                }
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier" || callee.object.type !== "Identifier") return
                const owner = callee.object.name
                const method = callee.property.name
                const clock = owner === "Date" && method === "now"
                const dice = owner === "Math" && method === "random"
                const crypto = RANDOM_FUNCTIONS.has(method) || (/^(?:crypto|webcrypto)$/.test(owner) && method.startsWith("random"))
                if (clock || dice || crypto) context.report({ node, messageId: "random", data: { name: `${owner}.${method}()` } })
            },
            NewExpression(node) {
                if (node.callee.type === "Identifier" && node.callee.name === "Date" && node.arguments.length === 0) context.report({ node, messageId: "random", data: { name: "new Date()" } })
            },
        }
    },
}

// -- tests-keep-constraints ------------------------------------------------------------------------

const CONSTRAINT_SQL = [
    /session_replication_role/i,
    /\bDISABLE\s+TRIGGER\b/i,
    /\bDEFERRABLE\b/i,
    /\bINITIALLY\s+DEFERRED\b/i,
    /\bSET\s+CONSTRAINTS\b[\s\S]*\bDEFERRED\b/i,
    /\bALTER\s+TABLE\b[\s\S]*\bDISABLE\b/i,
    /\bDROP\s+CONSTRAINT\b/i,
]
const CONSTRAINT_METHODS = new Set(["dropForeignKey", "dropForeignKeys", "dropCheckConstraint", "dropCheckConstraints", "dropUniqueConstraint", "dropUniqueConstraints"])

/** The test tree keeps every database constraint on. */
export const testsKeepConstraints = {
    meta: {
        type: "problem",
        docs: { description: "Nothing in the test tree disables or drops a database constraint." },
        schema: [],
        messages: {
            sql: "This test-tree SQL switches database constraints off (`{{what}}`). Tests run with constraints ON: create the parent chain through the builder instead of skipping the foreign key.",
            method: "`{{method}}` drops a database constraint in the test tree. Tests run with constraints ON: create the parent chain through the builder instead of dropping the foreign key.",
        },
    },
    create(context) {
        const slot = hfsOf(context).slotOf(context.filename || context.getFilename())
        if (typeof slot !== "string" || !slot.startsWith("be.tests.")) return {}
        const sourceCode = context.sourceCode || context.getSourceCode()
        const check = (node, text) => {
            const found = CONSTRAINT_SQL.find((pattern) => pattern.test(text ?? ""))
            if (found) context.report({ node, messageId: "sql", data: { what: text.match(found)[0] } })
        }
        return {
            CallExpression(node) {
                const method = methodOf(node)
                if (!method || !isDatabaseReceiver(context, node.callee.object)) return
                if (method === "query") check(node, queryText(node.arguments[0], sourceCode.getScope(node)))
                else if (CONSTRAINT_METHODS.has(method)) context.report({ node, messageId: "method", data: { method } })
            },
            TaggedTemplateExpression(node) {
                check(node, queryText(node, null))
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "persisting-builder-in-builders-slot": persistingBuilderInBuildersSlot,
    "spec-no-raw-insert": specNoRawInsert,
    "spec-no-repeated-row-literal": specNoRepeatedRowLiteral,
    "builder-arranges-only": builderArrangesOnly,
    "tests-keep-constraints": testsKeepConstraints,
}

/** Every rule of this law ships at `error`. */
export const recommended = {
    "starci-be/persisting-builder-in-builders-slot": "error",
    "starci-be/spec-no-raw-insert": "error",
    "starci-be/spec-no-repeated-row-literal": "error",
    "starci-be/builder-arranges-only": "error",
    "starci-be/tests-keep-constraints": "error",
}
