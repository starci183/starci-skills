/**
 * The rules that hold `exception-identity.md`.
 *
 * THREE RULES OVER ONE DECLARATION, AND THE FIRST IS WHAT MAKES THE OTHER GATES REAL. The
 * metadata-object rule, the base-class rule and the folder rule in `exceptions.mjs` all key on a name
 * ending in `Exception`, and the throw-site rule recognises only `Error` and the framework names. A
 * failure declared as `SomethingError` therefore sits inside the errors folder, extends the house
 * base, and is reported by none of them; the gate says nothing and that reads as agreement.
 *
 * The second rule is the one a client feels. The code is what Apollo stamps onto every GraphQL error
 * (`formatError` in the monolithic server module says so in as many words: code matching, not status,
 * is the front end's primary signal), so a code that drifts from its class is a wire contract nobody
 * can predict from the name - and a code copied from the exception above it makes two unrelated
 * failures arrive identical, which is the exact defect `EXCEPTION-1` refuses framework exceptions for.
 *
 * The third keeps the payload's type named after the failure it belongs to, so the shape a throw site
 * must satisfy is reachable from the exception's own name.
 */

/** The house base every exception extends. */
const EXCEPTION_BASE = "AbstractException"

/** Anything named like an exception. */
const EXCEPTION_NAME = /Exception$/

/** A class declaration that extends the house base - the only shape these rules govern. */
const isHouseException = (node) =>
  Boolean(node.id) && Boolean(node.superClass) && node.superClass.type === "Identifier" && node.superClass.name === EXCEPTION_BASE

/** The constructor of a class body, when it declares one. */
const constructorOf = (node) =>
  node.body.body.find((member) => member.type === "MethodDefinition" && member.kind === "constructor")

/** The `super(...)` call inside a constructor, which is where the message and the code are passed. */
const superCallOf = (ctor) => {
  const found = []
  const visit = (statements) => {
    for (const statement of statements ?? []) {
      if (
        statement.type === "ExpressionStatement" &&
        statement.expression.type === "CallExpression" &&
        statement.expression.callee.type === "Super"
      ) {
        found.push(statement.expression)
      }
    }
  }
  visit(ctor.value.body?.body)
  return found[0]
}

/** Letters only, upper case: `COURSE_NOT_FOUND_EXCEPTION` and `CourseNotFoundException` compare equal. */
const letters = (text) => String(text).replace(/_/g, "").toUpperCase()

// -- IDENTITY-1 ------------------------------------------------------------------------------------

/** The class name ends in `Exception`, because that suffix is what every other exception rule sees. */
export const exceptionNameEndsInException = {
  meta: {
    type: "problem",
    docs: { description: "A class extending `AbstractException` is named `*Exception`." },
    schema: [],
    messages: {
      suffix:
        "`{{name}}` extends `AbstractException` but is not named `*Exception`. Every rule guarding exceptions matches on that suffix - the throw-site rule, the metadata-object rule, the base-class rule and the folder rule all skip this class, so it is a failure NOTHING checks while the gate stays green. Rename it `{{suggestion}}`.",
    },
  },
  create(context) {
    return {
      ClassDeclaration(node) {
        if (!isHouseException(node) || EXCEPTION_NAME.test(node.id.name)) return
        context.report({
          node: node.id,
          messageId: "suffix",
          data: {
            name: node.id.name,
            suggestion: `${node.id.name.replace(/Error$/, "")}Exception`,
          },
        })
      },
    }
  },
}

// -- IDENTITY-2 ------------------------------------------------------------------------------------

/** The code is the class name, so nothing has to be looked up and nothing can be quietly reused. */
export const exceptionCodeMatchesClassName = {
  meta: {
    type: "problem",
    docs: { description: "The code passed to `super()` spells the class name." },
    schema: [],
    messages: {
      mismatch:
        "`{{name}}` reports the code `{{code}}`. The code is what a client matches on, so it is derived from the class name and nothing else: `{{expected}}`. A code that says something different cannot be predicted from the name, cannot be found by searching for the class, and - when it was copied from the exception above it - makes two unrelated failures arrive at the client identical.",
      notLiteral:
        "`{{name}}` builds its code instead of stating one. A code assembled at runtime cannot be found by searching for it, which is the one thing every consumer of it does - the client matching on it, the alert grouping by it, the reader asking where this failure comes from. Pass the literal `{{expected}}`.",
    },
  },
  create(context) {
    return {
      ClassDeclaration(node) {
        if (!isHouseException(node)) return
        const ctor = constructorOf(node)
        if (!ctor) return
        const call = superCallOf(ctor)
        if (!call || call.arguments.length < 2) return
        const code = call.arguments[1]
        const expected = `${node.id.name
          .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
          .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
          .toUpperCase()}`
        if (code.type !== "Literal" || typeof code.value !== "string") {
          context.report({ node: code, messageId: "notLiteral", data: { name: node.id.name, expected } })
          return
        }
        // Underscore placement is not the ruling - `GRAPHQL_DATA` and `GRAPH_QL_DATA` name the same
        // class, and an acronym has no single correct split. The letters are the ruling.
        if (letters(code.value) === letters(node.id.name)) return
        context.report({
          node: code,
          messageId: "mismatch",
          data: { name: node.id.name, code: code.value, expected },
        })
      },
    }
  },
}

// -- IDENTITY-3 ------------------------------------------------------------------------------------

/** The metadata type carries the exception's name, so the payload shape is reachable from it. */
export const exceptionMetadataTypeNamedForClass = {
  meta: {
    type: "problem",
    docs: { description: "The constructor's metadata parameter is typed `<Class>Metadata`." },
    schema: [],
    messages: {
      untyped:
        "`{{name}}`'s metadata parameter states no type. The parameter is the whole contract a throw site has to satisfy, and an untyped one accepts every object - including the one missing the id the failure exists to carry. Type it `{{expected}}`.",
      named:
        "`{{name}}` types its metadata as `{{actual}}`. Name the type after the exception - `{{expected}}` - so the payload is reachable from the failure's own name, and so the day this failure gains its first field there is already a place to put it that no call site has to learn.",
    },
  },
  create(context) {
    return {
      ClassDeclaration(node) {
        if (!isHouseException(node)) return
        const ctor = constructorOf(node)
        if (!ctor) return
        // `{ ... }: Metadata = {}` parses as an assignment pattern wrapping the destructuring, and
        // reading only the outer node skipped exactly the declarations that had given up on a named
        // type - the ones this rule exists for.
        const declared = ctor.value.params[0]
        const param = declared?.type === "AssignmentPattern" ? declared.left : declared
        if (!param || param.type !== "ObjectPattern") return
        const expected = `${node.id.name}Metadata`
        const annotation = param.typeAnnotation?.typeAnnotation
        if (!annotation) {
          context.report({ node: param, messageId: "untyped", data: { name: node.id.name, expected } })
          return
        }
        if (annotation.type !== "TSTypeReference" || annotation.typeName.type !== "Identifier") return
        if (annotation.typeName.name === expected) return
        context.report({
          node: annotation,
          messageId: "named",
          data: { name: node.id.name, actual: annotation.typeName.name, expected },
        })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "exception-name-ends-in-exception": exceptionNameEndsInException,
  "exception-code-matches-class-name": exceptionCodeMatchesClassName,
  "exception-metadata-type-named-for-class": exceptionMetadataTypeNamedForClass,
}

/**
 * The levels this law asks for.
 *
 * All three measured with debt when they landed and all three are at zero now, which is the only
 * state that earns `error`: a rule switched on over existing offenders trains its readers to scroll
 * past it, and a reader who has learned to scroll past one rule reads none of them. Each arrived at
 * `warn` with a ledger entry naming its offenders and flipped as that entry closed - metadata types
 * first, because renaming one costs no caller anything, then the codes and the class names, which
 * are wire-visible and were measured against every client before being moved.
 *
 * What that measurement found is worth keeping: across three front ends, five exception codes are
 * matched in total, and none of them belonged to a drifted declaration. The assumption that a code
 * change means a coordinated release was expensive to believe and cheap to check.
 */
export const recommended = {
  "starci-be/exception-name-ends-in-exception": "error", // debt paid 2026-08-14
  "starci-be/exception-code-matches-class-name": "error", // debt paid 2026-08-14
  "starci-be/exception-metadata-type-named-for-class": "error", // debt paid 2026-08-14
}
