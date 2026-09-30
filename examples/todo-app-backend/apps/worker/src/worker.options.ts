import { parsePlanConfig } from "@modules/domain/plan"
import type { PlanOptions } from "@modules/domain/plan"
import { parseRecurConfig } from "@modules/domain/recur"
import type { RecurOptions } from "@modules/domain/recur"
import { parseSessionConfig } from "@modules/domain/session"
import type { SessionOptions } from "@modules/domain/session"
import { parseUploadConfig } from "@modules/domain/upload"
import type { UploadOptions } from "@modules/domain/upload"
import { parseKeycloakConfig } from "@modules/integrations/keycloak"
import type { KeycloakOptions } from "@modules/integrations/keycloak"
import { parseNotifySmtpConfig } from "@modules/integrations/notify-smtp"
import type { NotifySmtpOptions } from "@modules/integrations/notify-smtp"
import { parseSepayConfig } from "@modules/integrations/sepay"
import type { SepayOptions } from "@modules/integrations/sepay"
import { parseUploadStorageConfig } from "@modules/integrations/upload"
import type { UploadStorageOptions } from "@modules/integrations/upload"
import type { EnvSource } from "@modules/platform/config"
import { parsePrimaryDatabaseConfig } from "@modules/platform/database"
import type { DatabaseConnectionConfig } from "@modules/platform/database"
import { parseMessagingConfig } from "@modules/platform/messaging"
import type { MessagingOptions } from "@modules/platform/messaging"
import { parseSchedulingConfig } from "@modules/platform/scheduling"
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
    readonly session: SessionOptions
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

/** Parses the worker options from the environment; a missing or malformed key stops the boot naming the key. */
export const parseWorkerAppOptions = (env: EnvSource): WorkerAppOptions => ({
    database: parsePrimaryDatabaseConfig(env),
    scheduling: parseSchedulingConfig(env),
    messaging: parseMessagingConfig(env),
    session: parseSessionConfig(env),
    keycloak: parseKeycloakConfig(env),
    sepay: parseSepayConfig(env),
    plan: parsePlanConfig(env),
    recur: parseRecurConfig(env),
    upload: parseUploadConfig(env),
    uploadStorage: parseUploadStorageConfig(env),
    notifySmtp: parseNotifySmtpConfig(env),
})
