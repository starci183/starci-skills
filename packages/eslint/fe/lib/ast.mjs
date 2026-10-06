/**
 * Small AST readers shared by the laws that look at JSX attributes, calls and effect callbacks.
 *
 * ONE PLACE, because each reader answers "what does this node say" and two copies answer it
 * slightly differently: a rule that treats `` `/a` `` as a string and a sibling that does not
 * disagree about which hrefs are hardcoded.
 */

/** The JSX attribute called `name` on an opening element, or null. */
export const attribute = (opening, name) =>
  opening.attributes.find(
    (entry) => entry.type === "JSXAttribute" && entry.name.type === "JSXIdentifier" && entry.name.name === name,
  ) ?? null

/** The expression an attribute carries: a literal, or the inside of `{...}`; null for a bare attribute. */
export const attributeValue = (entry) => {
  if (!entry?.value) return null
  return entry.value.type === "JSXExpressionContainer" ? entry.value.expression : entry.value
}

/** The text of a string literal or of a template with no substitution; null for anything else. */
export const stringOf = (node) => {
  if (!node) return null
  if (node.type === "Literal" && typeof node.value === "string") return node.value
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0]?.value.cooked ?? ""
  return null
}

/** The leading text of a string literal or template (up to the first substitution); null for anything else. */
export const leadingTextOf = (node) => {
  if (!node) return null
  if (node.type === "TemplateLiteral") return node.quasis[0]?.value.cooked ?? ""
  return stringOf(node)
}

/** `a.b.c` for a chain of plain member accesses ending in an identifier; null for anything computed. */
export const calleeName = (node) => {
  if (!node) return null
  if (node.type === "Identifier") return node.name
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    const head = calleeName(node.object)
    return head === null ? null : `${head}.${node.property.name}`
  }
  return null
}

/** The name of a JSX element for a plain tag or a component; null for a member or namespaced name. */
export const tagName = (opening) => (opening.name.type === "JSXIdentifier" ? opening.name.name : null)

/** True for a `className` / `class` JSX attribute. */
export const isClassAttribute = (node) =>
  node.type === "JSXAttribute" && node.name && (node.name.name === "className" || node.name.name === "class")

/** Static string carried by a JSX attribute or by a module constant holding a class string. */
export const staticText = (value) => {
  if (!value) return null
  if (value.type === "Literal" && typeof value.value === "string") return value.value
  if (value.type === "TemplateLiteral" && value.expressions.length === 0) {
    return value.quasis.map((quasi) => quasi.value.cooked).join(" ")
  }
  if (value.type === "JSXExpressionContainer") return staticText(value.expression)
  return null
}

/** True for a function expression or an arrow function. */
export const isFunction = (node) => node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression"

/**
 * Every node under `root`, depth first, through the visitor keys of the parser in use.
 * `enter` may return `false` to skip a node's children.
 */
export const walk = (sourceCode, root, enter) => {
  const keys = sourceCode.visitorKeys
  const visit = (node) => {
    if (enter(node) === false) return
    for (const key of keys[node.type] ?? []) {
      const child = node[key]
      if (Array.isArray(child)) {
        for (const item of child) if (item && typeof item.type === "string") visit(item)
      } else if (child && typeof child.type === "string") {
        visit(child)
      }
    }
  }
  visit(root)
}

/** True when an identifier called `name` appears anywhere under `root`. */
export const mentions = (sourceCode, root, name) => {
  let found = false
  walk(sourceCode, root, (node) => {
    if (found) return false
    if (node.type === "Identifier" && node.name === name) found = true
    return undefined
  })
  return found
}
