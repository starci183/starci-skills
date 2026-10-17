/**
 * The owner exports an auth callback may use besides the exchange (R287 `FE_CALLBACK_SHAPE`, owner ruling `auth-callback-pure-helpers`,
 * 2026-10-17 "Theo y tro"): a PURE helper of the app's `modules/routes` or `modules/auth` that computes the redirect target or validates
 * `next`, and a static route table. Both are found by TypeScript symbol resolution to the declaration, never by the spelling of the name.
 *
 * A pure helper is a synchronous function that returns text (or null), holds no `await` or `yield`, reaches no I/O global (network, storage,
 * DOM, `process`, `require`, `console`) and calls only locals, language built-ins and other pure helpers of `modules/routes` or
 * `modules/auth` (followed through barrels). `modules/config` is the environment owner: a call to its readers is a configuration read, not I/O.
 * Anything else it imports, a library value included, makes it impure.
 */
import ts from "typescript"
import { reaching } from "./own-hook-origin.mjs"
import { programFor } from "./program-for.mjs"
import { resolveImport } from "./scope.mjs"

/** Globals that reach the network, storage, the page, the process or the console. */
const IO_GLOBALS = new Set(["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "Request", "navigator", "localStorage", "sessionStorage", "indexedDB", "document", "window", "self", "globalThis", "process", "require", "console", "setTimeout", "setInterval", "queueMicrotask", "Worker", "BroadcastChannel"])

const OWNER_FILE = /\/modules\/(?:routes|auth)(?:\/|\.tsx?$)/
const CONFIG_FILE = /\/modules\/config(?:\/|\.tsx?$)/
const EXTENSIONS = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]

const normal = (file) => file.fileName.replaceAll("\\", "/")

/** The module file an import specifier names, or null when none exists on disk. */
const moduleFile = (context, source) => {
  const target = resolveImport(context, source)
  if (target === null) return null
  return EXTENSIONS.map((extension) => `${target}${extension}`).find((candidate) => ts.sys.fileExists(candidate)) ?? null
}

/** The declaration an export of the module resolves to, after barrels and re-exports. */
const exportedDeclaration = (context, source, name) => {
  const file = moduleFile(context, source)
  if (file === null) return null
  const program = reaching(programFor(context), context.filename, file)
  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(file)
  const moduleSymbol = sourceFile && checker.getSymbolAtLocation(sourceFile)
  const exported = moduleSymbol && checker.getExportsOfModule(moduleSymbol).find((symbol) => symbol.name === name)
  if (!exported) return null
  const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
  return { checker, declaration: symbol.declarations?.[0] ?? null }
}

/** Strip `as`, `satisfies` and parentheses. */
const bare = (node) => {
  let current = node
  while (current && (ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isParenthesizedExpression(current))) current = current.expression
  return current
}

/** The function-like node of a function declaration or of a variable initialised with an arrow or function expression. */
const functionOf = (declaration) => {
  if (ts.isFunctionDeclaration(declaration)) return declaration
  const init = ts.isVariableDeclaration(declaration) ? bare(declaration.initializer) : null
  return init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) ? init : null
}

const isInside = (node, root) => node.getSourceFile() === root.getSourceFile() && node.pos >= root.pos && node.end <= root.end

/** Whether an identifier names a declaration, a property or a member rather than referring to a binding. */
const isNameOnly = (node) => {
  const parent = node.parent
  if (ts.isPropertyAccessExpression(parent)) return parent.name === node
  if (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertySignature(parent)) return parent.name === node
  return (ts.isParameter(parent) || ts.isVariableDeclaration(parent) || ts.isFunctionDeclaration(parent) || ts.isBindingElement(parent)) && parent.name === node
}

/** A declaration of another file: an owner helper is followed, the environment owner is a leaf, everything else is impure. */
const foreignPure = (env, declaration, root) => {
  const file = normal(declaration.getSourceFile())
  if (CONFIG_FILE.test(file)) return true
  if (!OWNER_FILE.test(file) || declaration.getSourceFile().isDeclarationFile) return false
  return declarationPure(env, declaration, root)
}

/** A global of the language or of the lib files is pure unless it reaches I/O. */
const globalPure = (symbol) => !IO_GLOBALS.has(symbol.getName())

/** Whether one identifier reference stays inside the pure surface. */
const referencePure = (env, node, root) => {
  const symbol = env.checker.getSymbolAtLocation(node)
  if (!symbol) return node.text === "undefined"
  const target = symbol.flags & ts.SymbolFlags.Alias ? env.checker.getAliasedSymbol(symbol) : symbol
  const declarations = target.declarations ?? []
  if (declarations.length === 0) return node.text === "undefined"
  return declarations.every((declaration) => {
    const file = declaration.getSourceFile()
    if (isInside(declaration, root)) return true
    if (!ts.isExternalModule(file)) return globalPure(target)
    return foreignPure(env, declaration, root)
  })
}

/** Walk a node: no await or yield, no impure reference; type positions are not behaviour. */
const nodePure = (env, node, root) => {
  if (ts.isAwaitExpression(node) || ts.isYieldExpression(node)) return false
  if (ts.isTypeNode(node) && !ts.isExpressionWithTypeArguments(node)) return true
  if (ts.isIdentifier(node) && !isNameOnly(node) && !referencePure(env, node, root)) return false
  return ts.forEachChild(node, (child) => (nodePure(env, child, root) ? undefined : true)) !== true
}

/** A declaration is pure when its function (or its constant initialiser) is. */
function declarationPure(env, declaration, root) {
  if (env.seen.has(declaration)) return true
  env.seen.add(declaration)
  const fn = functionOf(declaration)
  if (fn) return !fn.asteriskToken && !fn.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword) && (fn.body ? nodePure(env, fn.body, fn) : false)
  if (ts.isVariableDeclaration(declaration) && declaration.initializer) return nodePure(env, declaration.initializer, declaration.initializer)
  return false
}

/** Whether a function's declared or inferred return type is text, null or undefined. */
const returnsText = (checker, declaration) => {
  const signature = checker.getSignaturesOfType(checker.getTypeAtLocation(declaration), ts.SignatureKind.Call)[0]
  if (!signature) return false
  const type = checker.getReturnTypeOfSignature(signature)
  const parts = type.isUnion() ? type.types : [type]
  return parts.every((part) => part.flags & (ts.TypeFlags.StringLike | ts.TypeFlags.Null | ts.TypeFlags.Undefined))
}

/** A static table: a constant object whose leaves are string literals or plain templates. */
const isStaticTable = (node) => {
  const value = bare(node)
  if (!value) return false
  if (ts.isStringLiteralLike(value)) return true
  if (ts.isObjectLiteralExpression(value)) return value.properties.every((property) => ts.isPropertyAssignment(property) && isStaticTable(property.initializer))
  return false
}

/**
 * What an import of the callback's owner modules is: `"pure"` (a pure text-returning helper), `"routes"` (a static route table) or null.
 *
 * @param {object} context - The ESLint rule context.
 * @param {string} source - The import specifier.
 * @param {string} name - The imported name.
 * @returns {"pure" | "routes" | null} The kind.
 */
export function ownerExportKind(context, source, name) {
  const found = exportedDeclaration(context, source, name)
  if (!found?.declaration) return null
  const { checker, declaration } = found
  if (ts.isVariableDeclaration(declaration) && !functionOf(declaration)) return declaration.parent.flags & ts.NodeFlags.Const && isStaticTable(declaration.initializer) ? "routes" : null
  const fn = functionOf(declaration)
  const env = { checker, seen: new Set() }
  return fn && returnsText(checker, fn) && declarationPure(env, declaration, fn) ? "pure" : null
}
