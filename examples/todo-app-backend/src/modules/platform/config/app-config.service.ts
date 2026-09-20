import {
    Injectable 
} from "@nestjs/common"
import {
    readFileSync 
} from "node:fs"
import {
    tmpdir 
} from "node:os"
import {
    join 
} from "node:path"

const DEFAULT_SESSION_TTL_DAYS = 30
const DEFAULT_KEYCLOAK_TOKEN_URL = "http://localhost:8089/realms/todo/protocol/openid-connect/token"
const DEFAULT_KEYCLOAK_CLIENT_ID = "todo-api"
const DEFAULT_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/todo"
const DEFAULT_CORS_ORIGIN = "http://localhost:3000"
const DEFAULT_RECUR_TICK_CRON = "*/5 * * * *"
const DEFAULT_SMTP_HOST = "localhost"
const DEFAULT_SMTP_PORT = 1025
const DEFAULT_SMTP_FROM = "notify@todo.dev"
const DEFAULT_REDIS_URL = "redis://localhost:6379"
const DEFAULT_SEPAY_BASE_URL = "https://my.sepay.vn"
/** integration.upload.local's content ceiling: 10 MiB per object, the same class of bound nivo sets on
 * attachment intake - large enough for task attachments, small enough that a direct upload stays a
 * memory-bounded buffer and a presigned PUT never parks a giant object on the volume. */
const DEFAULT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024
const DEFAULT_UPLOAD_ALLOWED_MIMES = ["text/plain",
    "application/pdf",
    "image/png",
    "image/jpeg"]
/** integration.upload.local: the signing material behind presigned PUT tokens. DEMO-ONLY fallback - a
 * real deployment names a decrypted file through UPLOAD_SIGNING_SECRET_FILE, same *_FILE convention as
 * the SePay credentials. */
const DEFAULT_UPLOAD_SIGNING_SECRET = "todo-upload-demo-signing-secret"
/** integration.upload.local: how long a presigned PUT token stays valid - short-lived on purpose, the
 * same 5-minute window a provider presign would carry. */
const DEFAULT_UPLOAD_PRESIGN_TTL_MS = 5 * 60 * 1000
/** integration.plan.sepay's paid-plan price: a fixed catalog item (data.plan.plan), not owner-configurable. */
const PAID_PLAN_PRICE_MINOR_UNITS = 99000
const PAID_PLAN_CURRENCY = "VND"

@Injectable()
/** Injectable service owning the app config logic the config capability exposes; wired by the capability's own module. */
export class AppConfigService {
    getSessionTtlDays(): number {
        const raw = process.env.TODO_SESSION_TTL_DAYS
        return raw ? Number(raw) : DEFAULT_SESSION_TTL_DAYS
    }

    getKeycloakTokenUrl(): string {
        return process.env.KEYCLOAK_TOKEN_URL ?? DEFAULT_KEYCLOAK_TOKEN_URL
    }

    getKeycloakClientId(): string {
        return process.env.KEYCLOAK_CLIENT_ID ?? DEFAULT_KEYCLOAK_CLIENT_ID
    }

    getDatabaseUrl(): string {
        return process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL
    }

    getCorsOrigin(): string {
        return process.env.CORS_ORIGIN ?? DEFAULT_CORS_ORIGIN
    }

    getPort(): number {
        const raw = process.env.PORT
        return raw ? Number(raw) : 3001
    }

    /** integration.recur.scheduler's tick interval - a standard cron expression, defaulting to that
   * integration record's own declared endpoint (`*\/5 * * * *`, every 5 minutes). Overridable only so a
   * live-proof run can observe a real tick without a 5-minute wait; production never sets this. */
    getRecurTickCron(): string {
        return process.env.RECUR_TICK_CRON ?? DEFAULT_RECUR_TICK_CRON
    }

    /** integration.notify.smtp: the SMTP submission host. No dev host is declared in
   * application-stacks.yaml at this commit (see that record's `sandbox` note), so this default names
   * nothing real - a live run only proceeds if SMTP_HOST is actually set to a reachable host. */
    getSmtpHost(): string {
        return process.env.SMTP_HOST ?? DEFAULT_SMTP_HOST
    }

    getSmtpPort(): number {
        const raw = process.env.SMTP_PORT
        return raw ? Number(raw) : DEFAULT_SMTP_PORT
    }

    getSmtpFromAddress(): string {
        return process.env.SMTP_FROM ?? DEFAULT_SMTP_FROM
    }

    /** integration.notify.queue: the dev stack's own Redis (component `redis`, port 6379). */
    getRedisUrl(): string {
        return process.env.REDIS_URL ?? DEFAULT_REDIS_URL
    }

    getSepayBaseUrl(): string {
        return process.env.SEPAY_BASE_URL ?? DEFAULT_SEPAY_BASE_URL
    }

    /** integration.upload.local: where the local storage adapter writes objects. Defaults to an
   * os-level temp dir so neither the dev host run nor an e2e api child ever writes into the source
   * tree; a dev compose volume (or a later minio swap) is just a different value for UPLOAD_DIR. */
    getUploadStorageDir(): string {
        return process.env.UPLOAD_DIR ?? join(tmpdir(),
            "todo-app-uploads")
    }

    getUploadMaxBytes(): number {
        const raw = process.env.UPLOAD_MAX_BYTES
        return raw ? Number(raw) : DEFAULT_UPLOAD_MAX_BYTES
    }

    /** The mime allowlist intake validation refuses outside of; UPLOAD_ALLOWED_MIMES overrides as a
   * comma-separated list. */
    getUploadAllowedMimes(): Array<string> {
        const raw = process.env.UPLOAD_ALLOWED_MIMES
        return raw ? raw.split(",").map(mime => mime.trim()).filter(Boolean) : [...DEFAULT_UPLOAD_ALLOWED_MIMES]
    }

    /** Signing material for presigned PUT tokens; DEMO-ONLY literal fallback so the dev/e2e stacks run
   * without a decrypted file, exactly the graceful-empty shape getSepayApiKey documents. */
    getUploadSigningSecret(): string {
        return this.readSecretFile(process.env.UPLOAD_SIGNING_SECRET_FILE) || DEFAULT_UPLOAD_SIGNING_SECRET
    }

    getUploadPresignTtlMs(): number {
        const raw = process.env.UPLOAD_PRESIGN_TTL_MS
        return raw ? Number(raw) : DEFAULT_UPLOAD_PRESIGN_TTL_MS
    }

    /** integration.plan.sepay's credential: SEPAY_API_KEY_FILE names a decrypted file path (see
   * scripts/with-dev-secrets.sh), never an inline value. Empty when unset/unreachable, rather than
   * throwing at construction time, so the app still boots without SePay and the live path fails at the
   * call site instead - exactly the shape gap.plan.sepay-not-reachable stays open against. */
    getSepayApiKey(): string {
        return this.readSecretFile(process.env.SEPAY_API_KEY_FILE)
    }

    getSepayWebhookSecret(): string {
        return this.readSecretFile(process.env.SEPAY_WEBHOOK_SECRET_FILE)
    }

    getPaidPlanPriceMinorUnits(): number {
        const raw = process.env.PLAN_PAID_PRICE_MINOR_UNITS
        return raw ? Number(raw) : PAID_PLAN_PRICE_MINOR_UNITS
    }

    getPaidPlanCurrency(): string {
        return process.env.PLAN_PAID_CURRENCY ?? PAID_PLAN_CURRENCY
    }

    private readSecretFile(filePath: string | undefined): string {
        if (!filePath) return ""
        try {
            return readFileSync(filePath,
                "utf8").trim()
        } catch {
            return ""
        }
    }
}
