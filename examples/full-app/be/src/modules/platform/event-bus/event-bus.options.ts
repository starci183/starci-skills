import type { InjectionToken } from "@nestjs/common"

/** What the event bus of one app needs: where the broker is, who the app is to it, and the connection whose outbox it relays. */
export interface EventBusOptions {
    /** The broker addresses, `host:port`. */
    readonly brokers: ReadonlyArray<string>
    /** The consumer group of the app: every instance of one app shares it. */
    readonly groupId: string
    /** What every topic name starts with: empty in a deployment, the run prefix of a test world. */
    readonly topicPrefix: string
    /** The pause between two relay passes over the outbox. */
    readonly relayIntervalMs: number
    /** The most outbox rows one relay pass hands to the broker. */
    readonly relayBatch: number
    /** The deadline of one broker call. */
    readonly timeoutMs: number
    /** The tokens of the shared entity managers of the connections that hold an outbox of the app: the relay reads each of them. */
    readonly connections: ReadonlyArray<InjectionToken>
}
