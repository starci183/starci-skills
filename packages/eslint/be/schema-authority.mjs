/**
 * The rules that hold HFS schema authority and the persistence boundary (catalog R34, R37, R74).
 *
 * The schema changes by migration and by nothing else, and the SQL that touches it lives in one place:
 *
 *   - `no-runtime-schema` (R34 `BE_SCHEMA_AUTHORITY`) refuses everything that lets the running process decide the
 *     schema: a DataSource / TypeORM options object (an object literal whose contextual TYPE is a `typeorm` or
 *     `@nestjs/typeorm` options type) with no literal `synchronize: false`; a `synchronize` that is anything but
 *     the literal `false`; `new DataSource(<not an object literal>)` whose options cannot be read; a
 *     `dataSource.synchronize()` or `.dropDatabase()` call; the `migrationsRun` option in any form and a `runMigrations()` /
 *     `undoLastMigration()` call outside the cli (apps/cli and src/features/cli) and the test world; `dropSchema` set to anything but `false`; a schema
 *     builder (`createSchemaBuilder()`, `.build()` of typeorm's `SchemaBuilder`); a `synchronize` key in the options of typeorm's
 *     `@Entity` (a per-entity switch is a second authority); a lifecycle hook (`onModuleInit`, `onApplicationBootstrap`) that
 *     writes rows through an `EntityManager` or `DataSource` (seeding is a cli command); a DDL statement in any string
 *     outside the migrations of `persistence/`; and an entity or migration glob. Only the cli (its migrate and seed commands) runs migrations and seeds.
 *   - `no-entity-in-contract` (R37 `BE_ENTITY_IN_CONTRACT`) keeps ORM entities out of the types that cross a boundary:
 *     any type whose declaration carries `@Entity` (from `typeorm`), reached through the type arguments and properties of
 *     a transport signature, the `execute` of a handler, or a `*.contracts.ts`, `*.command.ts` or `*.query.ts` file; and
 *     entity files that import `@nestjs/graphql` or `class-validator` (an entity never reaches a contract).
 *
 * Where a file lives is asked of the slot view (`be.persistence` and its `migrations/` folder, the transport slots),
 * never of a path pattern.
 */
import ts from "typescript"
import { isTransportSlot } from "./lib/transport-slots.mjs"
import { keyName, walk } from "./lib/ast.mjs"
import { hfsOf, inTestWorld } from "./lib/hfs.mjs"
import { baseName, isMigrationFile, packageOfFile } from "./lib/ports.mjs"
import { inCli } from "./lib/persistence.mjs"
import { isPackageType, typed } from "./lib/types.mjs"
import { isDeclarationFile } from "./lib/path.mjs"

/** Schema-changing statements: `CREATE|ALTER|DROP` of a structure, `TRUNCATE TABLE`, `ADD|DROP COLUMN`. */
const DDL = /\b(?:(?:CREATE|ALTER|DROP)\s+(?:OR\s+REPLACE\s+)?(?:UNIQUE\s+)?(?:TEMP(?:ORARY)?\s+)?(?:TABLE|INDEX|TYPE|SCHEMA|VIEW|MATERIALIZED\s+VIEW|SEQUENCE|EXTENSION|DATABASE|TRIGGER|FUNCTION|PROCEDURE|DOMAIN|POLICY|PUBLICATION|COLLATION|ROLE)|TRUNCATE\s+TABLE|(?:ADD|DROP)\s+(?:COLUMN|CONSTRAINT))\b/i

/** The packages whose option types describe a DataSource. */
const OPTION_PACKAGES = new Set(["typeorm", "@nestjs/typeorm"])

/** The DataSource operations that change the schema at runtime. */
const SCHEMA_OPERATIONS = new Set(["synchronize", "dropDatabase"])

/** The DataSource operations that run migrations: allowed only in the cli (apps/cli, src/features/cli) and the test world. */
const MIGRATION_RUNNERS = new Set(["runMigrations", "undoLastMigration"])

/** The typeorm types whose methods write rows. */
const WRITER_TYPES = ["EntityManager", "DataSource", "QueryRunner"]

/** The typeorm schema builder types. */
const SCHEMA_BUILDER_TYPES = ["SchemaBuilder", "RdbmsSchemaBuilder"]

/** The writes of an `EntityManager` that need no SQL text to be recognised. */
const WRITE_METHODS = new Set(["insert", "save", "upsert", "update", "delete", "remove", "softRemove", "softDelete", "recover", "increment", "decrement", "clear"])

/** A statement that writes rows. */
const WRITE_SQL = /\b(?:INSERT\s+INTO|UPDATE\s+\S+\s+SET|DELETE\s+FROM|MERGE\s+INTO)\b/i

/** The Nest lifecycle hooks that run at boot in every process that composes the provider. */
const BOOT_HOOKS = new Set(["onModuleInit", "onApplicationBootstrap"])

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

/** The non-union, non-intersection constituents of a TypeScript type. */
const leavesOf = (type) => (type.isUnionOrIntersection() ? type.types.flatMap(leavesOf) : [type])

/** The `synchronize` members that typeorm declares on the contextual type of an object literal, as TypeScript declarations. */
const synchronizeMembers = (context, node) => {
    const { checker, toTs } = typed(context)
    const tsNode = toTs(node)
    const expected = tsNode ? checker.getContextualType(tsNode) : undefined
    if (!expected) return []
    return leavesOf(expected)
        .flatMap((part) => checker.getPropertyOfType(part, "synchronize")?.declarations ?? [])
        .filter((declaration) => OPTION_PACKAGES.has(packageOfFile(declaration.getSourceFile().fileName)))
}

/** A `synchronize` declared as a method is the DataSource operation, not the options flag. */
const isMethod = (declaration) => ts.isMethodSignature(declaration) || ts.isMethodDeclaration(declaration)

/** A `synchronize` declared on typeorm's `EntityOptions` is the per-entity switch, not the connection's. */
const isEntityOption = (declaration) => ts.isInterfaceDeclaration(declaration.parent) && declaration.parent.name.text === "EntityOptions"

/** Whether an object literal is contextually a DataSource options object: its expected type has a `synchronize` option (a property, not the `synchronize()` method, not an entity's) declared by `typeorm`. */
const isOptionsObject = (context, node) => synchronizeMembers(context, node).some((declaration) => !isMethod(declaration) && !isEntityOption(declaration))

/** Whether an object literal is the options of typeorm's `@Entity(...)`. */
const isEntityOptions = (context, node) => synchronizeMembers(context, node).some(isEntityOption)

/** Whether an object literal is contextually a DataSource (or a partial of one) whose `synchronize` is the method: its keys are overrides of operations, not configuration. */
const isOperationsObject = (context, node) => {
    const members = synchronizeMembers(context, node)
    return members.length > 0 && members.every(isMethod)
}

/** Whether a file is the cli (the cli app or the cli feature root, whose migrate and seed commands run them) or the test world: the only places that run migrations and seed. */
const isMigrationHost = (hfs, filename) => inCli(hfs, filename) || inTestWorld(hfs, filename)

/** The SQL text of a call argument: a literal, a template, or the quasis of a tagged template. */
const sqlTextOf = (argument) => (argument ? stringsUnder(argument).join(" ") : "")

/**
 * The first call under a lifecycle hook that writes rows: an `EntityManager`/`DataSource`/`QueryRunner` write method, a `.query(...)` whose
 * text writes, or a call of another method of the same class (`this.seed()`) that does.
 */
const bootWriteOf = (context, method, klass, visited) => {
    let found = null
    walk(method.value.body, (node) => {
        if (found || node.type !== "CallExpression") return
        const callee = node.callee
        if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
        const name = callee.property.name
        if (callee.object.type === "ThisExpression") {
            const target = klass.body.body.find((member) => member.type === "MethodDefinition" && member.kind === "method" && !member.computed && keyName(member.key) === name)
            if (target && !visited.has(target)) {
                visited.add(target)
                found = bootWriteOf(context, target, klass, visited)
            }
            return
        }
        if (!WRITER_TYPES.some((type) => isPackageType(context, callee.object, type, "typeorm"))) return
        if (WRITE_METHODS.has(name) || (name === "query" && WRITE_SQL.test(sqlTextOf(node.arguments[0])))) found = node
    })
    return found
}

/** Whether an object literal has a property called `name`. */
const hasKey = (objectNode, name) => objectNode.properties.some((property) => property.type === "Property" && !property.computed && keyName(property.key) === name)

/** The schema is decided by migrations run by the cli migrate command, never by the running process. */
export const noRuntimeSchema = {
    meta: {
        type: "problem",
        docs: { description: "Every DataSource options object states `synchronize: false`; no `migrationsRun`, no runtime DDL, no entity or migration glob." },
        schema: [],
        messages: {
            synchronize: "`synchronize` is set to something other than the literal `false`. The schema changes by migration only; a boot-time ORM diff decides it otherwise.",
            synchronizeMissing: "This DataSource options object does not state `synchronize: false`. Write the literal `false` in every options object, so what the connection may do to the schema is readable where it is built.",
            optionsNotLiteral: "`new DataSource(...)` is given options that are not an object literal, so `synchronize: false` cannot be seen. Pass the options as an object literal that states `synchronize: false`.",
            synchronizeCall: "`.{{name}}()` changes the schema at runtime. Write a migration and let the cli migrate command run it.",
            migrationsRun: "`migrationsRun` is banned. Only the cli migrate command (`cli migrate run`) runs migrations, once per connection, before api and worker start.",
            runMigrations: "`.{{name}}()` runs migrations outside the cli. Only the cli migrate command (and the test world, over the same connections) runs them, once per connection, before api and worker start.",
            dropSchema: "`dropSchema` is set to something other than the literal `false`. A connection never drops the schema it opens; a migration changes it.",
            schemaBuilder: "`{{name}}` builds or logs the schema from the entity metadata at runtime. The schema changes by migration only.",
            entitySynchronize: "`synchronize` is set in the options of `@Entity`. A per-entity switch is a second schema authority next to the connection's literal `false`; delete the key.",
            bootSeed: "`{{hook}}` writes rows (`{{call}}`), so every process that composes this provider seeds at boot. Seeding is a cli command, run once per connection.",
            ddl: "A schema-changing statement (`CREATE|ALTER|DROP ...`) outside `persistence/migrations/`. Schema-changing SQL belongs in a migration.",
            glob: "`{{key}}` is found by glob. List the entities and migrations explicitly from each capability's `index.ts` so what runs is what was reviewed.",
        },
    },
    create(context) {
        const filename = context.filename || context.getFilename()
        if (isDeclarationFile(filename)) return {}
        const hfs = hfsOf(context)
        const migration = isMigrationFile(hfs, filename)
        const migrationHost = isMigrationHost(hfs, filename)
        return {
            ObjectExpression(node) {
                if (isOptionsObject(context, node) && !hasKey(node, "synchronize")) context.report({ node, messageId: "synchronizeMissing" })
            },
            MethodDefinition(node) {
                if (node.kind !== "method" || node.computed || !BOOT_HOOKS.has(keyName(node.key) ?? "") || migrationHost) return
                const klass = node.parent?.parent
                if (klass?.type !== "ClassDeclaration" && klass?.type !== "ClassExpression") return
                const write = bootWriteOf(context, node, klass, new Set([node]))
                if (write) context.report({ node: write, messageId: "bootSeed", data: { hook: keyName(node.key), call: context.sourceCode.getText(write.callee) } })
            },
            Property(node) {
                if (node.computed) return
                const key = keyName(node.key)
                if (key === "synchronize" && node.parent?.type === "ObjectExpression" && isEntityOptions(context, node.parent)) {
                    context.report({ node, messageId: "entitySynchronize" })
                } else if (key === "dropSchema" && !isFalse(node.value)) {
                    context.report({ node, messageId: "dropSchema" })
                } else if (key === "synchronize" && !isFalse(node.value)) {
                    if (node.parent?.type === "ObjectExpression" && isOperationsObject(context, node.parent)) return
                    context.report({ node, messageId: "synchronize" })
                } else if (key === "migrationsRun") {
                    context.report({ node, messageId: "migrationsRun" })
                } else if ((key === "entities" || key === "migrations") && stringsUnder(node.value).some((text) => text.includes("*"))) {
                    context.report({ node, messageId: "glob", data: { key } })
                }
            },
            NewExpression(node) {
                if (!isPackageType(context, node, "DataSource", "typeorm")) return
                const options = node.arguments[0]
                if (options && options.type !== "ObjectExpression") context.report({ node: options, messageId: "optionsNotLiteral" })
            },
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
                const name = callee.property.name
                if (SCHEMA_OPERATIONS.has(name)) {
                    if (isPackageType(context, callee.object, "DataSource", "typeorm")) context.report({ node, messageId: "synchronizeCall", data: { name } })
                } else if (MIGRATION_RUNNERS.has(name)) {
                    if (!migrationHost && isPackageType(context, callee.object, "DataSource", "typeorm")) context.report({ node, messageId: "runMigrations", data: { name } })
                } else if (name === "createSchemaBuilder") {
                    if (isPackageType(context, callee.object, "DataSource", "typeorm")) context.report({ node, messageId: "schemaBuilder", data: { name: "createSchemaBuilder()" } })
                } else if (name === "build" || name === "log") {
                    if (SCHEMA_BUILDER_TYPES.some((type) => isPackageType(context, callee.object, type, "typeorm"))) context.report({ node, messageId: "schemaBuilder", data: { name: `${name}()` } })
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

// -- R37 -------------------------------------------------------------------------------------------

/** Whether a decorator is `typeorm`'s `Entity`, read through the checker so an aliased import counts. */
const isEntityDecorator = (checker, decorator) => {
    const callee = ts.isCallExpression(decorator.expression) ? decorator.expression.expression : decorator.expression
    let symbol = checker.getSymbolAtLocation(callee)
    if (symbol && (symbol.flags & ts.SymbolFlags.Alias) !== 0) symbol = checker.getAliasedSymbol(symbol)
    return symbol?.name === "Entity" && (symbol.declarations ?? []).some((declaration) => packageOfFile(declaration.getSourceFile().fileName) === "typeorm")
}

/** Whether a TypeScript declaration is a class carrying `@Entity`. */
const carriesEntity = (checker, declaration) => ts.canHaveDecorators(declaration) && (ts.getDecorators(declaration) ?? []).some((decorator) => isEntityDecorator(checker, decorator))

/**
 * The name of an ORM entity a type reaches, or null: the type itself, a union or intersection member, a type argument
 * (`Array<OrderEntity>`, `Promise<...>`), or a property of a type the repository declares. Types declared by a package
 * or the language are not walked into, only through their type arguments.
 */
const entityReached = (checker, type, seen, depth) => {
    if (!type || depth > 6 || seen.has(type)) return null
    seen.add(type)
    if (type.isUnionOrIntersection()) {
        for (const part of type.types) {
            const found = entityReached(checker, part, seen, depth + 1)
            if (found) return found
        }
        return null
    }
    const declarations = type.getSymbol()?.getDeclarations() ?? []
    const entity = declarations.find((declaration) => carriesEntity(checker, declaration))
    if (entity) return entity.name?.text ?? "an entity"
    for (const argument of checker.getTypeArguments(type)) {
        const found = entityReached(checker, argument, seen, depth + 1)
        if (found) return found
    }
    const own = declarations.length > 0 && declarations.every((declaration) => !declaration.getSourceFile().isDeclarationFile)
    if (!own) return null
    for (const property of checker.getPropertiesOfType(type)) {
        const declaration = property.valueDeclaration ?? property.declarations?.[0]
        if (!declaration) continue
        const found = entityReached(checker, checker.getTypeOfSymbolAtLocation(property, declaration), seen, depth + 1)
        if (found) return found
    }
    return null
}

const FUNCTION_TYPES = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression", "TSDeclareFunction", "TSEmptyBodyFunctionExpression", "TSMethodSignature"])
const PARAMETER_HOLDERS = new Set(["Identifier", "ObjectPattern", "ArrayPattern", "AssignmentPattern", "RestElement"])

/** Which files carry boundary types, and how much of each: the whole file, or only the `execute` of a handler. */
const boundaryOf = (hfs, filename) => {
    const slot = hfs.slotOf(filename) ?? ""
    const name = baseName(filename)
    if (isTransportSlot(slot)) return "file"
    if (/\.(?:contracts|command|query)\.ts$/.test(name)) return "file"
    if (name.endsWith(".handler.ts")) return "execute"
    return null
}

/** The MethodDefinition a node sits in the signature of, or null. */
const methodOf = (node) => {
    let current = node
    while (current && !FUNCTION_TYPES.has(current.type)) current = current.parent
    return current?.parent?.type === "MethodDefinition" ? current.parent : null
}

/** An ORM entity type never appears in a contract, DTO, command or query, transport signature or handler `execute`. */
export const noEntityInContract = {
    meta: {
        type: "problem",
        docs: { description: "No type declared with `@Entity` is reachable from a transport signature, a handler `execute`, a `*.contracts.ts` or a message." },
        schema: [],
        messages: {
            entity: "`{{name}}` is an ORM entity and is reachable from a boundary type. Return a projection (a plain contract type) and pass a principal id and role instead of an entity.",
            entityImport: "An entity file imports `{{source}}`. An entity is a schema declaration only: GraphQL types and validators belong to the transport's own DTOs, never to the entity.",
        },
    },
    create(context) {
        const filename = context.filename || context.getFilename()
        if (isDeclarationFile(filename)) return {}
        const hfs = hfsOf(context)
        const listeners = {}
        if (baseName(filename).endsWith(".entity.ts")) {
            listeners.ImportDeclaration = (node) => {
                const source = String(node.source.value)
                if (["@nestjs/graphql", "class-validator"].some((banned) => source === banned || source.startsWith(`${banned}/`))) {
                    context.report({ node, messageId: "entityImport", data: { source } })
                }
            }
        }
        const boundary = boundaryOf(hfs, filename)
        if (!boundary) return listeners
        const { checker, toTs } = typed(context)
        const reported = new Set()
        const judge = (typeNode) => {
            if (reported.has(typeNode)) return
            const tsNode = toTs(typeNode)
            if (!tsNode) return
            const name = entityReached(checker, checker.getTypeFromTypeNode(tsNode), new Set(), 0)
            if (name) {
                reported.add(typeNode)
                context.report({ node: typeNode, messageId: "entity", data: { name } })
            }
        }
        /** Whether a signature is one this file is judged on. */
        const inScope = (node) => boundary === "file" || methodOf(node)?.key?.name === "execute"
        listeners.TSTypeAnnotation = (node) => {
            const holder = node.parent
            const isParameter = PARAMETER_HOLDERS.has(holder.type) && (FUNCTION_TYPES.has(holder.parent?.type) || holder.parent?.type === "TSParameterProperty")
            const isReturn = FUNCTION_TYPES.has(holder.type) && holder.returnType === node
            const isMember = holder.type === "PropertyDefinition" || holder.type === "TSPropertySignature"
            if ((isParameter || isReturn || (isMember && boundary === "file")) && inScope(holder)) judge(node.typeAnnotation)
        }
        listeners.TSTypeAliasDeclaration = (node) => {
            if (boundary === "file") judge(node.typeAnnotation)
        }
        // `extends Command<OrderEntity>` and `implements ICQRSHandler<...>`: the heritage names what the class carries across
        listeners.TSTypeParameterInstantiation = (node) => {
            const parent = node.parent
            const heritage = parent.type === "TSClassImplements" || parent.type === "TSInterfaceHeritage" || parent.type === "ClassDeclaration" || parent.type === "ClassExpression"
            if (heritage) for (const param of node.params) judge(param)
        }
        return listeners
    },
}

// -- R74 -------------------------------------------------------------------------------------------

const methodNamed = (klass, name) =>
    klass.body.body.find((member) => member.type === "MethodDefinition" && !member.computed && keyName(member.key) === name)

/** Whether a `down` body does nothing but refuse. */
const onlyThrows = (body) => body.body.length > 0 && body.body.every((statement) => statement.type === "ThrowStatement")

/** A migration can be undone. */
export const migrationDownReversible = {
    meta: {
        type: "problem",
        docs: { description: "A migration declares a `down()` that reverses its `up()`." },
        schema: [],
        messages: {
            missing: "This migration has an `up()` and no `down()`. A release that must roll back has no way to. Write `down()` as the exact inverse of `up()`.",
            empty: "`down()` is empty, so a rollback leaves the schema changed while the migration table says it was undone. Write the inverse of `up()`.",
            throws: "`down()` only throws. A rollback then fails halfway through a deploy. Write the inverse of `up()`; when `up()` drops data, `down()` recreates the structure and the data loss is stated in the migration's comment.",
        },
    },
    create(context) {
        const filename = context.filename || context.getFilename()
        if (isDeclarationFile(filename) || !isMigrationFile(hfsOf(context), filename)) return {}
        const check = (node) => {
            if (!node.body) return
            const up = methodNamed(node, "up")
            if (!up) return
            const down = methodNamed(node, "down")
            if (!down) context.report({ node: node.id ?? node, messageId: "missing" })
            else if (down.value.body.body.length === 0) context.report({ node: down.key, messageId: "empty" })
            else if (onlyThrows(down.value.body)) context.report({ node: down.key, messageId: "throws" })
        }
        return { ClassDeclaration: check }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "no-runtime-schema": noRuntimeSchema,
    "no-entity-in-contract": noEntityInContract,
    "migration-down-reversible": migrationDownReversible,
}

/** All three start at error: HFS keeps no baseline and the schema migration lanes clear the debt first. */
export const recommended = {
    "starci-be/no-runtime-schema": "error",
    "starci-be/no-entity-in-contract": "error",
    "starci-be/migration-down-reversible": "error",
}
