import { parseInvoiceConfig } from "@modules/domain/invoice"
import { parseIdentityApiConfig } from "@modules/integrations/identity-api"
import type { EnvSource } from "@modules/platform/config"
import { parseBillingDatabaseConfig } from "@modules/platform/database"
import { parseEventBusConfig } from "@modules/platform/event-bus"
import { parseHttpSecurityConfig, parseWebhookProviderConfig } from "@modules/platform/http-security"
import type { BillingAppOptions } from "./billing.options"

/** The billing environment values parsed before app composition. */
export interface BillingEnv extends BillingAppOptions {}

/** Reads the billing environment; missing or invalid values fail boot and secret readers prefer mounted files. */
export const readBillingEnv = (env: EnvSource): BillingEnv => ({
    port: env.int("BILLING_API_PORT"),
    database: parseBillingDatabaseConfig(env),
    identityApi: parseIdentityApiConfig(env),
    httpSecurity: { ...parseHttpSecurityConfig(env), webhooks: { sepay: parseWebhookProviderConfig(env, "SEPAY") } },
    eventBus: parseEventBusConfig(env),
    invoice: parseInvoiceConfig(env),
})
