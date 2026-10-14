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

/** Type assertions and optional chains preserve the identity of the wrapped value. */
const unwrapped = (node) => {
  while (node && ["TSAsExpression", "TSTypeAssertion", "TSNonNullExpression", "TSSatisfiesExpression", "ChainExpression"].includes(node.type)) node = node.expression
  return node
}

/** The binding of this identifier, rather than every variable with the same spelling. */
const bindingOf = (sourceCode, identifier) => {
  for (let scope = sourceCode.getScope(identifier); scope; scope = scope.upper) {
    const variable = scope.set.get(identifier.name)
    if (variable) return variable
  }
  return null
}

/** Prior writes in the use's execution scope or its parents; a closure can capture a later initializer. */
const writeBefore = (sourceCode, variable, node) => {
  const scopes = new Set()
  for (let scope = sourceCode.getScope(node); scope; scope = scope.upper) scopes.add(scope.variableScope)
  const writes = variable.references.filter((reference) => reference.isWrite()
    && scopes.has(reference.from.variableScope)
    && !(reference.writeExpr && reference.writeExpr.range[0] <= node.range[0] && node.range[1] <= reference.writeExpr.range[1]))
  return writes
    .filter((reference) => reference.identifier.range[0] < node.range[0])
    .sort((left, right) => right.identifier.range[0] - left.identifier.range[0])[0]
    ?? writes.find((reference) => reference.init)
}

/** Property extraction between a write's source and its destructured binding. */
const propertyPath = (identifier) => {
  const properties = []
  for (let node = identifier; node.parent; node = node.parent) {
    const parent = node.parent
    if (parent.type === "Property" && parent.value === node) properties.unshift(parent)
    else if (parent.type !== "ObjectPattern" && !(parent.type === "AssignmentPattern" && parent.left === node)) break
  }
  return properties
}

/** Known environment containers and constant computed keys, followed through local aliases. */
const environmentIdentity = (sourceCode) => {
  const textOf = (node, seen = new Set()) => {
    node = unwrapped(node)
    if (!node || seen.has(node)) return null
    if (node.type === "Literal" && typeof node.value === "string") return node.value
    if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked
    if (node.type !== "Identifier") return null
    const variable = bindingOf(sourceCode, node)
    if (!variable) return null
    const write = writeBefore(sourceCode, variable, node)
    if (!write?.writeExpr || propertyPath(write.identifier).length > 0) return null
    return textOf(write.writeExpr, new Set([...seen, node]))
  }
  const keyOf = (node) => node.computed ? textOf(node.key ?? node.property) : (node.key ?? node.property).name ?? (node.key ?? node.property).value
  const propertyKind = (kind, key) => {
    if (kind === "global" && key === "process") return "process"
    if ((kind === "process" || kind === "meta") && key === "env") return "env"
    return null
  }
  const kindOf = (node, seen = new Set()) => {
    node = unwrapped(node)
    if (!node || seen.has(node)) return null
    if (node.type === "MetaProperty" && node.meta.name === "import" && node.property.name === "meta") return "meta"
    if (node.type === "MemberExpression") return propertyKind(kindOf(node.object, new Set([...seen, node])), keyOf(node))
    if (node.type !== "Identifier") return null
    const variable = bindingOf(sourceCode, node)
    if (!variable || variable.defs.length === 0) {
      if (node.name === "process") return "process"
      return ["globalThis", "global"].includes(node.name) ? "global" : null
    }
    const imported = variable.defs.find((definition) => definition.type === "ImportBinding" && ["process", "node:process"].includes(definition.parent.source.value))
    if (imported) {
      if (imported.parent.importKind === "type" || imported.node.importKind === "type") return null
      if (imported.node.type !== "ImportSpecifier") return "process"
      const name = imported.node.imported.name ?? imported.node.imported.value
      return name === "default" ? "process" : name === "env" ? "env" : null
    }
    const write = writeBefore(sourceCode, variable, node)
    if (!write?.writeExpr) return null
    let kind = kindOf(write.writeExpr, new Set([...seen, node]))
    for (const property of propertyPath(write.identifier)) kind = propertyKind(kind, keyOf(property))
    return kind
  }
  const readsEnv = (pattern, kind) => {
    if (pattern.type === "AssignmentPattern") return readsEnv(pattern.left, kind)
    if (pattern.type !== "ObjectPattern") return false
    return pattern.properties.some((property) => {
      if (property.type !== "Property") return false
      const valueKind = propertyKind(kind, keyOf(property))
      return valueKind === "env" || readsEnv(property.value, valueKind)
    })
  }
  return { kindOf, readsEnv }
}

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
    if (isConfigModule(context)) return {}
    const members = []
    const destructures = []
    return {
      ImportDeclaration(node) {
        if (node.importKind === "type" || !["process", "node:process"].includes(node.source.value)) return
        for (const specifier of node.specifiers) {
          if (specifier.type === "ImportSpecifier" && specifier.importKind !== "type" && (specifier.imported.name ?? specifier.imported.value) === "env") context.report({ node: specifier, messageId: "env" })
        }
      },
      MemberExpression(node) {
        members.push(node)
      },
      VariableDeclarator(node) {
        if (node.id.type === "ObjectPattern" && node.init) destructures.push({ node, pattern: node.id, value: node.init })
      },
      AssignmentExpression(node) {
        if (node.operator === "=" && node.left.type === "ObjectPattern") destructures.push({ node, pattern: node.left, value: node.right })
      },
      AssignmentPattern(node) {
        if (node.left.type === "ObjectPattern") destructures.push({ node, pattern: node.left, value: node.right })
      },
      "Program:exit"() {
        const { kindOf, readsEnv } = environmentIdentity(context.sourceCode ?? context.getSourceCode())
        for (const node of members) {
          if (kindOf(node) === "env") context.report({ node, messageId: "env" })
        }
        for (const { node, pattern, value } of destructures) {
          if (readsEnv(pattern, kindOf(value))) context.report({ node, messageId: "env" })
        }
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
