/**
 * What the door rules of the feature kinds (webhooks, realtime) read from a class: what is injected into it, which methods
 * the framework enters, and which expression a call is made on. Every answer comes from a decorator's import, a value's
 * declared type or a declaration's origin, never from a spelling.
 */
import ts from "typescript"
import { walk } from "./ast.mjs"
import { decoratorCallee, importOf, isImportedFrom } from "./import-source.mjs"
import { typed } from "./types.mjs"

/** True when the class carries a decorator that is `name` exported by `source`. */
export const hasClassDecorator = (context, node, source, name) =>
    (node.decorators ?? []).some((decorator) => isImportedFrom(context, decoratorCallee(decorator), source, name))

/** The decorators of a method or class that are one of `names` exported by `source`. */
export const decoratorsFrom = (context, node, source, names) =>
    (node.decorators ?? []).filter((decorator) => isImportedFrom(context, decoratorCallee(decorator), source, names))

/**
 * Every value injected into a class: a constructor parameter (plain or a parameter property) and a property that
 * carries a decorator which injects (`Inject` of Nest, a `@nestjs/typeorm` injector or a function declared in a
 * `*.decorators.ts` file).
 *
 * @param {object} context - The ESLint rule context.
 * @param {object} classNode - A `ClassDeclaration`.
 * @returns {Array<{ node: object, annotation: object | undefined }>} The injected members, each with its declared type annotation.
 */
export const injectedMembers = (context, classNode) => {
    const members = []
    const constructor = classNode.body.body.find((member) => member.type === "MethodDefinition" && member.kind === "constructor")
    for (const original of constructor?.value.params ?? []) {
        const param = original.type === "TSParameterProperty" ? original.parameter : original
        members.push({ node: original, annotation: param.typeAnnotation?.typeAnnotation })
    }
    for (const member of classNode.body.body) {
        if (member.type !== "PropertyDefinition" || !(member.decorators ?? []).some((decorator) => isInjectorDecorator(context, decorator))) continue
        members.push({ node: member, annotation: member.typeAnnotation?.typeAnnotation })
    }
    return members
}

/** True for a decorator that injects: `Inject` of Nest, a `@nestjs/typeorm` injector, or a function declared in a `*.decorators.ts` file. */
const isInjectorDecorator = (context, decorator) => {
    const callee = decoratorCallee(decorator)
    if (callee?.type !== "Identifier") return false
    const found = importOf(context, callee)
    if (found?.source === "@nestjs/common" && found.imported === "Inject") return true
    if (found?.source === "@nestjs/typeorm") return true
    const symbol = aliasTarget(context, callee)
    return (symbol?.getDeclarations() ?? []).some((declaration) => declaration.getSourceFile().fileName.replaceAll("\\", "/").endsWith(".decorators.ts"))
}

/** The symbol an identifier names, with an import alias resolved to its target. */
export const aliasTarget = (context, identifier) => {
    const { checker, toTs } = typed(context)
    const tsNode = toTs(identifier)
    const symbol = tsNode && checker.getSymbolAtLocation(tsNode)
    if (!symbol) return symbol
    const isAlias = (symbol.flags & ts.SymbolFlags.Alias) !== 0
    return isAlias ? checker.getAliasedSymbol(symbol) : symbol
}

/** The methods of a class (instance, non-constructor) that carry one of the decorators `names` of `source`. */
export const methodsDecoratedBy = (context, classNode, source, names) =>
    classNode.body.body.filter((member) => member.type === "MethodDefinition" && member.kind === "method" && !member.static && decoratorsFrom(context, member, source, names).length > 0)

/**
 * Every call made in a method body, closures included: `<receiver>.<method>(...)` as `{ call, receiver, method }`, and any
 * other call as `{ call, receiver: null, method: null }`.
 */
export const callsOf = (method) => {
    const calls = []
    walk(method.value.body, (node) => {
        if (node.type !== "CallExpression") return
        const callee = node.callee
        const member = callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" ? callee : null
        calls.push({ call: node, receiver: member?.object ?? null, method: member?.property.name ?? null })
    })
    return calls
}

/** The parameters of a handler method, with the pattern a default value or a destructuring wraps unwrapped. */
export const parametersOf = (method) => method.value.params.map((param) => (param.type === "TSParameterProperty" ? param.parameter : param))
