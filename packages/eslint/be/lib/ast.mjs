/**
 * Small AST helpers the HFS laws share, so each rule states its question instead of its traversal.
 *
 * Nothing here touches disk or the type checker: a rule reads one file's syntax and its path.
 */

const SKIP_KEYS = new Set(["parent", "loc", "range", "tokens", "comments"])

const isNode = (value) => value !== null && typeof value === "object" && typeof value.type === "string"

const FUNCTION_TYPES = new Set(["FunctionDeclaration", "FunctionExpression", "ArrowFunctionExpression"])

/**
 * Visits `node` and every descendant, depth first.
 *
 * @param {object} node - The subtree root.
 * @param {(child: object) => void} visit - Called with each node.
 * @param {{ intoFunctions?: boolean }} [options] - `intoFunctions: false` stops at nested function boundaries.
 * @returns {void}
 */
export const walk = (node, visit, { intoFunctions = true } = {}) => {
    if (!isNode(node)) return
    visit(node)
    for (const [key, value] of Object.entries(node)) {
        if (SKIP_KEYS.has(key)) continue
        if (Array.isArray(value)) {
            for (const child of value) {
                if (!isNode(child)) continue
                if (!intoFunctions && FUNCTION_TYPES.has(child.type)) continue
                walk(child, visit, { intoFunctions })
            }
        } else if (isNode(value)) {
            if (!intoFunctions && FUNCTION_TYPES.has(value.type)) continue
            walk(value, visit, { intoFunctions })
        }
    }
}

/** True when any node of the subtree satisfies `predicate`. */
export const some = (node, predicate, options) => {
    let found = false
    walk(node, (child) => {
        if (!found && predicate(child)) found = true
    }, options)
    return found
}

/** The name a property key, identifier or string literal spells, else null. */
export const keyName = (node) => {
    if (!node) return null
    if (node.type === "Identifier") return node.name
    if (node.type === "Literal" && typeof node.value === "string") return node.value
    if (node.type === "PrivateIdentifier") return node.name
    return null
}

/** The name of a decorator (`@Foo` or `@Foo(...)`), else null. */
export const decoratorName = (decorator) => {
    const expression = decorator?.expression
    if (!expression) return null
    if (expression.type === "Identifier") return expression.name
    if (expression.type === "CallExpression" && expression.callee.type === "Identifier") return expression.callee.name
    return null
}

/** True for a string literal or a template without substitutions, giving its text via `staticText`. */
export const staticText = (node) => {
    if (!node) return null
    if (node.type === "Literal" && typeof node.value === "string") return node.value
    if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis.map((q) => q.value.cooked ?? "").join("")
    return null
}

/** Splits `webhookSecret`, `WEBHOOK_SECRET` and `webhook-secret` into lower-case words. */
export const wordsOf = (name) =>
    String(name)
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .split(/[^A-Za-z0-9]+/)
        .filter(Boolean)
        .map((word) => word.toLowerCase())
