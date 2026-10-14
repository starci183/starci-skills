import { parseInvoiceConfig } from "@modules/domain/invoice"
import { parseIdentityApiConfig } from "@modules/integrations/identity-api"
import type { EnvSource } from "@modules/platform/config"
import { parseBillingDatabaseConfig } from "@modules/platform/database"
import { parseEventBusConfig } from "@modules/platform/event-bus"
import { parseHttpSecurityConfig, parseWebhookProviderConfig } from "@modules/platform/http-security"

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
}

/** Reads the billing environment; missing or invalid values fail boot and secret readers prefer mounted files. */
export const readBillingEnv = (env: EnvSource): BillingEnv => ({
    port: env.int("BILLING_API_PORT"),
    database: parseBillingDatabaseConfig(env),
    identityApi: parseIdentityApiConfig(env),
    httpSecurity: { ...parseHttpSecurityConfig(env), webhooks: { sepay: parseWebhookProviderConfig(env, "SEPAY") } },
    eventBus: parseEventBusConfig(env),
    invoice: parseInvoiceConfig(env),
})
