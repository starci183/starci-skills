/**
 * The rules that hold `observability.md` (catalog R40 `BE_LOGGER_REQUIRED`, logging half).
 *
 * Three rules covering the three ways a log escapes the pipeline: the framework's own logger, a name fused with its
 * data, and a failure line whose identity is its wording. The logger is identified by its TYPE - the `Logger` port of
 * `platform/logging` - never by what a receiver or a method is called, so a renamed receiver, a property injection and
 * a lookalike class are all judged correctly.
 *
 * `no-console` is not reimplemented here: the standard rule already does it exactly, and shipping a second
 * implementation of a rule everybody has would be a maintenance cost with no gain. It is named in `recommended` so a
 * consuming repository switches it on with the others.
 *
 * OBSERVABILITY-4 and -5 are judgements a rule cannot make. Whether a log records a decision or merely an arrival
 * needs to know what the code is FOR, and no parser knows that.
 */
import { hfsOf } from "./lib/hfs.mjs"
import { baseName, enumsOf, isLoggerCall, isOwnedBy } from "./lib/ports.mjs"
import { isPackageType } from "./lib/types.mjs"

/** The framework loggers of `@nestjs/common` this replaces, by the names the package declares them under. */
const FRAMEWORK_LOGGERS = Object.freeze(["Logger", "ConsoleLogger"])

/** The package the framework loggers come from. */
const FRAMEWORK_PACKAGE = "@nestjs/common"

// -- OBSERVABILITY-1 -------------------------------------------------------------------------------

/** Logs leave through the `Logger` port, never the framework's own logger. */
export const noFrameworkLogger = {
  meta: {
    type: "problem",
    docs: { description: "Only the `Logger` port of `platform/logging` logs; the framework's `Logger` is refused." },
    schema: [],
    messages: {
      imported:
        "`{{name}}` from `{{pkg}}` bypasses the JSON-lines adapter, the `Clock` stamp and the event vocabulary every other line carries - the line is written in the right SHAPE and still arrives without them. Inject the `Logger` port (`@InjectLogger() private readonly logger: Logger`).",
      constructed:
        "`new {{name}}(...)` builds the framework logger through a local construction rather than the import. Inject the `Logger` port (`@InjectLogger() private readonly logger: Logger`).",
      extended:
        "This class extends the framework logger from `{{pkg}}`. Implement the `Logger` port of `platform/logging` instead.",
    },
  },
  create(context) {
    // the adapter of the port is the one place that may know how lines are written
    if (isOwnedBy(hfsOf(context), context.filename || context.getFilename(), "platform", "logging")) return {}
    const framework = (node) => FRAMEWORK_LOGGERS.some((name) => isPackageType(context, node, name, FRAMEWORK_PACKAGE))
    return {
      ImportDeclaration(node) {
        if (node.source.value !== FRAMEWORK_PACKAGE) return
        for (const specifier of node.specifiers || []) {
          if (specifier.type !== "ImportSpecifier") continue
          const imported = specifier.imported.name ?? specifier.imported.value
          if (FRAMEWORK_LOGGERS.includes(imported)) context.report({ node: specifier, messageId: "imported", data: { name: imported, pkg: FRAMEWORK_PACKAGE } })
        }
      },
      // judged by the type of what is built, so an aliased import or a namespace import cannot walk past the check above
      NewExpression(node) {
        if (framework(node)) context.report({ node, messageId: "constructed", data: { name: node.callee.name ?? node.callee.property?.name ?? "Logger" } })
      },
      "ClassDeclaration, ClassExpression"(node) {
        if (node.superClass && framework(node.superClass)) context.report({ node: node.superClass, messageId: "extended", data: { pkg: FRAMEWORK_PACKAGE } })
      },
    }
  },
}

// -- OBSERVABILITY-2 -------------------------------------------------------------------------------

/** The event name is a member of an owner's log-event enum, never a string built at the call site. */
export const noInterpolatedLogMessage = {
  meta: {
    type: "problem",
    docs: { description: "A `Logger` call's first argument is a member of an owner's `<owner>.log-events.ts` enum, not a built string." },
    schema: [],
    messages: {
      notEvent:
        "The first argument to `{{method}}(...)` names WHAT happened and must be a member of the owner's `<owner>.log-events.ts` enum. A string or a value of any other type fuses the name with the data, so the name stops being groupable and the data stops being queryable - and the day somebody rewords it, every dashboard built on it goes quiet. Pass the enum member, and put the variable part in the fields beside it.",
      wrongHome:
        "`{{enumName}}` is an enum, but not one declared in a `<owner>.log-events.ts` file. Log events are declared by the owner that emits them, in `<owner>.log-events.ts`, so each owner's vocabulary is found in one place.",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isLoggerCall(context, node)) return
        const first = node.arguments[0]
        if (!first) return
        const method = node.callee.property.name
        const enums = enumsOf(context, first)
        if (!enums) {
          context.report({ node: first, messageId: "notEvent", data: { method } })
          return
        }
        const stray = enums.find((entry) => !baseName(entry.file).endsWith(".log-events.ts"))
        if (stray) context.report({ node: first, messageId: "wrongHome", data: { enumName: stray.name } })
      },
    }
  },
}

/** Whether `node` is a bare reference to the caught error, by name. */
const isIdentifierNamed = (node, name) => Boolean(node) && node.type === "Identifier" && node.name === name

/** How each wording shape reads back to the author, keyed by the `kind` pushed in `scanErrorUsage`. */
const WORDING_SHAPES = {
  message: (name) => `\`${name}.message\``,
  stringWrap: (name) => `\`String(${name})\``,
  template: (name) => `a template literal that interpolates \`${name}\` directly`,
}

/**
 * Walk a log call's data arguments for two things beside the caught error: a reference that carries
 * only its rendered WORDING (`.message`, `String(error)`, `${error}` inside a template), and a
 * reference that carries its IDENTITY (`.code`). The walk is a shallow recursion over the expression
 * shapes a data object is normally built from - object properties, array elements, template
 * expressions, ternary branches, boolean joins. It does not need a type checker: these three wording
 * shapes and the one identity shape are syntactic, not semantic, which is exactly the boundary
 * OBSERVABILITY-5 draws between what a parser can hold and what needs a reader.
 */
const scanErrorUsage = (node, errorName, found) => {
  if (!node || typeof node !== "object" || typeof node.type !== "string") return
  switch (node.type) {
    case "MemberExpression":
      if (!node.computed && isIdentifierNamed(node.object, errorName) && node.property.type === "Identifier") {
        if (node.property.name === "message") found.wording.push({ node, kind: "message" })
        if (node.property.name === "code") found.identity.push(node)
      }
      scanErrorUsage(node.object, errorName, found)
      break
    case "CallExpression":
      if (
        node.callee.type === "Identifier" && node.callee.name === "String"
        && node.arguments.length === 1 && isIdentifierNamed(node.arguments[0], errorName)
      ) {
        found.wording.push({ node, kind: "stringWrap" })
      }
      for (const arg of node.arguments) scanErrorUsage(arg, errorName, found)
      break
    case "TemplateLiteral":
      for (const expr of node.expressions) {
        if (isIdentifierNamed(expr, errorName)) found.wording.push({ node: expr, kind: "template" })
        else scanErrorUsage(expr, errorName, found)
      }
      break
    case "ObjectExpression":
      for (const prop of node.properties) scanErrorUsage(prop, errorName, found)
      break
    case "Property":
      scanErrorUsage(node.value, errorName, found)
      break
    case "ArrayExpression":
      for (const el of node.elements) scanErrorUsage(el, errorName, found)
      break
    case "ConditionalExpression":
      scanErrorUsage(node.consequent, errorName, found)
      scanErrorUsage(node.alternate, errorName, found)
      break
    case "LogicalExpression":
    case "BinaryExpression":
      scanErrorUsage(node.left, errorName, found)
      scanErrorUsage(node.right, errorName, found)
      break
    default:
      break
  }
}

/**
 * A failure log's data carries the exception's `code`, not only its rendered message. Scoped to log
 * calls sitting inside a `catch`, and to references to that `catch`'s OWN error identifier - a field
 * that happens to be named `error` elsewhere is not this rule's business, and neither is a call
 * outside a `catch`, since OBSERVABILITY-5 only binds where the line is what an alert groups by.
 */
export const noErrorWordingAsLogIdentity = {
  meta: {
    type: "problem",
    docs: {
      description:
        "OBSERVABILITY-5 (Rule 5): a failure log's data carries the exception's `code`, so improving the wording never splits an alert in two.",
    },
    schema: [],
    messages: {
      wordingOnly:
        "This failure log carries {{shape}} but never `{{errorName}}.code`. Wording is what a person reads; code is what a dashboard groups by. Fuse the two and the alert lives or dies on how the sentence happens to be phrased today - reword it tomorrow for clarity and the old alert goes silent while a new one opens under the reworded text. Add `{{errorName}}.code` (and any other identity metadata) to the data, and keep the message only as a secondary field beside it.",
    },
  },
  create(context) {
    const catchStack = []
    return {
      CatchClause(node) {
        catchStack.push(node.param?.type === "Identifier" ? node.param.name : null)
      },
      "CatchClause:exit"() {
        catchStack.pop()
      },
      CallExpression(node) {
        const errorName = catchStack.at(-1)
        if (!errorName) return
        if (!isLoggerCall(context, node)) return

        // the event name (first argument) is OBSERVABILITY-2's business, not this rule's
        const dataArgs = node.arguments.slice(1)
        if (dataArgs.length === 0) return

        const found = { wording: [], identity: [] }
        for (const arg of dataArgs) {
          // the caught error passed whole is the port's `cause`: the adapter serializes its name, so identity rides with it
          if (isIdentifierNamed(arg, errorName)) found.identity.push(arg)
          scanErrorUsage(arg, errorName, found)
        }
        if (found.wording.length > 0 && found.identity.length === 0) {
          const first = found.wording[0]
          context.report({
            node: first.node,
            messageId: "wordingOnly",
            data: { errorName, shape: WORDING_SHAPES[first.kind](errorName) },
          })
        }
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-framework-logger": noFrameworkLogger,
  "no-interpolated-log-message": noInterpolatedLogMessage,
  "no-error-wording-as-log-identity": noErrorWordingAsLogIdentity,
}

/**
 * The level this law asks for, as the plugin's own opinion: every rule at `error`, no exemption list.
 *
 * `no-console` is the standard rule rather than a house one; the config factory borrows it (`lib/config.mjs`
 * BORROWED) so it is on wherever these three are.
 */
export const recommended = {
  "starci-be/no-framework-logger": "error",
  "starci-be/no-interpolated-log-message": "error",
  "starci-be/no-error-wording-as-log-identity": "error",
}
