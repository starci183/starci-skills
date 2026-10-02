/**
 * The rules that hold the event-bus and queue patterns (catalog R132 `BE_OUTBOX_WRITE_TX`, R133 `BE_EVENT_CONSUMER_SHAPE`,
 * R134 `BE_QUEUE_PRODUCER_SHAPE`).
 *
 * The one durable path of an event is: a domain service writes the outbox row in ITS transaction (`eventBus.publish(event, tx)`), the
 * relay hands the row to Kafka, a consumer in `transport/message` receives it and dispatches one command. A queue job takes the same
 * path through a typed producer (`<queue>Queue.enqueueX(payload, tx)`) and BullMQ. Raw Kafka and BullMQ clients are owned by
 * `platform/event-bus` and `platform/queue` (R90 `BE_INFRA_OWNER`); Nest's in-process buses are refused by `no-event-bus`.
 *
 * Every rule identifies what it judges by TYPE ORIGIN (the `EventBus` port declared by `platform/event-bus`, the `QueueOutbox` port of
 * `platform/queue`, typeorm's `EntityManager`) and by the slot view (tiers, `be.transport.message`, `be.queues`); none matches a
 * variable, class or method name written in the source, except the contract's own members `publish`, `eventName` and `eventId`.
 */
import ts from "typescript"
import { walk } from "./lib/ast.mjs"
import { hfsOf, inTestWorld } from "./lib/hfs.mjs"
import { infraTypeOf } from "./lib/persistence.mjs"
import { baseName, isOwnedType, ownerNameOf } from "./lib/ports.mjs"
import { resolveVariable, transactionCallback } from "./lib/transactions.mjs"
import { typeOrigins, typed } from "./lib/types.mjs"

/** The `EventBus` port of `platform/event-bus`. */
const isEventBusType = (context, node) => isOwnedType(context, node, { name: "EventBus", capability: "event-bus", tier: "platform" })

/** The `EventConsumer` port of `platform/event-bus`. */
const isEventConsumerType = (context, node) => isOwnedType(context, node, { name: "EventConsumer", capability: "event-bus", tier: "platform" })

/** The `EventDelivery` type of `platform/event-bus`. */
const isEventDeliveryType = (context, node) => isOwnedType(context, node, { name: "EventDelivery", capability: "event-bus", tier: "platform" })

/** The `QueueOutbox` port of `platform/queue`. */
const isQueueOutboxType = (context, node) => isOwnedType(context, node, { name: "QueueOutbox", capability: "queue", tier: "platform" })

/** True for a file the rules leave alone: the owners themselves, and the test composition (the world, e2e and fixtures). */
const isExempt = (hfs, file) => {
    const tier = hfs.tierOf(file)
    if (tier === "e2e" || tier === "fixtures" || inTestWorld(hfs, file)) return true
    return tier === "platform" && ["event-bus", "queue"].includes(ownerNameOf(hfs, file))
}

/** The index of the parameter of a signature declaration typed as typeorm's `EntityManager`, or -1. */
const transactionParameterIndex = (checker, declaration) => {
    const parameters = declaration?.parameters ?? []
    return parameters.findIndex((parameter) => {
        const type = checker.getTypeAtLocation(parameter)
        const symbol = type.getSymbol?.()
        return symbol?.getName() === "EntityManager" && String(symbol.declarations?.[0]?.getSourceFile().fileName ?? "").replace(/\\/g, "/").includes("/node_modules/typeorm/")
    })
}

/**
 * What an expression passed as the transaction is: the transactional manager a `.transaction(async (manager) => ...)` callback
 * receives, or a function parameter typed as the `EntityManager` (a helper that runs inside the caller's transaction).
 * The injected shared manager (`this.entityManager`), a local alias and any other expression are not proof of a transaction.
 */
const isTransactionManager = (context, argument) => {
    if (argument?.type !== "Identifier") return false
    const variable = resolveVariable(context.sourceCode, argument)
    const definition = variable?.defs[0]
    if (definition?.type !== "Parameter") return false
    const owner = definition.node
    const call = owner.parent
    if (call?.type === "CallExpression" && transactionCallback(context, call) === owner) return true
    if (owner.parent?.type === "FunctionExpression" && owner.parent.parent?.kind === "constructor") return false
    if (owner.parent?.kind === "constructor") return false
    return infraTypeOf(context, definition.name) === "EntityManager"
}

/** The outbox-writing call a node is: `{ kind: "publish", argument }` or `{ kind: "producer", argument }`, or null. */
const outboxWriteOf = (context, hfs, node) => {
    const callee = node.callee
    if (callee.type === "MemberExpression" && !callee.computed && callee.property.type === "Identifier" && callee.property.name === "publish" && isEventBusType(context, callee.object)) {
        return { kind: "publish", argument: node.arguments[1], expected: 1 }
    }
    const { checker, toTs } = typed(context)
    const tsNode = toTs(node)
    const declaration = tsNode ? checker.getResolvedSignature(tsNode)?.declaration : undefined
    if (!declaration) return null
    const file = declaration.getSourceFile().fileName
    if (hfs.tierOf(file) !== "queues") return null
    const index = transactionParameterIndex(checker, declaration)
    return index < 0 ? null : { kind: "producer", argument: node.arguments[index], expected: index }
}

/** `eventBus.publish(event, tx)` and a queue producer's `enqueueX(payload, tx)` are called only from `modules/domain`, inside its transaction. */
export const outboxWriteTx = {
    meta: {
        type: "problem",
        docs: { description: "The outbox is written only by a domain service, with the transaction manager of its own transaction." },
        schema: [],
        messages: {
            foreignTier: "`{{call}}` writes the outbox outside `modules/domain`. An event or a queue job is a consequence of a domain change: the domain service that makes the change publishes it inside the same transaction. A handler, a consumer or a job asks a domain service to act, and an integration or a platform capability never publishes.",
            noTransaction: "`{{call}}` does not pass the transaction manager of its own transaction. The outbox row must commit or roll back with the domain change: call it inside `this.entityManager.transaction(async (manager) => { ... })` and pass that `manager` (or a function parameter typed `EntityManager` that the transaction hands down). The injected shared manager, an alias or an outer manager is not the transaction.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        if (isExempt(hfs, context.filename)) return {}
        const inDomain = hfs.tierOf(context.filename) === "domain"
        return {
            CallExpression(node) {
                const write = outboxWriteOf(context, hfs, node)
                if (!write) return
                const call = context.sourceCode.getText(node.callee)
                if (!inDomain) context.report({ node, messageId: "foreignTier", data: { call } })
                else if (!isTransactionManager(context, write.argument)) context.report({ node, messageId: "noTransaction", data: { call } })
            },
        }
    },
}

/** The `eventName` literal of the event class an expression names (`typeof OrderPlacedEvent` has a static `eventName`), or null. */
const eventNameOf = (context, expression) => {
    const { checker, toTs } = typed(context)
    const tsNode = toTs(expression)
    if (!tsNode) return null
    const property = checker.getTypeAtLocation(tsNode).getProperty("eventName")
    if (!property) return null
    const type = checker.getTypeOfSymbolAtLocation(property, tsNode)
    return type.isStringLiteral() ? type.value : null
}

/** True when the node is a `.eventId` member read on a value typed as the `EventDelivery` of `platform/event-bus`. */
const readsDeliveryEventId = (context, node) =>
    node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier" && node.property.name === "eventId" && isEventDeliveryType(context, node.object)

/** The kebab stem of an event name: dots become dashes. */
const stemOfEvent = (name) => name.split(".").join("-")

/** A message consumer is the one door of an event: placed in `transport/message`, named after its event, and it forwards the event id. */
export const eventConsumerShape = {
    meta: {
        type: "problem",
        docs: { description: "A class implementing `EventConsumer` is `transport/message/<event>.consumer.ts`, named after its event class's `eventName`, and forwards `delivery.eventId`; a `.consumer.ts` implements `EventConsumer`." },
        schema: [],
        messages: {
            placement: "`{{name}}` implements `EventConsumer` outside a `.consumer.ts` file of the message transport (`transport/message/<event>.consumer.ts`). A consumer is a transport door: move it there.",
            notConsumer: "This `.consumer.ts` file declares `{{name}}`, which does not implement `EventConsumer` of `platform/event-bus`. The message transport holds only event consumers.",
            eventUnknown: "`{{name}}.event` must be an event class whose static `eventName` is a string literal (`static readonly eventName = \"order.placed\"`), so the consumer and its contract entry are one name.",
            stem: "The consumer of `{{event}}` is `{{expected}}.consumer.ts`, but this file is `{{actual}}.consumer.ts`. A consumer is named after the event it handles (dots become dashes).",
            noEventId: "`{{name}}.handle` never reads `delivery.eventId`. Delivery is at least once: pass the event id to the command so the domain service claims it in `platform/inbox` inside its own transaction and a redelivery is a no-op.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const file = context.filename
        const inTransport = hfs.slotOf(file) === "be.transport.message"
        const isConsumerFile = baseName(file).endsWith(".consumer.ts")
        const check = (node) => {
            const name = node.id?.name ?? "this class"
            const implementsConsumer = (node.implements ?? []).some((entry) => isEventConsumerType(context, entry))
            if (!implementsConsumer) {
                if (inTransport && isConsumerFile) context.report({ node: node.id ?? node, messageId: "notConsumer", data: { name } })
                return
            }
            if (!inTransport || !isConsumerFile) {
                context.report({ node: node.id ?? node, messageId: "placement", data: { name } })
                return
            }
            const eventProperty = node.body.body.find((member) => member.type === "PropertyDefinition" && !member.computed && member.key.type === "Identifier" && member.key.name === "event")
            const event = eventProperty?.value ? eventNameOf(context, eventProperty.value) : null
            if (event === null) context.report({ node: eventProperty ?? node.id ?? node, messageId: "eventUnknown", data: { name } })
            else {
                const actual = baseName(file).slice(0, -".consumer.ts".length)
                if (stemOfEvent(event) !== actual) context.report({ node: node.id ?? node, messageId: "stem", data: { event, expected: stemOfEvent(event), actual } })
            }
            const handle = node.body.body.find((member) => member.type === "MethodDefinition" && !member.computed && member.key.type === "Identifier" && member.key.name === "handle")
            const body = handle?.value?.body
            let forwarded = false
            if (body) walk(body, (child) => { if (readsDeliveryEventId(context, child)) forwarded = true })
            if (!forwarded) context.report({ node: handle ?? node.id ?? node, messageId: "noEventId", data: { name } })
        }
        return { ClassDeclaration: check, ClassExpression: check }
    },
}

/** The functions of an exported class or the exported functions of a `.queue.ts`: the producers. */
const producersOf = (program) => {
    const found = []
    for (const statement of program.body) {
        const declaration = statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration" ? statement.declaration : null
        if (!declaration) continue
        if (declaration.type === "FunctionDeclaration") {
            found.push(declaration)
        } else if (declaration.type === "ClassDeclaration") {
            for (const member of declaration.body.body) if (member.type === "MethodDefinition" && member.kind === "method" && member.value) found.push(member.value)
        } else if (declaration.type === "VariableDeclaration") {
            for (const item of declaration.declarations) if (item.init && (item.init.type === "ArrowFunctionExpression" || item.init.type === "FunctionExpression")) found.push(item.init)
        }
    }
    return found
}

/** A producer of a queue passes its own transaction parameter to the outbox, and nothing else writes the outbox there. */
export const queueProducerShape = {
    meta: {
        type: "problem",
        docs: { description: "In `modules/queues/<queue>/<queue>.queue.ts` every producer that writes the `QueueOutbox` takes a `tx` parameter typed `EntityManager` and passes it as the transaction." },
        schema: [],
        messages: {
            noTransaction: "This producer writes the queue outbox without passing its own `tx` parameter (typed `EntityManager`) as the first argument. A queue job is enqueued inside the caller's transaction: declare `tx: EntityManager` and call `outbox.write(tx, ...)`.",
        },
    },
    create(context) {
        const hfs = hfsOf(context)
        const file = context.filename
        if (hfs.slotOf(file) !== "be.queues" || !baseName(file).endsWith(".queue.ts")) return {}
        return {
            "Program:exit"(program) {
                for (const producer of producersOf(program)) {
                    const parameters = producer.params.filter((param) => param.type === "Identifier")
                    const tx = parameters.find((param) => infraTypeOf(context, param) === "EntityManager")
                    walk(producer.body, (node) => {
                        if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression" || !isQueueOutboxType(context, node.callee.object)) return
                        const first = node.arguments[0]
                        const passes = tx !== undefined && first?.type === "Identifier" && first.name === tx.name && resolveVariable(context.sourceCode, first)?.defs[0]?.name === tx
                        if (!passes) context.report({ node, messageId: "noTransaction" })
                    })
                }
            },
        }
    },
}

export const rules = {
    "outbox-write-tx": outboxWriteTx,
    "event-consumer-shape": eventConsumerShape,
    "queue-producer-shape": queueProducerShape,
}

/** The level these laws ask for: `error`, switched off nowhere. */
export const recommended = {
    "starci-be/outbox-write-tx": "error",
    "starci-be/event-consumer-shape": "error",
    "starci-be/queue-producer-shape": "error",
}
