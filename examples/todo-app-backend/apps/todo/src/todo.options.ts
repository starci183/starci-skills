import { parsePlanConfig } from "@modules/domain/plan"
import type { PlanOptions } from "@modules/domain/plan"
import { parseRecurConfig } from "@modules/domain/recur"
import type { RecurOptions } from "@modules/domain/recur"
import { parseIdentityConfig } from "@modules/domain/identity"
import type { IdentityOptions } from "@modules/domain/identity"
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
import { parseHttpSecurityConfig } from "@modules/platform/http-security"
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
    readonly session: IdentityOptions
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

/** Parses the todo api options from the environment; a missing or malformed key stops the boot naming the key. */
export const parseTodoAppOptions = (env: EnvSource): TodoAppOptions => ({
    port: env.int("PORT"),
    database: parsePrimaryDatabaseConfig(env),
    httpSecurity: parseHttpSecurityConfig(env),
    session: parseIdentityConfig(env),
    keycloak: parseKeycloakConfig(env),
    sepay: parseSepayConfig(env),
    plan: parsePlanConfig(env),
    recur: parseRecurConfig(env),
    upload: parseUploadConfig(env),
    uploadStorage: parseUploadStorageConfig(env),
    notifySmtp: parseNotifySmtpConfig(env),
})
