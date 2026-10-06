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

/**
 * The declarations of a type: those of its alias (a written `type Repo = Repository<T>`) and those of its own symbol, each
 * after alias resolution (an imported type alias resolves to its target). Both are origins, so a rename by alias hides nothing.
 */
const declarationsOf = (checker, type) => {
    if (!type) return []
    return [type.aliasSymbol, type.getSymbol?.()].flatMap((symbol) => {
        if (!symbol) return []
        const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
        return target.getDeclarations?.() ?? []
    })
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
    return originsOfType(checker, ts.isTypeNode(tsNode) ? checker.getTypeFromTypeNode(tsNode) : checker.getTypeAtLocation(tsNode))
}

/**
 * Where a TypeScript type is declared, for a rule that already holds a type from the checker (an alias argument, a call signature return).
 *
 * @param {object} checker - The program's type checker.
 * @param {object} type - A TypeScript type.
 * @returns {Array<{ name: string, file: string, module: string | null }>} The declaration origins, as `typeOrigins` returns them.
 */
export const originsOfType = (checker, type) => {
    const parts = type?.isUnion?.() ? type.types : [type]
    return parts.flatMap((part) => declarationsOf(checker, part).map((declaration) => {
        const file = String(declaration.getSourceFile().fileName).replaceAll("\\", "/")
        return { name: declaration.name && ts.isIdentifier(declaration.name) ? declaration.name.text : "", file, module: moduleOf(declaration, file) }
    }))
}

/**
 * The package a declaration belongs to: the name of an enclosing `declare module "<pkg>"`, else the package directory
 * of a `node_modules/<pkg>/` (or `node_modules/@scope/<pkg>/`) file, else null for the repository's own source.
 */
export const moduleOf = (declaration, file) => {
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

/**
 * The package that declares the value an expression names (`APP_GUARD` and `Injectable` of `@nestjs/*`), after alias resolution, or
 * null for the repository's own declaration, an unresolved name or an expression that names no symbol.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - An identifier, member expression or call (its callee is read).
 * @returns {string | null} The package name.
 */
export const packageOfExport = (context, node) => {
    const { checker, toTs } = typed(context)
    let tsNode = toTs(node)
    if (!tsNode) return null
    if (ts.isCallExpression(tsNode)) tsNode = tsNode.expression
    const symbol = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(tsNode) ? tsNode.name : tsNode)
    if (!symbol) return null
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    for (const declaration of target.getDeclarations?.() ?? []) {
        const module = moduleOf(declaration, String(declaration.getSourceFile().fileName).replaceAll("\\", "/"))
        if (module !== null) return module
    }
    return null
}

/**
 * True when the node is a reference to a value the package `pkg` exports (`APP_GUARD` of `@nestjs/core`). A local constant of the same name is not.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - An identifier or member expression.
 * @param {string} pkg - The package that must declare the referenced value.
 * @returns {boolean} Whether the node references an export of that package.
 */
export const isPackageExport = (context, node, pkg) => packageOfExport(context, node) === pkg
