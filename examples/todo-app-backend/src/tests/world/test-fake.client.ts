/**
 * The typed handle a spec holds on the fakes: `world.fake.<service>`. The fakes are third-party servers at the network edge
 * in the jest parent process; this client steers and reads them over the control channel. A spec uses `requests()` only to
 * check the contract (what the app sent); business assertions go through the app API or `world.db`.
 */
import { createE2EHttpClient } from "@e2e-kit/integrations/http/e2e-http-client"
import type { E2EHttpClient } from "@e2e-kit/integrations/http/e2e-http-client"
import type {
    DelayedSettleParams,
    FailureSpec,
    FakeName,
    RecordedRequest,
    SentMail,
    SepayIntent,
    SettleParams,
    WebhookDelivery,
} from "./fakes/fakes-control.contracts"
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"

const CONTROL_TIMEOUT_MS = 30_000

/** What every fake offers: arm a failure, read the recorded calls. */
export interface TestFake {
    /** Arms a failure for the next matching call (`status`, `timeout`) or the next webhook delivery (`badSignature`). */
    failNext(spec: FailureSpec): Promise<void>
    /** The calls the fake received, oldest first. */
    requests(): Promise<ReadonlyArray<RecordedRequest>>
}

/** The identity provider fake. */
export interface TestKeycloakFake extends TestFake {
    /** Registers a person and answers the person id its access tokens carry as `sub`. */
    person(email: string, password: string): Promise<string>
}

/** The mail host fake. */
export interface TestSmtpFake extends TestFake {
    /** The messages the mail host accepted, oldest first. */
    mails(): Promise<ReadonlyArray<SentMail>>
}

/** The payment gateway fake. */
export interface TestSepayFake extends TestFake {
    /** The payment intents the gateway created and what it reports for each. */
    intents(): Promise<ReadonlyArray<SepayIntent>>
    /** The webhooks the gateway delivered to the api and how the api answered each. */
    deliveries(): Promise<ReadonlyArray<WebhookDelivery>>
    /** The gateway settles a transaction and calls the api webhook door now; answers the delivery. */
    settle(params: SettleParams): Promise<WebhookDelivery>
    /** The gateway settles a transaction now and calls the api webhook door after `delayMs`; read the answer from `deliveries()`. */
    delayWebhook(params: DelayedSettleParams): Promise<void>
    /** The gateway sends its last delivery of a transaction again, as it does on a retry. */
    replayWebhook(gatewayIntentId: string): Promise<WebhookDelivery>
}

/** Every fake of the world. */
export interface TestFakes {
    /** The identity provider. */
    readonly keycloak: TestKeycloakFake
    /** The mail host. */
    readonly smtp: TestSmtpFake
    /** The payment gateway. */
    readonly sepay: TestSepayFake
}

const call = async <T>(http: E2EHttpClient, method: "GET" | "POST", path: string, body?: unknown): Promise<T> => {
    const response = method === "GET" ? await http.get<T>(path) : await http.post<T>(path, body ?? {})
    if (response.status !== 200) {
        throw new TestWorldError({
            code: TestWorldErrorCode.FakeControlFailed,
            params: { detail: `${method} ${path} answered ${response.status}` },
        })
    }
    return response.body
}

/** Builds the fake handles over the control server; `webhookTarget` answers the base URL of the api the gateway calls back. */
export const createTestFakes = (controlUrl: string, webhookTarget: () => string): TestFakes => {
    const http = createE2EHttpClient({ baseUrl: controlUrl, timeoutMs: CONTROL_TIMEOUT_MS })
    const base = (name: FakeName): TestFake => ({
        failNext: async (spec) => {
            await call<object>(http, "POST", `/control/${name}/fail-next`, spec)
        },
        requests: () => call<ReadonlyArray<RecordedRequest>>(http, "GET", `/control/${name}/requests`),
    })
    return {
        keycloak: {
            ...base("keycloak"),
            person: async (email, password) => (await call<{ personId: string }>(http, "POST", "/control/keycloak/persons", { email, password })).personId,
        },
        smtp: {
            ...base("smtp"),
            mails: () => call<ReadonlyArray<SentMail>>(http, "GET", "/control/smtp/mails"),
        },
        sepay: {
            ...base("sepay"),
            intents: () => call<ReadonlyArray<SepayIntent>>(http, "GET", "/control/sepay/intents"),
            deliveries: () => call<ReadonlyArray<WebhookDelivery>>(http, "GET", "/control/sepay/deliveries"),
            settle: (params) => call<WebhookDelivery>(http, "POST", "/control/sepay/settle", { ...params, deliverTo: webhookTarget() }),
            delayWebhook: async (params) => {
                await call<object>(http, "POST", "/control/sepay/delay-settle", { ...params, deliverTo: webhookTarget() })
            },
            replayWebhook: (gatewayIntentId) =>
                call<WebhookDelivery>(http, "POST", "/control/sepay/replay", { gatewayIntentId, deliverTo: webhookTarget() }),
        },
    }
}
