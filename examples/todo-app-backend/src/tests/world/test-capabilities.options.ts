/**
 * The capability set of the todo product as module factories for a modules world: every domain capability and integration
 * the handlers of `features/todo` need, registered with the options of the run exactly as the worker composes them. A modules
 * spec spreads it and adds the handler module (`TodoModule`) to dispatch real commands, or picks factories one by one.
 */
import { AuditModule } from "@modules/domain/audit"
import { NOTIFY_MESSAGES, NotifyModule } from "@modules/domain/notify"
import { PlanModule } from "@modules/domain/plan"
import { RecurModule } from "@modules/domain/recur"
import { SessionModule } from "@modules/domain/session"
import { ShareModule } from "@modules/domain/share"
import { TaskModule } from "@modules/domain/task"
import { UploadModule } from "@modules/domain/upload"
import { KeycloakModule } from "@modules/integrations/keycloak"
import { NotifySmtpModule } from "@modules/integrations/notify-smtp"
import { SepayModule } from "@modules/integrations/sepay"
import { UploadStorageModule } from "@modules/integrations/upload"
import { HttpModule } from "@modules/platform/http"
import { I18nModule } from "@modules/platform/i18n"
import { InboxModule } from "@modules/platform/inbox"
import { OutboxModule } from "@modules/platform/outbox"
import type { TestModuleFactory } from "./test-world.contracts"

/** Every capability of the product over the platform base the modules world already provides (clock, logging, cqrs, database). */
export const TODO_CAPABILITY_MODULES: ReadonlyArray<TestModuleFactory> = [
    () => I18nModule.register({ isGlobal: true, bundles: [NOTIFY_MESSAGES] }),
    () => HttpModule.register({ isGlobal: true }),
    () => OutboxModule.register({ isGlobal: true }),
    () => InboxModule.register({ isGlobal: true }),
    (options) => KeycloakModule.register({ isGlobal: true, ...options.keycloak }),
    (options) => SepayModule.register({ isGlobal: true, ...options.sepay }),
    (options) => NotifySmtpModule.register({ isGlobal: true, ...options.notifySmtp }),
    (options) => UploadStorageModule.register({ isGlobal: true, ...options.uploadStorage }),
    (options) => SessionModule.register({ isGlobal: true, ...options.session }),
    () => TaskModule.register({ isGlobal: true }),
    () => ShareModule.register({ isGlobal: true }),
    (options) => PlanModule.register({ isGlobal: true, ...options.plan }),
    (options) => RecurModule.register({ isGlobal: true, ...options.recur }),
    () => NotifyModule.register({ isGlobal: true }),
    () => AuditModule.register({ isGlobal: true }),
    (options) => UploadModule.register({ isGlobal: true, ...options.upload }),
]
