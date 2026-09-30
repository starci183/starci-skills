/**
 * Import-owner helpers: what a name written in a file IS, by the import that binds it, never by how it is spelled.
 *
 * `import { CommandHandler as Handler } from "@nestjs/cqrs"` and `import { CommandHandler } from "@nestjs/cqrs"` are the
 * same decorator; a local class that happens to be called `CommandHandler` is not. A rule that asks
 * `importOf(context, identifier)` sees that difference and a rule that compares identifier text does not.
 */

const textOf = (node) => (node?.type === "Identifier" ? node.name : node?.type === "Literal" ? String(node.value) : null)

/**
 * The import an identifier resolves to.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} identifier - An `Identifier` node in a value or decorator position.
 * @returns {{ source: string, imported: string } | null} The module specifier and the exported name (`*` for a namespace import, `default` for a default import), or null when the name is not an import binding.
 */
export const importOf = (context, identifier) => {
    if (identifier?.type !== "Identifier") return null
    for (let scope = context.sourceCode.getScope(identifier); scope; scope = scope.upper) {
        const variable = scope.set.get(identifier.name)
        if (!variable) continue
        const definition = variable.defs[0]
        if (definition?.type !== "ImportBinding") return null
        const specifier = definition.node
        const source = definition.parent.source.value
        if (specifier.type === "ImportSpecifier") return { source, imported: textOf(specifier.imported) }
        if (specifier.type === "ImportNamespaceSpecifier") return { source, imported: "*" }
        return { source, imported: "default" }
    }
    return null
}

/**
 * True when an expression is `name` exported by `source`, whether written as the imported (possibly renamed) identifier
 * or as a member of a namespace import of that module.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} expression - An `Identifier` or `MemberExpression` node.
 * @param {string | ReadonlyArray<string>} sources - The module specifier or specifiers.
 * @param {string | ReadonlyArray<string>} names - The exported name or names.
 * @returns {boolean} Whether the expression is one of those exports.
 */
export const isImportedFrom = (context, expression, sources, names) => {
    const wantedSources = [].concat(sources)
    const wantedNames = [].concat(names)
    if (expression?.type === "Identifier") {
        const found = importOf(context, expression)
        return found !== null && wantedSources.includes(found.source) && wantedNames.includes(found.imported)
    }
    if (expression?.type === "MemberExpression" && !expression.computed && expression.object.type === "Identifier") {
        const found = importOf(context, expression.object)
        return found !== null && found.imported === "*" && wantedSources.includes(found.source) && wantedNames.includes(textOf(expression.property))
    }
    return false
}

/** The called expression of a decorator: `@Foo` and `@Foo(...)` both give `Foo`. */
export const decoratorCallee = (decorator) => {
    const expression = decorator?.expression
    return expression?.type === "CallExpression" ? expression.callee : expression ?? null
}

/** The arguments of a decorator (`[]` for a bare `@Foo`). */
export const decoratorArguments = (decorator) => (decorator?.expression?.type === "CallExpression" ? decorator.expression.arguments : [])

/**
 * Visitors that report every place a file names another module: a static import, an `export ... from`, a dynamic
 * `import()`, `import x = require()` and a `require()` call with a literal argument.
 *
 * @param {(reference: { node: object, source: object, value: string, names: ReadonlyArray<string> }) => void} onReference - Called once per reference; `names` are the exported names taken (`*` for a whole module).
 * @returns {object} An ESLint visitor object.
 */
export const moduleReferences = (onReference) => {
    const literal = (node) => (node?.type === "Literal" && typeof node.value === "string" ? node.value : node?.type === "TemplateLiteral" && node.expressions.length === 0 ? node.quasis[0].value.cooked : null)
    return {
        ImportDeclaration(node) {
            const names = node.specifiers.map((specifier) => specifier.type === "ImportSpecifier" ? textOf(specifier.imported) : specifier.type === "ImportNamespaceSpecifier" ? "*" : "default")
            onReference({ node, source: node.source, value: node.source.value, names: names.length > 0 ? names : ["*"] })
        },
        ExportNamedDeclaration(node) {
            if (!node.source) return
            onReference({ node, source: node.source, value: node.source.value, names: node.specifiers.map((specifier) => textOf(specifier.local)) })
        },
        ExportAllDeclaration(node) {
            onReference({ node, source: node.source, value: node.source.value, names: ["*"] })
        },
        ImportExpression(node) {
            const value = literal(node.source)
            if (value !== null) onReference({ node, source: node.source, value, names: ["*"] })
        },
        CallExpression(node) {
            if (node.callee.type !== "Identifier" || node.callee.name !== "require") return
            const value = literal(node.arguments[0])
            if (value !== null) onReference({ node, source: node.arguments[0], value, names: ["*"] })
        },
        TSImportEqualsDeclaration(node) {
            const reference = node.moduleReference
            if (reference.type !== "TSExternalModuleReference") return
            const value = literal(reference.expression)
            if (value !== null) onReference({ node, source: reference.expression, value, names: ["*"] })
        },
    }
}
