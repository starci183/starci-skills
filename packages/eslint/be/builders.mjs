/**
 * The rules that hold the test data builder standard (catalog R48 `BE_SPEC_QUALITY`, knowledge BE-TEST-16).
 *
 * Builders live in `src/tests/fixtures/builders/<area>.builder.ts` (slot `be.tests.fixtures.builders`; the file name and location are
 * a BE_SOURCE_FORM finding of the slot manifest, not a rule of this file). Two rules judge what is written around them:
 *
 *   - `spec-no-raw-insert`: a spec arranges rows through a builder, never through a raw INSERT/UPDATE/DELETE or a direct write
 *     (`save`, `insert`, `upsert`, `update`, `delete`, `remove`) on an EntityManager, DataSource or QueryRunner. The receiver is
 *     recognised by its TYPE (the way `e2e-asserts-persisted-state` recognises a state read), never by its name. Reads stay allowed.
 *   - `builder-arranges-only`: a builder never asserts (no `expect`, no jest global), has deterministic defaults (no `Date.now()`,
 *     argument-less `new Date()`, `Math.random()`, `randomUUID()`, `crypto.random*`) and never switches constraints off.
 *
 * Not policed: the size of an object literal in a unit spec. "Long hand-built row chains" is intent, not shape; the raw-write rule
 * plus review cover it.
 */
import { basename } from "node:path"
import { staticText } from "./lib/ast.mjs"
import { isPackageType } from "./lib/types.mjs"

/** The file name of a linted path, in forward-slash form. */
const baseOf = (filename) => basename(String(filename || "").replace(/\\/g, "/"))

// -- spec-no-raw-insert ----------------------------------------------------------------------------

const WRITE_METHODS = new Set(["save", "insert", "upsert", "update", "delete", "remove", "softDelete", "softRemove", "recover", "restore"])
const RECEIVER_TYPES = ["EntityManager", "DataSource", "QueryRunner"]
const WRITING_SQL = /(?:^|[\s;(])(?:insert\s+into|update\s+["`\w.]+\s+set|delete\s+from|truncate\b)/i

/** A unit service spec, an integration spec or an e2e spec. */
const isSpecName = (name) => /\.(?:spec|integration-spec|e2e-spec)\.[cm]?ts$/.test(name)

/** The statement text of a `query` argument: a literal, a template (substitutions read as a space), or the `const` it names (one hop). */
const queryText = (node, scope) => {
    if (!node) return null
    if (node.type === "TemplateLiteral") return node.quasis.map((quasi) => quasi.value.cooked ?? "").join(" ")
    const direct = staticText(node)
    if (direct !== null) return direct
    if (node.type !== "Identifier") return null
    for (let reference = scope; reference; reference = reference.upper) {
        const variable = reference.set.get(node.name)
        if (!variable) continue
        const definition = variable.defs[0]?.node
        return definition?.type === "VariableDeclarator" && definition.init ? queryText(definition.init, null) : null
    }
    return null
}

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
        const isReceiver = (node) => RECEIVER_TYPES.some((name) => isPackageType(context, node, name, "typeorm"))
        return {
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
                const method = callee.property.name
                if (!WRITE_METHODS.has(method) && method !== "query") return
                if (!isReceiver(callee.object)) return
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

// -- builder-arranges-only -------------------------------------------------------------------------

const JEST_GLOBALS = new Set(["expect", "jest", "describe", "it", "test", "beforeAll", "beforeEach", "afterAll", "afterEach", "fail"])
const RANDOM_FUNCTIONS = new Set(["randomUUID", "randomBytes", "randomInt", "randomFillSync", "randomFill", "getRandomValues"])
const CONSTRAINT_SQL = [
    /session_replication_role/i,
    /\bDISABLE\s+TRIGGER\b/i,
    /\bDEFERRABLE\b/i,
    /\bSET\s+CONSTRAINTS\b[\s\S]*\bDEFERRED\b/i,
    /\bALTER\s+TABLE\b[\s\S]*\bDISABLE\b/i,
    /\bDROP\s+CONSTRAINT\b/i,
]

/** A builder arranges data only: no assertion, deterministic defaults, constraints on. */
export const builderArrangesOnly = {
    meta: {
        type: "problem",
        docs: { description: "A test data builder arranges data only: no assertion, deterministic defaults, constraints on." },
        schema: [],
        messages: {
            assertion: "A builder arranges data and never asserts: `{{name}}` is a test-framework global. Return the object or row and let the spec assert.",
            random: "`{{name}}` makes a builder default non-deterministic. Take ids from constants or `fakeIds()` and use a fixed date, so a failing spec reproduces.",
            constraints: "This SQL switches database constraints off (`{{what}}`). A builder runs with constraints ON: create the parent chain instead of skipping the foreign key.",
        },
    },
    create(context) {
        if (!/\.builder\.[cm]?ts$/.test(baseOf(context.filename || context.getFilename()))) return {}
        const sourceCode = context.sourceCode || context.getSourceCode()
        /** True when the identifier is not declared in the file (a framework global, not a local named `test`). */
        const isGlobal = (node) => {
            for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
                const variable = scope.set.get(node.name)
                if (variable) return variable.defs.length === 0
            }
            return true
        }
        const reportSql = (node, text) => {
            const found = CONSTRAINT_SQL.find((pattern) => pattern.test(text))
            if (found) context.report({ node, messageId: "constraints", data: { what: text.match(found)?.[0] ?? String(found) } })
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
            Literal(node) {
                if (typeof node.value === "string") reportSql(node, node.value)
            },
            TemplateLiteral(node) {
                reportSql(node, node.quasis.map((quasi) => quasi.value.cooked ?? "").join(" "))
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "spec-no-raw-insert": specNoRawInsert,
    "builder-arranges-only": builderArrangesOnly,
}

/** Every rule of this law ships at `error`. */
export const recommended = {
    "starci-be/spec-no-raw-insert": "error",
    "starci-be/builder-arranges-only": "error",
}
