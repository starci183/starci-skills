/** R263: a receipt transaction records and publishes; a reactor/job processes after commit. */
import ts from "typescript"
import { baseName } from "./ports.mjs"
import { originsOfType, typed } from "./types.mjs"

/** Imported aliases and overload signatures retain the implementation's actual body. */
const bodiesOf = (checker, call) => {
    const expression = call.expression
    let name = expression
    if (ts.isPropertyAccessExpression(expression)) name = expression.name
    if (ts.isElementAccessExpression(expression)) name = expression.argumentExpression
    const symbol = checker.getSymbolAtLocation(name)
    const target = symbol?.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    const declarations = [checker.getResolvedSignature(call)?.declaration, ...(target?.getDeclarations() ?? [])]
    return [...new Set(declarations.map((declaration) => declaration?.body ?? declaration?.initializer?.body).filter(Boolean))]
}

/** Receiver ownership is established by its declared type, including aliases and inherited ports. */
const hasOrigin = (checker, receiver, accepts, seen = new Set()) => {
    const type = receiver && checker.getTypeAtLocation(receiver)
    const read = (current) => {
        if (!current || seen.has(current)) return false
        seen.add(current)
        if (originsOfType(checker, current).some(accepts)) return true
        const parts = current.isUnionOrIntersection() ? current.types : []
        const bases = current.isClassOrInterface() ? checker.getBaseTypes(current) ?? [] : []
        return [...parts, ...bases].some(read)
    }
    return read(type)
}

/** Bracket access with a literal key has the same meaning as a dotted method/property. */
const memberName = (expression) => {
    if (ts.isPropertyAccessExpression(expression)) return expression.name.text
    if (ts.isElementAccessExpression(expression) && ts.isStringLiteralLike(expression.argumentExpression)) return expression.argumentExpression.text
    return null
}

/** A callback named process is the former in-transaction processing contract, including aliases and methods. */
const isProcessCallback = (checker, node) => {
    if (!(ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node) || ts.isMethodDeclaration(node))) return false
    const name = ts.isComputedPropertyName(node.name) ? node.name.expression : node.name
    if (!(ts.isIdentifier(name) || ts.isStringLiteralLike(name)) || name.text !== "process") return false
    return !!node.body || checker.getTypeAtLocation(node.initializer ?? node.name).getCallSignatures().length > 0
}

/** Persisting receipt data and publishing through platform ports are allowed; domain/CQRS processing is deferred. */
const isBusinessOrigin = (hfs, origin) => {
    if (origin.module === "@nestjs/cqrs") return ["CommandBus", "QueryBus"].includes(origin.name)
    return origin.module === null && hfs.tierOf(origin.file) === "domain" && baseName(origin.file).endsWith(".service.ts")
}

/** The transaction port's package establishes when the callback runs before commit. */
const isTransactionCall = (checker, call, receiver) => memberName(call.expression) === "transaction"
    && hasOrigin(checker, receiver, (origin) => origin.module === "typeorm" && ["EntityManager", "DataSource"].includes(origin.name))

/** Extracting, binding or destructuring a method preserves its domain/bus receiver. */
const isBusinessCall = (checker, hfs, expression, seen = new Set()) => {
    if (!expression || seen.has(expression)) return false
    seen.add(expression)
    const accepts = (origin) => isBusinessOrigin(hfs, origin)
    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) return isBusinessCall(checker, hfs, expression.expression, seen)
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
        if (hasOrigin(checker, expression.expression, accepts)) return true
        if (["bind", "call", "apply"].includes(memberName(expression))) return isBusinessCall(checker, hfs, expression.expression, seen)
    }
    if (ts.isCallExpression(expression)) return isBusinessCall(checker, hfs, expression.expression, seen)
    const name = ts.isPropertyAccessExpression(expression) ? expression.name
        : ts.isElementAccessExpression(expression) ? expression.argumentExpression : expression
    const symbol = checker.getSymbolAtLocation(name)
    const target = symbol?.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
    return target?.getDeclarations()?.some((declaration) => {
        if (ts.isBindingElement(declaration)) return hasOrigin(checker, declaration.parent.parent.initializer, accepts)
        return isBusinessCall(checker, hfs, declaration.initializer, seen)
    }) ?? false
}

/** Passing a const callback into transaction does not move its work past commit. */
const callbackBodies = (checker, expression, seen = new Set()) => {
    if (!expression || seen.has(expression)) return []
    seen.add(expression)
    if (expression.body) return [expression.body]
    if (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression)) return callbackBodies(checker, expression.expression, seen)
    if (ts.isCallExpression(expression) && memberName(expression.expression) === "bind") return callbackBodies(checker, expression.expression.expression, seen)
    const reference = ts.isPropertyAccessExpression(expression) ? expression.name : expression
    const symbol = checker.getSymbolAtLocation(reference)
    return symbol?.getDeclarations()?.flatMap((declaration) => declaration.body ? [declaration.body] : callbackBodies(checker, declaration.initializer, seen)) ?? []
}

/** Old inline process callbacks and business dispatch inside the receipt transaction violate handoff. */
const processesDelivery = (checker, hfs, body) => {
    let found = false
    const visited = [new Set(), new Set()]
    const visit = (node, inTransaction = false) => {
        const nodes = visited[Number(inTransaction)]
        if (found || nodes.has(node)) return
        nodes.add(node)
        if (isProcessCallback(checker, node)) found = true
        if (ts.isCallExpression(node)) {
            if (inTransaction && isBusinessCall(checker, hfs, node.expression)) found = true
            const member = ts.isPropertyAccessExpression(node.expression) || ts.isElementAccessExpression(node.expression)
            if (member && isTransactionCall(checker, node, node.expression.expression)) {
                for (const argument of node.arguments) {
                    visit(argument, true)
                    for (const callback of callbackBodies(checker, argument)) visit(callback, true)
                }
                return
            }
            if (inTransaction) for (const callback of callbackBodies(checker, node.expression)) visit(callback, true)
        }
        ts.forEachChild(node, (child) => visit(child, inTransaction))
    }
    visit(body)
    return found
}

/** Inspect the linted intake method or the implementation resolved at a webhook door's domain call. */
export const webhookIntakeProcessesDelivery = (context, hfs, node) => {
    const { checker, toTs } = typed(context)
    const reference = toTs(node)
    if (!reference) return false
    let bodies = reference.body ? [reference.body] : []
    if (ts.isCallExpression(reference)) bodies = [reference, ...bodiesOf(checker, reference)]
    return bodies.some((body) => processesDelivery(checker, hfs, body))
}
