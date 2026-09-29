import {
    DynamicModule, Module 
} from "@nestjs/common"
import {
    AppConfigService,
} from "@modules/platform/config/index"
import {
    CqrsModule 
} from "@nestjs/cqrs"
import {
    ConfigurableModuleClass, OPTIONS_TYPE 
} from "./audit.module-definition"
import {
    AuditKeystoreService 
} from "./audit-keystore.service"
import {
    AuditLogService 
} from "./audit-log.service"
import {
    AuditErasureService 
} from "./audit-erasure.service"
import {
    AuditEventSubscriber 
} from "./audit-event.subscriber"
import {
    AuditOperatorGuard 
} from "./audit-operator.guard"
import {
    AUDIT_OPERATOR_SUBJECTS, AuditOperatorService
} from "./audit-operator.service"
import {
    AppendLogLineHandler 
} from "./append-log-line.handler"
import {
    RequestErasureHandler 
} from "./request-erasure.handler"
import {
    CompleteErasureHandler 
} from "./complete-erasure.handler"
import {
    AuditLogHandler 
} from "./audit-log.handler"
import {
    ExportMyDataHandler 
} from "./export-my-data.handler"

/**
 * The `audit` capability module, under nivo's `modules/domain/<capability>` shape - impl.audit
 * .todo-app-backend.log and impl.audit.todo-app-backend.erasure's real home, closing
 * gap.audit.unbuilt-module. Owns AuditKeystoreService, AuditLogService, AuditErasureService,
 * AuditEventSubscriber and every audit CQRS handler.
 *
 * No `TypeOrmModule.forFeature(...)` here, same as `domain/task`/`domain/session`: every service
 * reaches its entities through `@InjectPrimaryEntityManager()`. `PlatformEventsModule` is not imported
 * either - it is registered globally from `app.module.ts`, and `AuditEventSubscriber` injects
 * `PlatformEventBus` directly, exactly as `domain/session`'s sign-in/sign-out handlers inject it to
 * publish rather than subscribe.
 */
@Module({
    providers: [
        AppendLogLineHandler,
        RequestErasureHandler,
        CompleteErasureHandler,
        AuditLogHandler,
        ExportMyDataHandler,
    ],
})
/** Nest module wiring the audit capability's providers; the app composition root registers it - other modules never import it. */
export class AuditModule extends ConfigurableModuleClass {
    static register(options: typeof OPTIONS_TYPE = {
    }): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            imports: [CqrsModule],
            providers: [
                ...(base.providers ?? []),
                AuditKeystoreService,
                AuditLogService,
                AuditErasureService,
                AuditEventSubscriber,
                AuditOperatorGuard,
                AuditOperatorService,
                {
                    provide: AUDIT_OPERATOR_SUBJECTS,
                    inject: [AppConfigService],
                    useFactory: (config: AppConfigService): ReadonlyArray<string> => config.getAuditOperatorSubjects(),
                },
            ],
            exports: [AuditLogService,
                AuditErasureService,
                AuditKeystoreService],
        }
    }
}
