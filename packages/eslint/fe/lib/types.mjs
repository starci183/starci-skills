/**
 * Type-aware helpers of the front-end canon: a rule asks what a node IS (its TypeScript type, the symbol an identifier
 * resolves to, the module a declaration comes from), never what it is called. `starciFeConfig` turns typed linting on for
 * the source tree (`parserOptions.projectService`), so these helpers refuse to run without the program instead of falling
 * back to a name match.
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
    throw new Error(`${context.id ?? "a starci-fe rule"} needs typed linting (parserOptions.projectService); lint through starciFeConfig, which turns it on`)
  }
  const program = services.program
  return { program, checker: program.getTypeChecker(), toTs: (node) => services.esTreeNodeToTSNodeMap.get(node) }
}

/**
 * True when the type of an expression is a promise (a thenable carrying a `then` method), after union members are read.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - An ESTree expression.
 * @returns {boolean} Whether evaluating the node yields a promise.
 */
export const isPromiseValued = (context, node) => {
  const { checker, toTs } = typed(context)
  const tsNode = toTs(node)
  if (!tsNode) return false
  const type = checker.getTypeAtLocation(tsNode)
  const parts = type.isUnion?.() ? type.types : [type]
  return parts.some((part) => Boolean(part.getProperty?.("then")))
}

/**
 * The declarations the symbol of an identifier resolves to, after import aliases are followed.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} identifier - An ESTree identifier (or any node with a symbol).
 * @returns {Array<object>} The TypeScript declarations (empty when the checker has no symbol).
 */
export const declarationsOf = (context, identifier) => {
  const { checker, toTs } = typed(context)
  const tsNode = toTs(identifier)
  if (!tsNode) return []
  let symbol = checker.getSymbolAtLocation(tsNode)
  if (!symbol) return []
  if (symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol)
  return symbol.getDeclarations?.() ?? []
}

/**
 * The forward-slash file name a declaration lives in.
 *
 * @param {object} declaration - A TypeScript declaration.
 * @returns {string} Its source file name.
 */
export const fileOf = (declaration) => String(declaration.getSourceFile().fileName).split("\\").join("/")
