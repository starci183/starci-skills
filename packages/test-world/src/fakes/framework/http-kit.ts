/** Plumbing of HTTP fakes: reading requests, answering, loopback listening, webhook delivery, body parsing helpers. */
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Server, Socket } from "node:net"
import type { WebhookDelivery } from "./contracts"

/** Reads a whole request body as utf8 text. */
export const readBody = async (request: IncomingMessage): Promise<string> => {
    const chunks: Array<Buffer> = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array))
    return Buffer.concat(chunks).toString("utf8")
}

/** The request headers as a record of lower-case names. */
export const headersOf = (request: IncomingMessage): Record<string, string> => {
    const headers: Record<string, string> = {}
    for (const [name, value] of Object.entries(request.headers)) {
        if (value !== undefined) headers[name] = Array.isArray(value) ? value.join(", ") : value
    }
    return headers
}

/** Text read as JSON without throwing: the parsed value, or `undefined` when it is not JSON. */
export const parseJson = (text: string): unknown => {
    try {
        return JSON.parse(text)
    } catch {
        return undefined
    }
}

/** Reads an `application/x-www-form-urlencoded` body. */
export const parseForm = (text: string): URLSearchParams => new URLSearchParams(text)

/** Binds the server on `127.0.0.1` at a port the OS picks and answers the port. */
export const listenLoopback = (server: Server): Promise<number> =>
    new Promise((resolve, reject) => {
        server.once("error", reject)
        server.listen(0, "127.0.0.1", () => {
            const address = server.address()
            resolve(typeof address === "object" && address !== null ? address.port : 0)
        })
    })

/** Keeps the open sockets of a server so `closeServer` can destroy keep-alive and held connections. */
export const trackSockets = (server: Server): Set<Socket> => {
    const sockets = new Set<Socket>()
    server.on("connection", (socket: Socket) => {
        sockets.add(socket)
        socket.once("close", () => sockets.delete(socket))
    })
    return sockets
}

/** Stops a server and destroys every open socket. */
export const closeServer = (server: Server, sockets: Set<Socket>): Promise<void> =>
    new Promise((resolve) => {
        if (!server.listening) {
            resolve()
            return
        }
        server.close(() => resolve())
        for (const socket of sockets) socket.destroy()
    })

/** Answers a JSON body. */
export const answerJson = (response: ServerResponse, status: number, body: unknown): void => {
    response.writeHead(status, { "content-type": "application/json" })
    response.end(JSON.stringify(body))
}

/** What a webhook delivery sends. */
export interface WebhookRequest {
    /** The app URL to call. */
    readonly url: string
    /** The exact body. */
    readonly body: string
    /** The headers (signature included); `content-type` defaults to JSON. */
    readonly headers?: Readonly<Record<string, string>>
    /** Which gateway transaction the delivery is about. */
    readonly reference?: string
    /** Give-up deadline (default 10s). */
    readonly timeoutMs?: number
}

/** Calls the app with a webhook; a network failure answers status 0 with the reason as response (the app being down is a result, not a crash). */
export const deliverWebhook = async (request: WebhookRequest): Promise<WebhookDelivery> => {
    const headers = { "content-type": "application/json", ...request.headers }
    const at = new Date().toISOString()
    const base = { reference: request.reference ?? "", url: request.url, body: request.body, headers, at }
    try {
        const response = await fetch(request.url, {
            method: "POST",
            headers,
            body: request.body,
            signal: AbortSignal.timeout(request.timeoutMs ?? 10_000),
        })
        return { ...base, status: response.status, response: await response.text() }
    } catch (cause) {
        return { ...base, status: 0, response: cause instanceof Error ? cause.message : String(cause) }
    }
}
