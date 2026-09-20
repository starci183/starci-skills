import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    TypeOrmModule 
} from "@nestjs/typeorm"
import {
    join 
} from "node:path"
import {
    AppConfigService 
} from "@modules/platform/config/app-config.service"
import {
    ConfigModule 
} from "@modules/platform/config/config.module"
import {
    WinstonService 
} from "@modules/platform/logging/winston.service"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./primary.module-definition"
import {
    POSTGRESQL_PRIMARY 
} from "./constants/connection"
import {
    PostgresPrimaryClient 
} from "./primary.client"
import {
    SessionEntity 
} from "./entities/session.entity"
import {
    TaskEntity 
} from "./entities/task.entity"
import {
    ShareInvitationEntity 
} from "./entities/share-invitation.entity"
import {
    RuleEntity 
} from "./entities/rule.entity"
import {
    OccurrenceEntity 
} from "./entities/occurrence.entity"
import {
    NotifyNotificationEntity 
} from "./entities/notification.entity"
import {
    NotifyDeliveryAttemptEntity 
} from "./entities/notify-delivery-attempt.entity"
import {
    NotifyPreferenceEntity 
} from "./entities/notify-preference.entity"
import {
    NotifyDigestWindowEntity 
} from "./entities/notify-digest-window.entity"
import {
    AuditLogLineEntity 
} from "./entities/audit-log-line.entity"
import {
    AuditKeyEntity 
} from "./entities/audit-key.entity"
import {
    AuditErasureRequestEntity 
} from "./entities/audit-erasure-request.entity"
import {
    SubscriptionEntity 
} from "./entities/subscription.entity"
import {
    PaymentIntentEntity 
} from "./entities/payment-intent.entity"
import {
    UploadEntity 
} from "./entities/upload.entity"

/**
 * integration.login.postgres / data.task.task: this is the one platform database module, under nivo's
 * `modules/platform/databases/postgresql/primary` shape (renamed from the former
 * `modules/integrations/postgres`). It owns the named `POSTGRESQL_PRIMARY` TypeORM connection, the
 * entities and the migrations. Capability modules import `PostgresqlPrimaryModule.register()` and
 * register their own `TypeOrmModule.forFeature([...], POSTGRESQL_PRIMARY)` against the entities this
 * module exports, so a capability module still never needs `entities/` or `migrations/` of its own.
 */
@Module({
})
/** Nest module wiring the primary capability's providers; the app composition root registers it - other modules never import it. */
export class PostgresqlPrimaryModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [
                TypeOrmModule.forRootAsync({
                    name: POSTGRESQL_PRIMARY,
                    imports: [ConfigModule],
                    inject: [AppConfigService],
                    useFactory: (config: AppConfigService) => ({
                        type: "postgres" as const,
                        url: config.getDatabaseUrl(),
                        entities: [
                            SessionEntity,
                            TaskEntity,
                            ShareInvitationEntity,
                            RuleEntity,
                            OccurrenceEntity,
                            NotifyNotificationEntity,
                            NotifyDeliveryAttemptEntity,
                            NotifyPreferenceEntity,
                            NotifyDigestWindowEntity,
                            AuditLogLineEntity,
                            AuditKeyEntity,
                            AuditErasureRequestEntity,
                            SubscriptionEntity,
                            PaymentIntentEntity,
                            UploadEntity,
                        ],
                        migrations: [join(__dirname,
                            "migrations",
                            "*.{js,ts}")],
                        migrationsRun: true,
                        synchronize: false,
                    }),
                }),
            ],
            providers: [...(base.providers ?? []),
                WinstonService,
                PostgresPrimaryClient],
            exports: [PostgresPrimaryClient],
        }
    }
}
