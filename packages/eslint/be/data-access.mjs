/**
 * The rules that hold `data-access.md` and the persistence half of the back-end convention (R82, R83).
 *
 * The database is reached one way: the shared TypeORM `EntityManager`, injected through the named injector of a declared
 * connection (`Inject<Pascal(connection)>EntityManager`), called directly. Every rule here identifies its receiver by its
 * TypeScript type (`isPackageType(..., "typeorm")`) and every path question goes through the HFS slot view: no variable
 * name, no path regular expression, no spec exemption.
 *
 * - `must-inject-entity-manager` - a constructor parameter typed `EntityManager` carries the named injector of a declared
 *   connection. A lookalike (`InjectFooEntityManager`) or a bare `InjectEntityManager()` is not one.
 * - `named-entity-manager-only` - no property injection of an `EntityManager`, `DataSource` or `QueryRunner`; a
 *   `DataSource` or `QueryRunner` is injected only in the platform database capability and the migrate app; no
 *   `getRepository(...)` on a manager or data source.
 * - `no-injected-repository` - no `@InjectRepository`, no `Repository<T>` type, no `TypeOrmModule.forFeature`.
 * - `require-entity-table-name` - `@Entity()` names its table.
 * - `no-outer-manager-in-transaction` - inside `<manager>.transaction(async (tx) => ...)` every call uses `tx`; any other
 *   value typed `EntityManager` that was declared outside the callback is refused.
 * - `no-eager-relation` - a relation decorator carries no `eager: true`.
 * - `no-external-call-in-transaction` (R82) - inside a transaction callback, no call through a receiver typed from
 *   `integrations/**`, `HttpClient` or `MessagePublisher`, and no `fetch`.
 */

import { walk } from "./lib/ast.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import {
    declaredInjectorNames,
    inDatabaseCapability,
    inMigrateApp, inTestBootstrap,
    infraTypeOf,
    injectionSites,
} from "./lib/persistence.mjs"
import { isPackageType, typeOrigins } from "./lib/types.mjs"

/** The `typeorm` repository types no class receives. */
const REPOSITORY_TYPES = ["Repository", "TreeRepository", "MongoRepository"]

// -- R83: the injector ---------------------------------------------------------------------------------

/** A constructor parameter typed `EntityManager` carries the named injector of a declared connection. */
export const mustInjectEntityManager = {
    meta: {
        type: "problem",
        docs: { description: "An injected `EntityManager` carries the named injector of a declared connection." },
        schema: [],
        messages: {
            undecorated:
                "`EntityManager` is injected without a named injector. The type alone does not say WHICH database this is; only `{{expected}}` names a declared connection (from `hfs.json`), and a lookalike or a bare `InjectEntityManager()` names none. Inject it with the injector of the connection this class reads.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const expected = declaredInjectorNames(hfs)
        return injectionSites(({ node, kind, decorators, annotation }) => {
            if (kind !== "param" || !annotation || infraTypeOf(context, annotation) !== "EntityManager") return
            if (decorators.some((name) => expected.includes(name))) return
            context.report({ node, messageId: "undecorated", data: { expected: expected.join("` or `") || "no injector (declare the connection in hfs.json)" } })
        })
    },
}

/** The shared manager is injected by name, as a constructor parameter, and called directly. */
export const namedEntityManagerOnly = {
    meta: {
        type: "problem",
        docs: {
            description:
                "No property injection of an `EntityManager`, `DataSource` or `QueryRunner`; a `DataSource` or `QueryRunner` only in the platform database capability, the migrate app and the test world (`src/tests/world`); no `getRepository`.",
        },
        schema: [],
        messages: {
            property:
                "`{{type}}` is injected as a class property. Property injection hides the dependency from the constructor and the app module. Receive the named-injector `EntityManager` as a constructor parameter.",
            infra:
                "`{{type}}` is injected here. A `DataSource` or `QueryRunner` is built and held only by the platform database capability, the migrate app and the test world in `src/tests/world`; specs take `world.db.<connection>`; everything else injects the shared `EntityManager` through its named injector and calls it directly.",
            getRepository:
                "`.getRepository(...)` binds a handle to ONE entity and hides which connection it came from. Call the shared manager directly: `manager.find(Entity, ...)`, `manager.save(Entity, ...)`, `tx.insert(Entity, ...)`.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const filename = context.filename || context.getFilename()
        const mayHoldConnections = inDatabaseCapability(hfs, filename) || inMigrateApp(hfs, filename) || inTestBootstrap(hfs, filename)
        return {
            ...injectionSites(({ node, kind, annotation }) => {
                if (!annotation) return
                const type = infraTypeOf(context, annotation)
                if (!type) return
                if (kind === "property") context.report({ node, messageId: "property", data: { type } })
                else if (type !== "EntityManager" && !mayHoldConnections) context.report({ node, messageId: "infra", data: { type } })
            }),
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
                if (callee.property.name !== "getRepository") return
                if (infraTypeOf(context, callee.object)) context.report({ node, messageId: "getRepository" })
            },
        }
    },
}

// -- R83: repositories ---------------------------------------------------------------------------------

/** Whether a type reference sits on a parameter or property already reported through its `@InjectRepository` decorator. */
const carriesInjectRepository = (node) => {
    for (let owner = node.parent; owner && owner.type !== "ClassBody"; owner = owner.parent) {
        const decorated = (owner.decorators ?? []).some((decorator) => decorator.expression.type === "CallExpression" && decorator.expression.callee.name === "InjectRepository")
        if (decorated) return true
    }
    return false
}

/** Persistence never arrives as a repository. */
export const noInjectedRepository = {
    meta: {
        type: "problem",
        docs: { description: "Persistence goes through the shared `EntityManager`, never a repository." },
        schema: [],
        messages: {
            repo:
                "Inject the shared EntityManager with the named injector and call it directly. A repository is bound to ONE entity, so it cannot carry a transaction into a second table - and a use case that grows a second write then has to be rewritten rather than extended.",
            forFeature:
                "`TypeOrmModule.forFeature(...)` registers repositories, and this back end has none. Register the entities once on the connection in the platform database capability and call the shared EntityManager.",
        },
    },
    create(context) {
        return {
            Decorator(node) {
                const expression = node.expression
                if (expression.type === "CallExpression" && expression.callee.type === "Identifier" && expression.callee.name === "InjectRepository") {
                    context.report({ node, messageId: "repo" })
                }
            },
            TSTypeReference(node) {
                if (!REPOSITORY_TYPES.some((name) => isPackageType(context, node, name, "typeorm"))) return
                if (!carriesInjectRepository(node)) context.report({ node, messageId: "repo" })
            },
            CallExpression(node) {
                const callee = node.callee
                if (callee.type !== "MemberExpression" || callee.computed || callee.property.type !== "Identifier") return
                if (callee.property.name === "forFeature" && isPackageType(context, callee.object, "TypeOrmModule", "@nestjs/typeorm")) {
                    context.report({ node, messageId: "forFeature" })
                }
            },
        }
    },
}

// -- DATA-3 ----------------------------------------------------------------------------------------

/** An entity names its table, so a class rename cannot become a dropped table. */
export const requireEntityTableName = {
    meta: {
        type: "problem",
        docs: { description: "`@Entity()` names its table explicitly." },
        schema: [],
        messages: {
            inferred:
                "`@Entity()` here lets the ORM infer the table name from the class name, so renaming the class renames the table - which `synchronize` performs as a DROP and CREATE rather than a migration. A class rename is a refactor; a dropped table is an outage. Name the table.",
        },
    },
    create(context) {
        /** Both `@Entity("t")` and `@Entity({ name: "t" })` name the table. */
        const isTableName = (argument) =>
            (argument.type === "Literal" && typeof argument.value === "string") || argument.type === "TemplateLiteral"
        return {
            Decorator(node) {
                const expression = node.expression
                if (expression.type !== "CallExpression") return
                if (expression.callee.type !== "Identifier" || expression.callee.name !== "Entity") return
                // The options form is not a stylistic variant to discourage: it is the ONLY form that can
                // also carry a schema qualifier, so rejecting it would push an author to delete the schema
                // to satisfy the rule - a worse outcome than the inferred name this exists to prevent.
                const named = expression.arguments.some(
                    (argument) =>
                        isTableName(argument)
                        || (argument.type === "ObjectExpression"
                            && argument.properties.some(
                                (property) =>
                                    property.type === "Property"
                                    && !property.computed
                                    && (property.key.name === "name" || property.key.value === "name")
                                    && isTableName(property.value),
                            )),
                )
                if (!named) context.report({ node, messageId: "inferred" })
            },
        }
    },
}

// -- transactions ----------------------------------------------------------------------------------

/** The callback of a `.transaction(...)` call on a manager or data source, or null. */
const transactionCallback = (context, node) => {
    const callee = node.callee
    if (callee.type !== "MemberExpression" || callee.computed) return null
    if (callee.property.type !== "Identifier" || callee.property.name !== "transaction") return null
    const receiver = infraTypeOf(context, callee.object)
    if (receiver !== "EntityManager" && receiver !== "DataSource") return null
    const callback = node.arguments[node.arguments.length - 1]
    return callback && (callback.type === "ArrowFunctionExpression" || callback.type === "FunctionExpression") ? callback : null
}

/** The variable an identifier resolves to, looking outward from the identifier's own scope. */
const resolveVariable = (sourceCode, node) => {
    for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) {
        const variable = scope.set.get(node.name)
        if (variable) return variable
    }
    return null
}

/** The leftmost expression of a member chain: `this.deps.em` gives the `this`. */
const rootOf = (expression) => {
    let current = expression
    while (current.type === "MemberExpression" || current.type === "TSNonNullExpression") current = current.type === "MemberExpression" ? current.object : current.expression
    return current
}

/** Whether an identifier position reads a value (a property name, a key or a type name does not). */
const readsValue = (node) => {
    const parent = node.parent
    if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) return false
    if (parent.type === "Property" && parent.key === node && !parent.computed && !parent.shorthand) return false
    return !parent.type.startsWith("TS")
}

/** Everything inside a transaction receives the transactional manager, not one declared outside it. */
export const noOuterManagerInTransaction = {
    meta: {
        type: "problem",
        docs: { description: "Inside `<manager>.transaction(async (tx) => ...)`, every call uses `tx`, never another `EntityManager` declared outside the callback." },
        schema: [],
        messages: {
            outerManager:
                "`{{name}}` is an EntityManager from OUTSIDE this transaction callback. A call through it runs and commits on its own, which is how half a write survives a rollback. Use the manager the callback received.",
        },
    },
    create(context) {
        const sourceCode = context.sourceCode || context.getSourceCode()
        /** Whether the value written at `node` was declared outside the callback spanning `range`. */
        const declaredOutside = (node, range) => {
            const root = rootOf(node)
            if (root.type === "ThisExpression") return true
            if (root.type !== "Identifier") return false
            const variable = resolveVariable(sourceCode, root)
            const declaration = variable?.defs[0]?.name
            return Boolean(declaration) && (declaration.range[0] < range[0] || declaration.range[1] > range[1])
        }
        return {
            CallExpression(node) {
                const callback = transactionCallback(context, node)
                if (!callback) return
                walk(callback.body, (child) => {
                    const isReference = child.type === "MemberExpression" || (child.type === "Identifier" && readsValue(child))
                    if (!isReference || infraTypeOf(context, child) !== "EntityManager") return
                    if (declaredOutside(child, callback.range)) context.report({ node: child, messageId: "outerManager", data: { name: sourceCode.getText(child) } })
                })
            },
        }
    },
}

// -- DATA-5 (Rule 6) --------------------------------------------------------------------------------

/** Relation decorators whose `eager` option can grant the relation to every caller. */
const RELATION_DECORATORS = /^(?:ManyToOne|OneToOne|OneToMany|ManyToMany)$/

/** A relation is asked for by the call site that needs it; the entity grants no relation eagerly. */
export const noEagerRelation = {
    meta: {
        type: "problem",
        docs: {
            description: "A relation decorator carries no `eager: true` (data-access.md DATA-5, Rule 6).",
        },
        schema: [],
        messages: {
            eager:
                "`@{{decorator}}(..., { eager: true })` grants this relation to every caller whether it asked for it or not, so a query that wants one column now pays for the whole tree. State the relation in the `relations` the call site writes, and drop `eager` here.",
        },
    },
    create(context) {
        return {
            Decorator(node) {
                const expression = node.expression
                if (expression.type !== "CallExpression") return
                if (expression.callee.type !== "Identifier" || !RELATION_DECORATORS.test(expression.callee.name)) return
                for (const argument of expression.arguments) {
                    if (argument.type !== "ObjectExpression") continue
                    const eagerProperty = argument.properties.find(
                        (property) =>
                            property.type === "Property"
                            && !property.computed
                            && (property.key.name === "eager" || property.key.value === "eager"),
                    )
                    if (!eagerProperty) continue
                    if (eagerProperty.value.type === "Literal" && eagerProperty.value.value === true) {
                        context.report({ node, messageId: "eager", data: { decorator: expression.callee.name } })
                    }
                }
            },
        }
    },
}

// -- R82 ---------------------------------------------------------------------------------------------

/** The platform types whose calls leave the process. */
const PLATFORM_EXTERNAL_TYPES = new Set(["HttpClient", "MessagePublisher"])

/** Every receiver of a call chain, outermost first: `this.stripe.charges.create()` gives `this.stripe.charges`, `this.stripe`, `this`. */
const receiversOf = (callee) => {
    const receivers = []
    let current = callee.type === "MemberExpression" ? callee.object : null
    while (current) {
        receivers.push(current)
        if (current.type === "MemberExpression") current = current.object
        else if (current.type === "CallExpression") current = current.callee.type === "MemberExpression" ? current.callee.object : null
        else if (current.type === "TSNonNullExpression") current = current.expression
        else current = null
    }
    return receivers
}

/** No transaction spans an external call: commit first, then call out (or write an outbox message inside the transaction). */
export const noExternalCallInTransaction = {
    meta: {
        type: "problem",
        docs: { description: "An HTTP, SDK or publish call does not run inside `<manager>.transaction(async (tx) => ...)`." },
        schema: [],
        messages: {
            external:
                "`{{call}}` runs inside `.transaction(...)`. A database transaction held open for as long as an external call takes means: the call fails after the transaction already did its work and now has to be undone by hand, or the call succeeds and the transaction then rolls back, and the two systems disagree with no way back. Commit the transaction, then make the call - or write an outbox message inside the transaction and let a worker deliver it after commit.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const sourceCode = context.sourceCode || context.getSourceCode()
        /** Whether a value's type is declared in `integrations/**` or is the platform `HttpClient` / `MessagePublisher`. */
        const isExternalReceiver = (node) =>
            typeOrigins(context, node).some(
                (origin) => hfs.tierOf(origin.file) === "integrations" || (PLATFORM_EXTERNAL_TYPES.has(origin.name) && hfs.slotOf(origin.file) === "be.platform"),
            )
        return {
            CallExpression(node) {
                const callback = transactionCallback(context, node)
                if (!callback) return
                walk(callback.body, (child) => {
                    if (child.type !== "CallExpression") return
                    const { callee } = child
                    const globalFetch = callee.type === "Identifier" && callee.name === "fetch" && !resolveVariable(sourceCode, callee)?.defs.length
                    if (globalFetch || receiversOf(callee).some(isExternalReceiver)) {
                        context.report({ node: child, messageId: "external", data: { call: sourceCode.getText(callee).slice(0, 60) } })
                    }
                })
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "must-inject-entity-manager": mustInjectEntityManager,
    "no-injected-repository": noInjectedRepository,
    "require-entity-table-name": requireEntityTableName,
    "no-outer-manager-in-transaction": noOuterManagerInTransaction,
    "no-eager-relation": noEagerRelation,
    "no-external-call-in-transaction": noExternalCallInTransaction,
    "named-entity-manager-only": namedEntityManagerOnly,
}

/** Every rule of this law ships at `error`; a repository is fixed before it adopts the plugin, never given a weaker level. */
export const recommended = {
    "starci-be/must-inject-entity-manager": "error",
    "starci-be/no-injected-repository": "error",
    "starci-be/require-entity-table-name": "error",
    "starci-be/no-outer-manager-in-transaction": "error",
    "starci-be/no-eager-relation": "error",
    "starci-be/no-external-call-in-transaction": "error",
    "starci-be/named-entity-manager-only": "error",
}
