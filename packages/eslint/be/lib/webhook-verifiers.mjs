/** Typed webhook proofs shared by the webhook and thin-feature laws. */
import { dirname } from "node:path"
import ts from "typescript"
import { walk } from "./ast.mjs"
import { baseName, isOwnedType } from "./ports.mjs"
import { originsOfType, typeOrigins, typed } from "./types.mjs"

/** The shared platform proof, identified by its declared owner. */
export const isWebhookSignatureType = (context, node) => isOwnedType(context, node, { name: "WebhookSignatureService", capability: "http-security", tier: "platform" })

/** A service declared by a domain owner, rather than a similarly named local or package type. */
export const isWebhookDomainServiceType = (context, hfs, node) =>
    typeOrigins(context, node).some((origin) => origin.module === null && hfs.tierOf(origin.file) === "domain" && baseName(origin.file).endsWith(".service.ts"))

/** The method symbol named by a property access, resolving imported aliases. */
const methodSymbol = (checker, expression) => {
    if (!expression || !ts.isPropertyAccessExpression(expression)) return null
    const symbol = checker.getSymbolAtLocation(expression.name)
    return symbol && symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol ?? null
}

/** Unwrap static TypeScript annotations around a declaration's array literal. */
const arrayOf = (expression) => {
    while (expression && (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression) || ts.isParenthesizedExpression(expression))) expression = expression.expression
    return expression && ts.isArrayLiteralExpression(expression) ? expression : null
}

/** All possible receiver types must be declared verifier classes; a type alias cannot rename a general service into one. */
const isDomainVerifierType = (context, hfs, receiver) => {
    const { checker, toTs } = typed(context)
    const type = checker.getTypeAtLocation(toTs(receiver))
    const parts = type.isUnion() ? type.types : [type]
    return parts.every((part) => part.getSymbol()?.getDeclarations()?.some((declaration) => {
        const file = declaration.getSourceFile().fileName.replace(/\\/g, "/")
        return ts.isClassDeclaration(declaration) && declaration.name && /(?:Verifier|verify)$/.test(declaration.name.text)
            && hfs.tierOf(file) === "domain" && baseName(file).endsWith(".service.ts")
    }))
}

/**
 * A provider's adjacent HTTP module may export webhookVerifiers as an array of
 * domain methods, e.g. [BillingService.prototype.receiveCassoWebhook] as const.
 * Compare symbols, so spelling an arbitrary receiver or alias as a verifier grants nothing.
 */
const declaresMethod = (checker, statement, method) => {
    if (!ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const)) return false
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) return false
    return statement.declarationList.declarations.some((declaration) => ts.isIdentifier(declaration.name)
        && declaration.name.text === "webhookVerifiers"
        && arrayOf(declaration.initializer)?.elements.some((entry) => methodSymbol(checker, entry) === method))
}

/** The module declaration is adjacent to this exact provider door, not another feature's proof list. */
const isProviderModule = (context, source) => {
    const file = source.fileName.replace(/\\/g, "/")
    const directory = dirname(context.filename).replace(/\\/g, "/")
    const moduleName = `${baseName(context.filename).slice(0, -".webhook.ts".length)}-http.module.ts`
    return dirname(file).replace(/\\/g, "/") === directory && baseName(file) === moduleName
}

/** A general domain service method is a verifier only when this provider's module declares its resolved symbol. */
const isModuleDeclaredVerifier = (context, call) => {
    const { program, checker, toTs } = typed(context)
    const method = methodSymbol(checker, toTs(call.callee))
    if (method === null) return false
    return program.getSourceFiles().some((source) => isProviderModule(context, source)
        && source.statements.some((statement) => declaresMethod(checker, statement, method)))
}

/** A direct, unconditional method call to the shared proof or a declared domain verifier. */
const isWebhookVerificationCall = (context, hfs, call, domainOnly = false) => {
    if (call?.type !== "CallExpression" || call.optional) return false
    const callee = call.callee
    if (callee.type !== "MemberExpression" || callee.computed || callee.optional || callee.property.type !== "Identifier") return false
    const { checker, toTs } = typed(context)
    const receiverType = checker.getTypeAtLocation(toTs(callee.object))
    const parts = receiverType.isUnion() ? receiverType.types : [receiverType]
    if (!domainOnly && callee.property.name === "verify" && parts.every((part) => originsOfType(checker, part).some((origin) => origin.module === null && origin.name === "WebhookSignatureService" && hfs.tierOf(origin.file) === "platform" && hfs.ownerOf(origin.file)?.split("/").at(-1) === "http-security"))) return true
    if (!isWebhookDomainServiceType(context, hfs, callee.object)) return false
    return isDomainVerifierType(context, hfs, callee.object) || isModuleDeclaredVerifier(context, call)
}

/** Expressions that can execute work or skip the proof before its call is entered. */
const PRE_PROOF_WORK = new Set(["CallExpression", "NewExpression", "ImportExpression", "TaggedTemplateExpression", "AssignmentExpression", "UpdateExpression", "AwaitExpression", "YieldExpression", "ChainExpression", "ConditionalExpression", "LogicalExpression", "SequenceExpression"])

/**
 * The first statement must itself be the proof (awaited if it returns a thenable).
 * Its receiver and arguments may pass delivery data, but cannot run another call first.
 */
const completedVerification = (context, hfs, expression, domainOnly = false) => {
    let call = expression
    const awaited = call?.type === "AwaitExpression"
    if (awaited) call = call.argument
    if (!isWebhookVerificationCall(context, hfs, call, domainOnly)) return null
    let work = false
    walk(call, (child) => {
        if (child !== call && (PRE_PROOF_WORK.has(child.type) || (child.type === "UnaryExpression" && child.operator === "delete"))) work = true
    })
    if (work) return null
    const { checker, toTs } = typed(context)
    const signature = checker.getResolvedSignature(toTs(call))
    if (!signature) return null
    const returned = checker.getReturnTypeOfSignature(signature)
    const parts = returned.isUnion() ? returned.types : [returned]
    if (!awaited && parts.some((part) => checker.getApparentType(part).getProperty("then"))) return null
    return call
}

/** POST's first statement remains the proof itself, before the intake or acknowledgement. */
export const firstWebhookVerification = (context, hfs, method) => {
    const first = method.value.body?.body[0]
    return completedVerification(context, hfs, first?.type === "ExpressionStatement" ? first.expression : null)
}

/** A challenge verifier must produce an echo value, rather than a void proof. */
const hasChallengeResult = (context, call) => {
    const { checker, toTs } = typed(context)
    const signature = checker.getResolvedSignature(toTs(call))
    const returned = signature && checker.getReturnTypeOfSignature(signature)
    const value = returned && (checker.getAwaitedType(returned) ?? returned)
    const parts = value?.isUnion() ? value.types : [value]
    return parts.every((part) => part && !(part.flags & (ts.TypeFlags.Void | ts.TypeFlags.Undefined | ts.TypeFlags.Never)))
}

/** The optional GET proves once, binding its result with const or returning the verifier call directly. */
export const firstWebhookChallenge = (context, hfs, method) => {
    const statements = method.value.body?.body ?? []
    const first = statements[0]
    if (first?.type === "ReturnStatement") {
        const call = completedVerification(context, hfs, first.argument, true)
        return call && hasChallengeResult(context, call) ? { call, result: null, echo: first, statements } : null
    }
    if (first?.type !== "VariableDeclaration" || first.kind !== "const" || first.declarations.length !== 1) return null
    const binding = first.declarations[0]
    if (binding.id.type !== "Identifier") return null
    const call = completedVerification(context, hfs, binding.init, true)
    return call && hasChallengeResult(context, call) ? { call, result: binding.id, echo: statements[1], statements } : null
}

/** The GET echoes only the original proof's value, with no intervening work or transformation. */
export const isWebhookChallengeReturn = (context, node, challenge) => {
    if (!challenge || node !== challenge.echo || node.type !== "ReturnStatement") return false
    if (challenge.result === null) return challenge.statements.length === 1
    if (challenge.statements.length !== 2 || node.argument?.type !== "Identifier") return false
    const { checker, toTs } = typed(context)
    return checker.getSymbolAtLocation(toTs(node.argument)) === checker.getSymbolAtLocation(toTs(challenge.result))
}
