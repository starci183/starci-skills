/**
 * The rules that hold the webhook kind (R182 `BE_WEBHOOK_SHAPE`, R183 `BE_WEBHOOK_UNVERIFIED`).
 *
 * A provider webhook (`src/features/webhooks/<provider>/transport/http/<provider>.webhook.ts`, slot `be.feature.webhooks.http`) is a signed intake door. It
 * proves the delivery came from the provider, then hands it to exactly ONE domain intake method, which records it and
 * publishes the event inside its own transaction (`eventBus.publish(event, tx)` is called only from `modules/domain`). The door
 * writes nothing and decides nothing:
 *
 *   - `webhook-shape` (R182): the door is one `@Controller` with one `@Post` handler, `@Public({ reason: PublicReason.SignedWebhook })`;
 *     it injects only the `WebhookSignatureService` of `platform/http-security` and services of `modules/domain`; its handler has no
 *     branch, loop or `try`, makes one domain intake call, optionally preceded by a declared domain verifier, and returns nothing.
 *     A single declared domain method may verify and intake internally, using per-connection secrets.
 *   - `webhook-verify-first` (R183): the first statement is the unconditional shared or declared domain proof call, so no path reaches the
 *     intake with an unproven delivery.
 *
 * What a receiver is comes from its TYPE (where the class is declared); what a decorator is comes from the import that binds it.
 * No rule here tests a directory spelled in a path pattern or a variable name.
 */
import { walk } from "./lib/ast.mjs"
import { callsOf, decoratorsFrom, hasClassDecorator, injectedMembers, methodsDecoratedBy } from "./lib/doors.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { decoratorArguments, decoratorCallee, importOf } from "./lib/import-source.mjs"
import { baseName, enumMemberOf } from "./lib/ports.mjs"
import { firstWebhookVerification, isWebhookDomainServiceType as isDomainServiceType, isWebhookSignatureType as isSignatureType } from "./lib/webhook-verifiers.mjs"

/** The slot of provider webhook doors. */
const SLOT = "be.feature.webhooks.http"

/** The HTTP verbs of `@nestjs/common`; only `Post` is a webhook method. */
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
        docs: { description: "A webhook door is one signed `@Post` handler that injects only the shared signature and domain services, verifies first, makes one domain intake call (with an optional declared domain proof call) and returns nothing." },
        schema: [],
        messages: {
            noDoor: "A webhook file declares one `@Controller` class: the door of the provider. Nothing else lives in `<provider>.webhook.ts`.",
            injects: "`{{what}}` is injected into a webhook door. A webhook injects only the `WebhookSignatureService` of `platform/http-security` and services of `modules/domain`; a bus, a repository, an `EntityManager` or a queue never reaches it. The intake is one domain service method that records the delivery and publishes the event inside its own transaction.",
            route: "A webhook door has exactly one `@Post` handler (this class has {{count}} route methods{{verbs}}). One provider endpoint is one door; another route belongs in its own provider folder or in an api feature.",
            notPublic: "`{{name}}` is not `@Public({ reason: PublicReason.SignedWebhook })`. The signature is the authentication of a webhook: it is public by that declaration and no other, so the open doors stay readable and the strict rate tier applies.",
            branch: "`{{what}}` is a decision or a loop in a webhook door. The door proves the delivery and hands it over: a refusal is the thrown error of `verify`, and every other decision belongs in the domain intake method.",
            call: "`{{what}}` is a call a webhook door does not make. The handler starts with the shared signature proof or a declared domain verifier and hands the delivery to one domain intake; a declared domain method may do both internally. Parsing, mapping and publishing belong in the domain service.",
            intakeCalls: "`{{name}}` makes {{count}} domain intake calls. A webhook hands the verified delivery to exactly one domain intake method (it records the delivery and publishes the event in one transaction); a separate first domain proof is allowed, and a second intake is orchestration that belongs in that method.",
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
                const proof = firstWebhookVerification(context, hfs, handler)
                const calls = callsOf(handler)
                const domainCalls = calls.filter(({ receiver }) => receiver !== null && isDomainServiceType(context, hfs, receiver))
                // One domain call can prove and intake internally; a separate domain proof is not a second intake.
                const separateProof = domainCalls.length > 1 && domainCalls.some(({ call }) => call === proof)
                let intake = 0
                for (const { call, receiver, method } of calls) {
                    if (receiver !== null && isSignatureType(context, receiver) && method === "verify") continue
                    if (receiver !== null && isDomainServiceType(context, hfs, receiver)) {
                        if (separateProof && call === proof) continue
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
        docs: { description: "The first statement of a webhook handler is an unconditional shared signature or declared domain verifier call, awaited when async, before any other work runs." },
        schema: [],
        messages: {
            first: "`{{name}}` does not start with an unconditional webhook proof. Call `WebhookSignatureService.verify` or a declared domain verifier as the first statement, awaiting an async proof. Domain verifier service names end in `Verifier` or `verify`, or their methods appear in the adjacent HTTP module's exported `webhookVerifiers` array. No data call or other work may run before verification, including inside its arguments.",
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
                    const proven = firstWebhookVerification(context, hfs, handler)
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
