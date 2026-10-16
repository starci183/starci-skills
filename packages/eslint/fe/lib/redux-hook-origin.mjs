/** Resolve typed Redux hook factories by their import provenance, never by a local use* name. */
import ts from "typescript"
import path from "node:path"

const REDUX_HOOKS = new Set(["useSelector", "useDispatch", "useStore"])
const programs = new WeakMap()

function programFor(context) {
  if (programs.has(context)) return programs.get(context)
  const services = context.sourceCode?.parserServices
  if (services?.program) return services.program
  const filename = context.filename
  const configPath = ts.findConfigFile(path.dirname(filename), ts.sys.fileExists)
  let options = { moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext }
  if (configPath) {
    const config = ts.readConfigFile(configPath, ts.sys.readFile)
    options = { ...options, ...ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath)).options }
  }
  const program = ts.createProgram([filename], options)
  programs.set(context, program)
  return program
}

function reduxImport(declaration) {
  if (!ts.isImportSpecifier(declaration) || declaration.isTypeOnly) return false
  const clause = declaration.parent.parent
  return !clause.isTypeOnly && clause.parent.moduleSpecifier.text === "react-redux"
    && REDUX_HOOKS.has((declaration.propertyName ?? declaration.name).text)
}

function typedFactory(checker, declaration) {
  if (!ts.isVariableDeclaration(declaration) || !(declaration.parent.flags & ts.NodeFlags.Const)) return false
  const call = declaration.initializer
  if (!call || !ts.isCallExpression(call) || call.arguments.length !== 0) return false
  const member = call.expression
  return ts.isPropertyAccessExpression(member) && member.name.text === "withTypes"
    && reduxBinding(checker, member.expression)
}

function reduxBinding(checker, node) {
  const symbol = checker.getSymbolAtLocation(node)
  return (symbol?.declarations ?? []).some(reduxImport)
}

/** A relative/barrel import must resolve to a const initialized by a real Redux hook's withTypes(). */
export function importedReduxHook(context, definition) {
  const specifier = definition.node
  if (specifier.type !== "ImportSpecifier" || definition.parent.importKind === "type" || specifier.importKind === "type") return false
  const source = String(definition.parent.source.value)
  const name = specifier.imported.name ?? specifier.imported.value
  if (source === "react-redux") return REDUX_HOOKS.has(name)
  const program = programFor(context)
  const target = ts.resolveModuleName(source, context.filename, program.getCompilerOptions(), ts.sys).resolvedModule
  const file = target && program.getSourceFile(target.resolvedFileName)
  const checker = program.getTypeChecker()
  const moduleSymbol = file && checker.getSymbolAtLocation(file)
  const exported = moduleSymbol && checker.getExportsOfModule(moduleSymbol).find(symbol => symbol.name === name)
  if (!exported) return false
  const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported
  return (symbol.declarations ?? []).some(declaration => typedFactory(checker, declaration))
}
