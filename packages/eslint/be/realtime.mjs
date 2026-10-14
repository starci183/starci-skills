/**
 * The rules that hold the realtime kind (R184 `BE_REALTIME_SHAPE`, R185 `BE_REALTIME_WRITES`, R186 `BE_REALTIME_TOPIC_SCOPE`).
 *
 * A realtime door (`src/features/realtime/<channel>/transport/websocket/<channel>.gateway.ts` for a socket, `transport/graphql/<x>.subscription.ts` for a GraphQL
 * subscription, slot `be.feature.realtime`) READS and PUSHES. It never writes: the push is fed by a reactor that calls the `RealtimeHub`
 * of `platform/realtime`, and the door only subscribes a client to a topic of that hub.
 *
 *   - `realtime-shape` (R184): a `.gateway.ts` holds one `@WebSocketGateway` class whose handlers are `@SubscribeMessage`, or a
 *     push-only gateway whose `@WebSocketServer` streams take the server's typed principal; a
 *     `.subscription.ts` holds one `@Resolver` class whose operations are `@Subscription`. Each is the door its file role names, and
 *     neither carries a query, a mutation or a REST route.
 *   - `realtime-read-only` (R185): the only value injected into a realtime door is the `RealtimeHub` of `platform/realtime`. No
 *     `EntityManager`, bus, queue, event bus or domain service reaches it.
 *   - `realtime-topic-scope` (R186): the topic passed to `hub.subscribe` is built from the principal parameter of the handler
 *     (`@CurrentPrincipal()` of `domain/identity`, or `Principal` of `platform/cqrs` for a push-only stream), so a client
 *     can only listen to what the principal owns.
 *
 * What a receiver is comes from its TYPE, what a decorator is from the import that binds it, and where a parameter comes
 * from from the declaration its name resolves to. No rule here tests a path pattern or a variable name.
 */
import { walk } from "./lib/ast.mjs"
import { aliasTarget, callsOf, hasClassDecorator, injectedMembers, methodsDecoratedBy, parametersOf } from "./lib/doors.mjs"
import { hfsOf } from "./lib/hfs.mjs"
import { decoratorCallee } from "./lib/import-source.mjs"
import { baseName, isOwnedType, ownerNameOf } from "./lib/ports.mjs"

/** The slot of realtime doors. */
const DOOR_SLOTS = new Set(["be.feature.realtime.graphql", "be.feature.realtime.websocket"])

/** The `RealtimeHub` port of `platform/realtime`. */
const isHubType = (context, node) => isOwnedType(context, node, { name: "RealtimeHub", capability: "realtime", tier: "platform" })

/** The decorators that make a class a door of one kind of realtime file, by file role. */
const ROLES = {
    gateway: { classDecorator: ["@nestjs/websockets", "WebSocketGateway"], operation: ["@nestjs/websockets", "SubscribeMessage"], foreign: [["@nestjs/graphql", ["Query", "Mutation", "ResolveField", "Subscription"]], ["@nestjs/common", ["Controller"]]] },
    subscription: { classDecorator: ["@nestjs/graphql", "Resolver"], operation: ["@nestjs/graphql", "Subscription"], foreign: [["@nestjs/graphql", ["Query", "Mutation", "ResolveField"]], ["@nestjs/websockets", ["WebSocketGateway", "SubscribeMessage"]], ["@nestjs/common", ["Controller"]]] },
}

/** The role (`gateway` or `subscription`) a realtime file name carries, or null. */
const roleOf = (filename) => /\.(gateway|subscription)\.ts$/.exec(baseName(filename))?.[1] ?? null

/** The door classes of a file: every class with a class-level door decorator of the role. */
const doorClasses = (context, program, role) => {
    const found = []
    walk(program, (node) => {
        if (node.type === "ClassDeclaration" && hasClassDecorator(context, node, ...ROLES[role].classDecorator)) found.push(node)
    })
    return found
}

/** The framework supplies this server property; no inbound message supplies a stream's principal. */
const hasSocketServer = (context, node) => node.body.body.some((member) =>
    member.type === "PropertyDefinition" && hasClassDecorator(context, member, "@nestjs/websockets", "WebSocketServer"))

/** The authenticated principal port the socket middleware passes to a push-only stream. */
const isStreamPrincipal = (context, param) => isOwnedType(context, param, { name: "Principal", capability: "cqrs", tier: "platform" })

/** Subscriptions on the platform's hub, including those inside closures. */
const hubSubscriptions = (context, method) => callsOf(method).filter(({ receiver, method: called }) =>
    called === "subscribe" && receiver !== null && isHubType(context, receiver))

/** The nonstatic methods a push-only gateway uses to feed its socket server. */
const streamMethods = (context, node) => {
    if (!hasSocketServer(context, node)) return []
    return node.body.body.filter((member) => member.type === "MethodDefinition" && member.kind === "method" && !member.static
        && hubSubscriptions(context, member).length > 0)
}

/** An inbound handler or a push-only stream taking the server's authenticated principal. */
const hasOperation = (context, node, role) => methodsDecoratedBy(context, node, ...ROLES[role].operation).length > 0
    || (role === "gateway" && streamMethods(context, node).some((method) => parametersOf(method).some((param) => isStreamPrincipal(context, param))))

/** A realtime file is the one door its role names, and nothing else. */
export const realtimeShape = {
    meta: {
        type: "problem",
        docs: { description: "A realtime file is one door: a `.gateway.ts` holds one `@WebSocketGateway` class with `@SubscribeMessage` handlers or principal-typed push streams through `@WebSocketServer`, a `.subscription.ts` holds one `@Resolver` class with `@Subscription` operations, and neither carries a route, query or mutation." },
        schema: [],
        messages: {
            door: "A `<channel>.{{role}}.ts` file declares exactly one `{{decorator}}` class (this one declares {{count}}). One file is one door.",
            operations: "This {{role}} door has no `@{{operation}}` handler or principal-typed push stream through `@WebSocketServer`. A realtime door subscribes the client to a topic of the `RealtimeHub`.",
            foreign: "`@{{name}}` has no place in a realtime {{role}} door. A realtime door only subscribes and pushes; a query, a mutation, a field resolver or a REST route belongs in an api feature, and the other realtime protocol in its own file.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const role = roleOf(context.filename)
        if (!DOOR_SLOTS.has(hfs.slotOf(context.filename) ?? "") || role === null) return {}
        const spec = ROLES[role]
        return {
            "Program:exit"(program) {
                const doors = doorClasses(context, program, role)
                if (doors.length !== 1) {
                    context.report({ node: program, messageId: "door", data: { role, decorator: `@${spec.classDecorator[1]}`, count: String(doors.length) } })
                    return
                }
                if (!hasOperation(context, doors[0], role)) context.report({ node: doors[0], messageId: "operations", data: { role, operation: spec.operation[1] } })
                walk(program, (node) => {
                    if (node.type !== "Decorator") return
                    for (const [source, names] of spec.foreign) {
                        const hit = names.find((name) => hasDecorator(context, node, source, name))
                        if (hit !== undefined) context.report({ node, messageId: "foreign", data: { name: hit, role } })
                    }
                })
            },
        }
    },
}

/** True when one decorator node is `name` exported by `source`. */
const hasDecorator = (context, decorator, source, name) => hasClassDecorator(context, { decorators: [decorator] }, source, name)

/** A realtime door injects the hub and nothing else: it reads and pushes, it never writes. */
export const realtimeReadOnly = {
    meta: {
        type: "problem",
        docs: { description: "The only value a realtime door injects is the `RealtimeHub` of `platform/realtime`: no `EntityManager`, bus, queue, event bus or domain service." },
        schema: [],
        messages: {
            injects: "`{{what}}` is injected into a realtime door. A realtime door reads and pushes only: it injects the `RealtimeHub` of `platform/realtime` and nothing that can write (an `EntityManager`, a `CommandBus`, an event bus, a queue, a domain service). The push is fed by a reactor that calls the hub; a write belongs in an api feature.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        if (!DOOR_SLOTS.has(hfs.slotOf(context.filename) ?? "") || roleOf(context.filename) === null) return {}
        return {
            ClassDeclaration(node) {
                for (const { node: member, annotation } of injectedMembers(context, node)) {
                    if (!annotation || !isHubType(context, annotation)) context.report({ node: member, messageId: "injects", data: { what: context.sourceCode.getText(member) } })
                }
            },
        }
    },
}

/** True when the parameter carries `@CurrentPrincipal()` declared by `domain/identity`, judged by the declaration the decorator resolves to. */
const isPrincipalParameter = (context, hfs, param) =>
    (param.decorators ?? []).some((decorator) => {
        const callee = decoratorCallee(decorator)
        if (callee?.type !== "Identifier") return false
        const symbol = aliasTarget(context, callee)
        return symbol?.getName() === "CurrentPrincipal" && (symbol.getDeclarations() ?? []).some((declaration) => ownerNameOf(hfs, declaration.getSourceFile().fileName) === "identity" && hfs.tierOf(declaration.getSourceFile().fileName) === "domain")
    })

/** True when the identifier resolves to one of the `names` (parameters of the handler). */
const resolvesTo = (context, identifier, parameters) => {
    for (let scope = context.sourceCode.getScope(identifier); scope; scope = scope.upper) {
        const variable = scope.set.get(identifier.name)
        if (!variable) continue
        return variable.defs.some((definition) => definition.type === "Parameter" && parameters.has(definition.name))
    }
    return false
}

/** A method's principal parameters, declared by the identity decorator or the push stream's platform type. */
const principalParameters = (context, hfs, method, push) => {
    const principals = new Set()
    for (const param of parametersOf(method)) {
        if (!isPrincipalParameter(context, hfs, param) && !(push && isStreamPrincipal(context, param))) continue
        const target = param.type === "AssignmentPattern" ? param.left : param
        if (target.type === "Identifier") principals.add(target)
    }
    return principals
}

/** The hub topic must use the method's principal declaration rather than a shadowing identifier. */
const checkMethodTopics = (context, hfs, method, push) => {
    const principals = principalParameters(context, hfs, method, push)
    for (const { call } of hubSubscriptions(context, method)) {
        let scoped = false
        walk(call.arguments[0], (child) => {
            if (child.type === "Identifier" && resolvesTo(context, child, principals)) scoped = true
        })
        if (!scoped) context.report({ node: call, messageId: "scope" })
    }
}

/** The topic a client subscribes to is built from the principal the handler receives. */
export const realtimeTopicScope = {
    meta: {
        type: "problem",
        docs: { description: "The topic passed to `RealtimeHub.subscribe` is built from the handler's `@CurrentPrincipal()` parameter or the push-only stream's platform `Principal` parameter." },
        schema: [],
        messages: {
            scope: "The topic of this `subscribe` is not built from the principal. A realtime handler takes `@CurrentPrincipal() principal`, or a push-only stream takes the platform `Principal`, and subscribes to a topic made from `principal.id` (plus any verified id), so one client cannot listen to another's channel. A topic taken only from client input is a leak.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const role = roleOf(context.filename)
        if (!DOOR_SLOTS.has(hfs.slotOf(context.filename) ?? "") || role === null) return {}
        const [source, name] = ROLES[role].operation
        return {
            ClassDeclaration(node) {
                const handlers = methodsDecoratedBy(context, node, source, name)
                for (const method of handlers) checkMethodTopics(context, hfs, method, false)
                if (role !== "gateway") return
                for (const method of streamMethods(context, node)) {
                    if (!handlers.includes(method)) checkMethodTopics(context, hfs, method, true)
                }
            },
        }
    },
}

/** The rules this law contributes to the plugin. */
export const rules = {
    "realtime-shape": realtimeShape,
    "realtime-read-only": realtimeReadOnly,
    "realtime-topic-scope": realtimeTopicScope,
}

/** Every rule of this law at `error`. */
export const recommended = {
    "starci-be/realtime-shape": "error",
    "starci-be/realtime-read-only": "error",
    "starci-be/realtime-topic-scope": "error",
}
