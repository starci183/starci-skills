/**
 * The rules that hold HFS v2 schema authority and the persistence boundary (catalog R34, R36, R37).
 *
 * The schema changes by migration and by nothing else, and the SQL that touches it lives in one place:
 *
 *   - `no-runtime-schema` (R34 `BE_SCHEMA_AUTHORITY`) refuses everything that lets the running process decide
 *     the schema: a `synchronize` that is not the literal `false`, a `dataSource.synchronize()` call, a
 *     `migrationsRun` that is not the literal `false`, a `CREATE|ALTER|DROP TABLE` string outside
 *     `persistence/migrations/`, and an entity or migration glob. Only `apps/migrate` runs migrations.
 *   - `sql-only-in-repository` (R36 `BE_SQL_OUTSIDE_REPOSITORY`) keeps raw SQL and query builders inside a
 *     `*.repository.ts` of a `persistence/` folder, so a use case or a service never contains SQL.
 *   - `no-entity-in-contract` (R37 `BE_ENTITY_IN_CONTRACT`) keeps ORM entities out of the types that cross a
 *     boundary: `*.contracts.ts`, DTOs, resolver and controller signatures. A contract returns a projection.
 */
import { keyName, staticText, walk } from "./lib/ast.mjs"
import { isDeclarationFile, isMigrationFile, normalizePath } from "./lib/path.mjs"

const DDL = /\b(?:CREATE|ALTER|DROP)\s+TABLE\b/i

const isFalse = (node) => node?.type === "Literal" && node.value === false

/** The text of every string literal and template chunk under `node`. */
const stringsUnder = (node) => {
    const found = []
    walk(node, (child) => {
        if (child.type === "Literal" && typeof child.value === "string") found.push(child.value)
        else if (child.type === "TemplateElement") found.push(child.value.cooked ?? "")
    })
    return found
}

/** The schema is decided by migrations run by `apps/migrate`, never by the running process. */
export const noRuntimeSchema = {
    meta: {
        type: "problem",
        docs: { description: "No synchronize, no migrationsRun in a service, no runtime DDL, no entity or migration glob." },
        schema: [],
        messages: {
            synchronize: "`synchronize` is set to something other than the literal `false`. The schema changes by migration only; a boot-time ORM diff decides it otherwise.",
            synchronizeCall: "`.synchronize()` builds the schema at runtime. Write a migration and let `apps/migrate` run it.",
            migrationsRun: "`migrationsRun` is not the literal `false`. Only `apps/migrate` runs migrations, once per connection, before api and worker start.",
            ddl: "A `CREATE|ALTER|DROP TABLE` string outside `persistence/migrations/`. Schema-changing SQL belongs in a migration.",
            glob: "`{{key}}` is found by glob. List the entities and migrations explicitly from each capability's `index.ts` so what runs is what was reviewed.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename)) return {}
        const migration = isMigrationFile(filename)
        return {
            Property(node) {
                const key = keyName(node.key)
                if (key === "synchronize" && !isFalse(node.value)) {
                    context.report({ node, messageId: "synchronize" })
                } else if (key === "migrationsRun" && !isFalse(node.value)) {
                    context.report({ node, messageId: "migrationsRun" })
                } else if ((key === "entities" || key === "migrations") && stringsUnder(node.value).some((text) => text.includes("*"))) {
                    context.report({ node, messageId: "glob", data: { key } })
                }
            },
            CallExpression(node) {
                if (node.callee.type !== "MemberExpression" || node.callee.computed) return
                if (node.callee.property.type === "Identifier" && node.callee.property.name === "synchronize") {
                    context.report({ node, messageId: "synchronizeCall" })
                }
            },
            Literal(node) {
                if (!migration && typeof node.value === "string" && DDL.test(node.value)) context.report({ node, messageId: "ddl" })
            },
            TemplateElement(node) {
                if (!migration && DDL.test(node.value.cooked ?? "")) context.report({ node, messageId: "ddl" })
            },
        }
    },
}

const REPOSITORY_FILE = /\/persistence\/(?:[^/]+\/)*[^/]+\.repository\.[cm]?ts$/

/** Raw SQL and query builders live in a `*.repository.ts` under `persistence/`, nowhere else. */
export const sqlOnlyInRepository = {
    meta: {
        type: "problem",
        docs: { description: "`.query(<sql>)` and `createQueryBuilder` only inside a persistence `*.repository.ts`." },
        schema: [],
        messages: {
            sql: "Raw SQL or a query builder outside a persistence repository. Move it into the `*.repository.ts` of the owning capability's `persistence/` and call that from the use case.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename) || isMigrationFile(filename) || REPOSITORY_FILE.test(filename)) return {}
        return {
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
                const name = callee.property.name
                if (name === "createQueryBuilder") {
                    context.report({ node, messageId: "sql" })
                } else if (name === "query" && staticText(node.arguments[0]) !== null) {
                    context.report({ node, messageId: "sql" })
                } else if (name === "query" && node.arguments[0]?.type === "TemplateLiteral") {
                    context.report({ node, messageId: "sql" })
                }
            },
        }
    },
}

/** Files whose types cross a boundary: contracts, DTOs, resolvers, controllers. */
const BOUNDARY_FILE = /\.contracts\.[cm]?ts$|\/dto\/|\.(?:request|response|input|type|args)\.[cm]?ts$|\.(?:resolver|controller)\.[cm]?ts$/

/** An ORM entity type never appears in a contract, DTO, resolver or controller signature. */
export const noEntityInContract = {
    meta: {
        type: "problem",
        docs: { description: "No `*Entity` type in a contract, DTO, resolver or controller signature." },
        schema: [],
        messages: {
            entity: "`{{name}}` is an ORM entity and leaks into a boundary type. Return a projection (a plain contract type) and pass a principal id and role instead of an entity.",
        },
    },
    create(context) {
        const filename = normalizePath(context.filename || context.getFilename())
        if (isDeclarationFile(filename) || !BOUNDARY_FILE.test(filename) || filename.includes("/persistence/")) return {}
        return {
            TSTypeReference(node) {
                if (node.typeName.type === "Identifier" && /Entity$/.test(node.typeName.name)) {
                    context.report({ node, messageId: "entity", data: { name: node.typeName.name } })
                }
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "no-runtime-schema": noRuntimeSchema,
    "sql-only-in-repository": sqlOnlyInRepository,
    "no-entity-in-contract": noEntityInContract,
}

/** All three start at error: HFS v2 keeps no baseline and the schema migration lanes clear the debt first. */
export const recommended = {
    "starci-be/no-runtime-schema": "error",
    "starci-be/sql-only-in-repository": "error",
    "starci-be/no-entity-in-contract": "error",
}
