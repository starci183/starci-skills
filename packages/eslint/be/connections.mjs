/**
 * The rules that hold one database = one connection = one named injector (R84), and the slots that may hold an
 * `EntityManager` (R88).
 *
 * - `one-connection-per-database` (R84 `BE_CONNECTION_DUPLICATE`) closes the ways a second door to a database appears:
 *   `InjectEntityManager(`, `InjectDataSource(` and `getEntityManagerToken(` are called only in the
 *   `<conn>.decorators.ts` of the platform database capability, in the cli app and in the test database fixture; any
 *   exported injector of an `EntityManager` (its declared type is `TypedParameterDecorator<EntityManager>`, whatever it
 *   is called) is `Inject<Pascal(conn)>EntityManager` for a declared connection and lives in that connection's
 *   `<conn>.decorators.ts`; `TypeOrmModule.forRoot*` and `new DataSource(` live in the platform database capability and
 *   the cli app; the literal connection name is written once, in `<conn>.connection.ts`; and a `<conn>.config.ts`
 *   reads only keys that start with that connection's `envPrefix`.
 * - `em-injection-slots` (R88 `BE_TRANSPORT_SHAPE`) lets a class receive the `EntityManager` only in an application
 *   handler, a domain service and the platform capabilities that own a `persistence/` - never in transport,
 *   integrations or an app.
 *
 * Every question about a receiver is a question about its TypeScript type, every question about a path is a question
 * to the HFS slot view.
 */
import ts from "typescript"
import { hfsOf, inTestWorld } from "./lib/hfs.mjs"
import {
    baseNameOf,
    connectionFileOf,
    connectionsOf,
    inDatabaseCapability,
    inCli,
    infraTypeOf,
    injectionSites,
    injectorNameOf,
    mayHoldEntityManager,
} from "./lib/persistence.mjs"
import { isPackageType, originsOfType, typed, typeOrigins } from "./lib/types.mjs"

/** The `@nestjs/typeorm` calls that build a second door to a connection. */
const RAW_CONNECTION_CALLS = new Set(["InjectEntityManager", "InjectDataSource", "getEntityManagerToken"])

/** The initializers that can be an injector factory; a plain value is never typed here. */
const FUNCTION_LIKE = new Set(["ArrowFunctionExpression", "FunctionExpression", "CallExpression"])

/** Whether a file may build connections: the platform database capability and the cli app. */
const mayBuildConnections = (hfs, file) => inDatabaseCapability(hfs, file) || inCli(hfs, file)

/** `new DataSource(` also in the test world (`src/tests/world`), which owns the shared test infrastructure (owner ruling 2026-09-30). */
const mayConstructDataSource = (hfs, file) => mayBuildConnections(hfs, file) || inTestWorld(hfs, file)

/** The connection whose name a string literal spells, or undefined. */
const connectionNamed = (hfs, node) =>
    node?.type === "Literal" && typeof node.value === "string" ? connectionsOf(hfs).find((connection) => connection.name === node.value) : undefined

/** Whether a symbol is the platform composition's `TypedParameterDecorator` alias. */
const isTypedParameterDecorator = (hfs, checker, symbol) => {
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    const declaration = target.declarations?.find(ts.isTypeAliasDeclaration)
    if (target.name !== "TypedParameterDecorator" || !declaration) return false
    const found = hfs.classify(declaration.getSourceFile().fileName)
    return found.slot === "be.platform" && found.bindings?.capability === "composition"
}

/** Whether a type argument is typeorm's `EntityManager`. */
const isEntityManagerArgument = (checker, type) => originsOfType(checker, type).some((origin) => origin.module === "typeorm" && origin.name === "EntityManager")

/** Whether a written type is `TypedParameterDecorator<EntityManager>`, following the aliases written over it. */
const isEntityManagerDecoratorNode = (hfs, checker, node, depth) => {
    if (!ts.isTypeReferenceNode(node) || depth > 4) return false
    const symbol = checker.getSymbolAtLocation(node.typeName)
    if (!symbol) return false
    if (isTypedParameterDecorator(hfs, checker, symbol)) return Boolean(node.typeArguments?.[0]) && isEntityManagerArgument(checker, checker.getTypeFromTypeNode(node.typeArguments[0]))
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    const declaration = target.declarations?.find(ts.isTypeAliasDeclaration)
    return Boolean(declaration) && isEntityManagerDecoratorNode(hfs, checker, declaration.type, depth + 1)
}

/** Whether a type is `TypedParameterDecorator<EntityManager>`, however an alias renamed it. */
const isEntityManagerDecorator = (hfs, checker, type) => {
    const alias = type?.aliasSymbol
    if (!alias) return false
    if (isTypedParameterDecorator(hfs, checker, alias)) return Boolean(type.aliasTypeArguments?.[0]) && isEntityManagerArgument(checker, type.aliasTypeArguments[0])
    const declaration = alias.declarations?.find(ts.isTypeAliasDeclaration)
    return Boolean(declaration) && isEntityManagerDecoratorNode(hfs, checker, declaration.type, 1)
}

/** Whether the value written at `node` is an EntityManager injector: it, or what it returns, is `TypedParameterDecorator<EntityManager>`. */
const isEntityManagerInjector = (context, hfs, node) => {
    const { checker, toTs } = typed(context)
    const tsNode = toTs(node)
    if (!tsNode) return false
    const type = checker.getTypeAtLocation(tsNode)
    return [type, ...type.getCallSignatures().map((signature) => signature.getReturnType())].some((candidate) => isEntityManagerDecorator(hfs, checker, candidate))
}

/** Whether a call reaches a value declared by `pkg` under one of `names`, however it was imported. */
const callsPackage = (context, node, names, pkg) => typeOrigins(context, node).some((origin) => origin.module === pkg && names.has(origin.name))

/** The constant a declared connection name is exported as: `expert-academy` gives `EXPERT_ACADEMY_CONNECTION`. */
const constantOf = (name) => `${name.toUpperCase().replace(/-/g, "_")}_CONNECTION`

/** The string an env key argument spells, or null when it is not a plain string. */
const keyText = (node) => {
    if (node?.type === "Literal" && typeof node.value === "string") return node.value
    return node?.type === "TemplateLiteral" && node.expressions.length === 0 ? node.quasis[0].value.cooked : null
}

/** Whether a call's receiver is an `EnvSource` instance (the reader), not the class itself. */
const isEnvSourceReader = (context, hfs, object) => {
    const isEnvSource = typeOrigins(context, object).some((origin) => {
        const found = hfs.classify(origin.file)
        return origin.name === "EnvSource" && found.slot === "be.platform" && found.bindings?.capability === "config"
    })
    if (!isEnvSource) return false
    const { checker, toTs } = typed(context)
    return checker.getTypeAtLocation(toTs(object)).getConstructSignatures().length === 0
}

/** One physical database is one connection, one injector, one config and one registration. */
export const oneConnectionPerDatabase = {
    meta: {
        type: "problem",
        docs: { description: "One database = one connection = one named `Inject<Conn>EntityManager` declared once in `platform/database`." },
        schema: [],
        messages: {
            rawInjector:
                "`{{name}}` is called here. A connection is reached only through its own injector: `{{name}}` is written in `platform/database/<connection>.decorators.ts`, the cli app and the test database fixture, and nowhere else. Inject the shared EntityManager with `Inject<Connection>EntityManager()`.",
            injectorHome:
                "`{{name}}` is an EntityManager injector that is not the one injector of a declared connection. The only allowed injector is `Inject<Pascal(connection)>EntityManager`, exported from `platform/database/<connection>.decorators.ts` of a connection declared in `hfs.json`. A capability- or feature-specific injector, a second injector for one database and an alias are all a second door to the same database: use the connection's own injector.",
            registration:
                "`{{what}}` builds a connection outside the platform database capability and the cli app. A connection is registered once, in `platform/database`; the cli app builds its `DataSource` from the same `<connection>.config.ts`.",
            literal:
                "The connection name `{{name}}` is written as a string here. It is written once, as `export const {{constant}} = \"{{name}}\"` in `platform/database/{{name}}.connection.ts`; import that constant.",
            envKey:
                "`{{key}}` is read in the config of connection `{{connection}}`, whose environment keys all start with `{{prefix}}_`. A key of another prefix would point this connection at another connection's database. Read `{{prefix}}_<NAME>` only, spelled as a string literal.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        const decoratorsFile = connectionFileOf(hfs, filename, "decorators")
        const connectionFile = connectionFileOf(hfs, filename, "connection")
        const configFile = connectionFileOf(hfs, filename, "config")
        const fixtureDatabase = hfs.slotOf(filename) === "be.tests.fixtures" && baseNameOf(filename) === "database.ts"
        const mayRawInject = Boolean(decoratorsFile) || inCli(hfs, filename) || fixtureDatabase
        const declaredNames = new Set(connectionsOf(hfs).map((connection) => injectorNameOf(connection.name)))

        /** Reports each injector-typed value written at `node`, unless it is the declared injector of this file's own connection. */
        const checkInjector = (name, node, reportNode) => {
            if (!isEntityManagerInjector(context, hfs, node)) return
            if (decoratorsFile && name === injectorNameOf(decoratorsFile.name)) return
            context.report({ node: reportNode, messageId: "injectorHome", data: { name } })
        }
        /** Reports a connection-name literal inside the options object of a registration. */
        const checkOptionsName = (options) => {
            if (options?.type !== "ObjectExpression") return
            for (const property of options.properties) {
                if (property.type !== "Property" || property.computed || property.key.name !== "name") continue
                const named = connectionNamed(hfs, property.value)
                if (named) context.report({ node: property.value, messageId: "literal", data: { name: named.name, constant: constantOf(named.name) } })
            }
        }
        return {
            CallExpression(node) {
                const { callee } = node
                if (callsPackage(context, callee, RAW_CONNECTION_CALLS, "@nestjs/typeorm")) {
                    const name = typeOrigins(context, callee).find((origin) => RAW_CONNECTION_CALLS.has(origin.name)).name
                    if (!mayRawInject) context.report({ node, messageId: "rawInjector", data: { name } })
                    for (const argument of node.arguments) {
                        const named = connectionNamed(hfs, argument)
                        if (named) context.report({ node: argument, messageId: "literal", data: { name: named.name, constant: constantOf(named.name) } })
                    }
                    return
                }
                if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" && ["forRoot", "forRootAsync"].includes(callee.property.name)
                    && isPackageType(context, callee.object, "TypeOrmModule", "@nestjs/typeorm")) {
                    if (!mayBuildConnections(hfs, filename)) context.report({ node, messageId: "registration", data: { what: `TypeOrmModule.${callee.property.name}` } })
                    checkOptionsName(node.arguments[0])
                    return
                }
                if (configFile && callee.type === "MemberExpression" && isEnvSourceReader(context, hfs, callee.object)) {
                    const key = keyText(node.arguments[0])
                    if (key === null || !key.startsWith(`${configFile.envPrefix}_`)) {
                        context.report({ node: node.arguments[0] ?? node, messageId: "envKey", data: { key: key ?? "<not a string literal>", connection: configFile.name, prefix: configFile.envPrefix } })
                    }
                }
            },
            NewExpression(node) {
                if (!isPackageType(context, node.callee, "DataSource", "typeorm")) return
                if (!mayConstructDataSource(hfs, filename)) context.report({ node, messageId: "registration", data: { what: "new DataSource(...)" } })
                checkOptionsName(node.arguments[0])
            },
            VariableDeclarator(node) {
                if (node.id.type !== "Identifier") return
                const named = connectionNamed(hfs, node.init)
                if (named && node.id.name === constantOf(named.name) && connectionFile?.name !== named.name) {
                    context.report({ node: node.init, messageId: "literal", data: { name: named.name, constant: node.id.name } })
                }
                if (node.init && FUNCTION_LIKE.has(node.init.type)) checkInjector(node.id.name, node.id, node.id)
            },
            FunctionDeclaration(node) {
                if (node.id) checkInjector(node.id.name, node.id, node.id)
            },
            ExportSpecifier(node) {
                const exported = node.exported.name ?? node.exported.value
                // Re-exporting a declared injector under its own name is the owner's public surface; an alias is a second injector.
                if (declaredNames.has(exported) || (!node.parent.source && node.local.name === exported)) return
                checkInjector(exported, node.local, node.exported)
            },
        }
    },
}

/** An EntityManager is injected in an application handler, a domain service or a platform persistence capability only. */
export const emInjectionSlots = {
    meta: {
        type: "problem",
        docs: { description: "An `EntityManager` is injected only in application handlers, domain services, projections and the platform capabilities that own a `persistence/`." },
        schema: [],
        messages: {
            slot:
                "`EntityManager` is injected in a file of slot `{{slot}}`. Only an application `*.handler.ts`, a domain `*.service.ts`, a projection's `*.projection.ts` and the platform database, inbox, event-bus, queue and jobs capabilities reach the database. Transport dispatches a command or query, an integration calls its provider, an app composes: move the data access into a handler or a domain service.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        if (mayHoldEntityManager(hfs, filename)) return {}
        return injectionSites(({ node, annotation }) => {
            if (annotation && infraTypeOf(context, annotation) === "EntityManager") {
                context.report({ node, messageId: "slot", data: { slot: hfs.slotOf(filename) ?? "no slot" } })
            }
        })
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "one-connection-per-database": oneConnectionPerDatabase,
    "em-injection-slots": emInjectionSlots,
}

/** Every rule of this law ships at `error`. */
export const recommended = {
    "starci-be/one-connection-per-database": "error",
    "starci-be/em-injection-slots": "error",
}
