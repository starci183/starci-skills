import fs from "node:fs"
import path from "node:path"
import ts from "typescript"
import { functionSubjectExports, valueObjectSubjects } from "../runtime/scripts/hfs/architecture/function-spec-providers.mjs"
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

const VALUE_OBJECTS = new Map()

/** The sibling module's value-object classes (undecorated, no constructor injection token), read from disk once per file; `[]` when none. */
export const valueObjectsOfSibling = (context) => {
    const sibling = path.resolve((context.filename || context.getFilename()).replace(/\.spec\.ts$/u, ".ts"))
    const stamp = fs.existsSync(sibling) ? fs.statSync(sibling).mtimeMs : -1
    const cached = VALUE_OBJECTS.get(sibling)
    if (cached?.stamp === stamp) return cached.names
    const names = stamp < 0 ? [] : valueObjectSubjects(ts, ts.createSourceFile(sibling, fs.readFileSync(sibling, "utf8"), ts.ScriptTarget.Latest, true)) ?? []
    VALUE_OBJECTS.set(sibling, { stamp, names })
    return names
}

/** `new Subject(...)` where Subject is a value-object class imported from the sibling module. */
const isValueObjectSubject = (context, value) => {
    if (value.type !== "NewExpression" || value.callee.type !== "Identifier") return false
    const imported = importOf(context, value.callee)
    return Boolean(imported && imported.source.startsWith(".") && valueObjectsOfSibling(context).includes(imported.imported))
}

/** Real functions under test are subject values; an inline fake or a collaborator remains a kit double. */
export const isRealSubjectValue = (context, value) => {
    if (isValueObjectSubject(context, value)) return true
    if (value.type === "Identifier") return realSubjectFunction(context, value) !== null
    if (value.type !== "ObjectExpression" || value.properties.length === 0) return false
    return value.properties.every((property) => property.type === "Property" && !property.computed
        && (property.key.name ?? property.key.value) === realSubjectFunction(context, property.value))
}
