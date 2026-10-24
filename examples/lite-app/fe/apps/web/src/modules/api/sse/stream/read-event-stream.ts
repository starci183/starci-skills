import { authClient } from "@/modules/auth"

/** One event the stream delivered: its id (the resume point the next request names in `Last-Event-ID`) and its data text. */
export interface ServerSentEvent {
    readonly id: string | undefined
    readonly data: string
}

/** Where a stream reports one failed attempt, as one line (the app's observability, when it wires one). */
export type StreamReporter = (line: string) => void

/** What following a stream takes. */
export interface FollowEventStreamParams {
    /** The absolute URL of the stream. */
    readonly url: string
    /** Stops the stream and its reconnects. */
    readonly signal: AbortSignal
    /** Called each time the stream (re)opens: the moment to read a snapshot, which closes the gap since the last event. */
    readonly onOpen: () => void
    /** Called once per event, in order. */
    readonly onEvent: (event: ServerSentEvent) => void
    /** Where a refused or broken attempt is reported; absent, it stays silent. */
    readonly report?: StreamReporter
}

/** The wait between two attempts: it doubles from the first delay up to the longest, and the server's `retry` replaces the first. */
const RECONNECT_POLICY = { initialDelayMs: 1_000, maxDelayMs: 15_000 } as const

/** The lines of the event-stream format: a blank line ends an event, `:` starts a comment, `field: value` sets a field. */
const LINE_BREAK = /\r\n|\n|\r/

/** Reads the event-stream text chunk by chunk and calls back once per complete event. */
const createEventParser = (onEvent: (event: ServerSentEvent) => void, onRetry: (delayMs: number) => void) => {
    let pending = ""
    let id: string | undefined
    let data: Array<string> = []
    const readLine = (line: string): void => {
        if (line === "") {
            if (data.length > 0) onEvent({ id, data: data.join("\n") })
            data = []
            return
        }
        if (line.startsWith(":")) return
        const colon = line.indexOf(":")
        const field = colon === -1 ? line : line.slice(0, colon)
        const raw = colon === -1 ? "" : line.slice(colon + 1)
        const value = raw.startsWith(" ") ? raw.slice(1) : raw
        if (field === "data") data.push(value)
        if (field === "id") id = value
        if (field === "retry" && /^\d+$/.test(value)) onRetry(Number(value))
    }
    return (chunk: string): void => {
        const lines = (pending + chunk).split(LINE_BREAK)
        pending = lines.pop() ?? ""
        lines.forEach(readLine)
    }
}

/** Opens the stream with the bearer access token; one 401 refreshes the token and asks again. */
const openStream = async (url: string, lastEventId: string | undefined, signal: AbortSignal): Promise<Response> => {
    const request = async (token: string | undefined): Promise<Response> =>
        fetch(url, {
            signal,
            cache: "no-store",
            headers: {
                accept: "text/event-stream",
                ...(token === undefined ? {} : { authorization: `Bearer ${token}` }),
                ...(lastEventId === undefined ? {} : { "last-event-id": lastEventId }),
            },
        })
    let response = await request(await authClient.accessToken())
    if (response.status === 401) response = await request(await authClient.refreshAccessToken())
    if (!response.ok || response.body === null) throw new Error(`the event stream was refused with status ${response.status}`)
    return response
}

/** Waits `delayMs`, or less when the signal aborts. */
const pause = (delayMs: number, signal: AbortSignal): Promise<void> =>
    new Promise((resolve) => {
        const timer = setTimeout(resolve, delayMs)
        signal.addEventListener(
            "abort",
            () => {
                clearTimeout(timer)
                resolve()
            },
            { once: true },
        )
    })

/** Reads the decoded text of a response until it ends, handing each chunk to the parser. */
const drain = async (reader: ReadableStreamDefaultReader<string>, parse: (chunk: string) => void): Promise<void> => {
    const chunk = await reader.read()
    if (chunk.done) return
    parse(chunk.value)
    return drain(reader, parse)
}

/**
 * Follows one event stream until the signal aborts: it opens it with the bearer token, reads its events, and when the connection
 * ends or fails it waits (doubling, capped) and opens it again with the id of the last event as `Last-Event-ID`, so the back end
 * replays what was missed. The browser `EventSource` cannot send an `Authorization` header, which is why this reads the response
 * with `fetch`.
 */
export const followEventStream = async ({ url, signal, onOpen, onEvent, report }: FollowEventStreamParams): Promise<void> => {
    let lastEventId: string | undefined
    let retryMs: number = RECONNECT_POLICY.initialDelayMs
    let delayMs: number = retryMs
    const parse = createEventParser(
        (event) => {
            lastEventId = event.id ?? lastEventId
            onEvent(event)
        },
        (serverDelayMs) => {
            retryMs = serverDelayMs
        },
    )
    const attempt = async (): Promise<void> => {
        if (signal.aborted) return
        try {
            const response = await openStream(url, lastEventId, signal)
            delayMs = retryMs
            onOpen()
            const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader()
            if (reader !== undefined) await drain(reader, parse)
        } catch (error) {
            if (!signal.aborted) report?.(`[event stream] ${error instanceof Error ? error.message : "the stream failed"}`)
        }
        await pause(delayMs, signal)
        delayMs = Math.min(delayMs * 2, RECONNECT_POLICY.maxDelayMs)
        return attempt()
    }
    return attempt()
}
