import { Module } from "@nestjs/common"
import type { DynamicModule } from "@nestjs/common"
import { APP_GUARD } from "@nestjs/core"
import { AUDIT_ERROR_KINDS, AUDIT_MESSAGES, AuditModule, auditEntities, auditMigrations } from "@modules/domain/audit"
import { NOTIFY_ERROR_KINDS, NOTIFY_MESSAGES, NotifyModule, notifyEntities, notifyMigrations } from "@modules/domain/notify"
import { PLAN_ERROR_KINDS, PLAN_MESSAGES, PlanModule, planEntities, planMigrations } from "@modules/domain/plan"
import { RECUR_ERROR_KINDS, RECUR_MESSAGES, RecurModule, recurEntities, recurMigrations } from "@modules/domain/recur"
import {
    AuthGuard,
    IDENTITY_ERROR_KINDS,
    IDENTITY_MESSAGES,
    IdentityModule,
    identityEntities,
    identityMigrations,
} from "@modules/domain/identity"
import { SHARE_ERROR_KINDS, SHARE_MESSAGES, ShareModule, shareEntities, shareMigrations } from "@modules/domain/share"
import { TASK_ERROR_KINDS, TASK_MESSAGES, TaskModule, taskEntities, taskMigrations } from "@modules/domain/task"
import { UPLOAD_ERROR_KINDS, UPLOAD_MESSAGES, UploadModule, uploadEntities, uploadMigrations } from "@modules/domain/upload"
import { KEYCLOAK_ERROR_KINDS, KEYCLOAK_MESSAGES, KeycloakModule } from "@modules/integrations/keycloak"
import { NOTIFY_SMTP_ERROR_KINDS, NOTIFY_SMTP_MESSAGES, NotifySmtpModule } from "@modules/integrations/notify-smtp"
import { SEPAY_ERROR_KINDS, SEPAY_MESSAGES, SepayModule } from "@modules/integrations/sepay"
import { UPLOAD_STORAGE_ERROR_KINDS, UPLOAD_STORAGE_MESSAGES, UploadStorageModule } from "@modules/integrations/upload"
import { ClockModule } from "@modules/platform/clock"
import { CONFIG_ERROR_KINDS } from "@modules/platform/config"
import { CqrsModule } from "@modules/platform/cqrs"
import { DATABASE_ERROR_KINDS, DATABASE_PROBE, DatabaseModule } from "@modules/platform/database"
import { ERRORS_MESSAGES, ErrorsModule } from "@modules/platform/errors"
import { GraphqlModule } from "@modules/platform/graphql"
import { HTTP_ERROR_KINDS, HTTP_MESSAGES, HttpModule } from "@modules/platform/http"
import {
    HTTP_SECURITY_ERROR_KINDS,
    HTTP_SECURITY_MESSAGES,
    HttpSecurityModule,
    OriginGuard,
    RateLimitGuard,
} from "@modules/platform/http-security"
import { I18nModule } from "@modules/platform/i18n"
import { InboxModule, inboxEntities, inboxMigrations } from "@modules/platform/inbox"
import { LoggingModule } from "@modules/platform/logging"
import { ObservabilityModule } from "@modules/platform/observability"
import { OutboxModule, outboxEntities, outboxMigrations } from "@modules/platform/outbox"
import { PROBES_ERROR_KINDS, PROBES_MESSAGES, ProbesModule } from "@modules/platform/probes"
import { HealthHttpModule } from "@features/health"
import { TodoGraphqlModule, TodoHttpModule } from "@features/todo"
import type { TodoAppOptions } from "./todo.options"

@Module({})
/** The composition root of the todo api: every capability is registered once, app-wide, and the three guards run in a fixed order. */
export class AppModule {
    /** Builds the todo api from its parsed options. */
    static register(options: TodoAppOptions): DynamicModule {
        return {
            module: AppModule,
            imports: [
                ClockModule.register({ isGlobal: true }),
                LoggingModule.register({ isGlobal: true }),
                I18nModule.register({
                    isGlobal: true,
                    bundles: [
                        ERRORS_MESSAGES,
                        HTTP_MESSAGES,
                        HTTP_SECURITY_MESSAGES,
                        PROBES_MESSAGES,
                        IDENTITY_MESSAGES,
                        TASK_MESSAGES,
                        SHARE_MESSAGES,
                        PLAN_MESSAGES,
                        RECUR_MESSAGES,
                        NOTIFY_MESSAGES,
                        AUDIT_MESSAGES,
                        UPLOAD_MESSAGES,
                        KEYCLOAK_MESSAGES,
                        SEPAY_MESSAGES,
                        NOTIFY_SMTP_MESSAGES,
                        UPLOAD_STORAGE_MESSAGES,
                    ],
                }),
                ErrorsModule.register({
                    isGlobal: true,
                    kinds: [
                        CONFIG_ERROR_KINDS,
                        DATABASE_ERROR_KINDS,
                        HTTP_ERROR_KINDS,
                        HTTP_SECURITY_ERROR_KINDS,
                        PROBES_ERROR_KINDS,
                        IDENTITY_ERROR_KINDS,
                        TASK_ERROR_KINDS,
                        SHARE_ERROR_KINDS,
                        PLAN_ERROR_KINDS,
                        RECUR_ERROR_KINDS,
                        NOTIFY_ERROR_KINDS,
                        AUDIT_ERROR_KINDS,
                        UPLOAD_ERROR_KINDS,
                        KEYCLOAK_ERROR_KINDS,
                        SEPAY_ERROR_KINDS,
                        NOTIFY_SMTP_ERROR_KINDS,
                        UPLOAD_STORAGE_ERROR_KINDS,
                    ],
                }),
                CqrsModule.register({ isGlobal: true }),
                HttpSecurityModule.register({ isGlobal: true, ...options.httpSecurity }),
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
                                ...inboxEntities,
                                ...outboxEntities,
                            ],
                            migrations: [
                                ...identityMigrations,
                                ...taskMigrations,
                                ...shareMigrations,
                                ...planMigrations,
                                ...recurMigrations,
                                ...notifyMigrations,
                                ...auditMigrations,
                                ...uploadMigrations,
                                ...inboxMigrations,
                                ...outboxMigrations,
                            ],
                        },
                    ],
                }),
                HttpModule.register({ isGlobal: true }),
                OutboxModule.register({ isGlobal: true }),
                InboxModule.register({ isGlobal: true }),
                KeycloakModule.register({ isGlobal: true, ...options.keycloak }),
                SepayModule.register({ isGlobal: true, ...options.sepay }),
                NotifySmtpModule.register({ isGlobal: true, ...options.notifySmtp }),
                UploadStorageModule.register({ isGlobal: true, ...options.uploadStorage }),
                IdentityModule.register({ isGlobal: true, ...options.session }),
                TaskModule.register({ isGlobal: true }),
                ShareModule.register({ isGlobal: true }),
                PlanModule.register({ isGlobal: true, ...options.plan }),
                RecurModule.register({ isGlobal: true, ...options.recur }),
                NotifyModule.register({ isGlobal: true }),
                AuditModule.register({ isGlobal: true }),
                UploadModule.register({ isGlobal: true, ...options.upload }),
                ObservabilityModule.register({ isGlobal: true }),
                ProbesModule.register({ isGlobal: true, service: "todo", probes: [DATABASE_PROBE] }),
                GraphqlModule.register({ isGlobal: true }),
                HealthHttpModule,
                TodoGraphqlModule,
                TodoHttpModule,
            ],
            providers: [
                { provide: APP_GUARD, useClass: RateLimitGuard },
                { provide: APP_GUARD, useClass: OriginGuard },
                { provide: APP_GUARD, useClass: AuthGuard },
            ],
        }
    }
}
