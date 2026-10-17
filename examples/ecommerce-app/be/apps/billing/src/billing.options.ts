import type { InvoiceOptions } from "@modules/domain/invoice"
import type { IdentityApiOptions } from "@modules/integrations/identity-api"
import type { DatabaseConnectionConfig } from "@modules/platform/database"
import type { EventBusConfig } from "@modules/platform/event-bus"
import type { HttpSecurityOptions, WebhookProviderOptions } from "@modules/platform/http-security"

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
    /** The broker the api consumes order events from and announces its events on. */
    readonly eventBus: EventBusConfig
    /** The billing limit. */
    readonly invoice: InvoiceOptions
    /** The notifier's signing secret and replay tolerance. */
    readonly sepay: WebhookProviderOptions
}
