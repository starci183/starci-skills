import { parseInvoiceConfig } from "@modules/domain/invoice"
import { parseIdentityApiConfig } from "@modules/integrations/identity-api"
import { parseSepayConfig } from "@modules/integrations/sepay"
import type { EnvSource } from "@modules/platform/config"
import { parseBillingDatabaseConfig } from "@modules/platform/database"
import { parseEventBusConfig } from "@modules/platform/event-bus"
import { parseHttpSecurityConfig } from "@modules/platform/http-security"

/** The billing environment values parsed before app composition. */
export interface BillingEnv {
    /** The port the API listens on. */
    readonly port: number
    /** The billing database connection. */
    readonly database: ReturnType<typeof parseBillingDatabaseConfig>
    /** Where the identity service answers, for the default-deny guard. */
    readonly identityApi: ReturnType<typeof parseIdentityApiConfig>
    /** The origin allowlist, rate limits and bank transfer signature settings. */
    readonly httpSecurity: ReturnType<typeof parseHttpSecurityConfig>
    /** The broker the API consumes order events from and announces its events on. */
    readonly eventBus: ReturnType<typeof parseEventBusConfig>
    /** The billing limit. */
    readonly invoice: ReturnType<typeof parseInvoiceConfig>
    /** The notifier signature options parsed at the app root. */
    readonly sepay: ReturnType<typeof parseSepayConfig>
}

/** Reads the billing environment; missing or invalid values fail boot and secret readers prefer mounted files. */
export const readBillingEnv = (env: EnvSource): BillingEnv => ({
    port: env.int("BILLING_API_PORT"),
    database: parseBillingDatabaseConfig(env),
    identityApi: parseIdentityApiConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
    sepay: parseSepayConfig(env),
    eventBus: parseEventBusConfig(env),
    invoice: parseInvoiceConfig(env),
})
