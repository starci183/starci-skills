/**
 * The rules that hold `data-access.md`.
 *
 * Three rules, all reading a constructor parameter or a decorator, all exact - there is no
 * heuristic here and no judgement to get wrong, which is why all three can be switched on without
 * a burn-down in a codebase that already follows them.
 *
 * The two rules canon does NOT try to enforce are worth naming so nobody adds them badly. Whether a
 * helper was handed the caller's transactional manager (DATA-4) needs the call graph, and whether a
 * relation should have been asked for at the call site (DATA-5) needs to know what the answer is
 * for. Both are read by a person; a rule that guessed would fire on correct code.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

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
    docs: { description: "Persistence goes through `EntityManager`, never an injected repository." },
    schema: [],
    messages: {
      repo:
        "Inject `EntityManager` instead of a repository. A repository is bound to ONE entity, so it cannot carry a transaction into a second table - and a use case that grows a second write then has to be rewritten rather than extended.",
    },
  },
  create(context) {
    return {
      MethodDefinition(node) {
        for (const original of constructorParams(node)) {
          const param = unwrapParam(original)
          const byDecorator = paramDecorators(original).includes("InjectRepository")
          const byType = REPOSITORY_TYPES.test(paramTypeName(param) || "")
          if (byDecorator || byType) context.report({ node: param, messageId: "repo" })
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

/** The rules this law contributes to the plugin. */
export const rules = {
  "must-inject-entity-manager": mustInjectEntityManager,
  "no-injected-repository": noInjectedRepository,
  "require-entity-table-name": requireEntityTableName,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * All three measured at zero debt in the reference repository, so all three ship at `error`. A
 * repository adopting them into an existing tree measures first and lands anything above zero at
 * `warn` with the count beside it.
 */
export const recommended = {
  "starci-be/must-inject-entity-manager": "error",
  "starci-be/no-injected-repository": "error",
  "starci-be/require-entity-table-name": "error",
}

/** Path helper shared with the other backend law modules. */
export { normalizePath }
