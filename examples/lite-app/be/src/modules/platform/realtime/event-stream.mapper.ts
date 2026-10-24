import type { MessageEvent } from "@nestjs/common"
import { Observable } from "rxjs"
import type { EventFrame } from "./realtime.port"

/**
 * How often an idle stream writes a comment frame. It stays below the idle timeouts of the edge (Caddy, Traefik, Cloudflare), so a
 * quiet channel is never cut as an idle connection.
 */
export const HEARTBEAT_MS = 20_000

/** The reconnect delay the client waits before it opens the stream again, sent once when the stream opens. */
export const RECONNECT_MS = 3_000

/**
 * Turns the frames of one hub subscription into the server-sent events of one HTTP response: an opening frame that carries the
 * reconnect delay, one event per frame with the frame id as the event `id` (the `Last-Event-ID` of a reconnect), and a comment
 * heartbeat while the channel is idle. Unsubscribing, which Nest does when the client disconnects, stops the heartbeat and returns
 * the hub iterator, so the hub holds no subscription for a client that left.
 */
export const eventStream = <T extends EventFrame>(
    frames: AsyncIterable<T>,
    heartbeatMs: number = HEARTBEAT_MS,
): Observable<MessageEvent> =>
    new Observable<MessageEvent>((subscriber) => {
        const iterator = frames[Symbol.asyncIterator]()
        subscriber.next({ retry: RECONNECT_MS, comment: "open" })
        const beat = setInterval(() => subscriber.next({ comment: "heartbeat" }), heartbeatMs)
        const pump = async (): Promise<void> => {
            try {
                for await (const frame of { [Symbol.asyncIterator]: () => iterator }) {
                    subscriber.next({ id: frame.id, data: frame })
                }
                subscriber.complete()
            } catch (cause) {
                subscriber.error(cause)
            }
        }
        void pump()
        return () => {
            clearInterval(beat)
            void iterator.return?.()
        }
    })
