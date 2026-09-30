/**
 * Platform APIs of the front-end canon, decided by resolution: an identifier or member is "the platform's" when the
 * TypeScript symbol it binds to is declared in a default library file or in an ambient global declaration, so a local
 * function that happens to be called `setTimeout` or `fetch` is not mistaken for the browser's.
 */
import ts from "typescript"
import { typed } from "./types.mjs"

/** True when a declaration sits in the default lib, in a global script declaration file, or in a `declare global` block. */
const isGlobalDeclaration = (program, declaration) => {
  const file = declaration.getSourceFile()
  if (program.isSourceFileDefaultLibrary(file)) return true
  for (let current = declaration.parent; current; current = current.parent) {
    if (ts.isModuleDeclaration(current) && current.flags & ts.NodeFlags.GlobalAugmentation) return true
  }
  return file.isDeclarationFile && !ts.isExternalModule(file)
}

/**
 * True when the symbol at a node (an identifier, or the property of a member access) is declared by the platform.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - An ESTree identifier, or a member expression (its property is asked).
 * @returns {boolean} Whether every declaration of the symbol is a platform (global, ambient) declaration.
 */
export const isPlatform = (context, node) => {
  const { program, checker, toTs } = typed(context)
  const target = node.type === "MemberExpression" ? node.property : node
  const tsNode = toTs(target)
  if (!tsNode) return false
  const symbol = checker.getSymbolAtLocation(tsNode)
  const declarations = symbol?.getDeclarations?.() ?? []
  return declarations.length > 0 && declarations.every((declaration) => isGlobalDeclaration(program, declaration))
}

/**
 * True when the type of an expression carries no information (`any`, `unknown` or an error type).
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - An ESTree expression.
 * @returns {boolean} Whether the checker could not decide what the expression is.
 */
export const isUnresolvedType = (context, node) => {
  const { checker, toTs } = typed(context)
  const tsNode = toTs(node)
  if (!tsNode) return true
  const type = checker.getTypeAtLocation(tsNode)
  return Boolean(type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown))
}

/**
 * The property names of the type of an expression, after union members are read.
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} node - An ESTree expression.
 * @returns {Set<string>} The names of the properties every member of the type could carry.
 */
export const propertyNamesOf = (context, node) => {
  const { checker, toTs } = typed(context)
  const tsNode = toTs(node)
  const names = new Set()
  if (!tsNode) return names
  const type = checker.getTypeAtLocation(tsNode)
  for (const part of type.isUnion?.() ? type.types : [type]) for (const property of part.getProperties?.() ?? []) names.add(property.getName())
  return names
}
