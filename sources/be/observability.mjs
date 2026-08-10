/**
 * The rules that hold `observability.md`.
 *
 * Two rules and one config line, covering the three ways a log escapes the pipeline: the framework's
 * own logger, `console`, and a name fused with its data. The third is the one worth a rule of its
 * own, because it is the only one that still LOOKS like structured logging - the call goes through
 * the right service and produces an unqueryable line anyway.
 *
 * `no-console` is not reimplemented here: the standard rule already does it exactly, and shipping a
 * second implementation of a rule everybody has would be a maintenance cost with no gain. It is
 * named in `recommended` so a consuming repository switches it on with the others.
 *
 * OBSERVABILITY-4 and -5 are judgements a rule cannot make. Whether a log records a decision or
 * merely an arrival needs to know what the code is FOR, and no parser knows that.
 */

/** Log methods the house service exposes. */
const LOG_METHODS = new Set(["log", "error", "warn", "info", "debug", "verbose"])

/** The house logging service, by the name it is injected under. */
const LOGGER_RECEIVER = "winstonService"

/** The framework logger this replaces. */
const FRAMEWORK_LOGGER = "Logger"

/** The package the framework logger comes from. */
const FRAMEWORK_PACKAGE = "@nestjs/common"

/** Whether a call's receiver is the house logging service, injected or via `this`. */
const isLoggerReceiver = (node) => {
  if (node.type === "Identifier") return node.name === LOGGER_RECEIVER
  if (node.type === "MemberExpression" && !node.computed) return node.property.name === LOGGER_RECEIVER
  return false
}

// -- OBSERVABILITY-1 -------------------------------------------------------------------------------

/** Logs leave through the house service, never the framework's own logger. */
export const noFrameworkLogger = {
  meta: {
    type: "problem",
    docs: { description: "Only the house logging service logs; the framework's `Logger` is refused." },
    schema: [],
    messages: {
      imported:
        "`Logger` from `{{pkg}}` bypasses the correlation id and the transport configuration the house service wires up - the line is written in the right SHAPE and still arrives without the context every other line carries, or does not arrive at all. Inject the house logging service.",
      constructed:
        "`new Logger(...)` - same bypass, reached through a local construction rather than the import. Inject the house logging service.",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        if (node.source.value !== FRAMEWORK_PACKAGE) return
        for (const specifier of node.specifiers || []) {
          if (specifier.type !== "ImportSpecifier") continue
          if (specifier.imported && specifier.imported.name === FRAMEWORK_LOGGER) {
            context.report({ node: specifier, messageId: "imported", data: { pkg: FRAMEWORK_PACKAGE } })
          }
        }
      },
      // caught separately so an aliased import cannot walk past the check above
      NewExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === FRAMEWORK_LOGGER) {
          context.report({ node, messageId: "constructed" })
        }
      },
    }
  },
}

// -- OBSERVABILITY-2 -------------------------------------------------------------------------------

/** The event name is a member of a closed set, never a string built at the call site. */
export const noInterpolatedLogMessage = {
  meta: {
    type: "problem",
    docs: { description: "A log call's first argument is an enum member, not a built string." },
    schema: [],
    messages: {
      built:
        "The first argument to `{{method}}(...)` names WHAT happened and must come from the log-name enum. A string built here fuses the name with the data, so in one move the name stops being groupable and the data stops being queryable - and the day somebody rewords it, every dashboard built on it goes quiet. Pass the enum member, and put the variable part in the data object beside it.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee
        if (callee.type !== "MemberExpression" || callee.computed) return
        const method = callee.property.name
        if (!LOG_METHODS.has(method)) return
        if (!isLoggerReceiver(callee.object)) return

        const first = node.arguments[0]
        if (!first) return
        const built = first.type === "TemplateLiteral"
          || (first.type === "BinaryExpression" && first.operator === "+")
          || (first.type === "Literal" && typeof first.value === "string")
        if (built) context.report({ node: first, messageId: "built", data: { method } })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-framework-logger": noFrameworkLogger,
  "no-interpolated-log-message": noInterpolatedLogMessage,
}

/**
 * The level this law asks for, as the plugin's own opinion.
 *
 * Both measured at zero debt in the reference repository ONCE the sanctioned exit is scoped:
 * `no-framework-logger` reports four sites under the standalone-agent folder, and those are the
 * exit rather than the debt. An agent running outside the request lifecycle has no request to
 * correlate and no transport configured, so the house service would give it a dependency and
 * nothing else. Scope that folder off in the consuming config -- once, by path -- rather than
 * letting per-line suppressions accumulate until nobody can see how wide the exception has grown.
 *
 * `no-console` is the standard rule rather than a house one, listed here so a repository switches
 * all three on together: it is the third way out of the pipeline, and leaving it off makes the
 * other two decorative.
 */
export const recommended = {
  "starci-be/no-framework-logger": "error",
  "starci-be/no-interpolated-log-message": "error",
  "no-console": "error",
}

/**
 * Paths where a plain logger is sanctioned -- programs with no request to correlate.
 *
 * Exported so a consuming config and a measuring gate use the SAME list. Two copies of an exemption
 * is how one of them silently grows.
 */
export const standaloneProgramGlobs = [
  "src/modules/playground-agent-core/**",
  "apps/playground-*-agent/**",
  "apps/cli/**",
]
