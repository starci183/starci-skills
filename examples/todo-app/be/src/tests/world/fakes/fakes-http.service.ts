/**
 * The plumbing every fake shares: reading a request, answering JSON, recording what was received, queueing the failures a
 * spec armed, and binding a loopback listener on an OS-allocated port.
 */
import type { IncomingMessage, Server as HttpServer, ServerResponse } from "node:http"
import type { Server } from "node:net"
import { worldClock } from "../kit/world-clock"
import type { FailureSpec, RecordedRequest } from "./fakes-control.contracts"

/** Text read as JSON: the parsed value, or the text itself with the parse failure as `cause`. */
export interface JsonReading {
    /** The parsed value, or the text when it is not JSON. */
    readonly value: unknown
    /** The parse failure, null when the text is JSON. */
    readonly cause: unknown
}

/** Reads text as JSON without throwing; text that is not JSON answers itself. */
export const readJson = (text: string): JsonReading => {
    try {
        return { value: JSON.parse(text), cause: null }
    } catch (cause) {
        return { value: text, cause }
    }
}

/** Reads a whole request body as UTF-8 text. */
export const readBody = async (request: IncomingMessage): Promise<string> => {
    const chunks: Array<Buffer> = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    return Buffer.concat(chunks).toString("utf8")
}

/** Answers a JSON body with a status. */
export const answerJson = (response: ServerResponse, status: number, body: unknown): void => {
    response.writeHead(status, { "content-type": "application/json" })
    response.end(JSON.stringify(body))
}

/** The request headers as a plain record of lower-case names. */
export const headersOf = (request: IncomingMessage): Record<string, string> => {
    const headers: Record<string, string> = {}
    for (const [name, value] of Object.entries(request.headers)) {
        if (value !== undefined) headers[name] = Array.isArray(value) ? value.join(", ") : value
    }
    return headers
}

/** The calls one fake received, oldest first. */
export class RequestLog {
    private readonly entries: Array<RecordedRequest> = []

    /** Records one call. */
    record(entry: Omit<RecordedRequest, "at">): void {
        this.entries.push({ at: worldClock.now().toISOString(), ...entry })
    }

    /** Everything recorded so far. */
    all(): ReadonlyArray<RecordedRequest> {
        return [...this.entries]
    }
}

/** The failures a spec armed for one fake: served to the next matching call, once each. */
export class FailureQueue {
    private readonly inbound: Array<FailureSpec> = []
    private deliveries = 0

    /** Arms a failure: a status or a silence waits for the next inbound call, a bad signature for the next webhook delivery. */
    push(spec: FailureSpec): void {
        if (spec.badSignature === true) this.deliveries += 1
        if (spec.status !== undefined || spec.timeout === true) this.inbound.push(spec)
    }

    /** The next armed inbound failure for a call about `subject` (a recipient, for the mail fake), consumed; null when none. */
    takeInbound(subject?: string): FailureSpec | null {
        const index = this.inbound.findIndex((spec) => spec.recipient === undefined || spec.recipient === subject)
        if (index < 0) return null
        const [taken] = this.inbound.splice(index, 1)
        return taken ?? null
    }

    /** True when the next webhook delivery must carry a wrong signature; consumes one armed failure. */
    takeBadSignature(): boolean {
        if (this.deliveries === 0) return false
        this.deliveries -= 1
        return true
    }
}

/** Binds the server to a loopback port the OS chooses and answers the port. */
export const listenLoopback = (server: Server): Promise<number> =>
    new Promise((resolve, reject) => {
        server.once("error", reject)
        server.listen(0, "127.0.0.1", () => {
            const address = server.address()
            resolve(typeof address === "object" && address !== null ? address.port : 0)
        })
    })

/** Stops the server and drops every open connection, including the ones a `timeout` failure left unanswered. */
export const closeServer = (server: HttpServer): Promise<void> =>
    new Promise((resolve) => {
        server.close(() => resolve())
        server.closeAllConnections()
    })
