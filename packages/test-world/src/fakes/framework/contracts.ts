/**
 * Layer (b), the fakes framework: network-edge fakes for SaaS we do not operate (payment gateways, mail hosts, model
 * providers). A fake is a real server on a loopback port: the app's real client (form, signature, deadline, parsing) runs
 * unchanged against it and only its URL points here. The fakes of a run live in the jest parent process (started by the
 * globalSetup, so they are shared by every spec worker), and a spec steers and reads them over one HTTP control channel:
 * `world.fake.<name>.<method>()`.
 *
 * Every fake records the requests it received and can be told to fail: `failNext` (status, timeout, badSignature,
 * truncated stream). Payment fakes also `replayWebhook` and `delayWebhook` towards the app under test, signing with the
 * real scheme of the provider.
 */

/** How the next matching call (or webhook delivery) misbehaves. */
export interface FailureSpec {
    /** Answer this HTTP status (with `body` when given, else an empty provider-shaped error body). SMTP: a 4xx/5xx reply code. */
    readonly status?: number
    /** The body to answer with `status`. */
    readonly body?: unknown
    /** Never answer: the connection stays open until the client's own deadline. */
    readonly timeout?: boolean
    /** Deliver a webhook (or sign a response) with a wrong signature. */
    readonly badSignature?: boolean
    /** Send a streamed response (`openai-compatible`) and cut it after this many events/bytes: the client sees a truncated stream. */
    readonly truncateStream?: { readonly afterEvents?: number; readonly afterBytes?: number }
    /** How many matching calls fail (default 1). */
    readonly times?: number
    /** Restrict the failure to calls whose method and/or path (prefix) match. */
    readonly match?: { readonly method?: string; readonly pathStartsWith?: string }
}

/** One request a fake received, oldest first; a spec checks the contract (what the app sent) with it, never business outcomes. */
export interface RecordedRequest {
    /** ISO time. */
    readonly at: string
    readonly method: string
    /** Path with query. */
    readonly path: string
    /** Lower-cased header names. */
    readonly headers: Readonly<Record<string, string>>
    /** The raw body as text (utf8). */
    readonly body: string
    /** The HTTP status the fake answered (0 when it never answered: timeout). SMTP: the last reply code. */
    readonly status: number
}

/** What a payment fake sends to the app under test and how the app answered. */
export interface WebhookDelivery {
    /** Which gateway transaction/intent the delivery is about. */
    readonly reference: string
    /** The URL called. */
    readonly url: string
    /** The exact body sent. */
    readonly body: string
    /** The headers sent (signature included). */
    readonly headers: Readonly<Record<string, string>>
    /** The HTTP status the app answered. */
    readonly status: number
    /** The app's response body. */
    readonly response: string
    /** ISO time. */
    readonly at: string
}

/** The methods every fake handle has. */
export interface FakeClient {
    /** Arms a failure for the next matching call(s). */
    failNext(spec: FailureSpec): Promise<void>
    /** The requests the fake received since the last reset, oldest first. */
    requests(): Promise<ReadonlyArray<RecordedRequest>>
    /** Forgets recorded requests, armed failures and fake state (the world calls it before every spec file). */
    reset(): Promise<void>
}

/** The typed HTTP bridge from a worker to a fake living in the jest parent process. */
export interface FakeBridge {
    /** Calls `POST /control/<fake>/<action>` (or GET when `body` is undefined) and answers the parsed JSON. */
    call<T>(action: string, body?: unknown): Promise<T>
    /** The base URL of the app that receives webhooks (the first listening app of the world, or the one named by `app`). */
    webhookTarget(app?: string): string
}

/** What a started fake hands back to the host. */
export interface FakeInstance {
    /** The base URL of an HTTP fake (empty for SMTP). */
    readonly url: string
    readonly host: string
    readonly port: number
    /** Values the app options need (`apiKey`, `webhookSecret`, `tmnCode`, ...). */
    readonly values: Readonly<Record<string, string>>
    /** Further named endpoints (`tokenUrl`, ...). */
    readonly endpoints: Readonly<Record<string, string>>
    /** Runs a control action sent by the handle in a worker. Throws to answer 4xx/5xx. */
    control(action: string, body: unknown): Promise<unknown>
    /** Clears recordings, armed failures and state. */
    reset(): Promise<void>
    /** Stops the server and clears timers. */
    close(): Promise<void>
}

/** What the host gives a fake when it starts it. */
export interface FakeStartContext {
    /** The run token. */
    readonly runId: string
    /** A run-stable random secret by label. */
    secret(label: string): string
    /** The current time (the host clock). */
    now(): Date
}

/** One fake of the world: how to start it (parent process) and how a spec drives it (worker). */
export interface FakeDefinition<TClient extends FakeClient = FakeClient> {
    /** `http` or `smtp`; documentation and status output. */
    readonly kind: "http" | "smtp"
    /** Starts the fake server on a free loopback port. */
    start(context: FakeStartContext): Promise<FakeInstance>
    /** Builds the typed handle a spec holds at `world.fake.<name>`. */
    client(bridge: FakeBridge): TClient
}
