/**
 * The fakes host: starts the fakes of the external providers (mail host, payment gateway) plus one small JSON
 * control server in the process that runs jest globalSetup, and answers where each listens. A spec worker steers and reads
 * the fakes through the control server (`e2e-fake.client.ts`), so every worker of the run shares the same servers.
 */
import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import { isRecord } from "@modules/platform/primitives"
import type { FailureSpec, FakeName } from "./fakes-control.contracts"
import { answerJson, closeServer, listenLoopback, readBody, readJson } from "./fakes-http.service"
import { SepayFake } from "./sepay/server"
import type { SepayFakeSecrets } from "./sepay/server"
import { SmtpFake } from "./smtp/server"

interface Answer {
    readonly status: number
    readonly body: unknown
}

type Handler = (body: unknown) => Answer | Promise<Answer>

const OK: Answer = { status: 200, body: {} }
const BAD_REQUEST: Answer = { status: 400, body: { error: "malformed control request" } }

const isFailureSpec = (value: unknown): value is FailureSpec =>
    isRecord(value) &&
    (value.status === undefined || typeof value.status === "number") &&
    (value.timeout === undefined || typeof value.timeout === "boolean") &&
    (value.badSignature === undefined || typeof value.badSignature === "boolean") &&
    (value.recipient === undefined || typeof value.recipient === "string")

const settleFields = (
    value: unknown,
): { gatewayIntentId: string; status: "paid" | "failed"; periodEnd?: string; deliverTo: string } | null => {
    if (!isRecord(value)) return null
    const { gatewayIntentId, status, periodEnd, deliverTo } = value
    if (typeof gatewayIntentId !== "string" || typeof deliverTo !== "string") return null
    if (status !== "paid" && status !== "failed") return null
    return typeof periodEnd === "string"
        ? { gatewayIntentId, status, periodEnd, deliverTo }
        : { gatewayIntentId, status, deliverTo }
}

/** Where the fakes listen, as the world configures the application with them. */
export interface FakesEndpoints {
    /** The base URL of the control server. */
    readonly controlUrl: string
    /** The loopback port of the mail host fake. */
    readonly smtpPort: number
    /** The base URL of the payment gateway fake. */
    readonly sepayBaseUrl: string
}

/** The started fakes and their control server. */
export class FakesHost {
    private readonly smtp = new SmtpFake()
    private readonly sepay: SepayFake
    private readonly routes = new Map<string, Handler>()
    private readonly control = createServer((request, response) => {
        void this.route(request, response)
    })
    private controlPort = 0
    private closing: Promise<void> | null = null

    /** Builds the fakes; the secrets are the ones the application configuration carries too. */
    constructor(secrets: SepayFakeSecrets) {
        this.sepay = new SepayFake(secrets)
        this.registerRoutes()
    }

    /** Binds every listener and answers where they are. */
    async start(): Promise<FakesEndpoints> {
        await Promise.all([this.smtp.listen(), this.sepay.listen()])
        this.controlPort = await listenLoopback(this.control)
        return {
            controlUrl: `http://127.0.0.1:${this.controlPort}`,
            smtpPort: this.smtp.port,
            sepayBaseUrl: this.sepay.baseUrl,
        }
    }

    /** Stops every listener; a second call answers the first. */
    close(): Promise<void> {
        this.closing ??= Promise.all([this.smtp.close(), this.sepay.close(), closeServer(this.control)]).then(
            () => undefined,
        )
        return this.closing
    }

    private registerRoutes(): void {
        const fakes: Record<FakeName, { failNext(spec: FailureSpec): void; requests(): unknown }> = {
            smtp: this.smtp,
            sepay: this.sepay,
        }
        for (const [name, fake] of Object.entries(fakes)) {
            this.routes.set(`GET /control/${name}/requests`, () => ({ status: 200, body: fake.requests() }))
            this.routes.set(`POST /control/${name}/fail-next`, (body) => {
                if (!isFailureSpec(body)) return BAD_REQUEST
                fake.failNext(body)
                return OK
            })
        }
        this.routes.set("GET /control/smtp/mails", () => ({ status: 200, body: this.smtp.mails() }))
        this.routes.set("GET /control/sepay/intents", () => ({ status: 200, body: this.sepay.allIntents() }))
        this.routes.set("GET /control/sepay/deliveries", () => ({ status: 200, body: this.sepay.deliveries() }))
        this.routes.set("POST /control/sepay/settle", async (body) => {
            const params = settleFields(body)
            return params === null ? BAD_REQUEST : { status: 200, body: await this.sepay.settle(params) }
        })
        this.routes.set("POST /control/sepay/delay-settle", (body) => {
            const params = settleFields(body)
            if (params === null || !isRecord(body) || typeof body.delayMs !== "number") return BAD_REQUEST
            this.sepay.delaySettle({ ...params, delayMs: body.delayMs })
            return OK
        })
        this.routes.set("POST /control/sepay/replay", async (body) => {
            if (!isRecord(body) || typeof body.gatewayIntentId !== "string" || typeof body.deliverTo !== "string")
                return BAD_REQUEST
            return { status: 200, body: await this.sepay.replay(body.gatewayIntentId, { deliverTo: body.deliverTo }) }
        })
        this.routes.set("POST /control/shutdown", () => {
            setImmediate(() => void this.close())
            return OK
        })
    }

    private async route(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const handler = this.routes.get(`${request.method ?? ""} ${request.url ?? ""}`)
        if (handler === undefined) {
            answerJson(response, 404, { error: "unknown control route" })
            return
        }
        const text = await readBody(request)
        const answer = await this.run(handler, text === "" ? undefined : readJson(text).value)
        answerJson(response, answer.status, answer.body)
    }

    private async run(handler: Handler, body: unknown): Promise<Answer> {
        try {
            return await handler(body)
        } catch (cause) {
            return { status: 500, body: { error: "control handler failed", cause: String(cause) } }
        }
    }
}
