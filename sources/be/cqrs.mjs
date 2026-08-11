/**
 * The rules that hold `cqrs.md`.
 *
 * Three of the seven rules are shapes a parser can see. The other four - where the work lives, how
 * thin the service is, whether an event is one the caller waits on - are judgements, and a rule
 * that guessed at them would fire on correct code often enough that everybody would learn to
 * disable it.
 *
 * The one worth explaining is CQRS-3. A handler that overrides `execute` still compiles and still
 * runs; the template method in the base is simply skipped. Nothing goes red, and the file stays
 * wrong until the day a cross-cutting concern is added to the base and silently misses it. That is
 * exactly the class of mistake a rule is for: invisible at the call site, expensive later.
 */

/** Forward-slash form of a filename, so Windows paths compare like every other path. */
const normalizePath = (filename) => String(filename || "").replace(/\\/g, "/")

/** Decorators that mark a class as a CQRS handler. */
const HANDLER_DECORATORS = /^(?:Command|Query|Events)Handler$/

/** A `<operation>.handler.ts`, and the operation it is named for. */
const handlerFile = (filename) => {
  const hit = normalizePath(filename).match(/\/([a-z0-9-]+)\.handler\.ts$/)
  return hit ? hit[1] : null
}

/** A `<operation>.command.ts` or `<operation>.query.ts`, and the operation it is named for. */
const messageFile = (filename) => {
  const hit = normalizePath(filename).match(/\/([a-z0-9-]+)\.(command|query)\.ts$/)
  return hit ? { operation: hit[1], kind: hit[2] } : null
}

/** Decorator names carried by a class declaration. */
const decoratorNames = (node) =>
  (node.decorators || []).map((decorator) => {
    const expression = decorator.expression
    if (expression.type === "CallExpression" && expression.callee.type === "Identifier") return expression.callee.name
    if (expression.type === "Identifier") return expression.name
    return null
  }).filter(Boolean)

/** Whether a class body declares a method of the given name. */
const declaredMethod = (node, name) =>
  (node.body.body || []).find(
    (member) => member.type === "MethodDefinition" && member.key && member.key.name === name,
  )

// -- CQRS-3 ----------------------------------------------------------------------------------------

/** A handler implements the template's `process`, never its public `execute`. */
export const handlerOverridesProcess = {
  meta: {
    type: "problem",
    docs: { description: "A CQRS handler overrides `process`, not `execute`." },
    schema: [],
    messages: {
      overridesExecute:
        "`{{name}}` overrides `execute`, which takes it OUT of the template method in the base handler. It compiles and it runs, so nothing goes red - and it is the one handler the next cross-cutting change (a timing, a transaction, a retry added to the base) will silently miss. Rename this to `protected override async process(...)`.",
      noProcess:
        "`{{name}}` is a CQRS handler with no `process` method. The base declares `process` abstract and calls it from `execute`; a handler that implements neither has no work to dispatch to.",
    },
  },
  create(context) {
    return {
      ClassDeclaration(node) {
        if (!decoratorNames(node).some((name) => HANDLER_DECORATORS.test(name))) return
        const name = (node.id && node.id.name) || "this handler"
        const execute = declaredMethod(node, "execute")
        if (execute) {
          context.report({ node: execute.key, messageId: "overridesExecute", data: { name } })
          return
        }
        // A handler that extends anything may inherit `process` from that base, and an
        // intermediate abstract handler is a legitimate shape - a family of suggestion queries
        // that all search the same way implements `process` once and is subclassed. Measured
        // against real source, reporting here regardless of the superclass produced ten false
        // positives and three true ones, so the check applies only to a standalone class.
        if (node.superClass) return
        if (!declaredMethod(node, "process")) {
          context.report({ node: node.id || node, messageId: "noProcess", data: { name } })
        }
      },
    }
  },
}

// -- CQRS-2 ----------------------------------------------------------------------------------------

/** A message carries request context and nothing else. */
export const messageCarriesParamsOnly = {
  meta: {
    type: "problem",
    docs: { description: "A command or query holds `params` and declares no logic." },
    schema: [],
    messages: {
      method:
        "`{{name}}` declares `{{member}}`. A message that computes has moved a decision into a file nobody reads for decisions, and two dispatchers of this message would then disagree about what it means. Keep the message to its `params`; compute in the handler.",
      shape:
        "`{{name}}` does not carry a single `params` field. A message is request context - the request, the user, the locale - handed to the handler whole; a message with several fields makes every dispatcher assemble it differently.",
    },
  },
  create(context) {
    const message = messageFile(context.filename || context.getFilename())
    if (!message) return {}
    return {
      ClassDeclaration(node) {
        // `.command.ts` is not one thing. A CLI framework uses the same suffix for a decorated
        // class with a `run` method, which is a DOOR rather than a message - measured against
        // real source, that family produced nineteen of this rule's twenty-one reports. A CQRS
        // message is a plain class; anything decorated here belongs to some other framework.
        if ((node.decorators || []).length > 0) return
        const members = node.body.body || []
        for (const member of members) {
          if (member.type !== "MethodDefinition" || member.kind === "constructor") continue
          context.report({
            node: member.key,
            messageId: "method",
            data: { name: (node.id && node.id.name) || "this message", member: member.key.name || "a method" },
          })
        }
        const constructor = members.find((member) => member.type === "MethodDefinition" && member.kind === "constructor")
        if (!constructor || !constructor.value) return
        const params = constructor.value.params || []
        const carriesParams = params.length === 1
          && (params[0].type === "TSParameterProperty" ? params[0].parameter : params[0]).name === "params"
        if (!carriesParams) {
          context.report({
            node: node.id || node,
            messageId: "shape",
            data: { name: (node.id && node.id.name) || "this message" },
          })
        }
      },
    }
  },
}

// -- CQRS-7 ----------------------------------------------------------------------------------------

/**
 * A handler has its twin spec beside it.
 *
 * The check is the FILENAME, not the disk: a rule that stats the filesystem reports differently
 * depending on what else is checked out, and a rule whose answer depends on the working tree is one
 * nobody can reproduce. This rule fires on the handler and names the file that should exist; a gate
 * that walks the tree is what counts them.
 */
export const handlerHasTwinSpec = {
  meta: {
    type: "problem",
    docs: { description: "A CQRS handler declares its twin spec filename in the same folder." },
    schema: [
      {
        type: "object",
        properties: { specs: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    messages: {
      missing:
        "`{{operation}}.handler.ts` has no `{{operation}}.handler.spec.ts` beside it. The decisions live in the handler, so an untested handler is an untested decision - and a spec in the same folder is found by whoever edits the handler rather than by whoever goes looking in a test tree.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    const operation = handlerFile(filename)
    if (!operation) return {}
    const options = context.options && context.options[0]
    const known = options && Array.isArray(options.specs) ? options.specs : null
    if (!known) return {}
    if (known.includes(`${operation}.handler.spec.ts`)) return {}
    return {
      "Program:exit"(node) {
        context.report({ node, messageId: "missing", data: { operation } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "handler-overrides-process": handlerOverridesProcess,
  "message-carries-params-only": messageCarriesParamsOnly,
  "handler-has-twin-spec": handlerHasTwinSpec,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * MEASURED AGAINST THE REFERENCE REPOSITORY, not estimated: 3 of 141 handlers override `execute`,
 * and 2 of 138 messages carry something other than a single `params`. Debt above zero means the
 * rule lands at `warn` with the count beside it, gets burned down, and flips to `error` at zero -
 * shipping at `error` with debt outstanding blocks every commit that touches an offender.
 *
 * COUNT ONLY THIS RULE'S REPORTS when measuring. Inline `eslint-disable` comments in the source
 * refer to rules a minimal measuring config never loads, and eslint reports each of those as a
 * problem of its own - which inflated the first measurement of every rule here by the same seven
 * files, and this rule's by two.
 *
 * `handler-has-twin-spec` is off by default because it needs the folder listing passed as an
 * option; a repository that wires it supplies the listing from its own gate.
 */
export const recommended = {
  "starci-be/handler-overrides-process": "error", // no=0 of 141 - burned down from 3
  "starci-be/message-carries-params-only": "error", // no=0 of 138 - burned down from 2
  "starci-be/handler-has-twin-spec": "off", // needs the folder listing as an option; a repo that wires it turns this on
}
