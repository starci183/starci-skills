/**
 * The typed options the test world hands to the real apps: what the `main.ts` of each app would parse
 * from the environment of a deployment, built as objects from the coordinates of the run. Everything third-party points
 * at a fake at the network edge; rate limits are high, the job tick and the queue poll are short, the session lives a day.
 */
import { Secret } from "@modules/platform/config"
import { PRIMARY_CONNECTION } from "@modules/platform/database"
import type { TestOptions } from "./test-world.contracts"
import type { TestWorldState } from "./test-world-state.service"

const RATE_LIMIT_HIGH = 1_000_000
const CALL_DEADLINE_MS = 2_500
const UPLOAD_MAX_BYTES = 1_048_576
const UPLOAD_MIMES: ReadonlyArray<string> = ["text/plain", "application/pdf", "image/png", "image/jpeg"]
const UPLOAD_PRESIGN_TTL_MS = 300_000
const PAID_PRICE_MINOR_UNITS = 99_000
const TICK_MS = 250

/** The options of the run, from the coordinates the globalSetup published. */
export const testOptions = (state: TestWorldState): TestOptions => ({
    port: 0,
    database: { name: PRIMARY_CONNECTION, url: new Secret(state.databaseUrl) },
    httpSecurity: {
        allowedOrigins: ["http://localhost:4069"],
        rateLimit: { windowMs: 60_000, defaultLimit: RATE_LIMIT_HIGH, strictLimit: RATE_LIMIT_HIGH },
    },
    identity: { ttlDays: 1, adminSubjects: [] },
    keycloak: { tokenUrl: state.keycloakTokenUrl, clientId: state.keycloakClientId, timeoutMs: CALL_DEADLINE_MS },
    sepay: {
        baseUrl: state.sepayBaseUrl,
        apiKey: new Secret(state.sepayApiKey),
        webhookSecret: new Secret(state.sepayWebhookSecret),
        timeoutMs: CALL_DEADLINE_MS,
    },
    plan: { paidPriceMinorUnits: PAID_PRICE_MINOR_UNITS, paidCurrency: "VND" },
    commission: { bps: 3000 },
    // The generation job is a cron of whole minutes: every minute is the shortest cadence it supports.
    recur: { tickCron: "* * * * *" },
    upload: {
        maxBytes: UPLOAD_MAX_BYTES,
        allowedMimes: UPLOAD_MIMES,
        presignTtlMs: UPLOAD_PRESIGN_TTL_MS,
        signingSecret: new Secret(state.uploadSigningSecret),
    },
    uploadStorage: { directory: state.uploadDir },
    notifySmtp: {
        host: "127.0.0.1",
        port: state.smtpPort,
        from: "todo@e2e.test",
        connectTimeoutMs: CALL_DEADLINE_MS,
        commandTimeoutMs: CALL_DEADLINE_MS,
    },
    scheduling: { tickMs: TICK_MS },
    messaging: { pollMs: TICK_MS, batchSize: 20, visibilityMs: 30_000 },
})
