import type { EnvSource } from "@modules/platform/config"
import type { EventBusOptions } from "./event-bus.options"

/** What the app's `main.ts` reads for the bus; the connection token is the app root's choice. */
export type EventBusConfig = Omit<EventBusOptions, "connections">

/** Reads the event bus options: the brokers and the group are required, the rest are tunables with literal defaults. */
export const parseEventBusConfig = (env: EnvSource): EventBusConfig => ({
    brokers: env
        .string("EVENT_BUS_BROKERS")
        .split(",")
        .map((broker) => broker.trim())
        .filter((broker) => broker.length > 0),
    groupId: env.string("EVENT_BUS_GROUP_ID"),
    topicPrefix: env.optional("EVENT_BUS_TOPIC_PREFIX") ?? "",
    relayIntervalMs: env.duration("EVENT_BUS_RELAY_INTERVAL", 200),
    relayBatch: env.int("EVENT_BUS_RELAY_BATCH", 50),
    timeoutMs: env.duration("EVENT_BUS_TIMEOUT", 3000),
})
