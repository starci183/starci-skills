/**
 * The rules that hold HFS schema authority and the persistence boundary (catalog R34, R37, R74).
 *
 * The schema changes by migration and by nothing else, and the SQL that touches it lives in one place:
 *
 *   - `no-runtime-schema` (R34 `BE_SCHEMA_AUTHORITY`) refuses everything that lets the running process decide the
 *     schema: a DataSource / TypeORM options object (an object literal whose contextual TYPE is a `typeorm` or
 *     `@nestjs/typeorm` options type) with no literal `synchronize: false`; a `synchronize` that is anything but
 *     the literal `false`; `new DataSource(<not an object literal>)` whose options cannot be read; a
 *     `dataSource.synchronize()` call; the `migrationsRun` option in any form; a DDL statement in any string outside the
 *     migrations of `persistence/`; and an entity or migration glob. Only `apps/migrate` runs migrations.
 *   - `no-entity-in-contract` (R37 `BE_ENTITY_IN_CONTRACT`) keeps ORM entities out of the types that cross a boundary:
 *     any type whose declaration carries `@Entity` (from `typeorm`), reached through the type arguments and properties of
 *     a transport signature, the `execute` of a handler, or a `*.contracts.ts`, `*.command.ts` or `*.query.ts` file; and
 *     entity files that import `@nestjs/graphql` or `class-validator` (an entity never reaches a contract).
 *
 * Where a file lives is asked of the slot view (`be.persistence` and its `migrations/` folder, the transport slots),
 * never of a path pattern.
 */
import ts from "typescript"
import { keyName, walk } from "./lib/ast.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { baseName, isMigrationFile, packageOfFile } from "./lib/ports.mjs"
import { isPackageType, typed } from "./lib/types.mjs"
import { isDeclarationFile } from "./lib/path.mjs"

/** Schema-changing statements: `CREATE|ALTER|DROP` of a structure, `TRUNCATE TABLE`, `ADD|DROP COLUMN`. */
const DDL = /\b(?:(?:CREATE|ALTER|DROP)\s+(?:OR\s+REPLACE\s+)?(?:UNIQUE\s+)?(?:TEMP(?:ORARY)?\s+)?(?:TABLE|INDEX|TYPE|SCHEMA|VIEW|MATERIALIZED\s+VIEW|SEQUENCE|EXTENSION|DATABASE|TRIGGER|FUNCTION|DOMAIN)|TRUNCATE\s+TABLE|(?:ADD|DROP)\s+COLUMN)\b/i

/** The packages whose option types describe a DataSource. */
const OPTION_PACKAGES = new Set(["typeorm", "@nestjs/typeorm"])

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

/** Whether an object literal is contextually a DataSource options object: its expected type has a `synchronize` member declared by `typeorm`. */
const isOptionsObject = (context, node) => {
    const { checker, toTs } = typed(context)
    const tsNode = toTs(node)
    const expected = tsNode ? checker.getContextualType(tsNode) : undefined
    if (!expected) return false
    return leavesOf(expected).some((part) => (checker.getPropertyOfType(part, "synchronize")?.declarations ?? [])
        .some((declaration) => OPTION_PACKAGES.has(packageOfFile(declaration.getSourceFile().fileName))))
}

/** Whether an object literal has a property called `name`. */
const hasKey = (objectNode, name) => objectNode.properties.some((property) => property.type === "Property" && !property.computed && keyName(property.key) === name)

/** The schema is decided by migrations run by `apps/migrate`, never by the running process. */
export const noRuntimeSchema = {
    meta: {
        type: "problem",
        docs: { description: "Every DataSource options object states `synchronize: false`; no `migrationsRun`, no runtime DDL, no entity or migration glob." },
        schema: [],
        messages: {
            synchronize: "`synchronize` is set to something other than the literal `false`. The schema changes by migration only; a boot-time ORM diff decides it otherwise.",
            synchronizeMissing: "This DataSource options object does not state `synchronize: false`. Write the literal `false` in every options object, so what the connection may do to the schema is readable where it is built.",
            optionsNotLiteral: "`new DataSource(...)` is given options that are not an object literal, so `synchronize: false` cannot be seen. Pass the options as an object literal that states `synchronize: false`.",
            synchronizeCall: "`.synchronize()` builds the schema at runtime. Write a migration and let `apps/migrate` run it.",
            migrationsRun: "`migrationsRun` is banned. Only `apps/migrate` runs migrations, once per connection, before api and worker start.",
            ddl: "A schema-changing statement (`CREATE|ALTER|DROP ...`) outside `persistence/migrations/`. Schema-changing SQL belongs in a migration.",
            glob: "`{{key}}` is found by glob. List the entities and migrations explicitly from each capability's `index.ts` so what runs is what was reviewed.",
        },
    },
    create(context) {
        const filename = context.filename || context.getFilename()
        if (isDeclarationFile(filename)) return {}
        const migration = isMigrationFile(hfsOf(context), filename)
        return {
            ObjectExpression(node) {
                if (isOptionsObject(context, node) && !hasKey(node, "synchronize")) context.report({ node, messageId: "synchronizeMissing" })
            },
            Property(node) {
                if (node.computed) return
                const key = keyName(node.key)
                if (key === "synchronize" && !isFalse(node.value)) {
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
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier" || callee.property.name !== "synchronize") return
                if (isPackageType(context, callee.object, "DataSource", "typeorm")) context.report({ node, messageId: "synchronizeCall" })
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
    if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
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
    if (slot.startsWith("be.transport.") || slot === "be.feature.transport.cli") return "file"
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
