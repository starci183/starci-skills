/**
 * Type-aware helpers: a rule asks what a node IS (its TypeScript type and where that type is declared), never what it
 * is called. `starciBeConfig` turns typed linting on for every file (`parserOptions.projectService`), so these
 * helpers refuse to run without the program instead of falling back to a name match: a rule that silently degrades to
 * a heuristic is the loophole the owner closed.
 */
import ts from "typescript"

/**
 * The TypeScript services of the file being linted.
 *
 * @param {object} context - The ESLint rule context.
 * @returns {{ program: object, checker: object, toTs: (node: object) => object }} The program, its checker and the ESTree to TS node map.
 */
export const typed = (context) => {
    const services = context.sourceCode?.parserServices ?? context.parserServices
    if (!services?.program || !services.esTreeNodeToTSNodeMap) {
        throw new Error(`${context.id ?? "a starci-be rule"} needs typed linting (parserOptions.projectService); lint through starciBeConfig, which turns it on`)
    }
    const program = services.program
    return { program, checker: program.getTypeChecker(), toTs: (node) => services.esTreeNodeToTSNodeMap.get(node) }
}

/** The declarations of a type's symbol after alias resolution (an imported type alias resolves to its target). */
const declarationsOf = (checker, type) => {
    if (!type) return []
    let symbol = type.aliasSymbol ?? type.getSymbol?.()
    if (!symbol) return []
    if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
    return symbol.getDeclarations?.() ?? []
}

/**
 * Where the type of an ESTree node (or of a type annotation node) is declared.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - An expression, identifier, parameter or type node.
 * @returns {Array<{ name: string, file: string, module: string | null }>} Each declaration's symbol name, forward-slash file path and package; `[]` for a primitive or an anonymous type.
 */
export const typeOrigins = (context, node) => {
    const { checker, toTs } = typed(context)
    const tsNode = toTs(node)
    if (!tsNode) return []
    const type = ts.isTypeNode(tsNode) ? checker.getTypeFromTypeNode(tsNode) : checker.getTypeAtLocation(tsNode)
    const parts = type?.isUnion?.() ? type.types : [type]
    return parts.flatMap((part) => declarationsOf(checker, part).map((declaration) => {
        const file = String(declaration.getSourceFile().fileName).replace(/\\/g, "/")
        return { name: declaration.name && ts.isIdentifier(declaration.name) ? declaration.name.text : "", file, module: moduleOf(declaration, file) }
    }))
}

/**
 * The package a declaration belongs to: the name of an enclosing `declare module "<pkg>"`, else the package directory
 * of a `node_modules/<pkg>/` (or `node_modules/@scope/<pkg>/`) file, else null for the repository's own source.
 */
const moduleOf = (declaration, file) => {
    for (let node = declaration.parent; node; node = node.parent) {
        if (ts.isModuleDeclaration(node) && ts.isStringLiteral(node.name)) return node.name.text
    }
    const match = /\/node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(file)
    return match ? match[1] : null
}

/**
 * True when the node's type is the named type declared in a file whose path satisfies `fromFile`.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - The node to type.
 * @param {string} name - The declared symbol name (`EntityManager`).
 * @param {(file: string) => boolean} [fromFile] - Filter on the declaring file (a package path, a slot).
 * @returns {boolean} Whether one of the node's type origins matches.
 */
export const isTypeNamed = (context, node, name, fromFile = () => true) =>
    typeOrigins(context, node).some((origin) => origin.name === name && fromFile(origin.file))

/**
 * True when the node's type is `name` declared by the package `pkg` (`typeorm`, `@nestjs/cqrs`).
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - The node to type.
 * @param {string} name - The declared symbol name.
 * @param {string} pkg - The package that declares it.
 * @returns {boolean} Whether the node's type is that package's `name`.
 */
export const isPackageType = (context, node, name, pkg) =>
    typeOrigins(context, node).some((origin) => origin.name === name && origin.module === pkg)
