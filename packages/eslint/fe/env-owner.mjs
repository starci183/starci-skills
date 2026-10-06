/**
 * The rules that hold `env-owner.md` (HFS R49, `FE_ENV_OWNER`).
 *
 * TWO FACTS, ONE OWNER. The environment is read in exactly one place, `modules/config`, and what it
 * reads has no default that stands in for a real deployment value. They are one law because they
 * fail together: an app with nine copies of `process.env.API_URL ?? "http://localhost:3068"` had
 * nine readers and nine silent defaults, so a production build with the variable missing talked to
 * a developer's laptop and looked healthy.
 *
 * The rules cannot see whether `modules/config` throws when a variable is missing in production -
 * that is a behaviour, and the module's own spec is where it is proven. What they hold is the
 * shape that makes it provable: one reader, and no literal fallback next to it.
 */

import { isConfigModule } from "./lib/scope.mjs"

/** `process.env`, or `import.meta.env`. */
const isEnvObject = (node) => {
  if (!node || node.type !== "MemberExpression" || node.computed) return false
  const name = node.property && node.property.name
  if (name !== "env") return false
  const object = node.object
  if (object.type === "Identifier" && object.name === "process") return true
  return (
    object.type === "MetaProperty" && object.meta.name === "import" && object.property.name === "meta"
  )
}

/** The variable name of `process.env.NAME` / `process.env["NAME"]`, or null. */
const envVariableName = (node) => {
  if (!node || node.type !== "MemberExpression" || !isEnvObject(node.object)) return null
  if (!node.computed && node.property.type === "Identifier") return node.property.name
  if (node.computed && node.property.type === "Literal" && typeof node.property.value === "string") {
    return node.property.value
  }
  return null
}

/** Static text of a literal or an expression-free template, else null. */
const staticText = (node) => {
  if (!node) return null
  if (node.type === "Literal" && typeof node.value === "string") return node.value
  if (node.type === "TemplateLiteral") {
    return node.quasis.map((quasi) => quasi.value.cooked ?? "").join("")
  }
  return null
}

/** An absolute or protocol-relative URL: what a fallback must never carry. */
const URL_TEXT = /^(?:https?:)?\/\/\S+/i

/** Variable names whose value is a secret or an address: a default for one is a hole in a deployment. */
const SENSITIVE_NAME = /(?:SECRET|TOKEN|PASSWORD|PASSWD|API_?KEY|PRIVATE_?KEY|URL|URI|HOST|ENDPOINT|ORIGIN)$/i

// -- FE-ENV-1 --------------------------------------------------------------------------------------

/** Only `modules/config` reads the environment. */
export const noEnvOutsideConfig = {
  meta: {
    type: "problem",
    docs: { description: "`process.env` and `import.meta.env` are read only in `modules/config`." },
    schema: [],
    messages: {
      env:
        "This file reads the environment. Only `modules/config` may: it is the one place that can fail loudly when a production variable is missing. Read the value from the config module's typed export instead.",
    },
  },
  create(context) {
    const filename = context.filename || context.getFilename()
    if (isConfigModule(context)) return {}
    return {
      MemberExpression(node) {
        if (isEnvObject(node)) context.report({ node, messageId: "env" })
      },
      VariableDeclarator(node) {
        // `const { env } = process` reads the environment without the member expression.
        if (node.id.type !== "ObjectPattern" || !node.init) return
        if (node.init.type !== "Identifier" || node.init.name !== "process") return
        const reads = node.id.properties.some(
          (property) => property.type === "Property" && property.key.type === "Identifier" && property.key.name === "env",
        )
        if (reads) context.report({ node, messageId: "env" })
      },
    }
  },
}

// -- FE-ENV-2 --------------------------------------------------------------------------------------

/** A fallback never stands in for a deployment address or secret. */
export const noHardcodedEndpointFallback = {
  meta: {
    type: "problem",
    docs: { description: "No URL literal as a fallback, and no literal default for an address or secret variable." },
    schema: [],
    messages: {
      url:
        "A URL literal used as a fallback (`?? \"http://...\"`, `|| \"http://...\"` or a parameter default). A missing variable then silently points production at a developer's machine. Read the address from `modules/config`, which throws when it is absent.",
      variable:
        "`{{name}}` is an address or secret variable with a literal default. A default here makes a misconfigured deployment look healthy. Remove the default and let `modules/config` fail loudly when it is missing.",
    },
  },
  create(context) {
    return {
      LogicalExpression(node) {
        if (node.operator !== "??" && node.operator !== "||") return
        const text = staticText(node.right)
        if (text === null) return
        if (URL_TEXT.test(text)) {
          context.report({ node: node.right, messageId: "url" })
          return
        }
        const name = envVariableName(node.left)
        if (name && text !== "" && SENSITIVE_NAME.test(name)) {
          context.report({ node: node.right, messageId: "variable", data: { name } })
        }
      },
      AssignmentPattern(node) {
        const text = staticText(node.right)
        if (text !== null && URL_TEXT.test(text)) context.report({ node: node.right, messageId: "url" })
      },
    }
  },
}

/** The rules this law contributes to the plugin. */
export const rules = {
  "no-env-outside-config": noEnvOutsideConfig,
  "no-hardcoded-endpoint-fallback": noHardcodedEndpointFallback,
}

/** Both are exact syntactic shapes, and both are errors. */
export const recommended = Object.fromEntries(Object.keys(rules).map((name) => [`starci-fe/${name}`, "error"]))
