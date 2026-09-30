/**
 * The rules that keep a database call safe to run in production (R36, R68, R69, R77).
 *
 * SQL text is a `SqlText` constant built with the `sql` tag in a persistence `<name>.sql.ts`; a dynamic identifier is a
 * `SqlIdent` from `ident()`; a value is a numbered parameter. Every receiver is identified by its TypeScript type
 * (`EntityManager`, `QueryRunner`, `DataSource` from `typeorm`), never by its name, and every path question goes to the
 * HFS slot view. No rule here parses SQL text: what a statement reads and writes is judged by the architecture
 * machine (R86).
 *
 * - `sql-text-only` (R36 `BE_SQL_OUTSIDE_PERSISTENCE`) - the first argument of `.query(` is a `SqlText`, and the `sql`
 *   tag is called only in a persistence `<name>.sql.ts`.
 * - `no-query-builder` (R36) - no `createQueryBuilder(` call.
 * - `no-interpolated-sql` (R68 `BE_SQL_INTERPOLATED`) - a substitution inside the `sql` tag is a `SqlIdent`; a `.query(`
 *   string built by template or concatenation is refused.
 * - `query-needs-limit` (R69 `BE_QUERY_UNBOUNDED`) - `find`, `findBy` and `findAndCount` on an `EntityManager` carry `take`.
 * - `no-query-in-loop` (R77 `BE_QUERY_IN_LOOP`) - an `EntityManager` read does not run once per element of a loop.
 *
 * A migration is hand-written DDL run once by `apps/migrate`; its `queryRunner.query(...)` takes plain text.
 */
import { keyName } from "./lib/ast.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { baseNameOf, infraTypeOf, isMigrationFile } from "./lib/persistence.mjs"
import { isPackageType, typeOrigins } from "./lib/types.mjs"

/** The property a call goes through: `manager.query(...)` gives `query`. */
const calleeProperty = (node) =>
    node.callee.type === "MemberExpression" && !node.callee.computed && node.callee.property.type === "Identifier"
        ? node.callee.property.name
        : null

/** Whether a type origin is declared by the platform database capability (where `SqlText`, `SqlIdent` and `sql` live). */
const fromDatabaseCapability = (hfs, origin) => {
    const found = hfs.classify(origin.file)
    return found.slot === "be.platform" && found.bindings?.capability === "database"
}

/** Whether the value at `node` has the branded type `name` exported by the platform database capability. */
const hasBrand = (context, hfs, node, name) => typeOrigins(context, node).some((origin) => origin.name === name && fromDatabaseCapability(hfs, origin))

/** Whether a call goes through `.query` on a manager, runner or data source. */
const isQueryCall = (context, node) => calleeProperty(node) === "query" && infraTypeOf(context, node.callee.object) !== null

// -- R36 -----------------------------------------------------------------------------------------------

/** SQL text is `SqlText`, and only a persistence `.sql.ts` builds it. */
export const sqlTextOnly = {
    meta: {
        type: "problem",
        docs: { description: "`.query(...)` takes a `SqlText`, and the `sql` tag is called only in a persistence `<name>.sql.ts`." },
        schema: [],
        messages: {
            notSqlText:
                "The first argument of `.query(...)` is not a `SqlText`. SQL text is a constant built with the `sql` tag in the `persistence/<name>.sql.ts` of the owning capability and imported here; the row shape and its mapper live in `<name>.rows.ts`.",
            tagOutsideSqlFile:
                "The `sql` tag is called outside a persistence `<name>.sql.ts`. Write the statement as an exported constant in the `persistence/<name>.sql.ts` of the capability that owns the tables, and import it.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        const migration = isMigrationFile(hfs, filename)
        const sqlFile = hfs.slotOf(filename) === "be.persistence" && baseNameOf(filename).endsWith(".sql.ts")
        const isSqlTag = (node) => typeOrigins(context, node).some((origin) => origin.name === "sql" && fromDatabaseCapability(hfs, origin))
        return {
            CallExpression(node) {
                if (isSqlTag(node.callee) && !sqlFile) context.report({ node, messageId: "tagOutsideSqlFile" })
                if (migration || !isQueryCall(context, node)) return
                const first = node.arguments[0]
                if (!first || !hasBrand(context, hfs, first, "SqlText")) context.report({ node: first ?? node, messageId: "notSqlText" })
            },
            TaggedTemplateExpression(node) {
                if (isSqlTag(node.tag) && !sqlFile) context.report({ node, messageId: "tagOutsideSqlFile" })
            },
        }
    },
}

/** There is one way to write a complex read, and it is SQL. */
export const noQueryBuilder = {
    meta: {
        type: "problem",
        docs: { description: "No `createQueryBuilder(...)` call." },
        schema: [],
        messages: {
            builder:
                "`createQueryBuilder(...)` is banned. A read is `manager.find(Entity, { where, take })`, or a `SqlText` constant in the capability's `persistence/<name>.sql.ts` run with `manager.query(...)`.",
        },
    },
    create(context) {
        return {
            CallExpression(node) {
                const callee = node.callee
                const name = callee.type === "Identifier" ? callee.name : calleeProperty(node)
                if (name === "createQueryBuilder") context.report({ node, messageId: "builder" })
            },
        }
    },
}

// -- R68 -----------------------------------------------------------------------------------------------

/** A statement is text plus parameters; a value never becomes part of the text. */
export const noInterpolatedSql = {
    meta: {
        type: "problem",
        docs: { description: "Inside the `sql` tag every substitution is a `SqlIdent`; a `.query(...)` string is never built by template or concatenation." },
        schema: [],
        messages: {
            substitution:
                "This substitution (`{{expression}}`) is not a `SqlIdent`. A value spliced into a statement is an injection hole and defeats the plan cache. Pass a value as a numbered parameter (`$1`) in the array argument; a dynamic identifier goes through `ident(name, allowed)`, which checks it against a fixed list and is the only substitution the `sql` tag accepts.",
            built:
                "This SQL text is built with a template or a `+`. A value spliced into a statement is an injection hole. Write the statement as a `SqlText` constant with the `sql` tag in `persistence/<name>.sql.ts` and pass values as numbered parameters (`$1`) in the array argument.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const sourceCode = context.sourceCode || context.getSourceCode()
        const filename = context.filename || context.getFilename()
        const migration = isMigrationFile(hfs, filename)
        return {
            TaggedTemplateExpression(node) {
                if (!typeOrigins(context, node.tag).some((origin) => origin.name === "sql" && fromDatabaseCapability(hfs, origin))) return
                for (const expression of node.quasi.expressions) {
                    if (!hasBrand(context, hfs, expression, "SqlIdent")) {
                        context.report({ node: expression, messageId: "substitution", data: { expression: sourceCode.getText(expression).slice(0, 60) } })
                    }
                }
            },
            CallExpression(node) {
                if (migration || !isQueryCall(context, node)) return
                const first = node.arguments[0]
                if (first?.type === "TemplateLiteral" && first.expressions.length > 0) context.report({ node: first, messageId: "built" })
                else if (first?.type === "BinaryExpression" && first.operator === "+") context.report({ node: first, messageId: "built" })
            },
        }
    },
}

// -- R69 -----------------------------------------------------------------------------------------------

const BOUNDED_READS = new Set(["find", "findBy", "findAndCount", "findAndCountBy"])

/** A list read states its bound. */
export const queryNeedsLimit = {
    meta: {
        type: "problem",
        docs: { description: "`find`, `findBy` and `findAndCount` on an `EntityManager` state `take`." },
        schema: [],
        messages: {
            find:
                "`.{{method}}(...)` reads every matching row and states no `take` in its options object. Pass `take` with a named bound (`manager.find(Entity, { where, take: LIST_ROWS_MAX })`), or page by keyset.",
            findBy:
                "`.{{method}}(...)` cannot take a bound, so it reads every matching row. Use `manager.find(Entity, { where, take })` with a named bound, or page by keyset.",
        },
    },
    create(context) {
        return {
            CallExpression(node) {
                const method = calleeProperty(node)
                if (!method || !BOUNDED_READS.has(method) || !isPackageType(context, node.callee.object, "EntityManager", "typeorm")) return
                if (method === "findBy" || method === "findAndCountBy") {
                    context.report({ node: node.callee.property, messageId: "findBy", data: { method } })
                    return
                }
                const options = node.arguments[node.arguments.length - 1]
                const hasTake =
                    options?.type === "ObjectExpression"
                    && options.properties.some((property) => property.type === "Property" && keyName(property.key) === "take")
                if (!hasTake) context.report({ node: node.callee.property, messageId: "find", data: { method } })
            },
        }
    },
}

// -- R77 -----------------------------------------------------------------------------------------------

const LOOP_READS = new Set(["find", "findBy", "findOne", "findOneBy", "findOneOrFail", "findOneByOrFail", "findAndCount", "findAndCountBy", "count", "countBy", "exists", "existsBy"])
const ITERATION_METHODS = new Set(["map", "forEach", "flatMap", "filter", "reduce", "some", "every"])
const LOOP_STATEMENTS = new Set(["ForStatement", "ForOfStatement", "ForInStatement"])

/** Whether `node` runs once per element: inside a `for` loop, or inside a callback of an array iteration method. */
const insideIteration = (node) => {
    let current = node.parent
    while (current) {
        if (LOOP_STATEMENTS.has(current.type)) return true
        if (current.type === "FunctionDeclaration" || current.type === "FunctionExpression" || current.type === "ArrowFunctionExpression") {
            const call = current.parent
            return (
                call?.type === "CallExpression"
                && call.callee.type === "MemberExpression"
                && !call.callee.computed
                && call.callee.property.type === "Identifier"
                && ITERATION_METHODS.has(call.callee.property.name)
                && call.arguments.includes(current)
            )
        }
        current = current.parent
    }
    return false
}

/** A read inside an iteration is N+1: one round trip per element. */
export const noQueryInLoop = {
    meta: {
        type: "problem",
        docs: { description: "An `EntityManager` read does not run once per element of a loop." },
        schema: [],
        messages: {
            inLoop:
                "`.{{method}}(...)` runs once per element, so the number of round trips grows with the input (N+1) and one large request holds a connection for as long as it takes. Read the rows once before the loop with `find(Entity, { where: { <key>: In(keys) }, take })` or a `SqlText` with `WHERE <key> = ANY($1)`, index them in a `Map`, and look up inside the loop. A polling `while` loop is not this rule's business.",
        },
    },
    create(context) {
        return {
            CallExpression(node) {
                const method = calleeProperty(node)
                if (!method || !LOOP_READS.has(method) || !insideIteration(node)) return
                if (infraTypeOf(context, node.callee.object) === "EntityManager") context.report({ node: node.callee.property, messageId: "inLoop", data: { method } })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "sql-text-only": sqlTextOnly,
    "no-query-builder": noQueryBuilder,
    "no-interpolated-sql": noInterpolatedSql,
    "query-needs-limit": queryNeedsLimit,
    "no-query-in-loop": noQueryInLoop,
}

/** Every rule of this law ships at `error`; no baseline exists. */
export const recommended = {
    "starci-be/sql-text-only": "error",
    "starci-be/no-query-builder": "error",
    "starci-be/no-interpolated-sql": "error",
    "starci-be/query-needs-limit": "error",
    "starci-be/no-query-in-loop": "error",
}
