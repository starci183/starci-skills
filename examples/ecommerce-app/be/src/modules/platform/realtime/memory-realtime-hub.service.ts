import { Injectable } from "@nestjs/common"
import type { RealtimeHub, RealtimeTopic } from "./realtime.port"

/** One open subscription: takes a pushed value and queues it for its client when the topic accepts it. */
type Subscription = (frame: unknown) => void

@Injectable()
/**
 * The push hub of one app instance: a frame published to a topic reaches every subscription open on that topic in the same
 * process, in order. A subscription is open from the first read of its stream until the reader stops (`return`), and stopping
 * releases it, so a disconnected client leaves nothing behind.
 */
export class MemoryRealtimeHubService implements RealtimeHub {
    private readonly subscriptions = new Map<string, Set<Subscription>>()

    /** Pushes the frame to every subscription of the topic open now. */
    publish<T extends object>(topic: RealtimeTopic<T>, frame: T): void {
        for (const subscription of this.subscriptions.get(topic.name) ?? []) {
            subscription(frame)
        }
    }

    /** The stream of frames pushed to the topic while the reader keeps reading it. */
    subscribe<T extends object>(topic: RealtimeTopic<T>): AsyncIterable<T> {
        return { [Symbol.asyncIterator]: () => this.open(topic) }
    }

    /** How many subscriptions of the topic are open now. */
    subscriberCount(topic: RealtimeTopic<object>): number {
        return this.subscriptions.get(topic.name)?.size ?? 0
    }

    private open<T extends object>(topic: RealtimeTopic<T>): AsyncIterator<T> {
        const waiting: Array<T> = []
        let wake: (() => void) | undefined
        let closed = false
        const subscription: Subscription = (frame) => {
            if (!topic.accepts(frame)) return
            waiting.push(frame)
            wake?.()
        }
        const open = this.subscriptions.get(topic.name) ?? new Set<Subscription>()
        open.add(subscription)
        this.subscriptions.set(topic.name, open)
        return {
            next: async () => {
                while (waiting.length === 0 && !closed) {
                    await new Promise<void>((resolve) => {
                        wake = resolve
                    })
                }
                const frame = waiting.shift()
                return frame === undefined ? { done: true, value: undefined } : { done: false, value: frame }
            },
            return: async () => {
                closed = true
                open.delete(subscription)
                if (open.size === 0) this.subscriptions.delete(topic.name)
                wake?.()
                return { done: true, value: undefined }
            },
        }
    }
}
