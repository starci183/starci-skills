/**
 * What the test-data laws share: which value is a database receiver, what text a `query` argument carries, and which calls create rows.
 * A receiver is recognised by its TYPE (`EntityManager`, `DataSource`, `QueryRunner` of `typeorm`), never by its name.
 */
import { staticText } from "./ast.mjs"
import { isPackageType } from "./types.mjs"

/** The `typeorm` types a call can write through. */
const RECEIVER_TYPES = Object.freeze(["EntityManager", "DataSource", "QueryRunner"])

/** Statement text that changes rows. */
export const WRITING_SQL = /(?:^|[\s;(])(?:insert\s+into|update\s+["`\w.]+\s+set|delete\s+from|truncate\b)/i

/** Statement text that creates rows. */
export const INSERTING_SQL = /(?:^|[\s;(])insert\s+into\b/i

/**
 * True when the node's type is a typeorm database receiver.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - The receiver expression.
 * @returns {boolean} Whether its type is `EntityManager`, `DataSource` or `QueryRunner` of `typeorm`.
 */
export const isDatabaseReceiver = (context, node) => RECEIVER_TYPES.some((name) => isPackageType(context, node, name, "typeorm"))

/**
 * The statement text of a `query` argument: a literal, a template (substitutions read as a space), a tagged template, or the `const` it names (one hop).
 *
 * @param {object | undefined} node - The argument.
 * @param {object | null} scope - The scope the argument is read in (null after the one hop).
 * @returns {string | null} The text, or null when it cannot be read statically.
 */
export const queryText = (node, scope) => {
    if (!node) return null
    if (node.type === "TemplateLiteral") return node.quasis.map((quasi) => quasi.value.cooked ?? "").join(" ")
    if (node.type === "TaggedTemplateExpression") return queryText(node.quasi, null)
    const direct = staticText(node)
    if (direct !== null) return direct
    if (node.type !== "Identifier") return null
    for (let reference = scope; reference; reference = reference.upper) {
        const variable = reference.set.get(node.name)
        if (!variable) continue
        const definition = variable.defs[0]?.node
        return definition?.type === "VariableDeclarator" && definition.init ? queryText(definition.init, null) : null
    }
    return null
}

/**
 * The member name of a call `receiver.method(...)`, or null for any other callee.
 *
 * @param {object} node - A CallExpression.
 * @returns {string | null} The method name.
 */
export const methodOf = (node) => {
    const callee = node.callee
    return callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" ? callee.property.name : null
}
