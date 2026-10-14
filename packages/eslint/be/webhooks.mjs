/**
 * The rules that hold the webhook kind (R182 `BE_WEBHOOK_SHAPE`, R183 `BE_WEBHOOK_UNVERIFIED`).
 *
 * A provider webhook (`src/features/webhooks/<provider>/transport/http/<provider>.webhook.ts`, slot `be.feature.webhooks.http`) is a signed intake door. It
 * proves the delivery came from the provider, then hands it to exactly ONE domain intake method, which records it and
 * records the inbox delivery inside its own transaction. A reactor or job consumes it and dispatches the command. The door
 * writes nothing and decides nothing:
 *
 *   - `webhook-shape` (R182): the door is one `@Controller` with one `@Post` handler, `@Public({ reason: PublicReason.SignedWebhook })`;
 *     it injects only the `WebhookSignatureService` of `platform/http-security` and services of `modules/domain`; its handler has no
 *     branch, loop or `try`, makes one domain intake call, optionally preceded by a declared domain verifier, and returns nothing or
 *     its own exported literal `PROVIDER_ACK`. An optional signed `@Get` verifies and echoes only the domain verifier result.
 *     A single declared domain method may verify and intake internally, using per-connection secrets.
 *   - `webhook-verify-first` (R183): the first statement is the unconditional shared or declared domain proof call, so no path reaches the
 *     intake with an unproven delivery.
 *
 * What a receiver is comes from its TYPE (where the class is declared); what a decorator is comes from the import that binds it.
 * No rule here tests a directory spelled in a path pattern or a variable name.
 */
import ts from "typescript"
import { walk } from "./lib/ast.mjs"
import { callsOf, decoratorsFrom, hasClassDecorator, injectedMembers, methodsDecoratedBy } from "./lib/doors.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { decoratorArguments, decoratorCallee, importOf, isImportedFrom } from "./lib/import-source.mjs"
import { baseName, enumMemberOf } from "./lib/ports.mjs"
import { typed } from "./lib/types.mjs"
import { isProviderAcknowledgement } from "./lib/webhook-ack.mjs"
import { webhookForbiddenReferences, webhookIntakeDispatchesCommand } from "./lib/webhook-handoff.mjs"
import { firstWebhookChallenge, firstWebhookVerification, isWebhookChallengeReturn, isWebhookDomainServiceType as isDomainServiceType, isWebhookSignatureType as isSignatureType } from "./lib/webhook-verifiers.mjs"
import { webhookInboxKey } from "./webhook-handoff-inbox.mjs"
import { webhookIntakeProcessesDelivery } from "./webhook-handoff-intake.mjs"

/** The slot of provider webhook doors. */
const SLOT = "be.feature.webhooks.http"

/** One POST intake and, optionally, one GET subscription challenge are the only webhook routes. */
const HTTP_VERBS = ["Get", "Post", "Put", "Patch", "Delete", "All", "Options", "Head"]

/** Statements and expressions that are a decision or a repetition: none of them belongs in a door. */
const DECISION_NODES = new Set(["IfStatement", "SwitchStatement", "ConditionalExpression", "LogicalExpression", "ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement", "TryStatement", "ThrowStatement"])

/** The `@Controller` classes of a webhook file, with their handler methods. */
const doorsOf = (context, program) => {
    const doors = []
    walk(program, (node) => {
        if (node.type !== "ClassDeclaration") return
        if (hasClassDecorator(context, node, "@nestjs/common", "Controller")) doors.push(node)
    })
    return doors
}

/** The route methods of a controller: every method carrying an HTTP verb decorator. */
const routeMethods = (context, controller) => methodsDecoratedBy(context, controller, "@nestjs/common", HTTP_VERBS)

/** The handler of a webhook door: its `@Post` method, or null when it has none. */
const handlerOf = (context, controller) => methodsDecoratedBy(context, controller, "@nestjs/common", "Post")[0] ?? null

/** Aliased decorators retain the HTTP verb exported by Nest, rather than their local spelling. */
const routeVerbs = (context, route) => decoratorsFrom(context, route, "@nestjs/common", HTTP_VERBS).map((decorator) => HTTP_VERBS.find((verb) => isImportedFrom(context, decoratorCallee(decorator), "@nestjs/common", verb)))

/** One unambiguous POST plus at most one unambiguous GET; stacked verb decorators grant no extra routes. */
const validRoutes = (context, routes) => {
    const verbs = routes.flatMap((route) => routeVerbs(context, route))
    return verbs.length === routes.length && verbs.filter((verb) => verb === "Post").length === 1
        && verbs.filter((verb) => verb === "Get").length <= 1 && verbs.every((verb) => verb === "Post" || verb === "Get")
}

/** A route's name is only presentation, never its identity. */
const methodName = (method) => method.key.type === "Identifier" ? method.key.name : "the handler"

/** True when the method carries `@Public({ reason: PublicReason.SignedWebhook })`: the reason is read from the enum member the argument is. */
const isSignedWebhookDoor = (context, method) =>
    (method.decorators ?? []).some((decorator) => {
        const callee = decoratorCallee(decorator)
        if (callee?.type !== "Identifier" || importOf(context, callee) === null) return false
        const options = decoratorArguments(decorator)[0]
        if (options?.type !== "ObjectExpression") return false
        const reason = options.properties.find((property) => property.type === "Property" && !property.computed && property.key.type === "Identifier" && property.key.name === "reason")
        const member = reason ? enumMemberOf(context, reason.value) : null
        return member !== null && member.enumName === "PublicReason" && member.member === "SignedWebhook"
    })

/** Decisions are equally forbidden in the delivery and subscription doors. */
const reportDecisions = (context, method) => {
    walk(method.value.body, (child) => {
        if (DECISION_NODES.has(child.type)) context.report({ node: child, messageId: "branch", data: { what: child.type === "LogicalExpression" ? child.operator : child.type.replace(/(Statement|Expression)$/, "").toLowerCase() } })
    })
}

/** POST returns are restricted to the immutable literal acknowledgement of this webhook feature. */
const reportPostReturns = (context, hfs, handler) => {
    walk(handler.value.body, (child) => {
        if (child.type === "ReturnStatement" && child.argument && !isProviderAcknowledgement(context, hfs, child.argument)) context.report({ node: child, messageId: "returns", data: { name: methodName(handler) } })
    })
}

/** Delivery calls consist only of the completed proof and one domain inbox intake. */
const deliveryCallKind = (context, hfs, entry, separateProof, proof) => {
    if (entry.receiver === null) return "call"
    if (isSignatureType(context, entry.receiver) && entry.method === "verify") return "proof"
    if (!isDomainServiceType(context, hfs, entry.receiver)) return "call"
    if (separateProof && entry.call === proof) return "proof"
    return "intake"
}

/** A declared proof is no escape hatch for dispatching commands behind the intake door. */
const reportDomainDispatch = (context, hfs, call, receiver) => {
    if (receiver !== null && isDomainServiceType(context, hfs, receiver) && webhookIntakeDispatchesCommand(context, hfs, call)) context.report({ node: call, messageId: "handoff" })
}

/** Delivery calls consist only of the completed proof and one domain inbox intake. */
const reportIntakeCalls = (context, hfs, handler) => {
    const proof = firstWebhookVerification(context, hfs, handler)
    const calls = callsOf(handler)
    const domainCalls = calls.filter(({ receiver }) => receiver !== null && isDomainServiceType(context, hfs, receiver))
    const separateProof = domainCalls.length > 1 && domainCalls.some(({ call }) => call === proof)
    let intake = 0
    for (const entry of calls) {
        const { call } = entry
        reportDomainDispatch(context, hfs, call, entry.receiver)
        const kind = deliveryCallKind(context, hfs, entry, separateProof, proof)
        if (kind === "proof") continue
        if (kind === "intake") {
            intake += 1
            continue
        }
        context.report({ node: call, messageId: "call", data: { what: context.sourceCode.getText(call.callee) } })
    }
    if (intake !== 1) context.report({ node: handler.key, messageId: "intakeCalls", data: { name: methodName(handler), count: String(intake) } })
}

/** A challenge calls its domain verifier once and echoes exactly the returned value. */
const reportChallenge = (context, hfs, handler) => {
    const challenge = firstWebhookChallenge(context, hfs, handler)
    let echoes = 0
    walk(handler.value.body, (child) => {
        if (child.type !== "ReturnStatement") return
        echoes += 1
        if (!isWebhookChallengeReturn(context, child, challenge)) context.report({ node: child, messageId: "returns", data: { name: methodName(handler) } })
    })
    if (echoes === 0) context.report({ node: handler.key, messageId: "returns", data: { name: methodName(handler) } })
    for (const { call, receiver } of callsOf(handler)) {
        reportDomainDispatch(context, hfs, call, receiver)
        if (call !== challenge?.call) context.report({ node: call, messageId: "call", data: { what: context.sourceCode.getText(call.callee) } })
    }
}

/** Public declaration and branch restrictions apply to both routes. */
const reportRoute = (context, hfs, handler, challenge = false) => {
    if (!isSignedWebhookDoor(context, handler)) context.report({ node: handler.key, messageId: "notPublic", data: { name: methodName(handler) } })
    reportDecisions(context, handler)
    if (challenge) reportChallenge(context, hfs, handler)
    else {
        reportPostReturns(context, hfs, handler)
        reportIntakeCalls(context, hfs, handler)
    }
}

/** The provider file contains one controller; an exported PROVIDER_ACK declaration may accompany it. */
const reportDoor = (context, hfs, program) => {
    const doors = doorsOf(context, program)
    if (doors.length !== 1) {
        context.report({ node: program, messageId: "noDoor" })
        return
    }
    const door = doors[0]
    for (const { node, annotation } of injectedMembers(context, door)) {
        if (!annotation || !(isSignatureType(context, annotation) || isDomainServiceType(context, hfs, annotation))) context.report({ node, messageId: "injects", data: { what: context.sourceCode.getText(node) } })
    }
    const routes = routeMethods(context, door)
    if (!validRoutes(context, routes)) {
        const verbs = routes.length > 0 ? ` (${routes.map((route) => routeVerbs(context, route).join("+")).join(", ")})` : ""
        context.report({ node: door, messageId: "route", data: { count: String(routes.length), verbs } })
        return
    }
    reportRoute(context, hfs, handlerOf(context, door))
    for (const challenge of methodsDecoratedBy(context, door, "@nestjs/common", "Get")) reportRoute(context, hfs, challenge, true)
}

/** Resolve a decorator or method through its imported alias to its declaration. */
const targetSymbol = (checker, node) => {
    const symbol = checker.getSymbolAtLocation(node)
    return symbol?.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
}

/** Public metadata belongs to the identity owner, including aliases and namespace imports. */
const isPublicDecorator = (context, hfs, decorator) => {
    const { checker, toTs } = typed(context)
    const node = toTs(decoratorCallee(decorator))
    const symbol = node && targetSymbol(checker, ts.isPropertyAccessExpression(node) ? node.name : node)
    return symbol?.getName() === "Public" && symbol.getDeclarations()?.some((declaration) => {
        const file = declaration.getSourceFile().fileName.replace(/\\/g, "/")
        return hfs.tierOf(file) === "domain" && hfs.ownerOf(file)?.split("/").at(-1) === "identity"
    })
}

/** Unwrap const/satisfies annotations without granting a computed declaration a proof. */
const unwrapTs = (node) => {
    while (node && (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node))) node = node.expression
    return node
}

/** Static object properties keep aliases, spreads and computed literal keys readable. Last writes win. */
const propertyValue = (checker, expression, name, seen = new Set()) => {
    const node = unwrapTs(expression)
    if (!node || seen.has(node)) return null
    seen.add(node)
    if (ts.isObjectLiteralExpression(node)) {
        for (const property of [...node.properties].reverse()) {
            if (ts.isSpreadAssignment(property)) {
                const value = propertyValue(checker, property.expression, name, seen)
                if (value) return value
            } else if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
                const key = ts.isComputedPropertyName(property.name) ? unwrapTs(property.name.expression) : property.name
                if ((ts.isIdentifier(key) || ts.isStringLiteralLike(key)) && key.text === name) return property.initializer ?? property.name
            }
        }
        return null
    }
    const symbol = targetSymbol(checker, ts.isPropertyAccessExpression(node) ? node.name : node)
    for (const declaration of symbol?.getDeclarations() ?? []) {
        const value = propertyValue(checker, declaration.initializer, name, seen)
        if (value) return value
    }
    return null
}

/** A SignedWebhook reason is the actual identity enum member, even behind a const options alias. */
const signedReason = (context, decorator) => {
    const { checker, toTs } = typed(context)
    const options = decoratorArguments(decorator)[0]
    const reason = options && propertyValue(checker, toTs(options), "reason")
    if (!reason) return false
    const type = checker.getTypeAtLocation(unwrapTs(reason))
    const declaration = type.getSymbol()?.getDeclarations()?.[0]
    const owner = declaration?.parent
    if (!declaration || !ts.isEnumMember(declaration) || !owner || !ts.isEnumDeclaration(owner)
        || owner.name.text !== "PublicReason" || declaration.name.getText().replace(/["']/g, "") !== "SignedWebhook") return false
    const hfs = hfsOf(context)
    const file = declaration.getSourceFile().fileName.replace(/\\/g, "/")
    return hfs.tierOf(file) === "domain" && hfs.ownerOf(file)?.split("/").at(-1) === "identity"
}

/** An explicit verifier exemption names the exact domain method in a webhook HTTP module's exported const array. */
const declaredVerifier = (context, hfs, method) => {
    if (method?.type !== "MethodDefinition" || hfs.tierOf(context.filename) !== "domain" || !baseName(context.filename).endsWith(".service.ts")) return false
    const { checker, program, toTs } = typed(context)
    const declaration = toTs(method)
    const symbol = declaration?.name && targetSymbol(checker, declaration.name)
    if (!symbol) return false
    return program.getSourceFiles().some((source) => hfs.slotOf(source.fileName) === SLOT && baseName(source.fileName).endsWith(".module.ts")
        && source.statements.some((statement) => ts.isVariableStatement(statement)
            && statement.declarationList.flags & ts.NodeFlags.Const
            && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)
            && statement.declarationList.declarations.some((entry) => {
                const array = unwrapTs(entry.initializer)
                return ts.isIdentifier(entry.name) && entry.name.text === "webhookVerifiers" && array && ts.isArrayLiteralExpression(array)
                    && array.elements.some((item) => {
                        const reference = unwrapTs(item)
                        return reference && ts.isPropertyAccessExpression(reference) && targetSymbol(checker, reference.name) === symbol
                    })
            })))
}

/** Read literal paths and const aliases through the checker; Nest accepts path lists and Controller options too. */
const routePaths = (context, decorator) => {
    const { checker, toTs } = typed(context)
    const seen = new Set()
    const read = (original) => {
        const node = unwrapTs(original)
        if (!node || seen.has(node)) return []
        seen.add(node)
        if (ts.isStringLiteralLike(node)) return [node.text]
        if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap(read)
        if (ts.isObjectLiteralExpression(node)) return read(propertyValue(checker, node, "path"))
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
            return read(node.left).flatMap((left) => read(node.right).map((right) => left + right))
        }
        if (ts.isTemplateExpression(node)) {
            return node.templateSpans.reduce((values, span) => values.flatMap((value) => read(span.expression).map((part) => value + part + span.literal.text)), [node.head.text])
        }
        const reference = ts.isPropertyAccessExpression(node) ? node.name : node
        const symbol = targetSymbol(checker, reference)
        return symbol?.getDeclarations()?.flatMap((declaration) => read(declaration.initializer)) ?? []
    }
    return decoratorArguments(decorator).flatMap((argument) => read(toTs(argument)))
}

/** R263: public webhook traffic always enters the signed, verified webhook kind. */
export const webhookScope = {
    meta: {
        type: "problem",
        docs: { description: "SignedWebhook metadata belongs only to webhook doors or explicitly declared domain verifiers; public webhook/callback/events routes belong to the webhook kind." },
        schema: [],
        messages: {
            scope: "[BE_WEBHOOK_SCOPE] SignedWebhook metadata is allowed only on a `<provider>.webhook.ts` door in the webhook HTTP slot or an exact domain method declared in its HTTP module's exported `webhookVerifiers`. Move public webhook, callback and events routes into that door so signature verification and inbox handoff are enforced.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const slot = hfs.slotOf(context.filename)
        if (slot?.startsWith("be.tests.") || /(?:\.spec|\.d)\.ts$/.test(context.filename)) return {}
        const inDoor = slot === SLOT && baseName(context.filename).endsWith(".webhook.ts")
        return {
            CallExpression(call) {
                if (inDoor && call.callee.type === "MemberExpression" && isDomainServiceType(context, hfs, call.callee.object)
                    && webhookIntakeProcessesDelivery(context, hfs, call)) context.report({ node: call, messageId: "scope" })
            },
            Decorator(decorator) {
                if (!inDoor && isPublicDecorator(context, hfs, decorator) && signedReason(context, decorator)
                    && !declaredVerifier(context, hfs, decorator.parent)) context.report({ node: decorator, messageId: "scope" })
            },
            ClassDeclaration(controller) {
                if (inDoor || !hasClassDecorator(context, controller, "@nestjs/common", "Controller")) return
                const classPublic = (controller.decorators ?? []).filter((decorator) => isPublicDecorator(context, hfs, decorator))
                const prefix = decoratorsFrom(context, controller, "@nestjs/common", "Controller").flatMap((decorator) => routePaths(context, decorator))
                for (const method of routeMethods(context, controller)) {
                    const publicMetadata = [...classPublic, ...(method.decorators ?? []).filter((decorator) => isPublicDecorator(context, hfs, decorator))]
                    if (publicMetadata.length === 0 || publicMetadata.some((decorator) => signedReason(context, decorator))) continue
                    const paths = [...prefix, ...decoratorsFrom(context, method, "@nestjs/common", HTTP_VERBS).flatMap((decorator) => routePaths(context, decorator))]
                    if (paths.some((path) => /webhook|callback|events/i.test(path))) context.report({ node: method.key, messageId: "scope" })
                }
            },
        }
    },
}

/** A provider webhook door: one signed `@Post`, the signature proof, one domain intake call, nothing else. */
export const webhookShape = {
    meta: {
        type: "problem",
        docs: { description: "A webhook door has one signed POST that verifies first, hands off once to a domain inbox intake and returns empty or its own literal PROVIDER_ACK, plus an optional signed GET that echoes only its domain verifier result. No command bus reaches the door or intake." },
        schema: [],
        messages: {
            noDoor: "A webhook file declares one `@Controller` class: the provider door. Its own exported literal `PROVIDER_ACK` may accompany it in `<provider>.webhook.ts`.",
            injects: "`{{what}}` is injected into a webhook door. A webhook injects only the `WebhookSignatureService` of `platform/http-security` and services of `modules/domain`; a bus, a repository, an `EntityManager` or a queue never reaches it. The intake records the inbox delivery inside its own transaction; a reactor or job dispatches the command afterward.",
            route: "A webhook door has exactly one `@Post` delivery handler and at most one `@Get` subscription challenge (this class has {{count}} route methods{{verbs}}). The GET calls its declared domain verifier first and echoes only that result; other routes belong in their own provider folder or an api feature.",
            notPublic: "`{{name}}` is not `@Public({ reason: PublicReason.SignedWebhook })`. The signature is the authentication of a webhook: it is public by that declaration and no other, so the open doors stay readable and the strict rate tier applies.",
            branch: "`{{what}}` is a decision or a loop in a webhook door. The door proves the delivery and hands it over: a refusal is the thrown error of `verify`, and every other decision belongs in the domain intake method.",
            call: "`{{what}}` is a call a webhook door does not make. The handler starts with the shared signature proof or a declared domain verifier and hands the delivery to one domain intake; a declared domain method may do both internally. Parsing, mapping and publishing belong in the domain service.",
            intakeCalls: "`{{name}}` makes {{count}} domain intake calls. A webhook hands the verified delivery to exactly one domain method that records its inbox delivery in a transaction; a separate first domain proof is allowed, and a second intake is orchestration that belongs in that method.",
            returns: "`{{name}}` returns an undeclared or computed body. POST returns empty or the exported `PROVIDER_ACK` const of this webhook feature, initialized only with literal object/string data and declared `as const` or with a readonly literal type. GET echoes exactly its first declared domain verifier call's result. Domain data, inline literals and every other computed body are refused.",
            handoff: "A webhook door, its declaring HTTP module or its called domain method reaches the command/query bus or a feature command handler. A delivery or challenge verifier cannot conceal command dispatch. Verify, record the inbox delivery, and let a reactor or job dispatch the command afterward.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const name = baseName(context.filename)
        const isDoor = name.endsWith(".webhook.ts")
        if (hfs.slotOf(context.filename) !== SLOT || !(isDoor || name.endsWith(".module.ts"))) return {}
        return {
            "Program:exit"(program) {
                for (const node of webhookForbiddenReferences(context, hfs, program)) context.report({ node, messageId: "handoff" })
                if (isDoor) reportDoor(context, hfs, program)
            },
        }
    },
}

/** The first statement of the handler is the unconditional signature proof. */
export const webhookVerifyFirst = {
    meta: {
        type: "problem",
        docs: { description: "POST starts with an unconditional shared signature or declared domain proof. An optional GET starts with its domain challenge verifier, binding or returning only that result. Async proofs are awaited before any other work." },
        schema: [],
        messages: {
            first: "`{{name}}` does not start with an unconditional webhook proof. POST starts with `WebhookSignatureService.verify` or a declared domain verifier. GET first binds or returns its declared domain verifier's challenge result. Await an async proof. Domain verifier service names end in `Verifier` or `verify`, or their methods appear in the adjacent HTTP module's exported `webhookVerifiers` array. No data call or other work may run before verification, including inside its arguments.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        if (hfs.slotOf(context.filename) !== SLOT || !baseName(context.filename).endsWith(".webhook.ts")) return {}
        return {
            "Program:exit"(program) {
                for (const door of doorsOf(context, program)) {
                    for (const handler of methodsDecoratedBy(context, door, "@nestjs/common", ["Post", "Get"])) {
                        const challenge = decoratorsFrom(context, handler, "@nestjs/common", "Get").length > 0
                        const proven = challenge ? firstWebhookChallenge(context, hfs, handler) : firstWebhookVerification(context, hfs, handler)
                        if (!proven) context.report({ node: handler.key, messageId: "first", data: { name: methodName(handler) } })
                    }
                }
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "webhook-shape": webhookShape,
    "webhook-verify-first": webhookVerifyFirst,
    "webhook-scope": webhookScope,
    "webhook-inbox-key": webhookInboxKey,
}

/** Every rule of this law at `error`. */
export const recommended = {
    "starci-be/webhook-shape": "error",
    "starci-be/webhook-verify-first": "error",
    "starci-be/webhook-scope": "error",
    "starci-be/webhook-inbox-key": "error",
}
