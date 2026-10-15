import path from "node:path"
import ts from "typescript"
import { functionSubjectExports } from "../runtime/scripts/hfs/architecture/function-spec-providers.mjs"
import { importOf } from "./import-source.mjs"
import { typed } from "./types.mjs"

/** The exported real function of a function-only sibling subject, with aliases resolved by TypeScript. */
const realSubjectFunction = (context, value) => {
    if (value.type !== "Identifier") return null
    const imported = importOf(context, value)
    if (!imported || !imported.source.startsWith(".")) return null
    const { checker, toTs } = typed(context)
    const tsNode = toTs(value)
    const symbol = ts.isShorthandPropertyAssignment(tsNode.parent)
        ? checker.getShorthandAssignmentValueSymbol(tsNode.parent) : checker.getSymbolAtLocation(tsNode)
    const alias = symbol?.declarations?.some(declaration => ts.isImportSpecifier(declaration))
    const target = alias ? checker.getAliasedSymbol(symbol) : symbol
    const declaration = target?.valueDeclaration
    if (!declaration) return null
    const sourceFile = declaration.getSourceFile()
    const sibling = (context.filename || context.getFilename()).replace(/\.spec\.ts$/u, ".ts")
    if (path.resolve(sourceFile.fileName) !== path.resolve(sibling)) return null
    const names = functionSubjectExports(ts, sourceFile)
    return names?.includes(imported.imported) ? imported.imported : null
}

/** Real functions under test are subject values; an inline fake or a collaborator remains a kit double. */
export const isRealSubjectValue = (context, value) => {
    if (value.type === "Identifier") return realSubjectFunction(context, value) !== null
    if (value.type !== "ObjectExpression" || value.properties.length === 0) return false
    return value.properties.every((property) => property.type === "Property" && !property.computed
        && (property.key.name ?? property.key.value) === realSubjectFunction(context, property.value))
}
