/**
 * The payment gateway at the network edge: an HTTP server that speaks the two calls the application client makes
 * (create a payment intent, read a transaction) and delivers the webhook the way the gateway does: by calling the
 * application `/webhooks/sepay` door over HTTP with the shared secret in the Authorization header. Requests to the API are
 * authenticated with the run API key. The application client and webhook door run unchanged; only `SEPAY_BASE_URL` points
 * here. Failures a spec arms: a status or a silence for the next API call, a wrong secret for the next delivery; a delivery
 * can be replayed, and a settlement can be delivered after a delay.
 */
import { createServer } from "node:http"
import type { IncomingMessage, ServerResponse } from "node:http"
import { isRecord } from "@modules/platform/primitives"
import type {
    DelayedSettleParams,
    FailureSpec,
    RecordedRequest,
    SepayIntent,
    SettleParams,
    WebhookDelivery,
    WebhookTarget,
} from "../fakes-control.contracts"
import { worldClock } from "../../kit/world-clock"
import { FailureQueue, RequestLog, answerJson, closeServer, headersOf, listenLoopback, readBody, readJson } from "../fakes-http.service"
import { renderPayload } from "../payload.service"

const CREATE_INTENT_PATH = "/userapi/transactions/qr"
const TRANSACTION_PATH = "/userapi/transactions/details/"
const WEBHOOK_PATH = "/webhooks/sepay"
const WEBHOOK_TIMEOUT_MS = 15_000
const DEFAULT_PERIOD_MS = 30 * 86_400_000

/** The secrets the fake shares with the application configuration. */
export interface SepayFakeSecrets {
    /** The API key the application authenticates its calls with. */
    readonly apiKey: string
    /** The shared secret the fake signs its webhook deliveries with. */
    readonly webhookSecret: string
}

interface StoredIntent extends SepayIntent {
    readonly status: "pending" | "paid" | "failed"
}

/** What the application asked the gateway to create. */
interface CreateRequest {
    readonly reference: string
    readonly amount: number
    readonly currency: string
}

/** What the application answered to a delivery. */
interface DeliveryAnswer {
    readonly status: number
    readonly body: unknown
}

const EMPTY_CREATE: CreateRequest = { reference: "", amount: 0, currency: "" }

const parseCreateBody = (raw: string): CreateRequest => {
    const { value } = readJson(raw)
    if (!isRecord(value)) return EMPTY_CREATE
    const { reference, amount, currency } = value
    return {
        reference: typeof reference === "string" ? reference : "",
        amount: typeof amount === "number" ? amount : 0,
        currency: typeof currency === "string" ? currency : "",
    }
}

/** The payment gateway fake. */
export class SepayFake {
    private readonly log = new RequestLog()
    private readonly failures = new FailureQueue()
    private readonly intents = new Map<string, StoredIntent>()
    private readonly sent: Array<WebhookDelivery> = []
    private readonly lastPayloads = new Map<string, unknown>()
    private readonly timers = new Set<NodeJS.Timeout>()
    private readonly server = createServer((request, response) => {
        void this.answer(request, response)
    })
    private listening = 0
    private sequence = 0

    constructor(private readonly secrets: SepayFakeSecrets) {}

    /** Binds the loopback port. */
    async listen(): Promise<void> {
        this.listening = await listenLoopback(this.server)
    }

    /** Stops the server and cancels every delayed delivery. */
    close(): Promise<void> {
        for (const timer of this.timers) clearTimeout(timer)
        this.timers.clear()
        return closeServer(this.server)
    }

    /** The base URL the application is configured with. */
    get baseUrl(): string {
        return `http://127.0.0.1:${this.listening}`
    }

    /** Arms a failure: a status or a silence for the next API call, a bad signature for the next webhook delivery. */
    failNext(spec: FailureSpec): void {
        this.failures.push(spec)
    }

    /** The API calls received so far. */
    requests(): ReadonlyArray<RecordedRequest> {
        return this.log.all()
    }

    /** The intents created so far, with what the gateway reports for each. */
    allIntents(): ReadonlyArray<SepayIntent> {
        return [...this.intents.values()]
    }

    /** The webhook deliveries made so far, with the answers of the application. */
    deliveries(): ReadonlyArray<WebhookDelivery> {
        return [...this.sent]
    }

    /** Sets what the gateway reports for a transaction and delivers the webhook now; answers what the application replied. */
    settle(params: SettleParams & WebhookTarget): Promise<WebhookDelivery> {
        const intent = this.intents.get(params.gatewayIntentId)
        const periodEnd = params.periodEnd ?? new Date(worldClock.now().getTime() + DEFAULT_PERIOD_MS).toISOString()
        this.intents.set(params.gatewayIntentId, {
            gatewayIntentId: params.gatewayIntentId,
            reference: intent?.reference ?? "",
            amount: intent?.amount ?? 0,
            currency: intent?.currency ?? "",
            checkoutUrl: intent?.checkoutUrl ?? "",
            status: params.status,
            periodEnd,
        })
        const payload = renderPayload("sepay", "webhook-delivery", { id: params.gatewayIntentId, status: params.status, periodEnd })
        this.lastPayloads.set(params.gatewayIntentId, payload)
        return this.deliver(params.gatewayIntentId, params.deliverTo, payload)
    }

    /** Settles now and delivers the webhook after `delayMs`: the gateway reports at once, the callback arrives late. */
    delaySettle(params: DelayedSettleParams & WebhookTarget): void {
        const timer = setTimeout(() => {
            this.timers.delete(timer)
            void this.settle(params)
        }, params.delayMs)
        this.timers.add(timer)
    }

    /** Sends the last delivery of a transaction again, byte for byte, as a gateway does on a retry. */
    replay(gatewayIntentId: string, target: WebhookTarget): Promise<WebhookDelivery> {
        return this.deliver(gatewayIntentId, target.deliverTo, this.lastPayloads.get(gatewayIntentId) ?? {})
    }

    private async deliver(gatewayIntentId: string, deliverTo: string, payload: unknown): Promise<WebhookDelivery> {
        const invalid = this.failures.takeBadSignature()
        const secret = invalid ? `${this.secrets.webhookSecret}-tampered` : this.secrets.webhookSecret
        const signature = invalid ? "invalid" : "valid"
        const delivery = await this.post(deliverTo, secret, payload).then(
            (answer) => ({ gatewayIntentId, signature, httpStatus: answer.status, body: answer.body }) satisfies WebhookDelivery,
            (cause: unknown) =>
                ({ gatewayIntentId, signature, httpStatus: 0, body: cause instanceof Error ? cause.message : String(cause) }) satisfies WebhookDelivery,
        )
        this.sent.push(delivery)
        return delivery
    }

    private async post(deliverTo: string, secret: string, payload: unknown): Promise<DeliveryAnswer> {
        const response = await fetch(`${deliverTo}${WEBHOOK_PATH}`, {
            method: "POST",
            headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        })
        return { status: response.status, body: readJson(await response.text()).value }
    }

    private async answer(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const body = await readBody(request)
        const method = request.method ?? ""
        const path = request.url ?? ""
        this.log.record({ method, path, headers: headersOf(request), body })
        const failure = this.failures.takeInbound()
        if (failure?.timeout === true) return
        if (failure?.status !== undefined) {
            answerJson(response, failure.status, { error: "server_error", message: "injected failure" })
            return
        }
        if (request.headers.authorization !== `Bearer ${this.secrets.apiKey}`) {
            answerJson(response, 401, renderPayload("sepay", "error-unauthorized"))
            return
        }
        if (method === "POST" && path === CREATE_INTENT_PATH) this.createIntent(body, response)
        else if (method === "GET" && path.startsWith(TRANSACTION_PATH)) this.readTransaction(path, response)
        else answerJson(response, 404, renderPayload("sepay", "error-not-found"))
    }

    private createIntent(rawBody: string, response: ServerResponse): void {
        this.sequence += 1
        const gatewayIntentId = `fake-sepay-${String(this.sequence).padStart(6, "0")}`
        const checkoutUrl = `${this.baseUrl}/checkout/${gatewayIntentId}`
        const { reference, amount, currency } = parseCreateBody(rawBody)
        this.intents.set(gatewayIntentId, { gatewayIntentId, reference, amount, currency, checkoutUrl, status: "pending", periodEnd: null })
        answerJson(response, 200, renderPayload("sepay", "create-intent-response", { id: gatewayIntentId, checkoutUrl }))
    }

    private readTransaction(path: string, response: ServerResponse): void {
        const id = decodeURIComponent(path.slice(TRANSACTION_PATH.length))
        const intent = this.intents.get(id)
        if (intent === undefined) {
            answerJson(response, 404, renderPayload("sepay", "error-not-found"))
            return
        }
        if (intent.status === "pending") {
            answerJson(response, 200, renderPayload("sepay", "transaction-pending", { id }))
            return
        }
        answerJson(response, 200, renderPayload("sepay", "transaction-settled", { id, status: intent.status, periodEnd: intent.periodEnd ?? "" }))
    }
}
