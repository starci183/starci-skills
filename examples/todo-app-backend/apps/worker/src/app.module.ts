import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { AuditModule, auditEntities } from "@modules/domain/audit"
import { NOTIFY_MESSAGES, NotifyModule, notifyEntities } from "@modules/domain/notify"
import { PlanModule, planEntities } from "@modules/domain/plan"
import { RecurModule, recurEntities } from "@modules/domain/recur"
import { IdentityModule, identityEntities } from "@modules/domain/identity"
import { ShareModule, shareEntities } from "@modules/domain/share"
import { TaskModule, taskEntities } from "@modules/domain/task"
import { TaskflowModule } from "@modules/domain/taskflow"
import { UploadModule, uploadEntities } from "@modules/domain/upload"
import { KeycloakModule } from "@modules/integrations/keycloak"
import { NotifySmtpModule } from "@modules/integrations/notify-smtp"
import { SepayModule } from "@modules/integrations/sepay"
import { UploadStorageModule } from "@modules/integrations/upload"
import { ClockModule } from "@modules/platform/clock"
import { CqrsModule } from "@modules/platform/cqrs"
import { DatabaseModule } from "@modules/platform/database"
import { HttpModule } from "@modules/platform/http"
import { I18nModule } from "@modules/platform/i18n"
import { InboxModule, inboxEntities } from "@modules/platform/inbox"
import { LeaseModule, leaseEntities } from "@modules/platform/lease"
import { LoggingModule } from "@modules/platform/logging"
import { MessagingModule } from "@modules/platform/messaging"
import { OutboxModule, outboxEntities } from "@modules/platform/outbox"
import { SchedulingModule } from "@modules/platform/scheduling"
import { TodoMessageModule, TodoScheduleModule } from "@features/todo"
import type { WorkerAppOptions } from "./worker.options"

@Module({})
/** The composition root of the worker: the capabilities the handlers need, the scheduler and the queue runner, and the schedule and message transports of the todo feature. */
export class AppModule {
    /** Builds the worker from its parsed options. */
    static register(options: WorkerAppOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ClockModule.register({ isGlobal: true }),
                LoggingModule.register({ isGlobal: true }),
                I18nModule.register({ isGlobal: true, bundles: [NOTIFY_MESSAGES] }),
                CqrsModule.register({ isGlobal: true }),
                DatabaseModule.register({
                    isGlobal: true,
                    connections: [
                        {
                            ...options.database,
                            entities: [
                                ...identityEntities,
                                ...taskEntities,
                                ...shareEntities,
                                ...planEntities,
                                ...recurEntities,
                                ...notifyEntities,
                                ...auditEntities,
                                ...uploadEntities,
                                ...leaseEntities,
                                ...inboxEntities,
                                ...outboxEntities,
                            ],
                            migrations: [],
                        },
                    ],
                }),
                HttpModule.register({ isGlobal: true }),
                LeaseModule.register({ isGlobal: true }),
                OutboxModule.register({ isGlobal: true }),
                InboxModule.register({ isGlobal: true }),
                SchedulingModule.register({ isGlobal: true, ...options.scheduling }),
                MessagingModule.register({ isGlobal: true, ...options.messaging }),
                KeycloakModule.register({ isGlobal: true, ...options.keycloak }),
                SepayModule.register({ isGlobal: true, ...options.sepay }),
                NotifySmtpModule.register({ isGlobal: true, ...options.notifySmtp }),
                UploadStorageModule.register({ isGlobal: true, ...options.uploadStorage }),
                IdentityModule.register({ isGlobal: true, ...options.identity }),
                TaskModule.register({ isGlobal: true }),
                ShareModule.register({ isGlobal: true }),
                PlanModule.register({ isGlobal: true, ...options.plan }),
                TaskflowModule.register({ isGlobal: true }),
                RecurModule.register({ isGlobal: true, ...options.recur }),
                NotifyModule.register({ isGlobal: true }),
                AuditModule.register({ isGlobal: true }),
                UploadModule.register({ isGlobal: true, ...options.upload }),
                TodoScheduleModule,
                TodoMessageModule,
            ],
        }
    }
}
