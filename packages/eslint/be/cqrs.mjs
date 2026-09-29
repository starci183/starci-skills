/**
 * The rules that hold `cqrs.md`.
 *
 * Four of the eight rules are shapes a parser can see. The other four - where the work lives, how
 * thin the service is, whether the folder is split, whether an event is one the caller waits on -
 * are judgements, and a rule that guessed at them would fire on correct code often enough that
 * everybody would learn to disable it.
 *
 * The one worth explaining is CQRS-3. A handler that overrides `execute` still compiles and still
 * runs; the template method in the base is simply skipped. Nothing goes red, and the file stays
 * wrong until the day a cross-cutting concern is added to the base and silently misses it. That is
 * exactly the class of mistake a rule is for: invisible at the call site, expensive later.
 *
 * Rule 2 (CQRS-1, one operation one folder) was measured and NOT added here, and that absence is
 * itself a finding. A per-file check can only compare a filename's operation slug to its immediate
 * parent directory - and against this reference repository that comparison mismatched on 462 files
 * even after allowing an operation-prefixed suffix (`course-enroll-crypto.service.ts` beside
 * `course-enroll.handler.ts`). The mismatches were not CQRS-1 violations: multi-step operations
 * nested under a shared parent (`sign-in/init/`, `sign-in/resend/`), aggregator modules named for
 * their parent (`ai-balancer/balancer.module.ts`), and an unrelated lesson-content tree
 * (`features/mock/**`) all failed the comparison while being correct. A rule that guessed here would
 * have reported on more correct files than wrong ones, which is precisely the failure mode this law
 * warns against - it would have taught everybody to disable it. The law's own "documented" tier for
 * CQRS-1 is the honest answer, not a gap to close.
 */

import { normalizePath } from "./lib/path.mjs"

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

/** The rules this law contributes to the plugin. */
export const rules = {
  "handler-overrides-process": handlerOverridesProcess,
  "message-carries-params-only": messageCarriesParamsOnly,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * Both measured at zero debt in the reference repository (3 of 141 handlers overrode `execute` and
 * 2 of 138 messages carried more than `params`; both were burned down), so both are `error`.
 *
 * The twin-spec count rule and the encoded-failure rule are gone. Test selection follows behavior and
 * risk, not a filename count; and HFS v2 returns an expected refusal as a typed outcome union, so a
 * handler that returns `{ success: false }` is no longer a defect this canon can call by shape.
 */
export const recommended = {
  "starci-be/handler-overrides-process": "error",
  "starci-be/message-carries-params-only": "error",
}
