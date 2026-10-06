/**
 * `defineHttpFake`: the one way to write an HTTP fake. The framework owns everything generic (loopback server, request
 * recording, armed failures, held sockets, truncated streams, timers, webhook delivery, control actions and the base client);
 * a fake supplies only its protocol: routes, state, values and its own steering actions.
 */
import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { FailureSpec, FakeBridge, FakeClient, FakeDefinition, FakeInstance, FakeStartContext, WebhookDelivery } from "./contracts"
import { FailureQueue, FakeControlRejected, FakeTimers, RequestLog, runBaseControl } from "./failures"
import { closeServer, deliverWebhook, headersOf, listenLoopback, parseForm, parseJson, readBody, trackSockets } from "./http-kit"
import type { WebhookRequest } from "./http-kit"

/** One request a route function reads. */
export interface FakeHttpRequest {
    /** Upper-case method. */
    readonly method: string
    /** Path with query. */
    readonly path: string
    /** Path without query. */
    readonly pathname: string
    readonly query: URLSearchParams
    /** Lower-cased header names. */
    readonly headers: Readonly<Record<string, string>>
    /** The raw body, utf8. */
    readonly rawBody: string
    /** Parameters of the matched route pattern (`/orders/:id`). */
    readonly params: Readonly<Record<string, string>>
    /** The body parsed as JSON; `undefined` when it is not JSON. */
    json(): unknown
    /** The body parsed as a form. */
    form(): URLSearchParams
}

/** What a route answers. */
export interface FakeHttpReply {
    /** Default 200. */
    readonly status?: number
    readonly headers?: Readonly<Record<string, string>>
    /** A string or Buffer as is; anything else as JSON. */
    readonly body?: unknown
    /**
     * A streamed body: each entry is one event written as its own chunk (SSE: `data: {...}\n\n`). Takes precedence over `body`;
     * `truncateStream.afterEvents` counts these entries.
     */
    readonly stream?: ReadonlyArray<string>
}

/** What a route function or control action can use. */
export interface HttpFakeContext<TState, TOptions> {
    /** The current state (replaced by the state factory on reset). */
    readonly state: TState
    readonly options: TOptions
    /** The base URL of this fake. */
    readonly url: string
    readonly host: string
    readonly port: number
    /** The start context of the host. */
    readonly start: FakeStartContext
    /** A run-stable secret by label. */
    secret(label: string): string
    /** Runs delayed work; cancelled by reset and close. */
    schedule(delayMs: number, task: () => unknown): void
    /** Calls the app with a webhook. */
    deliverWebhook(request: WebhookRequest): Promise<WebhookDelivery>
    /** True when a `badSignature` failure was armed for the next delivery (consumed). */
    takeBadSignature(): boolean
}

/** A route function. */
export type HttpFakeHandler<TState, TOptions> = (
    request: FakeHttpRequest,
    context: HttpFakeContext<TState, TOptions>,
) => FakeHttpReply | Promise<FakeHttpReply>

/** One route of a route table; `path` may hold `:param` segments and a final `*`. */
export interface HttpFakeRoute<TState, TOptions> {
    /** Upper-case method, or `*`. */
    readonly method: string
    readonly path: string
    readonly handle: HttpFakeHandler<TState, TOptions>
}

/** A fake-specific steering action. */
export type HttpFakeControlAction<TState, TOptions> = (
    body: unknown,
    context: HttpFakeContext<TState, TOptions>,
) => unknown

/** What a fake declares. */
export interface HttpFakeSpec<TClient extends FakeClient, TOptions, TState> {
    /** Route table, tried in order. */
    readonly routes?: ReadonlyArray<HttpFakeRoute<TState, TOptions>>
    /** Fallback route function for anything the table does not match; without either the fake answers 404. */
    readonly handle?: HttpFakeHandler<TState, TOptions>
    /** Builds a fresh state (start and every reset). */
    readonly state?: (options: TOptions, start: FakeStartContext) => TState
    /** Extra work on reset, after the framework cleared recordings, failures and timers and rebuilt the state. */
    readonly reset?: (context: HttpFakeContext<TState, TOptions>) => Promise<void> | void
    /** The values exposed to the app options. */
    readonly values?: (context: HttpFakeContext<TState, TOptions>) => Record<string, string>
    /** Further named endpoints (absolute URLs). */
    readonly endpoints?: (context: HttpFakeContext<TState, TOptions>) => Record<string, string>
    /** The body answered for an armed `status` failure without `body`. */
    readonly failureBody?: (status: number) => unknown
    /** Extra control actions by name. */
    readonly controlActions?: Readonly<Record<string, HttpFakeControlAction<TState, TOptions>>>
    /** Extends the base client (`failNext`, `requests`, `reset`) with the fake's own methods. */
    /** The typed handle of the fake; it gets the declared options too (a payment fake reads `webhookApp` there). */
    readonly client?: (bridge: FakeBridge, base: FakeClient, options: TOptions) => TClient
}

/** The base client every fake handle starts from. */
export const createBaseClient = (bridge: FakeBridge): FakeClient => ({
    failNext: async (spec: FailureSpec) => {
        await bridge.call("fail-next", spec)
    },
    requests: () => bridge.call("requests"),
    reset: async () => {
        await bridge.call("reset", {})
    },
})

/** Matches a path pattern (`/a/:id/*`) against a pathname; the params, or null. */
export const matchPath = (pattern: string, pathname: string): Record<string, string> | null => {
    const wanted = pattern.split("/").filter((segment) => segment !== "")
    const actual = pathname.split("/").filter((segment) => segment !== "")
    const params: Record<string, string> = {}
    for (let index = 0; index < wanted.length; index += 1) {
        const segment = wanted[index] ?? ""
        if (segment === "*") {
            params["*"] = actual.slice(index).join("/")
            return params
        }
        const value = actual[index]
        if (value === undefined) return null
        if (segment.startsWith(":")) params[segment.slice(1)] = decodeURIComponent(value)
        else if (segment !== value) return null
    }
    return actual.length === wanted.length ? params : null
}

const encodeBody = (reply: FakeHttpReply): { readonly payload: string | Buffer; readonly headers: Record<string, string> } => {
    const headers: Record<string, string> = { ...reply.headers }
    const body = reply.body
    if (body === undefined) return { payload: "", headers }
    if (typeof body === "string" || Buffer.isBuffer(body)) return { payload: body, headers }
    if (!Object.keys(headers).some((name) => name.toLowerCase() === "content-type")) headers["content-type"] = "application/json"
    return { payload: JSON.stringify(body), headers }
}

const writeChunk = (response: ServerResponse, chunk: string | Buffer): Promise<void> =>
    new Promise((resolve) => {
        response.write(chunk, () => resolve())
    })

/** Writes a reply as a chunked response; `cut` stops after N events (or N bytes) and destroys the socket: a premature close. */
const sendReply = async (
    response: ServerResponse,
    reply: FakeHttpReply,
    cut: FailureSpec["truncateStream"] | undefined,
): Promise<void> => {
    const status = reply.status ?? 200
    if (cut === undefined && reply.stream === undefined) {
        const { payload, headers } = encodeBody(reply)
        response.writeHead(status, headers)
        response.end(payload)
        return
    }
    const { payload, headers } = encodeBody(reply)
    const events: ReadonlyArray<string | Buffer> = reply.stream ?? [payload]
    response.writeHead(status, headers)
    if (cut === undefined) {
        for (const event of events) await writeChunk(response, event)
        response.end()
        return
    }
    if (cut.afterEvents !== undefined) {
        for (const event of events.slice(0, cut.afterEvents)) await writeChunk(response, event)
    } else {
        let budget = cut.afterBytes ?? 0
        for (const event of events) {
            const bytes = Buffer.isBuffer(event) ? event : Buffer.from(event, "utf8")
            if (budget <= 0) break
            await writeChunk(response, bytes.subarray(0, budget))
            budget -= bytes.length
        }
    }
    response.socket?.destroy()
}

const toRequest = (
    incoming: IncomingMessage,
    rawBody: string,
    params: Readonly<Record<string, string>>,
): FakeHttpRequest => {
    const path = incoming.url ?? "/"
    const url = new URL(path, "https://fake.local")
    return {
        method: (incoming.method ?? "GET").toUpperCase(),
        path,
        pathname: url.pathname,
        query: url.searchParams,
        headers: headersOf(incoming),
        rawBody,
        params,
        json: () => parseJson(rawBody),
        form: () => parseForm(rawBody),
    }
}

const isFailureOnly = (spec: FailureSpec): boolean => spec.truncateStream === undefined

/**
 * Defines an HTTP fake. The result is a factory: `defineHttpFake(spec)(options)` is the `FakeDefinition` a config declares.
 * Three type arguments are needed to type the state: `defineHttpFake<MyClient, MyOptions, MyState>(...)`.
 */
export const defineHttpFake = <TClient extends FakeClient = FakeClient, TOptions = undefined, TState = undefined>(
    spec: HttpFakeSpec<TClient, TOptions, TState>,
): ((options?: TOptions) => FakeDefinition<TClient>) => {
    return (options?: TOptions): FakeDefinition<TClient> => ({
        kind: "http",
        client: (bridge) => {
            const base = createBaseClient(bridge)
            return spec.client === undefined ? (base as TClient) : spec.client(bridge, base, options as TOptions)
        },
        start: async (start): Promise<FakeInstance> => {
            const resolved = options as TOptions
            const log = new RequestLog()
            const failures = new FailureQueue()
            const timers = new FakeTimers()
            let state = spec.state === undefined ? (undefined as TState) : spec.state(resolved, start)
            let baseUrl = ""
            let boundPort = 0
            const context: HttpFakeContext<TState, TOptions> = {
                get state() {
                    return state
                },
                options: resolved,
                get url() {
                    return baseUrl
                },
                host: "127.0.0.1",
                get port() {
                    return boundPort
                },
                start,
                secret: (label) => start.secret(label),
                schedule: (delayMs, task) => timers.schedule(delayMs, task),
                deliverWebhook,
                takeBadSignature: () => failures.takeBadSignature(),
            }

            const dispatch = async (incoming: IncomingMessage, response: ServerResponse): Promise<void> => {
                const rawBody = await readBody(incoming)
                const probe = toRequest(incoming, rawBody, {})
                const record = log.begin({ method: probe.method, path: probe.path, headers: probe.headers, body: rawBody })
                const failure = failures.takeInbound(probe.method, probe.path)
                if (failure?.timeout === true) return
                if (failure?.status !== undefined && isFailureOnly(failure)) {
                    record.setStatus(failure.status)
                    const body = failure.body ?? spec.failureBody?.(failure.status) ?? { error: "injected failure" }
                    await sendReply(response, { status: failure.status, body }, undefined)
                    return
                }
                let handler: HttpFakeHandler<TState, TOptions> | undefined = spec.handle
                let params: Record<string, string> = {}
                for (const route of spec.routes ?? []) {
                    if (route.method !== "*" && route.method.toUpperCase() !== probe.method) continue
                    const matched = matchPath(route.path, probe.pathname)
                    if (matched === null) continue
                    handler = route.handle
                    params = matched
                    break
                }
                const reply: FakeHttpReply =
                    handler === undefined
                        ? { status: 404, body: { error: `no route for ${probe.method} ${probe.pathname}` } }
                        : await handler(toRequest(incoming, rawBody, params), context)
                if (failure?.truncateStream !== undefined) {
                    record.setStatus(reply.status ?? 200)
                    await sendReply(response, reply, failure.truncateStream)
                    return
                }
                record.setStatus(reply.status ?? 200)
                await sendReply(response, reply, undefined)
            }

            const server = createServer((incoming, response) => {
                dispatch(incoming, response).catch((cause: unknown) => {
                    if (response.headersSent) {
                        response.socket?.destroy()
                        return
                    }
                    response.writeHead(500, { "content-type": "application/json" })
                    response.end(JSON.stringify({ error: cause instanceof Error ? cause.message : String(cause) }))
                })
            })
            const sockets = trackSockets(server)
            boundPort = await listenLoopback(server)
            baseUrl = `http://127.0.0.1:${boundPort}`

            const reset = async (): Promise<void> => {
                log.clear()
                failures.clear()
                timers.clear()
                state = spec.state === undefined ? (undefined as TState) : spec.state(resolved, start)
                await spec.reset?.(context)
            }

            return {
                url: baseUrl,
                host: "127.0.0.1",
                port: boundPort,
                values: spec.values?.(context) ?? {},
                endpoints: spec.endpoints?.(context) ?? {},
                control: async (action, body) => {
                    const base = await runBaseControl(action, body, { failures, log, reset })
                    if (base.handled) return base.result
                    const custom = spec.controlActions?.[action]
                    if (custom === undefined) throw new FakeControlRejected(404, `unknown control action "${action}"`)
                    return custom(body, context)
                },
                reset,
                close: async () => {
                    timers.clear()
                    await closeServer(server, sockets)
                },
            }
        },
    })
}
