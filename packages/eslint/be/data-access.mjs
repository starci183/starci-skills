/**
 * The rules that hold `data-access.md`.
 *
 * The first three read a constructor parameter or a decorator, all exact - there is no heuristic
 * here and no judgement to get wrong, which is why all three can be switched on without a burn-down
 * in a codebase that already follows them.
 *
 * The next two hold a narrower, exact slice of DATA-4 (Rule 5) and DATA-5 (Rule 6) - the slice of
 * each that a single file settles on its own, with no call graph and no knowledge of intent needed.
 *
 * `no-outer-manager-in-transaction` catches the one shape of DATA-4 a parser can see: a
 * `this.<field>.transaction(async (tx) => ...)` callback whose body reaches for `this.<field>`
 * again instead of `tx`. That field held the manager from BEFORE the transaction opened, so a call
 * through it runs and commits on its own - the exact "half of it was written" bug DATA-4 names. What
 * it does NOT see, and cannot: whether a HELPER defined in another file was handed `tx` by ITS
 * caller. That still needs the call graph and stays undecidable, same as the law says.
 *
 * `no-eager-relation` catches the one shape of DATA-5 a parser can see: `eager: true` written on a
 * relation decorator. What it does NOT see: whether a call site correctly asked for a relation it
 * needed. That still needs to know what the answer is for and stays undecidable, same as the law
 * says.
 *
 * Both remaining gaps are read by a person; a rule that guessed at either would fire on correct
 * code, which is how a correct rule gets disabled.
 *
 * `no-external-call-in-transaction` (R82 `BE_TRANSACTION_EXTERNAL_CALL`) refuses `fetch`, an HTTP
 * client call or any method of a `*Client`/`*Sdk` receiver written inside `.transaction(async (tx) =>
 * ...)`. Holding the transaction open for as long as the external call takes means a failure after
 * partial commit, or a success the rollback then reverses with no way back; the fix is to commit
 * first and call out after, or to write an outbox message inside the transaction instead.
 *
 * `named-entity-manager-only` (R83 `BE_UNNAMED_DATA_ACCESS`) holds the one way a use case reaches the
 * database: the shared `EntityManager` injected through a named injector and called directly. It refuses a bare
 * `@InjectEntityManager()`, any `.getRepository(...)` call, and an injected `DataSource` outside the platform
 * database module and `apps/migrate`. `no-injected-repository` refuses `@InjectRepository` and `Repository<T>` in the same spirit.
 */

import { walk } from "./lib/ast.mjs"
import { normalizePath } from "./lib/path.mjs"

/** A parameter property (`private readonly x: T`) wraps the parameter it declares. */
const unwrapParam = (param) => (param.type === "TSParameterProperty" ? param.parameter : param)

/** The type name a parameter is annotated with, or null. */
const paramTypeName = (param) => {
  const annotation = param.typeAnnotation && param.typeAnnotation.typeAnnotation
  if (!annotation || annotation.type !== "TSTypeReference" || annotation.typeName.type !== "Identifier") return null
  return annotation.typeName.name
}

/** Decorator names on a parameter, including ones carried by the parameter property wrapping it. */
const paramDecorators = (original) => {
  const carriers = [original]
  if (original.type === "TSParameterProperty") carriers.push(original.parameter)
  const names = []
  for (const carrier of carriers) {
    for (const decorator of carrier.decorators || []) {
      const expression = decorator.expression
      if (expression.type === "CallExpression" && expression.callee.type === "Identifier") {
        names.push(expression.callee.name)
      } else if (expression.type === "Identifier") {
        names.push(expression.name)
      }
    }
  }
  return names
}

/** Every parameter of a constructor definition. */
const constructorParams = (node) =>
  node.kind === "constructor" && node.value && node.value.params ? node.value.params : []

/** Repository types that bind a handle to one entity. */
const REPOSITORY_TYPES = /^(?:Repository|TreeRepository|MongoRepository)$/

/** The house decorator family that names a datasource. */
const NAMES_DATASOURCE = /^Inject\w*EntityManager$/

// -- DATA-1 ----------------------------------------------------------------------------------------

/** An injected manager names the datasource it belongs to. */
export const mustInjectEntityManager = {
  meta: {
    type: "problem",
    docs: { description: "An injected `EntityManager` names its datasource through a decorator." },
    schema: [],
    messages: {
      undecorated:
        "`EntityManager` is injected without an `@Inject*EntityManager()` decorator. The type alone does not say WHICH datasource this is, and this application has more than one - so this reads correctly while pointing at the wrong database. Name the connection at the injection site.",
    },
  },
  create(context) {
    return {
      MethodDefinition(node) {
        for (const original of constructorParams(node)) {
          const param = unwrapParam(original)
          if (paramTypeName(param) !== "EntityManager") continue
          if (paramDecorators(original).some((name) => NAMES_DATASOURCE.test(name))) continue
          context.report({ node: param, messageId: "undecorated" })
        }
      },
    }
  },
}

// -- DATA-2 ----------------------------------------------------------------------------------------

/** Persistence never arrives as a repository. */
export const noInjectedRepository = {
  meta: {
    type: "problem",
    docs: { description: "Persistence goes through the shared `EntityManager`, never an injected repository." },
    schema: [],
    messages: {
      repo:
        "Inject the shared EntityManager with the named injector and call it directly. A repository is bound to ONE entity, so it cannot carry a transaction into a second table - and a use case that grows a second write then has to be rewritten rather than extended.",
    },
  },
  create(context) {
    return {
      // `@InjectRepository(...)` is refused wherever it is written: a constructor parameter, a property, a method parameter.
      Decorator(node) {
        const expression = node.expression
        if (expression.type === "CallExpression" && expression.callee.type === "Identifier" && expression.callee.name === "InjectRepository") {
          context.report({ node, messageId: "repo" })
        }
      },
      MethodDefinition(node) {
        for (const original of constructorParams(node)) {
          const param = unwrapParam(original)
          // A decorated parameter is reported once, by the Decorator visitor.
          if (paramDecorators(original).includes("InjectRepository")) continue
          if (REPOSITORY_TYPES.test(paramTypeName(param) || "")) context.report({ node: param, messageId: "repo" })
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

// -- DATA-4 (Rule 5) --------------------------------------------------------------------------------

/** Node types that rebind `this` - a `this.<field>` read past one of these belongs to a different call. */
const REBINDS_THIS = /^(?:FunctionDeclaration|FunctionExpression|ClassDeclaration|ClassExpression)$/

/** Walk every descendant of `node` that still runs under the SAME `this`, calling `visit` on each. */
const walkPreservingThis = (node, visit) => {
  if (!node || typeof node.type !== "string") return
  visit(node)
  for (const key of Object.keys(node)) {
    if (key === "parent") continue
    const value = node[key]
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child && typeof child.type === "string" && !REBINDS_THIS.test(child.type)) walkPreservingThis(child, visit)
      }
    } else if (value && typeof value.type === "string" && !REBINDS_THIS.test(value.type)) {
      walkPreservingThis(value, visit)
    }
  }
}

/** Everything inside a transaction receives the transactional manager, not the outer injected one. */
export const noOuterManagerInTransaction = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Inside `this.<field>.transaction(async (tx) => ...)`, every call uses `tx` - never `this.<field>` again (data-access.md DATA-4, Rule 5).",
    },
    schema: [],
    messages: {
      outerManager:
        "This is inside `this.{{field}}.transaction(...)`, but it reaches for `this.{{field}}` again instead of `{{param}}`, the manager the callback received. `this.{{field}}` is the manager from BEFORE the transaction opened - a call through it runs and commits on its own, which is how half a write survives a rollback. Use `{{param}}`.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "MemberExpression" || callee.computed) return
        if (callee.property.type !== "Identifier" || callee.property.name !== "transaction") return
        const object = callee.object
        if (object.type !== "MemberExpression" || object.computed) return
        if (object.object.type !== "ThisExpression") return
        if (object.property.type !== "Identifier") return
        const field = object.property.name
        // Only the arrow-function callback is covered. A plain `function (tx) {}` callback does not
        // inherit `this` from the enclosing method at all - TypeORM invokes it with no receiver, so
        // `this.<field>` inside one throws rather than silently escaping the transaction, and this
        // rule exists for the silent case.
        const callback = node.arguments[0]
        if (!callback || callback.type !== "ArrowFunctionExpression") return
        const param = callback.params[0]
        const paramName = param && param.type === "Identifier" ? param.name : "the transactional manager"
        walkPreservingThis(callback.body, (descendant) => {
          if (
            descendant.type === "MemberExpression"
            && !descendant.computed
            && descendant.object.type === "ThisExpression"
            && descendant.property.type === "Identifier"
            && descendant.property.name === field
          ) {
            context.report({ node: descendant, messageId: "outerManager", data: { field, param: paramName } })
          }
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

// -- DATA-6 (R82) ------------------------------------------------------------------------------------

const HTTP_RECEIVER = /^(?:axios|http|httpService|httpClient|axiosInstance)$/
const HTTP_METHODS = new Set(["get", "post", "put", "patch", "delete", "head", "request"])
/** A receiver named for an integration client or SDK: `stripeClient`, `this.paymentSdk`. */
const EXTERNAL_RECEIVER = /(?:Client|Sdk)$/

const calleeMethodName = (callee) =>
  callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" ? callee.property.name : null

const calleeReceiverName = (callee) => {
  if (callee.type !== "MemberExpression") return null
  const object = callee.object
  if (object.type === "Identifier") return object.name
  if (object.type === "MemberExpression" && !object.computed && object.property.type === "Identifier") return object.property.name
  return null
}

/** Whether `node` is a call this law treats as reaching an external system: `fetch`, an HTTP client, or any method of a `*Client`/`*Sdk`. */
const isExternalCall = (node) => {
  if (node.type !== "CallExpression") return false
  const { callee } = node
  if (callee.type === "Identifier" && callee.name === "fetch") return true
  const method = calleeMethodName(callee)
  const receiver = calleeReceiverName(callee)
  if (!method || !receiver) return false
  if (HTTP_RECEIVER.test(receiver) && HTTP_METHODS.has(method)) return true
  return EXTERNAL_RECEIVER.test(receiver)
}

/** A short label for a reported call: `stripeClient.charge`, `fetch`. */
const describeCall = (node) => {
  const { callee } = node
  if (callee.type === "Identifier") return callee.name
  const method = calleeMethodName(callee) ?? "?"
  const receiver = calleeReceiverName(callee) ?? "?"
  return `${receiver}.${method}`
}

/** No transaction spans an external call: commit first, then call out (or write an outbox message inside the transaction). */
export const noExternalCallInTransaction = {
  meta: {
    type: "problem",
    docs: {
      description: "An HTTP or SDK call does not run inside `.transaction(async (tx) => ...)`.",
    },
    schema: [],
    messages: {
      external:
        "`{{call}}` runs inside `.transaction(...)`. A database transaction held open for as long as an external call takes means: the call fails after the transaction already did its work and now has to be undone by hand, or the call succeeds and the transaction then rolls back, and the two systems disagree with no way back. Commit the transaction, then make the call - or write an outbox message inside the transaction and let a worker deliver it after commit.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "MemberExpression" || callee.computed) return
        if (callee.property.type !== "Identifier" || callee.property.name !== "transaction") return
        const callback = node.arguments[0]
        if (!callback || (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression")) return
        walk(callback.body, (child) => {
          if (isExternalCall(child)) context.report({ node: child, messageId: "external", data: { call: describeCall(child) } })
        })
      },
    }
  },
}

// -- DATA-7 (R83) ------------------------------------------------------------------------------------

/** Files that build the connections: the platform database module and the migrate app. */
const CONNECTION_BUILDER = /(?:^|\/)(?:platform\/(?:databases?|db|datasource|typeorm)|apps\/migrate)\//

/** The one way a use case reaches the database: the shared `EntityManager`, named, then called directly. */
export const namedEntityManagerOnly = {
  meta: {
    type: "problem",
    docs: {
      description:
        "The shared EntityManager is injected through a named injector and called directly; no bare `@InjectEntityManager()`, no `getRepository`, no injected `DataSource` (data-access.md DATA-7, R83).",
    },
    schema: [],
    messages: {
      unnamed:
        "`@InjectEntityManager()` names no connection, and this application registers more than one - so it points at whichever is default. Inject the shared EntityManager with the named injector (`InjectPrimaryEntityManager()`, `InjectAgentOsEntityManager()`, `InjectExpertAcademyEntityManager()`, or `@InjectEntityManager(<CONNECTION_TOKEN>)`) and call it directly.",
      getRepository:
        "`.getRepository(...)` binds a handle to ONE entity and hides which connection it came from. Inject the shared EntityManager with the named injector and call it directly: `manager.find(Entity, ...)`, `manager.save(Entity, ...)`, `tx.insert(Entity, ...)`.",
      dataSource:
        "`DataSource` is injected here to reach the database. Inject the shared EntityManager with the named injector and call it directly; a `DataSource` is built only by the platform database module.",
    },
  },
  create(context) {
    const filename = normalizePath(context.filename || context.getFilename())
    if (/\.d\.[cm]?ts$/.test(filename) || /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(filename)) return {}
    const mayBuildConnections = CONNECTION_BUILDER.test(filename)
    return {
      Decorator(node) {
        const expression = node.expression
        if (expression.type !== "CallExpression" || expression.callee.type !== "Identifier") return
        if (expression.callee.name === "InjectEntityManager" && expression.arguments.length === 0) {
          context.report({ node, messageId: "unnamed" })
        }
      },
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "MemberExpression" || callee.computed) return
        if (callee.property.type === "Identifier" && callee.property.name === "getRepository") {
          context.report({ node, messageId: "getRepository" })
        }
      },
      MethodDefinition(node) {
        if (mayBuildConnections) return
        for (const original of constructorParams(node)) {
          const param = unwrapParam(original)
          const byType = paramTypeName(param) === "DataSource"
          const byDecorator = paramDecorators(original).some((name) => name === "InjectDataSource" || name === "InjectConnection")
          if (byType || byDecorator) context.report({ node: param, messageId: "dataSource" })
        }
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

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * All five measured against the reference repository (`src/**`) before shipping. The original three
 * measured at zero debt and ship at `error`. `no-outer-manager-in-transaction` also measured zero -
 * every `.transaction(async (tx) => ...)` callback in the reference repository already uses only the
 * parameter it was handed - and ships at `error`. `no-eager-relation` also measured zero - no entity
 * in the reference repository declares `eager: true` - and ships at `error` as well; a repository
 * adopting these into a tree that is not already clean measures first and lands anything above zero
 * at `warn` with the count beside it.
 */
export const recommended = {
  "starci-be/must-inject-entity-manager": "error",
  "starci-be/no-injected-repository": "error",
  "starci-be/require-entity-table-name": "error",
  "starci-be/no-outer-manager-in-transaction": "error",
  "starci-be/no-eager-relation": "error",
  "starci-be/no-external-call-in-transaction": "error",
  "starci-be/named-entity-manager-only": "error",
}

/** Path helper shared with the other backend law modules. */
export { normalizePath }
