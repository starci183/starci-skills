import { parseInvoiceConfig } from "@modules/domain/invoice"
import type { InvoiceOptions } from "@modules/domain/invoice"
import { parseIdentityApiConfig } from "@modules/integrations/identity-api"
import type { IdentityApiOptions } from "@modules/integrations/identity-api"
import type { EnvSource } from "@modules/platform/config"
import { parseBillingDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionConfig } from "@modules/platform/database"
import { parseHttpSecurityConfig, parseWebhookProviderConfig } from "@modules/platform/http-security"
import type { HttpSecurityOptions } from "@modules/platform/http-security"
import { parseMessagingConfig } from "@modules/platform/messaging"
import type { MessagingOptions } from "@modules/platform/messaging"

/** Everything the billing api needs from its environment, parsed once in main.ts. */
export interface BillingAppOptions {
    /** The port the api listens on. */
    readonly port: number
    /** The billing database connection. */
    readonly database: DatabaseConnectionConfig
    /** Where the identity service answers, for the default-deny guard. */
    readonly identityApi: IdentityApiOptions
    /** The origin allowlist, the rate limits and the signature settings of the bank transfer notifier. */
    readonly httpSecurity: HttpSecurityOptions
    /** The Redis queues the api consumes order events from and announces its events on. */
    readonly messaging: MessagingOptions
    /** The billing limit. */
    readonly invoice: InvoiceOptions
}

/** Parses the billing api options from the environment; a missing or malformed key stops the boot naming the key. */
export const parseBillingAppOptions = (env: EnvSource): BillingAppOptions => ({
    port: env.int("BILLING_API_PORT"),
    database: parseBillingDatabaseConfig(env),
    identityApi: parseIdentityApiConfig(env),
    httpSecurity: { ...parseHttpSecurityConfig(env), webhooks: { sepay: parseWebhookProviderConfig(env, "SEPAY") } },
    messaging: parseMessagingConfig(env),
    invoice: parseInvoiceConfig(env),
})
