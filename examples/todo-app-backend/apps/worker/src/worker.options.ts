import type { PlanOptions } from "@modules/domain/plan"
import type { RecurOptions } from "@modules/domain/recur"
import type { IdentityOptions } from "@modules/domain/identity"
import type { UploadOptions } from "@modules/domain/upload"
import type { KeycloakOptions } from "@modules/integrations/keycloak"
import type { NotifySmtpOptions } from "@modules/integrations/notify-smtp"
import type { SepayOptions } from "@modules/integrations/sepay"
import type { UploadStorageOptions } from "@modules/integrations/upload"
import type { DatabaseConnectionConfig } from "@modules/platform/database"
import type { MessagingOptions } from "@modules/platform/messaging"
import type { SchedulingOptions } from "@modules/platform/scheduling"

/** Everything the worker needs from its environment, parsed once in main.ts. */
export interface WorkerAppOptions {
    /** The primary database connection. */
    readonly database: DatabaseConnectionConfig
    /** How the tick loop of the jobs runs. */
    readonly scheduling: SchedulingOptions
    /** How the consumers poll the queue store. */
    readonly messaging: MessagingOptions
    /** Session lifetime and the administrator roster. */
    readonly identity: IdentityOptions
    /** The identity provider. */
    readonly keycloak: KeycloakOptions
    /** The payment gateway. */
    readonly sepay: SepayOptions
    /** The paid plan. */
    readonly plan: PlanOptions
    /** The recurrence generation tick. */
    readonly recur: RecurOptions
    /** The upload rules. */
    readonly upload: UploadOptions
    /** Where upload bytes are stored. */
    readonly uploadStorage: UploadStorageOptions
    /** The outbound mail server. */
    readonly notifySmtp: NotifySmtpOptions
}
