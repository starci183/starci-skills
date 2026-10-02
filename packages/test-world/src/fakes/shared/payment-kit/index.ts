/**
 * What the four payment fakes (vnpay, momo, payos, sepay) share, so each fake holds only its protocol: the book of webhook
 * deliveries with byte-identical replay, the delivery itself (any HTTP method), the control-body readers and the one typed
 * client the four expose (`intents`, `deliveries`, `settle`, `fail`, `delayWebhook`, `replayWebhook`).
 */
import type { FakeBridge, FakeClient, WebhookDelivery } from "../../framework/contracts"
import { FakeControlRejected } from "../../framework/failures"

/** The wrong-secret suffix a `badSignature` failure signs with. */
export const TAMPERED_SUFFIX = "-tampered"

/** `secret`, or a wrong one when a bad signature was armed. */
export const secretFor = (secret: string, bad: boolean): string => (bad ? `${secret}${TAMPERED_SUFFIX}` : secret)

/** What a delivery sends. */
export interface OutgoingDelivery {
    readonly reference: string
    readonly method: "GET" | "POST"
    /** The full URL called (the query included for GET). */
    readonly url: string
    /** The exact body ("" for GET). */
    readonly body: string
    readonly headers: Readonly<Record<string, string>>
}

/** Calls the app; a network failure answers status 0 with the reason (the app being down is a result, not a crash). */
export const sendOutgoing = async (outgoing: OutgoingDelivery, timeoutMs = 10_000): Promise<WebhookDelivery> => {
    const at = new Date().toISOString()
    const base = { reference: outgoing.reference, url: outgoing.url, body: outgoing.body, headers: outgoing.headers, at }
    try {
        const response = await fetch(outgoing.url, {
            method: outgoing.method,
            headers: outgoing.headers,
            body: outgoing.method === "GET" ? undefined : outgoing.body,
            signal: AbortSignal.timeout(timeoutMs),
        })
        return { ...base, status: response.status, response: await response.text() }
    } catch (cause) {
        return { ...base, status: 0, response: cause instanceof Error ? cause.message : String(cause) }
    }
}

/** The deliveries a fake made and the last request per reference, for a byte-identical replay. */
export class DeliveryBook {
    private readonly sent: Array<WebhookDelivery> = []
    private readonly last = new Map<string, OutgoingDelivery>()

    /** Sends, remembers the request as the last one of its reference and records the answer. */
    async deliver(outgoing: OutgoingDelivery): Promise<WebhookDelivery> {
        this.last.set(outgoing.reference, outgoing)
        return this.record(await sendOutgoing(outgoing))
    }

    /** The last request sent for `reference`, or null. */
    lastOf(reference: string): OutgoingDelivery | null {
        return this.last.get(reference) ?? null
    }

    /** Sends the last request of `reference` again, unchanged; null when nothing was sent for it. */
    async replay(reference: string): Promise<WebhookDelivery | null> {
        const outgoing = this.last.get(reference)
        return outgoing === undefined ? null : this.record(await sendOutgoing(outgoing))
    }

    /** Everything delivered so far, oldest first. */
    all(): ReadonlyArray<WebhookDelivery> {
        return [...this.sent]
    }

    private record(delivery: WebhookDelivery): WebhookDelivery {
        this.sent.push(delivery)
        return delivery
    }
}

/** Reads a control body as an object or rejects with 400. */
export const controlRecord = (body: unknown, action: string): Readonly<Record<string, unknown>> => {
    if (typeof body !== "object" || body === null || Array.isArray(body)) throw new FakeControlRejected(400, `${action} needs an object body`)
    return body as Readonly<Record<string, unknown>>
}

/** A required non-empty string of a control body. */
export const controlString = (record: Readonly<Record<string, unknown>>, key: string, action: string): string => {
    const value = record[key]
    if (typeof value !== "string" || value === "") throw new FakeControlRejected(400, `${action} needs "${key}" (string)`)
    return value
}

/** An optional string of a control body. */
export const controlOptionalString = (record: Readonly<Record<string, unknown>>, key: string): string | undefined => {
    const value = record[key]
    return typeof value === "string" && value !== "" ? value : undefined
}

/** A required number of a control body. */
export const controlNumber = (record: Readonly<Record<string, unknown>>, key: string, action: string): number => {
    const value = record[key]
    if (typeof value !== "number" || !Number.isFinite(value)) throw new FakeControlRejected(400, `${action} needs "${key}" (number)`)
    return value
}

/** Joins the app base URL (`bridge.webhookTarget()`), and a path that starts with `/`. */
export const appUrl = (deliverTo: string, path: string): string => `${deliverTo.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`

/** A path option normalised to start with `/`. */
export const normalizePath = (path: string): string => (path.startsWith("/") ? path : `/${path}`)

/** What every payment fake is declared with besides its protocol options. */
export interface PaymentWebhookOptions {
    /**
     * The declared app whose listener receives the webhooks (default: the first listening app of the world). Name it when the
     * world boots several listening apps and the webhook door lives in one of them.
     */
    readonly webhookApp?: string
}

/** The methods every payment fake handle has, over the provider's own parameter types. */
export interface PaymentClient<TIntent, TSettle, TFail, TDelay> extends FakeClient {
    /** What the app created at the gateway, with amounts, references and status. */
    intents(): Promise<ReadonlyArray<TIntent>>
    /** The webhooks the fake delivered and what the app answered, oldest first. */
    deliveries(): Promise<ReadonlyArray<WebhookDelivery>>
    /** The transaction succeeds and the fake calls the app's webhook door now; answers the delivery. */
    settle(params: TSettle): Promise<WebhookDelivery>
    /** The provider reports a failure/cancellation and the fake calls the app's webhook door now. */
    fail(params: TFail): Promise<WebhookDelivery>
    /** Settles now (the gateway reports it) and calls the webhook door after `delayMs`; timers are cleared on reset. */
    delayWebhook(params: TDelay): Promise<void>
    /** Sends the last webhook of a reference again, byte for byte, as a gateway does on a retry. */
    replayWebhook(reference: string): Promise<WebhookDelivery>
}

/** Builds the client methods; every call that reaches the app carries `deliverTo` (the app under test). */
export const paymentClient = <TIntent, TSettle extends object, TFail extends object, TDelay extends object>(
    bridge: FakeBridge,
    base: FakeClient,
    options: PaymentWebhookOptions | undefined,
): PaymentClient<TIntent, TSettle, TFail, TDelay> => {
    const target = (): string => bridge.webhookTarget(options?.webhookApp)
    return {
        ...base,
        intents: () => bridge.call("intents"),
        deliveries: () => bridge.call("deliveries"),
        settle: (params) => bridge.call("settle", { ...params, deliverTo: target() }),
        fail: (params) => bridge.call("fail", { ...params, deliverTo: target() }),
        delayWebhook: async (params) => {
            await bridge.call("delay-webhook", { ...params, deliverTo: target() })
        },
        replayWebhook: (reference) => bridge.call("replay-webhook", { reference, deliverTo: target() }),
    }
}
