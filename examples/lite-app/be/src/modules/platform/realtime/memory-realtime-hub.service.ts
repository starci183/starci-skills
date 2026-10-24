import { Injectable } from "@nestjs/common"
import type { MessageEvent } from "@nestjs/common"
import type { Observable } from "rxjs"
import { eventStream } from "./event-stream.mapper"
import type { EventFrame, RealtimeHub, RealtimeSubscribeOptions, RealtimeTopic } from "./realtime.port"

/** One open subscription: takes a pushed value and queues it for its client when the topic accepts it. */
type Subscription = (frame: unknown) => void

/** One retained frame with the id a reconnecting client names to resume after it. */
interface RetainedFrame {
    readonly id: string
    readonly frame: object
}

/** How many frames of one topic the hub keeps for a reconnecting client (the oldest is dropped first). */
export const REPLAY_FRAMES = 64

/** How many topics keep frames at all (the topic published to least recently is dropped first). */
export const REPLAY_TOPICS = 1024

/** The string `id` a frame carries, or undefined: only a frame with an id can be resumed after. */
const idOf = (frame: object): string | undefined => {
    const id: unknown = Reflect.get(frame, "id")
    return typeof id === "string" ? id : undefined
}

@Injectable()
/**
 * The push hub of the one api process: a frame published to a topic reaches every subscription open on that topic in order, and
 * is retained in a bounded buffer so a client that reconnects with its last id receives what it missed. A subscription is open from
 * the first read of its stream until the reader stops (`return`), and stopping releases it, so a disconnected client leaves nothing
 * behind. The hub is single-replica by design: another process has its own subscriptions and its own buffer.
 */
export class MemoryRealtimeHubService implements RealtimeHub {
    private readonly subscriptions = new Map<string, Set<Subscription>>()
    private readonly retained = new Map<string, Array<RetainedFrame>>()

    /** Retains the frame (bounded), then pushes it to every subscription of the topic open now. */
    publish<T extends object>(topic: RealtimeTopic<T>, frame: T): void {
        this.retain(topic, frame)
        for (const subscription of this.subscriptions.get(topic.name) ?? []) {
            subscription(frame)
        }
    }

    /** The stream of frames pushed to the topic (after the `after` frame, when given) while the reader keeps reading it. */
    subscribe<T extends object>(topic: RealtimeTopic<T>, options?: RealtimeSubscribeOptions): AsyncIterable<T> {
        return { [Symbol.asyncIterator]: () => this.open(topic, options?.after) }
    }

    /** The subscription of the topic as server-sent events (see `eventStream`). */
    stream<T extends EventFrame>(
        topic: RealtimeTopic<T>,
        options?: RealtimeSubscribeOptions,
    ): Observable<MessageEvent> {
        return eventStream(this.subscribe(topic, options))
    }

    /** How many subscriptions of the topic are open now. */
    subscriberCount(topic: RealtimeTopic<object>): number {
        return this.subscriptions.get(topic.name)?.size ?? 0
    }

    private retain<T extends object>(topic: RealtimeTopic<T>, frame: T): void {
        const id = idOf(frame)
        if (id === undefined || !topic.accepts(frame)) return
        const kept = this.retained.get(topic.name) ?? []
        this.retained.delete(topic.name)
        kept.push({ id, frame })
        if (kept.length > REPLAY_FRAMES) kept.shift()
        this.retained.set(topic.name, kept)
        if (this.retained.size <= REPLAY_TOPICS) return
        this.retained.delete(String(this.retained.keys().next().value))
    }

    private replayAfter<T extends object>(topic: RealtimeTopic<T>, after: string | undefined): Array<T> {
        if (after === undefined) return []
        const kept = this.retained.get(topic.name) ?? []
        const index = kept.findIndex((entry) => entry.id === after)
        return kept
            .slice(index + 1)
            .map((entry) => entry.frame)
            .filter((frame): frame is T => topic.accepts(frame))
    }

    private open<T extends object>(topic: RealtimeTopic<T>, after: string | undefined): AsyncIterator<T> {
        const waiting: Array<T> = this.replayAfter(topic, after)
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
            next: async function next(): Promise<IteratorResult<T>> {
                if (waiting.length === 0 && !closed) {
                    await new Promise<void>((resolve) => {
                        wake = resolve
                    })
                    return next()
                }
                const frame = waiting.shift()
                return frame === undefined ? { done: true, value: undefined } : { done: false, value: frame }
            },
            return: () => {
                closed = true
                open.delete(subscription)
                if (open.size === 0) this.subscriptions.delete(topic.name)
                wake?.()
                return Promise.resolve({ done: true, value: undefined })
            },
        }
    }
}
