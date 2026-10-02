/**
 * GraphQL subscriptions over the graphql-ws protocol (`graphql-transport-ws`, what Nest's Apollo driver serves with
 * `subscriptions: { "graphql-ws": true }`) at the app's GraphQL path, on Node's own WebSocket: no client dependency. A
 * signed-in caller passes its session as `connectionParams.authorization: "Bearer <token>"`. Frames are kept in arrival
 * order; `next()` waits for the next unread one with the world's waitFor semantics (a state, never a sleep).
 *
 * graphql-ws does not acknowledge a `subscribe`: `subscribe()` resolves once the connection is acknowledged and the
 * subscribe message is on the wire. A spec triggers the push AFTER `subscribe()` resolved.
 */
import { TestWorldErrorCode, worldError } from "../errors"
import type { GraphqlErrorObserved } from "./api"

/** The sub-protocol of graphql-ws. */
export const GRAPHQL_WS_PROTOCOL = "graphql-transport-ws"
const DEFAULT_TIMEOUT_MS = 20_000

/** One open subscription as a spec drives it. */
export interface GraphqlSubscription<TData> {
    /** The next unread `data` frame; waits up to `timeoutMs` (default 20000), then fails with TEST_WORLD_TIMED_OUT naming the operation. */
    next(timeoutMs?: number): Promise<TData>
    /** Every `data` frame received so far, oldest first (read or not): `[]` proves nothing was pushed. */
    frames(): ReadonlyArray<TData>
    /** The GraphQL errors the server sent for this subscription (`error` message, or `next` payloads with errors). */
    errors(): ReadonlyArray<GraphqlErrorObserved>
    /** How the socket closed (code and reason), or null while it is open. */
    closed(): { readonly code: number; readonly reason: string } | null
    /** Completes the subscription and closes the socket; resolves once it is closed. Idempotent. */
    close(): Promise<void>
}

/** What opens a subscription. */
export interface SubscribeSpec {
    /** `ws://` or `wss://` URL of the GraphQL path. */
    readonly url: string
    readonly query: string
    readonly variables?: Readonly<Record<string, unknown>>
    /** The session the subscription rides on, sent as `connectionParams.authorization`. */
    readonly bearerToken?: string
    /** How long the connection may take to be acknowledged (default 20000). */
    readonly timeoutMs?: number
    /** The label failures name (the operation key or the document). */
    readonly label: string
}

/** The ws URL of an http base URL and a path. */
export const websocketUrlOf = (baseUrl: string, path: string): string =>
    `${baseUrl.replace(/^http/, "ws").replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`

interface Message {
    readonly type: string
    readonly id?: string
    readonly payload?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value)

/** Opens one subscription; rejects when the server refuses the connection (closes it, or never acknowledges it). */
export const openSubscription = <TData>(spec: SubscribeSpec): Promise<GraphqlSubscription<TData>> =>
    new Promise((resolve, reject) => {
        const id = "1"
        const frames: Array<TData> = []
        const errors: Array<GraphqlErrorObserved> = []
        let read = 0
        let closed: { code: number; reason: string } | null = null
        let wake: (() => void) | null = null
        let acknowledged = false
        const socket = new WebSocket(spec.url, GRAPHQL_WS_PROTOCOL)
        const send = (message: Message): void => socket.send(JSON.stringify(message))
        const notify = (): void => {
            const waiting = wake
            wake = null
            waiting?.()
        }
        const handshake = setTimeout(() => {
            if (acknowledged) return
            socket.close(4408, "connection initialisation timeout")
            reject(worldError(TestWorldErrorCode.TimedOut, `the subscription ${spec.label} was not acknowledged within ${spec.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms`))
        }, spec.timeoutMs ?? DEFAULT_TIMEOUT_MS)

        const subscription: GraphqlSubscription<TData> = {
            next: async (timeoutMs = DEFAULT_TIMEOUT_MS) => {
                const deadline = Date.now() + timeoutMs
                for (;;) {
                    if (read < frames.length) return frames[read++] as TData
                    if (errors.length > 0) throw worldError(TestWorldErrorCode.NotDeclared, `the subscription ${spec.label} answered errors: ${JSON.stringify(errors).slice(0, 700)}`)
                    if (closed !== null) throw worldError(TestWorldErrorCode.TimedOut, `the subscription ${spec.label} closed (${closed.code} ${closed.reason}) before the next frame`)
                    const left = deadline - Date.now()
                    if (left <= 0) throw worldError(TestWorldErrorCode.TimedOut, `timed out after ${timeoutMs}ms waiting for a frame of the subscription ${spec.label}; ${frames.length} frame(s) received, all read`)
                    await new Promise<void>((done) => {
                        const timer = setTimeout(done, left)
                        wake = () => {
                            clearTimeout(timer)
                            done()
                        }
                    })
                }
            },
            frames: () => [...frames],
            errors: () => [...errors],
            closed: () => closed,
            close: async () => {
                if (closed !== null) return
                const ended = new Promise<void>((done) => socket.addEventListener("close", () => done(), { once: true }))
                if (socket.readyState === WebSocket.OPEN) {
                    send({ type: "complete", id })
                    socket.close(1000, "normal closure")
                } else socket.close()
                await ended
            },
        }

        socket.addEventListener("open", () => {
            send({ type: "connection_init", payload: spec.bearerToken === undefined ? {} : { authorization: `Bearer ${spec.bearerToken}` } })
        })
        socket.addEventListener("message", (event: MessageEvent) => {
            let message: Message
            try {
                message = JSON.parse(String(event.data)) as Message
            } catch {
                return
            }
            if (message.type === "ping") send({ type: "pong" })
            else if (message.type === "connection_ack") {
                acknowledged = true
                clearTimeout(handshake)
                send({ type: "subscribe", id, payload: { query: spec.query, variables: spec.variables ?? {} } })
                resolve(subscription)
            } else if (message.id === id && message.type === "next" && isRecord(message.payload)) {
                const payloadErrors = message.payload["errors"]
                if (Array.isArray(payloadErrors)) errors.push(...(payloadErrors as ReadonlyArray<GraphqlErrorObserved>))
                if (message.payload["data"] !== undefined && message.payload["data"] !== null) frames.push(message.payload["data"] as TData)
                notify()
            } else if (message.id === id && message.type === "error") {
                errors.push(...(Array.isArray(message.payload) ? (message.payload as ReadonlyArray<GraphqlErrorObserved>) : [{ message: JSON.stringify(message.payload) }]))
                notify()
            }
        })
        socket.addEventListener("close", (event: { readonly code: number; readonly reason: string }) => {
            closed = { code: event.code, reason: event.reason }
            clearTimeout(handshake)
            notify()
            if (!acknowledged) reject(worldError(TestWorldErrorCode.SignInRefused, `the subscription ${spec.label} was refused: the server closed the connection (${event.code} ${event.reason})`))
        })
        socket.addEventListener("error", () => {
            // the close event that follows carries the code and settles the promise
        })
    })
