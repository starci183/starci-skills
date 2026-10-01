/**
 * The host of the fakes of a run: starts every declared fake in this process plus ONE control HTTP server the workers talk to.
 *
 * - `POST|GET /control/<fake>/<action>`: JSON body in, `200` JSON out; `{error}` with 4xx/5xx on refusal.
 * - `POST /control/reset`: resets every fake. `POST /control/shutdown`: acknowledged, see {@link FakesHost.shutdownRequested}.
 */
import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { Server, Socket } from "node:net"
import { TestWorldErrorCode, worldError } from "../../errors"
import type { FakeDefinition, FakeInstance, FakeStartContext } from "./contracts"
import { FakeControlRejected } from "./failures"
import { answerJson, closeServer, listenLoopback, readBody, trackSockets } from "./http-kit"

/** One started fake as the world publishes it. */
export interface StartedFake {
    readonly url: string
    readonly host: string
    readonly port: number
    readonly values: Readonly<Record<string, string>>
    readonly endpoints: Readonly<Record<string, string>>
}

/** What `start` answers. */
export interface FakesHostStarted {
    /** The base URL of the control channel. */
    readonly controlUrl: string
    /** Every started fake by name. */
    readonly fakes: Record<string, StartedFake>
}

/** Starts and controls the fakes of a run. */
export class FakesHost {
    private readonly instances = new Map<string, FakeInstance>()
    private control: Server | null = null
    private sockets = new Set<Socket>()
    private shutdownWaiters: Array<() => void> = []
    private shutdownAsked = false

    constructor(
        private readonly definitions: Readonly<Record<string, FakeDefinition>>,
        private readonly context: FakeStartContext,
    ) {}

    /** Starts every fake and the control server. A failing start closes what already started. */
    async start(): Promise<FakesHostStarted> {
        const fakes: Record<string, StartedFake> = {}
        try {
            for (const [name, definition] of Object.entries(this.definitions)) {
                const instance = await definition.start(this.context)
                this.instances.set(name, instance)
                fakes[name] = {
                    url: instance.url,
                    host: instance.host,
                    port: instance.port,
                    values: instance.values,
                    endpoints: instance.endpoints,
                }
            }
            const server = createServer((request, response) => {
                this.route(request, response).catch((cause: unknown) => {
                    if (!response.headersSent) answerJson(response, 500, { error: cause instanceof Error ? cause.message : String(cause) })
                })
            })
            this.sockets = trackSockets(server)
            this.control = server
            const port = await listenLoopback(server)
            return { controlUrl: `http://127.0.0.1:${port}/control`, fakes }
        } catch (cause) {
            await this.close()
            throw worldError(TestWorldErrorCode.InfrastructureFailed, "the fakes host could not start", cause)
        }
    }

    /** Resolves once a client posted `/control/shutdown`. */
    shutdownRequested(): Promise<void> {
        if (this.shutdownAsked) return Promise.resolve()
        return new Promise((resolve) => this.shutdownWaiters.push(resolve))
    }

    /** Resets every fake. */
    async resetAll(): Promise<void> {
        for (const instance of this.instances.values()) await instance.reset()
    }

    /** Stops the control server and every fake. */
    async close(): Promise<void> {
        const server = this.control
        this.control = null
        if (server !== null) await closeServer(server, this.sockets)
        const instances = [...this.instances.values()]
        this.instances.clear()
        await Promise.all(instances.map((instance) => instance.close().catch(() => undefined)))
    }

    private async route(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const method = request.method ?? "GET"
        const segments = new URL(request.url ?? "/", "http://control.local").pathname.split("/").filter((part) => part !== "")
        if (segments[0] !== "control") {
            answerJson(response, 404, { error: "not a control path" })
            return
        }
        const raw = await readBody(request)
        if (segments.length === 2 && segments[1] === "reset" && method === "POST") {
            await this.resetAll()
            answerJson(response, 200, { reset: true })
            return
        }
        if (segments.length === 2 && segments[1] === "shutdown" && method === "POST") {
            this.shutdownAsked = true
            for (const waiter of this.shutdownWaiters) waiter()
            this.shutdownWaiters = []
            answerJson(response, 200, { shutdown: true })
            return
        }
        const [, fake, action] = segments
        if (fake === undefined || action === undefined || segments.length !== 3) {
            answerJson(response, 404, { error: "control paths are /control/<fake>/<action>" })
            return
        }
        const instance = this.instances.get(fake)
        if (instance === undefined) {
            answerJson(response, 404, { error: `no fake named "${fake}"` })
            return
        }
        let body: unknown
        if (raw.trim() !== "") {
            try {
                body = JSON.parse(raw)
            } catch {
                answerJson(response, 400, { error: "the control body is not JSON" })
                return
            }
        }
        try {
            const result = await instance.control(action, body)
            answerJson(response, 200, result === undefined ? null : result)
        } catch (cause) {
            const status = cause instanceof FakeControlRejected ? cause.status : 500
            answerJson(response, status, { error: cause instanceof Error ? cause.message : String(cause) })
        }
    }
}
