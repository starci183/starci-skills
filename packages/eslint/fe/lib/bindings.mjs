/**
 * Bindings of the front-end canon: what an identifier resolves to through the scope manager, which module an import
 * comes from, which function a name stands for, and a stable KEY for an expression that names a place (a variable, a
 * member path, `this.x`). A rule that must decide "is this the same handle / target / listener" compares keys, never
 * spellings: two `id` variables in different scopes have different keys, `timerRef.current` has one key wherever it is
 * written.
 */

/** The globals that all name the browser's global object. */
const GLOBAL_OBJECT = new Set(["window", "globalThis", "self"])

/** Wrappers that change a node's type, not its identity. */
const TRANSPARENT = new Set(["TSAsExpression", "TSNonNullExpression", "TSSatisfiesExpression", "TSTypeAssertion", "ChainExpression", "ParenthesizedExpression"])

/**
 * The node without the wrappers that only change its type (`x as T`, `x!`, `x?.y`).
 *
 * @param {object} node - An ESTree node.
 * @returns {object} The inner node.
 */
export const unwrap = (node) => {
  let current = node
  while (current && TRANSPARENT.has(current.type)) current = current.expression
  return current
}

/**
 * The node's parent with the type-only wrappers skipped upward.
 *
 * @param {object} node - An ESTree node.
 * @returns {object|null} The first parent that is not a type-only wrapper.
 */
export const parentOf = (node) => {
  let current = node.parent
  while (current && TRANSPARENT.has(current.type)) current = current.parent
  return current ?? null
}

/** True for a function expression, an arrow function or a function declaration. */
export const isFn = (node) =>
  Boolean(node) && (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression" || node.type === "FunctionDeclaration")

/**
 * The scope-manager variable an identifier resolves to, or null for a global.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} identifier - An ESTree identifier.
 * @returns {object|null} The variable.
 */
export const variableOf = (context, identifier) => {
  for (let scope = context.sourceCode.getScope(identifier); scope; scope = scope.upper) {
    const variable = scope.set.get(identifier.name)
    if (variable) return variable
  }
  return null
}

/**
 * Where an identifier was imported from.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} identifier - An ESTree identifier.
 * @returns {{ source: string, imported: string|null }|null} The module specifier and the imported name (`null` for a default or namespace import), or null when the identifier is not an import.
 */
export const importOf = (context, identifier) => {
  const variable = variableOf(context, identifier)
  const definition = variable?.defs.find((entry) => entry.type === "ImportBinding")
  if (!definition) return null
  const specifier = definition.node
  const source = String(definition.parent.source.value)
  if (specifier.type === "ImportSpecifier") return { source, imported: specifier.imported.name ?? String(specifier.imported.value) }
  return { source, imported: null }
}

/**
 * The function an expression stands for: the function itself, or the function a same-file variable or declaration holds.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - An ESTree expression.
 * @returns {object|null} The function node, or null when it cannot be resolved in this file.
 */
export const functionOf = (context, node) => {
  const inner = unwrap(node)
  if (!inner) return null
  if (isFn(inner)) return inner
  if (inner.type !== "Identifier") return null
  const variable = variableOf(context, inner)
  for (const definition of variable?.defs ?? []) {
    if (definition.type === "FunctionName" && definition.node.type === "FunctionDeclaration") return definition.node
    if (definition.type === "Variable" && definition.node.id.type === "Identifier") {
      const init = unwrap(definition.node.init)
      if (isFn(init)) return init
    }
  }
  return null
}

/** A stable numeric id per scope-manager variable, so keys compare by binding and not by spelling. */
const VARIABLE_IDS = new WeakMap()
let nextVariableId = 1
const idOf = (variable) => {
  if (!VARIABLE_IDS.has(variable)) VARIABLE_IDS.set(variable, nextVariableId++)
  return VARIABLE_IDS.get(variable)
}

/**
 * The key of an expression that names a place: `v12` for a variable, `v12.current` for a member path, `this.timer` for
 * a member of `this`, `g:window` for the browser's global object under any of its names. Anything else has no key.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - An ESTree expression.
 * @returns {string|null} The key.
 */
export const keyOf = (context, node) => {
  const inner = unwrap(node)
  if (!inner) return null
  if (inner.type === "Identifier") {
    const variable = variableOf(context, inner)
    if (variable && variable.defs.length > 0) return `v${idOf(variable)}`
    return GLOBAL_OBJECT.has(inner.name) ? "g:window" : `g:${inner.name}`
  }
  if (inner.type === "ThisExpression") return "this"
  if (inner.type === "MemberExpression") {
    const head = keyOf(context, inner.object)
    if (head === null) return null
    if (!inner.computed && inner.property.type === "Identifier") return `${head}.${inner.property.name}`
    if (inner.computed && inner.property.type === "Literal") return `${head}[${String(inner.property.value)}]`
    return null
  }
  return null
}

/**
 * The receiver and the member name of a call written as `receiver.name(...)`, or the bare name of `name(...)`.
 *
 * @param {object} call - An ESTree call expression.
 * @returns {{ receiver: object|null, name: string }|null} The parts, or null for a computed or exotic callee.
 */
export const calleeParts = (call) => {
  const callee = unwrap(call.callee)
  if (callee.type === "Identifier") return { receiver: null, name: callee.name }
  if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier") return { receiver: callee.object, name: callee.property.name }
  return null
}
