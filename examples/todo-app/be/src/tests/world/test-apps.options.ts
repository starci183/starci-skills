/**
 * The typed options the test world hands to the real apps: what the `main.ts` of each app would parse from the environment
 * of a deployment, built as objects from the wiring of the run. The services of the stack are the real ones the library
 * runs (Postgres, Keycloak with the stack's realm, MinIO, Redis); every external provider points at a fake at the network edge; rate
 * limits are high, the job tick and the queue poll are short, the session lives a day.
 */
import { TestWorldError, TestWorldErrorCode } from "./test-world.error"
import type { WorldWiring } from "@starci/test-world"
import { EnvSource, Secret } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionConfig } from "@modules/platform/database"
import type { KeycloakOptions } from "@modules/integrations/keycloak"
import type { NotifySmtpOptions } from "@modules/integrations/notify-smtp"
import type { SepayOptions } from "@modules/integrations/sepay"
import type { CacheOptions } from "@modules/integrations/cache"
import type { UploadStorageOptions } from "@modules/integrations/upload-storage"
import type { TodoAppOptions } from "../../../apps/todo/src/todo.options"
import type { WorkerAppOptions } from "../../../apps/worker/src/worker.options"

const RATE_LIMIT_HIGH = 1_000_000
const CALL_DEADLINE_MS = 2_500
const UPLOAD_MAX_BYTES = 1_048_576
const UPLOAD_MIMES: ReadonlyArray<string> = ["text/plain", "application/pdf", "image/png", "image/jpeg"]
const UPLOAD_PRESIGN_TTL_MS = 300_000
const PAID_PRICE_MINOR_UNITS = 99_000
const TICK_MS = 250

/** The todo api options plus the worker tick options: one set both apps of the run are registered with. */
export interface TestOptions extends TodoAppOptions, Pick<WorkerAppOptions, "scheduling" | "messaging"> {}

/** The wiring of the todo world: its apps, its one connection and its two fakes. */
export type TodoWiring = WorldWiring<"todo" | "worker", "primary", "smtp" | "sepay">

/** The value a fake exposes for the app options; a missing one is a declaration mistake the boot must name. */
const fakeValue = (values: Readonly<Record<string, string>>, key: string): string => {
    const value = values[key]
    if (value === undefined) {
        throw new TestWorldError({
            code: TestWorldErrorCode.NotDeclared,
            params: { detail: `the fake exposes no value "${key}"` },
        })
    }
    return value
}

/** The primary connection of the run. */
export const primaryDatabaseOf = (w: TodoWiring): DatabaseConnectionConfig =>
    parsePrimaryDatabaseConfig(new EnvSource({ PRIMARY_DB_URL: w.db.primary.url }))

/** The real Keycloak realm of the run, through its public password-grant client. */
export const keycloakOptionsOf = (w: TodoWiring): KeycloakOptions => ({
    tokenUrl: w.keycloak.tokenUrl,
    clientId: w.keycloak.clientId,
    timeoutMs: CALL_DEADLINE_MS,
})

/** The payment gateway fake at the network edge. */
export const sepayOptionsOf = (w: TodoWiring): SepayOptions => ({
    baseUrl: w.fake.sepay.url,
    apiKey: new Secret(fakeValue(w.fake.sepay.values, "apiKey")),
    webhookSecret: new Secret(fakeValue(w.fake.sepay.values, "webhookSecret")),
    timeoutMs: CALL_DEADLINE_MS,
})

/** The mail host fake at the network edge. */
export const notifySmtpOptionsOf = (w: TodoWiring): NotifySmtpOptions => ({
    host: w.fake.smtp.host,
    port: w.fake.smtp.port,
    from: "todo@e2e.test",
    connectTimeoutMs: CALL_DEADLINE_MS,
    commandTimeoutMs: CALL_DEADLINE_MS,
})

/** The run's own Redis DB, where the rate limiter counts. */
export const cacheOptionsOf = (w: TodoWiring): CacheOptions => ({ url: new Secret(w.redis.url) })

/** The bucket of the run's MinIO that holds the uploads (declared in `stacks.minio.buckets`). */
export const UPLOADS_BUCKET = "uploads"

/** The upload storage over the run's own bucket of the stack's MinIO. */
export const uploadStorageOptionsOf = (w: TodoWiring): UploadStorageOptions => ({
    endpoint: w.minio.endpoint,
    region: "us-east-1",
    bucket: w.minio.bucket(UPLOADS_BUCKET),
    accessKeyId: w.minio.accessKey,
    secretAccessKey: new Secret(w.minio.secretKey),
    timeoutMs: CALL_DEADLINE_MS,
})

/** The options of the run, from the wiring the library built. */
export const testOptions = (w: TodoWiring): TestOptions => ({
    port: w.apps.todo.port,
    database: primaryDatabaseOf(w),
    httpSecurity: {
        allowedOrigins: ["http://localhost:4069"],
        rateLimit: { windowMs: 60_000, defaultLimit: RATE_LIMIT_HIGH, strictLimit: RATE_LIMIT_HIGH },
    },
    cache: cacheOptionsOf(w),
    identity: { ttlDays: 1, adminSubjects: [] },
    keycloak: keycloakOptionsOf(w),
    sepay: sepayOptionsOf(w),
    plan: { paidPriceMinorUnits: PAID_PRICE_MINOR_UNITS, paidCurrency: "VND" },
    commission: { bps: 3000 },
    // The generation job is a cron of whole minutes: every minute is the shortest cadence it supports.
    recur: { tickCron: "* * * * *" },
    upload: {
        maxBytes: UPLOAD_MAX_BYTES,
        allowedMimes: UPLOAD_MIMES,
        presignTtlMs: UPLOAD_PRESIGN_TTL_MS,
        signingSecret: new Secret(w.secret("upload-signing")),
    },
    uploadStorage: uploadStorageOptionsOf(w),
    notifySmtp: notifySmtpOptionsOf(w),
    scheduling: { tickMs: TICK_MS },
    messaging: { pollMs: TICK_MS, batchSize: 20, visibilityMs: 30_000 },
})
