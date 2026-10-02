/**
 * The rules that hold the webhook kind (R137 `BE_WEBHOOK_SHAPE`, R138 `BE_WEBHOOK_UNVERIFIED`).
 *
 * A provider webhook (`src/features/webhooks/<provider>/<provider>.webhook.ts`, slot `be.feature.webhooks`) is a signed intake door. It
 * proves the delivery came from the provider, then hands it to exactly ONE domain intake method, which records it and
 * publishes the event inside its own transaction (`eventBus.publish(event, tx)` is called only from `modules/domain`). The door
 * writes nothing and decides nothing:
 *
 *   - `webhook-shape` (R137): the door is one `@Controller` with one `@Post` handler, `@Public({ reason: PublicReason.SignedWebhook })`;
 *     it injects only the `WebhookSignatureService` of `platform/http-security` and services of `modules/domain`; its handler has no
 *     branch, loop or `try`, makes exactly one call on a domain service, calls on the signature service only `verify`, and returns
 *     nothing.
 *   - `webhook-verify-first` (R138): the first statement of the handler is the unconditional `verify` call, so no path reaches the
 *     intake with an unproven delivery.
 *
 * What a receiver is comes from its TYPE (where the class is declared); what a decorator is comes from the import that binds it.
 * No rule here tests a directory spelled in a path pattern or a variable name.
 */
import { walk } from "./lib/ast.mjs"
import { callsOf, decoratorsFrom, hasClassDecorator, injectedMembers, methodsDecoratedBy } from "./lib/doors.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { decoratorArguments, decoratorCallee, importOf } from "./lib/import-source.mjs"
import { baseName, enumMemberOf, isOwnedType } from "./lib/ports.mjs"
import { typeOrigins } from "./lib/types.mjs"

/** The slot of provider webhook doors. */
const SLOT = "be.feature.webhooks"

/** The HTTP verbs of `@nestjs/common`; only `Post` is a webhook method. */
const HTTP_VERBS = ["Get", "Post", "Put", "Patch", "Delete", "All", "Options", "Head"]

/** Statements and expressions that are a decision or a repetition: none of them belongs in a door. */
const DECISION_NODES = new Set(["IfStatement", "SwitchStatement", "ConditionalExpression", "LogicalExpression", "ForStatement", "ForInStatement", "ForOfStatement", "WhileStatement", "DoWhileStatement", "TryStatement", "ThrowStatement"])

/** The `WebhookSignatureService` of `platform/http-security`. */
const isSignatureType = (context, node) => isOwnedType(context, node, { name: "WebhookSignatureService", capability: "http-security", tier: "platform" })

/** A service of `modules/domain`: a class declared in a `<name>.service.ts` of the domain tier. */
const isDomainServiceType = (context, hfs, node) =>
    typeOrigins(context, node).some((origin) => origin.module === null && hfs.tierOf(origin.file) === "domain" && baseName(origin.file).endsWith(".service.ts"))

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

/** A provider webhook door: one signed `@Post`, the signature proof, one domain intake call, nothing else. */
export const webhookShape = {
    meta: {
        type: "problem",
        docs: { description: "A webhook door is one `@Controller` with one `@Public({ reason: PublicReason.SignedWebhook })` `@Post` handler that injects only the `WebhookSignatureService` and domain services, verifies, makes exactly one domain call and returns nothing." },
        schema: [],
        messages: {
            noDoor: "A webhook file declares one `@Controller` class: the door of the provider. Nothing else lives in `<provider>.webhook.ts`.",
            injects: "`{{what}}` is injected into a webhook door. A webhook injects only the `WebhookSignatureService` of `platform/http-security` and services of `modules/domain`; a bus, a repository, an `EntityManager` or a queue never reaches it. The intake is one domain service method that records the delivery and publishes the event inside its own transaction.",
            route: "A webhook door has exactly one `@Post` handler (this class has {{count}} route methods{{verbs}}). One provider endpoint is one door; another route belongs in its own provider folder or in an api feature.",
            notPublic: "`{{name}}` is not `@Public({ reason: PublicReason.SignedWebhook })`. The signature is the authentication of a webhook: it is public by that declaration and no other, so the open doors stay readable and the strict rate tier applies.",
            branch: "`{{what}}` is a decision or a loop in a webhook door. The door proves the delivery and hands it over: a refusal is the thrown error of `verify`, and every other decision belongs in the domain intake method.",
            call: "`{{what}}` is a call a webhook door does not make. The handler calls `verify` of the `WebhookSignatureService` once and one method of a domain service once; parsing, mapping and publishing belong in the domain service.",
            intakeCalls: "`{{name}}` calls domain services {{count}} times. A webhook hands the verified delivery to exactly one domain intake method (it records the delivery and publishes the event in one transaction); a second call is orchestration that belongs in that method.",
            returns: "`{{name}}` returns a value. A webhook acknowledges with its status and an empty body; it returns nothing of the domain to the provider.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        if (hfs.slotOf(context.filename) !== SLOT || !baseName(context.filename).endsWith(".webhook.ts")) return {}
        return {
            "Program:exit"(program) {
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
                const handler = handlerOf(context, door)
                if (routes.length !== 1 || handler === null) {
                    const verbs = routes.length > 0 ? ` (${routes.map((route) => decoratorsFrom(context, route, "@nestjs/common", HTTP_VERBS).map((decorator) => decoratorCallee(decorator).name ?? "route").join("+")).join(", ")})` : ""
                    context.report({ node: door, messageId: "route", data: { count: String(routes.length), verbs } })
                    return
                }
                const name = handler.key.type === "Identifier" ? handler.key.name : "the handler"
                if (!isSignedWebhookDoor(context, handler)) context.report({ node: handler.key, messageId: "notPublic", data: { name } })
                walk(handler.value.body, (child) => {
                    if (DECISION_NODES.has(child.type)) context.report({ node: child, messageId: "branch", data: { what: child.type === "LogicalExpression" ? child.operator : child.type.replace(/(Statement|Expression)$/, "").toLowerCase() } })
                    else if (child.type === "ReturnStatement" && child.argument) context.report({ node: child, messageId: "returns", data: { name } })
                })
                let intake = 0
                for (const { call, receiver, method } of callsOf(handler)) {
                    if (receiver !== null && isSignatureType(context, receiver) && method === "verify") continue
                    if (receiver !== null && isDomainServiceType(context, hfs, receiver)) {
                        intake += 1
                        continue
                    }
                    context.report({ node: call, messageId: "call", data: { what: context.sourceCode.getText(call.callee) } })
                }
                if (intake !== 1) context.report({ node: handler.key, messageId: "intakeCalls", data: { name, count: String(intake) } })
            },
        }
    },
}

/** The first statement of the handler is the unconditional signature proof. */
export const webhookVerifyFirst = {
    meta: {
        type: "problem",
        docs: { description: "The first statement of a webhook handler is the unconditional `verify` call of the `WebhookSignatureService` (signature and replay window), before anything else runs." },
        schema: [],
        messages: {
            first: "`{{name}}` does not start with `verify` of the `WebhookSignatureService`. The first statement of a webhook handler is `this.<signature>.verify({ rawBody, signature, timestamp })` (awaited when it is async): a delivery that fails the signature or the replay window throws before any other code runs, so no path reaches the intake unproven.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        if (hfs.slotOf(context.filename) !== SLOT || !baseName(context.filename).endsWith(".webhook.ts")) return {}
        return {
            "Program:exit"(program) {
                for (const door of doorsOf(context, program)) {
                    const handler = handlerOf(context, door)
                    if (handler === null) continue
                    const first = handler.value.body?.body[0]
                    let expression = first?.type === "ExpressionStatement" ? first.expression : null
                    if (expression?.type === "AwaitExpression") expression = expression.argument
                    const proven = expression?.type === "CallExpression"
                        && expression.callee.type === "MemberExpression"
                        && !expression.callee.computed
                        && expression.callee.property.type === "Identifier"
                        && expression.callee.property.name === "verify"
                        && isSignatureType(context, expression.callee.object)
                    if (!proven) context.report({ node: handler.key, messageId: "first", data: { name: handler.key.type === "Identifier" ? handler.key.name : "the handler" } })
                }
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "webhook-shape": webhookShape,
    "webhook-verify-first": webhookVerifyFirst,
}

/** Every rule of this law at `error`. */
export const recommended = {
    "starci-be/webhook-shape": "error",
    "starci-be/webhook-verify-first": "error",
}
