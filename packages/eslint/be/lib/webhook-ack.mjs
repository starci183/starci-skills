/** A provider's only POST body is its own exported, immutable literal acknowledgement. */
import ts from "typescript"
import { aliasTarget } from "./doors.mjs"
import { typed } from "./types.mjs"

/** Static wrappers carry a type, never permission to compute the acknowledgement. */
const unwrap = (node) => {
    while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))) node = node.expression
    return node
}

/** A scalar literal includes JSON null and a signed numeric literal, but no identifier or template. */
const scalarLiteral = (node) => {
    if (!node) return false
    if (ts.isStringLiteral(node) || ts.isNumericLiteral(node)) return true
    if ([ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind)) return true
    return ts.isPrefixUnaryExpression(node) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(node.operator) && ts.isNumericLiteral(node.operand)
}

/** Literal data recursively excludes spreads, computed keys, methods, accessors and input references. */
const literalData = (expression) => {
    const node = unwrap(expression)
    if (scalarLiteral(node)) return true
    if (node && ts.isArrayLiteralExpression(node)) return node.elements.every(literalData)
    if (!node || !ts.isObjectLiteralExpression(node)) return false
    return node.properties.every((property) => ts.isPropertyAssignment(property)
        && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name) || ts.isNumericLiteral(property.name))
        && literalData(property.initializer))
}

/** The declaration has a const assertion anywhere in its static initializer wrappers. */
const constAsserted = (expression) => {
    let node = expression
    while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))) {
        if (ts.isAsExpression(node) && ts.isTypeReferenceNode(node.type) && ts.isIdentifier(node.type.typeName) && node.type.typeName.text === "const") return true
        node = node.expression
    }
    return false
}

/** A readonly literal annotation cannot widen the provider's fixed body to arbitrary data. */
const builtinReadonly = (node, services) => {
    if (!ts.isTypeReferenceNode(node) || !ts.isIdentifier(node.typeName) || node.typeName.text !== "Readonly" || node.typeArguments?.length !== 1) return false
    const symbol = services.checker.getSymbolAtLocation(node.typeName)
    return (symbol?.getDeclarations() ?? []).some((declaration) => services.program.isSourceFileDefaultLibrary(declaration.getSourceFile()))
}

/** Readonly's built-in mapped type is trusted; a locally shadowed alias is not. */
const readonlyLiteralType = (node, services, readonly = false) => {
    if (!node) return false
    if (ts.isLiteralTypeNode(node)) return scalarLiteral(node.literal)
    if (ts.isTypeOperatorNode(node) && node.operator === ts.SyntaxKind.ReadonlyKeyword) return readonlyLiteralType(node.type, services, true)
    if (builtinReadonly(node, services)) return readonlyLiteralType(node.typeArguments[0], services, true)
    if (ts.isTupleTypeNode(node)) return readonly && node.elements.every((entry) => readonlyLiteralType(entry, services))
    if (!ts.isTypeLiteralNode(node) || node.members.length === 0) return false
    return node.members.every((member) => ts.isPropertySignature(member) && !member.questionToken
        && (readonly || member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ReadonlyKeyword))
        && readonlyLiteralType(member.type, services))
}

/** The actual symbol is exported by the source module, including a separate export declaration. */
const exportedByModule = (checker, declaration, symbol) => {
    const sourceSymbol = checker.getSymbolAtLocation(declaration.getSourceFile())
    if (!sourceSymbol) return false
    return checker.getExportsOfModule(sourceSymbol).some((entry) => {
        const target = entry.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(entry) : entry
        return entry.name === "PROVIDER_ACK" && target === symbol
    })
}

/** A return names the declared PROVIDER_ACK itself, with identity and ownership resolved by TypeScript/HFS. */
export const isProviderAcknowledgement = (context, hfs, expression) => {
    if (expression?.type !== "Identifier") return false
    const symbol = aliasTarget(context, expression)
    if (!symbol || symbol.name !== "PROVIDER_ACK") return false
    const services = typed(context)
    const { checker } = services
    const owner = hfs.ownerOf(context.filename)
    return (symbol.getDeclarations() ?? []).some((declaration) => {
        if (!ts.isVariableDeclaration(declaration) || !(declaration.parent.flags & ts.NodeFlags.Const)) return false
        if (owner === null || hfs.ownerOf(declaration.getSourceFile().fileName) !== owner) return false
        if (!exportedByModule(checker, declaration, symbol)) return false
        const value = unwrap(declaration.initializer)
        if (!value || !(ts.isObjectLiteralExpression(value) || ts.isStringLiteral(value)) || !literalData(value)) return false
        return constAsserted(declaration.initializer) || readonlyLiteralType(declaration.type, services)
    })
}
