/**
 * The integration capabilities of the todo back end as module factories for a modules world: each real integration module,
 * registered as the app root registers it (global, with the options of the run), over the platform base the declaration
 * gives (clock, logging, the outbound HTTP port). Keycloak is the real realm of the stack; the mail host and the payment
 * gateway are the library fakes at the network edge; the upload storage is the S3 adapter over the run's bucket of the stack's MinIO.
 */
import type { DynamicModule } from "@nestjs/common"
import type { ModuleFactory } from "@starci/test-world"
import { KeycloakModule } from "@modules/integrations/keycloak"
import { NotifySmtpModule } from "@modules/integrations/notify-smtp"
import { SepayModule } from "@modules/integrations/sepay"
import { UploadStorageModule } from "@modules/integrations/upload-storage"
import { ClockModule } from "@modules/platform/clock"
import { HttpModule } from "@modules/platform/http"
import { LoggingModule } from "@modules/platform/logging"
import { keycloakOptionsOf, notifySmtpOptionsOf, sepayOptionsOf, uploadStorageOptionsOf } from "./test-apps.options"

/** The platform base every modules world of the todo back end is registered over. */
export const platformBase = (): ReadonlyArray<DynamicModule> => [
    ClockModule.register({ isGlobal: true }),
    LoggingModule.register({ isGlobal: true }),
    HttpModule.register({ isGlobal: true }),
]

/** The identity provider client over the real realm. */
export const KEYCLOAK_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) => KeycloakModule.register({ isGlobal: true, ...keycloakOptionsOf(w) }),
]

/** The mail client over the mail host fake. */
export const NOTIFY_SMTP_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) => NotifySmtpModule.register({ isGlobal: true, ...notifySmtpOptionsOf(w) }),
]

/** The payment gateway client over the SePay fake. */
export const SEPAY_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) => SepayModule.register({ isGlobal: true, ...sepayOptionsOf(w) }),
]

/** The upload storage over the run's bucket of the stack's MinIO. */
export const UPLOAD_STORAGE_CAPABILITY_MODULES: ReadonlyArray<ModuleFactory> = [
    (w) => UploadStorageModule.register({ isGlobal: true, ...uploadStorageOptionsOf(w) }),
]
