import type { CommissionOptions } from "@modules/domain/commission"
import type { PlanOptions } from "@modules/domain/plan"
import type { RecurOptions } from "@modules/domain/recur"
import type { IdentityOptions } from "@modules/domain/identity"
import type { UploadOptions } from "@modules/domain/upload"
import type { KeycloakOptions } from "@modules/integrations/keycloak"
import type { NotifySmtpOptions } from "@modules/integrations/notify-smtp"
import type { SepayOptions } from "@modules/integrations/sepay"
import type { UploadStorageOptions } from "@modules/integrations/upload-storage"
import type { DatabaseConnectionConfig } from "@modules/platform/database"
import type { HttpSecurityOptions } from "@modules/platform/http-security"

/** Everything the todo api needs from its environment, parsed once in main.ts. */
export interface TodoAppOptions {
    /** The port the api listens on. */
    readonly port: number
    /** The primary database connection. */
    readonly database: DatabaseConnectionConfig
    /** The origin allowlist and rate limits. */
    readonly httpSecurity: HttpSecurityOptions
    /** Session lifetime and the administrator roster. */
    readonly identity: IdentityOptions
    /** The identity provider. */
    readonly keycloak: KeycloakOptions
    /** The payment gateway. */
    readonly sepay: SepayOptions
    /** The paid plan. */
    readonly plan: PlanOptions
    /** The referral commission rate. */
    readonly commission: CommissionOptions
    /** The recurrence generation tick. */
    readonly recur: RecurOptions
    /** The upload rules. */
    readonly upload: UploadOptions
    /** Where upload bytes are stored. */
    readonly uploadStorage: UploadStorageOptions
    /** The outbound mail server. */
    readonly notifySmtp: NotifySmtpOptions
}
