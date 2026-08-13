/**
 * The rules that hold `exceptions.md`.
 *
 * FOUR RULES, AND THE PAIRING IS THE POINT. Two watch the throw site and two watch the declaration,
 * because either half alone has a hole the other closes: a class that extends a framework base is
 * thrown by its own house-shaped name, so a throw-site rule passes it, and one such class stayed
 * live and thrown from four call sites while the gate stayed green.
 *
 * `throw-abstract-exception` is a heuristic and says so: a rule reading one file at a time cannot
 * verify that a thrown class extends anything, so it matches `Error` and a named list of framework
 * exceptions. `exception-extends-abstract` is what makes that heuristic sound - it guarantees the
 * only `*Exception` classes in the tree are house ones.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** The house base every exception extends. */
const EXCEPTION_BASE = "AbstractException"

/** Anything named like an exception. */
const EXCEPTION_NAME = /Exception$/

/** Framework exceptions that carry an HTTP status and no identity. */
const FRAMEWORK_EXCEPTIONS = new Set([
  "BadRequestException",
  "NotFoundException",
  "UnauthorizedException",
  "ForbiddenException",
  "InternalServerErrorException",
  "HttpException",
  "ConflictException",
  "NotAcceptableException",
  "RequestTimeoutException",
  "GoneException",
  "PayloadTooLargeException",
  "UnsupportedMediaTypeException",
  "UnprocessableEntityException",
  "NotImplementedException",
  "BadGatewayException",
  "ServiceUnavailableException",
  "GatewayTimeoutException",
])

/** Where every exception is declared. */
const ERRORS_FOLDER = /\/exceptions\/errors\//

/**
 * True when a file sits in an exceptions folder - ANY of them.
 *
 * THE PATH USED TO BE `/platform/exceptions/errors/`, WHICH WAS ONE REPOSITORY'S LAYOUT WRITTEN
 * INTO A LAW. EXCEPTION-4 asks for one place per APPLICATION to look, not for one literal path: a
 * repository with several apps has `apps/<name>/src/exceptions/errors/` per app and still satisfies
 * it, because "what can this application throw" still has a single answer.
 *
 * Measured before changing: the narrow path reported 83 findings in a second back end, and the top
 * offenders were files already sitting in an `exceptions/errors/` folder - just not that one. A rule
 * that fires on correct code is worse than no rule, because the next author learns to scroll past it.
 */
const isInErrorsFolder = (filename) => ERRORS_FOLDER.test(normalizePath(filename))

/** The base class's own file, which is the one class allowed to extend something else. */
const isExceptionBaseFile = (filename) => /exceptions\/errors\/abstract\.ts$/.test(normalizePath(filename))

/**
 * The test lanes, where `throw new Error` is a test-runner assertion rather than a domain failure.
 *
 * THE CARVE-OUT WAS ALREADY GRANTED IN PROSE AND MISSING FROM THE RULE, which is the worst of the
 * two places for them to disagree: canon said the lanes may throw, the artifact said they may not,
 * and a repository adopting the rule inherited 69 findings its own canon had already excused.
 *
 * A flow that could not fail its own setup would have to invent a domain exception for "the fixture
 * is missing", which is a failure of the test rather than of the business - and naming it as a
 * domain failure would put it in the same vocabulary the product uses to describe real ones.
 */
const isTestLane = (filename) => {
  const path = normalizePath(filename)
  return /\.spec\.ts$/.test(path) || /-spec\.ts$/.test(path) || path.includes("/src/tests/")
}

/**
 * A liveness or readiness probe, where the HTTP STATUS is the whole contract.
 *
 * THE RULE'S OWN REASON IS WHAT GRANTS THIS. A framework exception is refused because it "carries an
 * HTTP status and no identity" - the status is not enough to tell two failures apart. A probe is the
 * one endpoint where that sentence inverts: kubernetes reads the status code and NOTHING else, never
 * the body, so the status is the entire identity and a domain exception carrying a rich code would
 * arrive as a 500 and be read as "down" for the wrong reason.
 *
 * Narrow on purpose. Only a health controller qualifies, so this cannot become the place a service
 * goes to avoid naming its failures.
 */
const isHealthProbe = (filename) => /\/health(?:z)?\.controller\.ts$|\/health\//.test(normalizePath(filename))

// -- EXCEPTION-1 -----------------------------------------------------------------------------------

/** Throw a house exception, never `Error` and never a framework built-in. */
export const throwAbstractException = {
  meta: {
    type: "problem",
    docs: { description: "Throw an `AbstractException` subclass, not `Error` or a framework exception." },
    schema: [],
    messages: {
      bareError:
        "`throw new Error(...)` carries a sentence and no code, so nothing downstream can group, match or retry on it without parsing English. Throw the exception class that NAMES this failure.",
      framework:
        "`throw new {{name}}(...)` carries an HTTP status and no identity - two unrelated failures arrive at a client indistinguishable, and the only thing telling them apart is the message, which is the part that gets reworded. Throw an `AbstractException` subclass.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    // the lanes canon already excuses - see `isTestLane`
    if (isTestLane(filename)) return {}
    const probe = isHealthProbe(filename)
    return {
      ThrowStatement(node) {
        const thrown = node.argument
        if (!thrown || thrown.type !== "NewExpression" || thrown.callee.type !== "Identifier") return
        const name = thrown.callee.name
        if (name === "Error") {
          context.report({ node: thrown, messageId: "bareError" })
          return
        }
        // a probe answers with a status code and nothing else - see `isHealthProbe`. `Error` above
        // is still refused here: a probe's status is its contract, an unnamed crash is not.
        if (probe) return
        if (FRAMEWORK_EXCEPTIONS.has(name)) {
          context.report({ node: thrown, messageId: "framework", data: { name } })
        }
      },
    }
  },
}

// -- EXCEPTION-2 -----------------------------------------------------------------------------------

/** The constructor takes one metadata object, `{}` when there is nothing to say. */
export const requireExceptionObjectArg = {
  meta: {
    type: "problem",
    docs: { description: "`new XException(...)` passes exactly one object-literal argument." },
    schema: [],
    messages: {
      zero:
        "`new {{name}}()` - pass the metadata object even when it is empty: `new {{name}}({})`. One spelling for every throw means a reader never has to check whether THIS exception happens to take arguments.",
      notObject:
        "`new {{name}}(...)` takes a metadata OBJECT, not a positional value. A positional shape cannot grow: the day this failure needs a second field, every throw site is edited and the ones edited wrong still compile.",
      extra:
        "`new {{name}}(...)` takes exactly ONE metadata object, not several arguments.",
    },
  },
  create(context) {
    return {
      ThrowStatement(node) {
        const thrown = node.argument
        if (!thrown || thrown.type !== "NewExpression" || thrown.callee.type !== "Identifier") return
        const name = thrown.callee.name
        if (name === EXCEPTION_BASE || !EXCEPTION_NAME.test(name)) return
        /*
         * A FRAMEWORK EXCEPTION IS NOT A HOUSE ONE, AND ITS SHAPE IS NOT OURS TO DICTATE.
         *
         * This rule says a house exception takes exactly one metadata object. `EXCEPTION_NAME`
         * matches anything ending in `Exception`, so it was also demanding that shape from Nest's
         * own classes - `new ServiceUnavailableException(body)` is the constructor Nest published,
         * and rewriting it to satisfy a house convention would change what the framework sends.
         *
         * Whether a framework exception may be thrown at all is EXCEPTION-1's question, and it
         * answers it. This rule only governs the ones we declare.
         */
        if (FRAMEWORK_EXCEPTIONS.has(name)) return

        if (thrown.arguments.length === 0) {
          context.report({ node: thrown, messageId: "zero", data: { name } })
          return
        }
        if (thrown.arguments.length > 1) {
          context.report({ node: thrown, messageId: "extra", data: { name } })
        }
        if (thrown.arguments[0].type !== "ObjectExpression") {
          context.report({ node: thrown.arguments[0], messageId: "notObject", data: { name } })
        }
      },
    }
  },
}

// -- EXCEPTION-3 -----------------------------------------------------------------------------------

/** The class extends the house base, so the throw site tells the truth about what is thrown. */
export const exceptionExtendsAbstract = {
  meta: {
    type: "problem",
    docs: { description: "An `*Exception` class extends `AbstractException`." },
    schema: [],
    messages: {
      base:
        "`{{name}}` extends `{{parent}}`. Every exception extends `{{expected}}` - a framework base slips past the throw-site rule, because the throw then READS as a house exception and nothing looks wrong at any call site.",
    },
  },
  create(context) {
    if (isExceptionBaseFile(context.filename || context.getFilename())) return {}
    return {
      ClassDeclaration(node) {
        if (!node.id || !EXCEPTION_NAME.test(node.id.name)) return
        const parent = node.superClass
        if (!parent || parent.type !== "Identifier" || parent.name === EXCEPTION_BASE) return
        context.report({
          node: parent,
          messageId: "base",
          data: { name: node.id.name, parent: parent.name, expected: EXCEPTION_BASE },
        })
      },
    }
  },
}

// -- EXCEPTION-4 -----------------------------------------------------------------------------------

/** Every exception is declared in one folder, so the set of failures is readable in one place. */
export const exceptionInErrorsFolder = {
  meta: {
    type: "problem",
    docs: { description: "An `*Exception` class is declared under the exceptions folder." },
    schema: [],
    messages: {
      place:
        "`{{name}}` is declared outside the exceptions folder. They all live in one place so \"what can this application throw?\" has one answer, and so a reviewer sees a new failure mode ARRIVE in a diff rather than discovering it in production.",
    },
  },
  create(context) {
    if (isInErrorsFolder(context.filename || context.getFilename())) return {}
    return {
      ClassDeclaration(node) {
        if (!node.id || !EXCEPTION_NAME.test(node.id.name)) return
        // an undecorated class with no base is a shape, not an exception - the declaration this
        // rule is after always extends something
        if (!node.superClass) return
        context.report({ node: node.id, messageId: "place", data: { name: node.id.name } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "throw-abstract-exception": throwAbstractException,
  "require-exception-object-arg": requireExceptionObjectArg,
  "exception-extends-abstract": exceptionExtendsAbstract,
  "exception-in-errors-folder": exceptionInErrorsFolder,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * All four measured at zero debt in the reference repository. The sanctioned exit is stated where it
 * applies rather than carved into the rule: the spec family and the test tree may `throw new Error`,
 * because there it means "the runner cannot continue" rather than naming a failure the product can
 * produce. A consuming repository turns `throw-abstract-exception` off for those globs.
 */
export const recommended = {
  "starci-be/throw-abstract-exception": "error",
  "starci-be/require-exception-object-arg": "error",
  "starci-be/exception-extends-abstract": "error",
  "starci-be/exception-in-errors-folder": "error",
}
